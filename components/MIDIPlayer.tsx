'use client'

import { useRef, useState } from 'react'
import { Download, Music, Pause, Play } from 'lucide-react'

interface MIDIPlayerProps {
  tabs: {
    measure: number
    frets: number[]
    notes: string[]
    technique: string
  }[]
  tempo: number
}

const BASE_MIDI = [40, 45, 50, 55, 59, 64]

function midiNote(stringIndex: number, fret: number): number {
  return BASE_MIDI[stringIndex] + fret
}

export default function MIDIPlayer({ tabs, tempo }: MIDIPlayerProps) {
  const [isPlaying, setIsPlaying] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const stopRef = useRef<(() => void) | null>(null)

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

  return (
    <div className="rounded-lg border border-gray-200 bg-white/90 p-4">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="flex items-center gap-2 text-base font-semibold text-gray-900">
          <Music className="h-4 w-4" />
          탭 미리듣기
        </h3>
        <span className="text-xs text-gray-500">{tempo} BPM</span>
      </div>

      <div className="flex items-center justify-center gap-3">
        <button
          onClick={() => void playTabPreview()}
          disabled={isLoading || tabs.length === 0}
          className="rounded-full bg-indigo-600 p-3 text-white hover:bg-indigo-700 disabled:opacity-40"
          title={isPlaying ? '정지' : '탭 소리 재생'}
        >
          {isLoading ? (
            <span className="block h-5 w-5 animate-spin rounded-full border-2 border-white/30 border-t-white" />
          ) : isPlaying ? (
            <Pause className="h-5 w-5" />
          ) : (
            <Play className="h-5 w-5" />
          )}
        </button>
        <button
          onClick={() => void downloadMidi()}
          disabled={isLoading || tabs.length === 0}
          className="rounded-full bg-gray-200 p-3 text-gray-700 hover:bg-gray-300 disabled:opacity-40"
          title="MIDI 다운로드"
        >
          <Download className="h-5 w-5" />
        </button>
      </div>

      <p className="mt-3 text-center text-xs text-gray-500">
        실제 곡은 위 추출 음원 재생을 사용하세요. 여기는 탭 음정 미리듣기입니다.
      </p>
    </div>
  )
}
