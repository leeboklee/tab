'use client'

import { useState, useRef, useEffect } from 'react'
import { Play, Pause, Square, RotateCcw, Volume2, VolumeX } from 'lucide-react'

interface MetronomeProps {
  tempo?: number
  onTempoChange?: (tempo: number) => void
}

export default function Metronome({ tempo = 120, onTempoChange }: MetronomeProps) {
  const [isPlaying, setIsPlaying] = useState(false)
  const [currentTempo, setCurrentTempo] = useState(tempo)
  const [volume, setVolume] = useState(0.7)
  const [isMuted, setIsMuted] = useState(false)
  const [beatCount, setBeatCount] = useState(0)
  const [timeSignature, setTimeSignature] = useState(4) // 4/4 박자
  const [accentBeat, setAccentBeat] = useState(1) // 첫 번째 박자에 액센트
  
  const audioContextRef = useRef<AudioContext | null>(null)
  const intervalRef = useRef<NodeJS.Timeout | null>(null)
  const beatIntervalRef = useRef<number | null>(null)

  useEffect(() => {
    if (typeof window !== 'undefined') {
      audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)()
    }
    
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
      }
      if (beatIntervalRef.current) {
        cancelAnimationFrame(beatIntervalRef.current)
      }
      if (audioContextRef.current) {
        audioContextRef.current.close()
      }
    }
  }, [])

  const playClick = (isAccent = false) => {
    if (!audioContextRef.current || isMuted) return

    const oscillator = audioContextRef.current.createOscillator()
    const gainNode = audioContextRef.current.createGain()
    
    oscillator.connect(gainNode)
    gainNode.connect(audioContextRef.current.destination)
    
    // 액센트는 더 높은 주파수와 더 큰 볼륨
    oscillator.frequency.setValueAtTime(isAccent ? 1000 : 800, audioContextRef.current.currentTime)
    oscillator.type = 'sine'
    
    const clickVolume = isAccent ? volume * 1.5 : volume * 0.8
    gainNode.gain.setValueAtTime(0, audioContextRef.current.currentTime)
    gainNode.gain.linearRampToValueAtTime(clickVolume, audioContextRef.current.currentTime + 0.01)
    gainNode.gain.exponentialRampToValueAtTime(0.001, audioContextRef.current.currentTime + 0.1)
    
    oscillator.start(audioContextRef.current.currentTime)
    oscillator.stop(audioContextRef.current.currentTime + 0.1)
  }

  const startMetronome = () => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current)
    }
    
    const beatInterval = 60000 / currentTempo // 밀리초 단위
    let currentBeat = 0
    
    intervalRef.current = setInterval(() => {
      const isAccent = currentBeat === 0
      playClick(isAccent)
      
      setBeatCount(prev => prev + 1)
      currentBeat = (currentBeat + 1) % timeSignature
    }, beatInterval)
  }

  const stopMetronome = () => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current)
      intervalRef.current = null
    }
    setBeatCount(0)
  }

  const togglePlayPause = () => {
    if (isPlaying) {
      stopMetronome()
      setIsPlaying(false)
    } else {
      startMetronome()
      setIsPlaying(true)
    }
  }

  const reset = () => {
    stopMetronome()
    setIsPlaying(false)
    setBeatCount(0)
  }

  const handleTempoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newTempo = parseInt(e.target.value)
    setCurrentTempo(newTempo)
    onTempoChange?.(newTempo)
    
    // 재생 중이면 새로운 템포로 다시 시작
    if (isPlaying) {
      stopMetronome()
      setTimeout(() => {
        startMetronome()
      }, 100)
    }
  }

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setVolume(parseFloat(e.target.value))
  }

  const toggleMute = () => {
    setIsMuted(!isMuted)
  }

  const handleTimeSignatureChange = (signature: number) => {
    setTimeSignature(signature)
    setBeatCount(0)
  }

  const handleAccentBeatChange = (beat: number) => {
    setAccentBeat(beat)
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h4 className="text-lg font-semibold text-gray-900">메트로놈</h4>
        <div className="flex items-center space-x-2">
          <span className="text-sm text-gray-600">박자: {beatCount}</span>
        </div>
      </div>

      <div className="flex items-center space-x-4">
        <button
          onClick={togglePlayPause}
          className="p-2 bg-primary-600 text-white rounded-full hover:bg-primary-700 transition-colors"
        >
          {isPlaying ? <Pause className="h-5 w-5" /> : <Play className="h-5 w-5" />}
        </button>
        
        <button
          onClick={reset}
          className="p-2 bg-gray-200 text-gray-700 rounded-full hover:bg-gray-300 transition-colors"
        >
          <RotateCcw className="h-4 w-4" />
        </button>
      </div>

      <div className="space-y-4">
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

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-700">박자</label>
            <div className="flex space-x-1">
              {[2, 3, 4, 6, 8].map(sig => (
                <button
                  key={sig}
                  onClick={() => handleTimeSignatureChange(sig)}
                  className={`px-3 py-1 text-xs rounded ${
                    timeSignature === sig
                      ? 'bg-primary-600 text-white'
                      : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                  }`}
                >
                  {sig}/4
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-700">액센트</label>
            <div className="flex space-x-1">
              {Array.from({ length: timeSignature }, (_, i) => i + 1).map(beat => (
                <button
                  key={beat}
                  onClick={() => handleAccentBeatChange(beat)}
                  className={`px-2 py-1 text-xs rounded ${
                    accentBeat === beat
                      ? 'bg-red-600 text-white'
                      : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                  }`}
                >
                  {beat}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="text-xs text-gray-500">
        <p>• 클릭하여 재생/일시정지</p>
        <p>• 템포와 박자 조절 가능</p>
        <p>• 첫 번째 박자에 액센트</p>
      </div>
    </div>
  )
}
