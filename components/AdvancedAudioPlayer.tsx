'use client'

import { useEffect, useRef, useState } from 'react'
import { Pause, Play, RotateCcw, Volume2, VolumeX } from 'lucide-react'

interface AdvancedAudioPlayerProps {
  audioUrl?: string
  tempo?: number
  tabs?: {
    measure: number
    frets: number[]
    notes: string[]
    technique: string
  }[]
  isPlaying?: boolean
  onPlay?: () => void
  onPause?: () => void
  onReset?: () => void
  compact?: boolean
  variant?: 'light' | 'dark'
}

export default function AdvancedAudioPlayer({
  audioUrl,
  tempo = 120,
  tabs = [],
  isPlaying: externalPlaying,
  onPlay,
  onPause,
  onReset,
  compact = false,
  variant = 'dark',
}: AdvancedAudioPlayerProps) {
  const audioRef = useRef<HTMLAudioElement>(null)
  const [isPlaying, setIsPlaying] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(0)
  const [volume, setVolume] = useState(0.85)
  const [isMuted, setIsMuted] = useState(false)
  const [loadError, setLoadError] = useState<string | null>(null)

  const playing = externalPlaying ?? isPlaying
  const isDark = variant === 'dark'

  useEffect(() => {
    const audio = audioRef.current
    if (!audio) return

    const onTimeUpdate = () => setCurrentTime(audio.currentTime)
    const onLoaded = () => {
      setDuration(audio.duration || 0)
      setLoadError(null)
    }
    const onEnded = () => {
      setIsPlaying(false)
      onPause?.()
    }
    const onError = () => setLoadError('음원을 불러오지 못했습니다.')

    audio.addEventListener('timeupdate', onTimeUpdate)
    audio.addEventListener('loadedmetadata', onLoaded)
    audio.addEventListener('ended', onEnded)
    audio.addEventListener('error', onError)

    return () => {
      audio.removeEventListener('timeupdate', onTimeUpdate)
      audio.removeEventListener('loadedmetadata', onLoaded)
      audio.removeEventListener('ended', onEnded)
      audio.removeEventListener('error', onError)
    }
  }, [audioUrl, onPause])

  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = isMuted ? 0 : volume
    }
  }, [volume, isMuted])

  const togglePlayPause = async () => {
    const audio = audioRef.current
    if (!audio || !audioUrl) return

    try {
      if (playing) {
        audio.pause()
        setIsPlaying(false)
        onPause?.()
      } else {
        await audio.play()
        setIsPlaying(true)
        onPlay?.()
      }
    } catch (error) {
      console.error('Audio play failed:', error)
      setLoadError('재생 권한이 필요합니다. 버튼을 다시 눌러주세요.')
    }
  }

  const handleReset = () => {
    const audio = audioRef.current
    if (audio) {
      audio.pause()
      audio.currentTime = 0
      setCurrentTime(0)
    }
    setIsPlaying(false)
    onReset?.()
    onPause?.()
  }

  const handleSeek = (value: number) => {
    const audio = audioRef.current
    if (!audio) return
    audio.currentTime = value
    setCurrentTime(value)
  }

  const formatTime = (seconds: number) => {
    if (!Number.isFinite(seconds)) return '0:00'
    const m = Math.floor(seconds / 60)
    const s = Math.floor(seconds % 60)
    return `${m}:${s.toString().padStart(2, '0')}`
  }

  const progress = duration > 0 ? (currentTime / duration) * 100 : 0

  const shellClass = isDark
    ? 'rounded-xl border border-white/8 bg-white/[0.03]'
    : 'rounded-lg border border-gray-200 bg-white/90'
  const titleClass = isDark ? 'text-sm font-medium text-white' : 'text-base font-semibold text-gray-900'
  const mutedClass = isDark ? 'text-xs text-white/45' : 'text-xs text-gray-500'
  const btnPrimary = isDark
    ? 'rounded-full bg-[#ff8a3d] p-2.5 text-white hover:bg-[#ff9f5a]'
    : 'rounded-full bg-blue-600 p-3 text-white hover:bg-blue-700'
  const btnSecondary = isDark
    ? 'rounded-full border border-white/10 bg-white/5 p-2.5 text-white/70 hover:bg-white/10'
    : 'rounded-full bg-gray-200 p-3 text-gray-700 hover:bg-gray-300'
  const rangeClass = isDark
    ? 'h-1.5 w-full cursor-pointer appearance-none rounded-full bg-white/10 accent-[#ff8a3d]'
    : 'h-2 w-full cursor-pointer appearance-none rounded-lg bg-gray-200'

  return (
    <div className={`${shellClass} ${compact ? 'p-3' : 'p-4'}`}>
      <div className={`flex items-center justify-between ${compact ? 'mb-2' : 'mb-3'}`}>
        <h3 className={`flex items-center gap-2 ${titleClass}`}>
          <Volume2 className="h-4 w-4 opacity-70" />
          음원 재생
        </h3>
        {!compact && (
          <span className={mutedClass}>{tempo} BPM · {tabs.length}마디</span>
        )}
      </div>

      {!audioUrl ? (
        <p className={`text-sm ${isDark ? 'text-white/45' : 'text-gray-500'}`}>
          분석된 음원이 없습니다. YouTube 추출 또는 업로드 후 재생됩니다.
        </p>
      ) : (
        <>
          {loadError && (
            <p className={`mb-2 text-sm ${isDark ? 'text-red-400' : 'text-red-600'}`}>{loadError}</p>
          )}

          <div className={`flex items-center gap-2 ${compact ? '' : 'justify-center gap-3'}`}>
            <button
              onClick={() => void togglePlayPause()}
              className={btnPrimary}
              title={playing ? '일시정지' : '재생'}
            >
              {playing ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
            </button>
            <button onClick={handleReset} className={btnSecondary} title="처음으로">
              <RotateCcw className="h-4 w-4" />
            </button>
            <button
              onClick={() => setIsMuted(!isMuted)}
              className={btnSecondary}
              title={isMuted ? '음소거 해제' : '음소거'}
            >
              {isMuted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
            </button>
            <div className={`ml-auto flex items-center gap-2 text-xs ${mutedClass}`}>
              <span>{formatTime(currentTime)}</span>
              <span>/</span>
              <span>{formatTime(duration)}</span>
            </div>
          </div>

          <input
            type="range"
            min={0}
            max={duration || 0}
            step={0.1}
            value={currentTime}
            onChange={(e) => handleSeek(Number(e.target.value))}
            className={`mt-2 ${rangeClass}`}
          />
          {!compact && (
            <input
              type="range"
              min={0}
              max={1}
              step={0.05}
              value={isMuted ? 0 : volume}
              onChange={(e) => setVolume(Number(e.target.value))}
              className={`mt-2 ${rangeClass}`}
            />
          )}

          <audio ref={audioRef} src={audioUrl} preload="metadata" className="hidden" />
        </>
      )}
    </div>
  )
}
