'use client'

import { useRef, useState } from 'react'
import { Download, Guitar, Pause, Play } from 'lucide-react'

interface MIDIPlayerProps {
  tabs: {
    measure: number
    frets: number[]
    notes: string[]
    technique: string
  }[]
  tempo: number
  compact?: boolean
  variant?: 'light' | 'dark'
}

const BASE_MIDI = [40, 45, 50, 55, 59, 64]

function midiNote(stringIndex: number, fret: number): number {
  return BASE_MIDI[stringIndex] + fret
}

export default function MIDIPlayer({ tabs, tempo, compact = false, variant = 'dark' }: MIDIPlayerProps) {
  const [isPlaying, setIsPlaying] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const stopRef = useRef<(() => void) | null>(null)

  const isDark = variant === 'dark'

  const stopPlayback = () => {
    stopRef.current?.()
    stopRef.current = null
    setIsPlaying(false)
  }

  const playTabPreview = async () => {
    if (isPlaying) {
      stopPlayback()
      return
    }

    setIsLoading(true)
    try {
      const Tone = await import('tone')
      await Tone.start()

      const synth = new Tone.PolySynth(Tone.Synth, {
        oscillator: { type: 'triangle' },
        envelope: { attack: 0.01, decay: 0.2, sustain: 0.1, release: 0.3 },
      }).toDestination()

      const beatSec = 60 / tempo
      let cancelled = false
      stopRef.current = () => {
        cancelled = true
        synth.dispose()
        Tone.Transport.stop()
        Tone.Transport.cancel()
      }

      tabs.forEach((tab, beatIndex) => {
        tab.frets.forEach((fret, stringIndex) => {
          if (fret < 0) return
          const note = Tone.Frequency(midiNote(stringIndex, fret), 'midi').toNote()
          Tone.Transport.schedule((time) => {
            if (!cancelled) synth.triggerAttackRelease(note, '8n', time)
          }, beatIndex * beatSec)
        })
      })

      Tone.Transport.bpm.value = tempo
      Tone.Transport.start()
      setIsPlaying(true)

      window.setTimeout(() => {
        if (!cancelled) stopPlayback()
      }, tabs.length * beatSec * 1000 + 500)
    } catch (error) {
      console.error('Tab preview play failed:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const downloadMidi = async () => {
    setIsLoading(true)
    try {
      const { Midi } = await import('@tonejs/midi')
      const midi = new Midi()
      const track = midi.addTrack()
      midi.header.setTempo(tempo)

      tabs.forEach((tab, beatIndex) => {
        const startTime = beatIndex * (60 / tempo)
        tab.frets.forEach((fret, stringIndex) => {
          if (fret < 0) return
          track.addNote({
            midi: midiNote(stringIndex, fret),
            time: startTime,
            duration: 0.4,
            velocity: 0.7,
          })
        })
      })

      const blob = new Blob([midi.toArray()], { type: 'audio/midi' })
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = 'guitar-tab.mid'
      link.click()
      URL.revokeObjectURL(url)
    } catch (error) {
      console.error('MIDI export failed:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const shellClass = isDark
    ? 'rounded-xl border border-white/8 bg-white/[0.03]'
    : 'rounded-lg border border-gray-200 bg-white/90'
  const titleClass = isDark ? 'text-sm font-medium text-white' : 'text-base font-semibold text-gray-900'
  const btnPrimary = isDark
    ? 'rounded-full bg-white/10 p-2.5 text-white hover:bg-white/15 disabled:opacity-40'
    : 'rounded-full bg-indigo-600 p-3 text-white hover:bg-indigo-700 disabled:opacity-40'
  const btnSecondary = isDark
    ? 'rounded-full border border-white/10 bg-white/5 p-2.5 text-white/70 hover:bg-white/10 disabled:opacity-40'
    : 'rounded-full bg-gray-200 p-3 text-gray-700 hover:bg-gray-300 disabled:opacity-40'

  return (
    <div className={`${shellClass} ${compact ? 'p-3' : 'p-4'}`}>
      <div className={`flex items-center justify-between ${compact ? 'mb-2' : 'mb-3'}`}>
        <h3 className={`flex items-center gap-2 ${titleClass}`}>
          <Guitar className="h-4 w-4 opacity-70" />
          탭 미리듣기
        </h3>
        {!compact && <span className={`text-xs ${isDark ? 'text-white/45' : 'text-gray-500'}`}>{tempo} BPM</span>}
      </div>

      <div className="flex items-center gap-2">
        <button
          onClick={() => void playTabPreview()}
          disabled={isLoading || tabs.length === 0}
          className={btnPrimary}
          title={isPlaying ? '정지' : '탭 소리 재생'}
        >
          {isLoading ? (
            <span className="block h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
          ) : isPlaying ? (
            <Pause className="h-4 w-4" />
          ) : (
            <Play className="h-4 w-4" />
          )}
        </button>
        <button
          onClick={() => void downloadMidi()}
          disabled={isLoading || tabs.length === 0}
          className={btnSecondary}
          title="MIDI 다운로드"
        >
          <Download className="h-4 w-4" />
        </button>
        <p className={`ml-1 text-xs ${isDark ? 'text-white/40' : 'text-gray-500'}`}>
          탭 음정만 간단히 들어보기
        </p>
      </div>
    </div>
  )
}
