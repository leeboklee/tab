'use client'

import { useState, useRef, useEffect } from 'react'
import { Play, Pause, Volume2, VolumeX, RotateCcw, SkipBack, SkipForward } from 'lucide-react'

interface AdvancedAudioPlayerProps {
  audioUrl?: string
  tempo?: number
  onTempoChange?: (tempo: number) => void
}

export default function AdvancedAudioPlayer({ audioUrl, tempo = 120, onTempoChange }: AdvancedAudioPlayerProps) {
  const [isPlaying, setIsPlaying] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(0)
  const [volume, setVolume] = useState(1)
  const [isMuted, setIsMuted] = useState(false)
  const [playbackRate, setPlaybackRate] = useState(1)
  const [currentTempo, setCurrentTempo] = useState(tempo)
  
  const audioRef = useRef<HTMLAudioElement>(null)

  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.addEventListener('timeupdate', handleTimeUpdate)
      audioRef.current.addEventListener('loadedmetadata', handleLoadedMetadata)
      audioRef.current.addEventListener('ended', handleEnded)
      
      return () => {
        audioRef.current?.removeEventListener('timeupdate', handleTimeUpdate)
        audioRef.current?.removeEventListener('loadedmetadata', handleLoadedMetadata)
        audioRef.current?.removeEventListener('ended', handleEnded)
      }
    }
  }, [])

  const handleTimeUpdate = () => {
    if (audioRef.current) {
      setCurrentTime(audioRef.current.currentTime)
    }
  }

  const handleLoadedMetadata = () => {
    if (audioRef.current) {
      setDuration(audioRef.current.duration)
    }
  }

  const handleEnded = () => {
    setIsPlaying(false)
  }

  const togglePlayPause = () => {
    if (audioRef.current) {
      if (isPlaying) {
        audioRef.current.pause()
      } else {
        audioRef.current.play()
      }
      setIsPlaying(!isPlaying)
    }
  }

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newTime = parseFloat(e.target.value)
    if (audioRef.current) {
      audioRef.current.currentTime = newTime
      setCurrentTime(newTime)
    }
  }

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newVolume = parseFloat(e.target.value)
    setVolume(newVolume)
    if (audioRef.current) {
      audioRef.current.volume = newVolume
    }
  }

  const toggleMute = () => {
    if (audioRef.current) {
      audioRef.current.muted = !isMuted
      setIsMuted(!isMuted)
    }
  }

  const handlePlaybackRateChange = (rate: number) => {
    setPlaybackRate(rate)
    if (audioRef.current) {
      audioRef.current.playbackRate = rate
    }
  }

  const handleTempoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newTempo = parseInt(e.target.value)
    setCurrentTempo(newTempo)
    onTempoChange?.(newTempo)
  }

  const formatTime = (time: number) => {
    const minutes = Math.floor(time / 60)
    const seconds = Math.floor(time % 60)
    return `${minutes}:${seconds.toString().padStart(2, '0')}`
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center space-x-4">
        <button
          onClick={togglePlayPause}
          className="p-2 bg-primary-600 text-white rounded-full hover:bg-primary-700 transition-colors"
        >
          {isPlaying ? <Pause className="h-5 w-5" /> : <Play className="h-5 w-5" />}
        </button>
        
        <button className="p-2 bg-gray-200 text-gray-700 rounded-full hover:bg-gray-300 transition-colors">
          <SkipBack className="h-4 w-4" />
        </button>
        
        <button className="p-2 bg-gray-200 text-gray-700 rounded-full hover:bg-gray-300 transition-colors">
          <SkipForward className="h-4 w-4" />
        </button>
        
        <button className="p-2 bg-gray-200 text-gray-700 rounded-full hover:bg-gray-300 transition-colors">
          <RotateCcw className="h-4 w-4" />
        </button>
      </div>

      <div className="space-y-2">
        <div className="flex items-center space-x-2">
          <span className="text-sm text-gray-600 w-12">{formatTime(currentTime)}</span>
          <input
            type="range"
            min="0"
            max={duration || 0}
            value={currentTime}
            onChange={handleSeek}
            className="flex-1 h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
          />
          <span className="text-sm text-gray-600 w-12">{formatTime(duration)}</span>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <label className="text-sm font-medium text-gray-700">볼륨</label>
          <div className="flex items-center space-x-2">
            <button onClick={toggleMute} className="p-1">
              {isMuted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
            </button>
            <input
              type="range"
              min="0"
              max="1"
              step="0.1"
              value={isMuted ? 0 : volume}
              onChange={handleVolumeChange}
              className="flex-1 h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
            />
            <span className="text-sm text-gray-600 w-8">{Math.round((isMuted ? 0 : volume) * 100)}%</span>
          </div>
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium text-gray-700">재생 속도</label>
          <div className="flex space-x-1">
            {[0.5, 0.75, 1, 1.25, 1.5].map(rate => (
              <button
                key={rate}
                onClick={() => handlePlaybackRateChange(rate)}
                className={`px-2 py-1 text-xs rounded ${
                  playbackRate === rate 
                    ? 'bg-primary-600 text-white' 
                    : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                }`}
              >
                {rate}x
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="space-y-2">
        <label className="text-sm font-medium text-gray-700">템포 (BPM)</label>
        <div className="flex items-center space-x-2">
          <input
            type="range"
            min="60"
            max="200"
            value={currentTempo}
            onChange={handleTempoChange}
            className="flex-1 h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
          />
          <span className="text-sm text-gray-600 w-12">{currentTempo} BPM</span>
        </div>
      </div>

      {audioUrl && (
        <audio
          ref={audioRef}
          src={audioUrl}
          preload="metadata"
          className="hidden"
        />
      )}
    </div>
  )
}
