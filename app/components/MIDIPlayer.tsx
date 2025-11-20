'use client'

import { useState, useRef, useEffect } from 'react'
import { Play, Pause, Square, RotateCcw, Volume2, Settings } from 'lucide-react'

interface MIDIPlayerProps {
  midiData?: any
  tempo?: number
  onTempoChange?: (tempo: number) => void
}

export default function MIDIPlayer({ midiData, tempo = 120, onTempoChange }: MIDIPlayerProps) {
  const [isPlaying, setIsPlaying] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(0)
  const [volume, setVolume] = useState(0.8)
  const [currentTempo, setCurrentTempo] = useState(tempo)
  const [selectedTrack, setSelectedTrack] = useState(0)
  const [isLooping, setIsLooping] = useState(false)
  
  const audioContextRef = useRef<AudioContext | null>(null)
  const animationFrameRef = useRef<number | null>(null)

  useEffect(() => {
    // MIDI 시뮬레이션을 위한 오디오 컨텍스트 초기화
    if (typeof window !== 'undefined') {
      audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)()
    }
    
    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current)
      }
      if (audioContextRef.current) {
        audioContextRef.current.close()
      }
    }
  }, [])

  const generateMIDITone = (frequency: number, duration: number, startTime: number) => {
    if (!audioContextRef.current) return

    const oscillator = audioContextRef.current.createOscillator()
    const gainNode = audioContextRef.current.createGain()
    
    oscillator.connect(gainNode)
    gainNode.connect(audioContextRef.current.destination)
    
    oscillator.frequency.setValueAtTime(frequency, startTime)
    oscillator.type = 'sine'
    
    gainNode.gain.setValueAtTime(0, startTime)
    gainNode.gain.linearRampToValueAtTime(volume * 0.3, startTime + 0.01)
    gainNode.gain.exponentialRampToValueAtTime(0.001, startTime + duration)
    
    oscillator.start(startTime)
    oscillator.stop(startTime + duration)
  }

  const playMIDISequence = () => {
    if (!audioContextRef.current || !midiData) return

    const tracks = midiData.tracks || []
    const currentTrack = tracks[selectedTrack] || []
    
    currentTrack.forEach((note: any, index: number) => {
      if (note.type === 'noteOn') {
        const startTime = audioContextRef.current!.currentTime + (index * 60 / currentTempo / 4)
        const duration = 60 / currentTempo / 2 // 8분음표 길이
        const frequency = 440 * Math.pow(2, (note.noteNumber - 69) / 12) // A4 = 440Hz
        
        generateMIDITone(frequency, duration, startTime)
      }
    })
  }

  const togglePlayPause = () => {
    if (isPlaying) {
      setIsPlaying(false)
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current)
      }
    } else {
      setIsPlaying(true)
      playMIDISequence()
      startTimeUpdate()
    }
  }

  const stop = () => {
    setIsPlaying(false)
    setCurrentTime(0)
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current)
    }
  }

  const reset = () => {
    stop()
    setCurrentTime(0)
  }

  const startTimeUpdate = () => {
    const updateTime = () => {
      if (isPlaying) {
        setCurrentTime(prev => {
          const newTime = prev + 0.1
          if (newTime >= duration) {
            if (isLooping) {
              return 0
            } else {
              setIsPlaying(false)
              return duration
            }
          }
          return newTime
        })
        animationFrameRef.current = requestAnimationFrame(updateTime)
      }
    }
    updateTime()
  }

  const handleTempoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newTempo = parseInt(e.target.value)
    setCurrentTempo(newTempo)
    onTempoChange?.(newTempo)
  }

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setVolume(parseFloat(e.target.value))
  }

  const formatTime = (time: number) => {
    const minutes = Math.floor(time / 60)
    const seconds = Math.floor(time % 60)
    return `${minutes}:${seconds.toString().padStart(2, '0')}`
  }

  // 시뮬레이션용 MIDI 데이터 생성
  const simulatedMIDIData = {
    tracks: [
      // 트랙 1: 멜로디
      Array.from({ length: 32 }, (_, i) => ({
        type: 'noteOn',
        noteNumber: 60 + (i % 12), // C4부터 시작
        velocity: 80,
        time: i * 60 / currentTempo / 4
      })),
      // 트랙 2: 베이스
      Array.from({ length: 16 }, (_, i) => ({
        type: 'noteOn',
        noteNumber: 36 + (i % 4) * 2, // 베이스 라인
        velocity: 90,
        time: i * 60 / currentTempo / 2
      }))
    ]
  }

  const currentMIDIData = midiData || simulatedMIDIData

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h4 className="text-lg font-semibold text-gray-900">MIDI 플레이어</h4>
        <div className="flex items-center space-x-2">
          <button
            onClick={() => setIsLooping(!isLooping)}
            className={`px-3 py-1 text-xs rounded ${
              isLooping ? 'bg-primary-600 text-white' : 'bg-gray-200 text-gray-700'
            }`}
          >
            반복
          </button>
          <button className="p-1 text-gray-600 hover:text-gray-800">
            <Settings className="h-4 w-4" />
          </button>
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
          onClick={stop}
          className="p-2 bg-gray-200 text-gray-700 rounded-full hover:bg-gray-300 transition-colors"
        >
          <Square className="h-4 w-4" />
        </button>
        
        <button
          onClick={reset}
          className="p-2 bg-gray-200 text-gray-700 rounded-full hover:bg-gray-300 transition-colors"
        >
          <RotateCcw className="h-4 w-4" />
        </button>
      </div>

      <div className="space-y-2">
        <div className="flex items-center space-x-2">
          <span className="text-sm text-gray-600 w-12">{formatTime(currentTime)}</span>
          <input
            type="range"
            min="0"
            max={duration || 30}
            value={currentTime}
            className="flex-1 h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
            readOnly
          />
          <span className="text-sm text-gray-600 w-12">{formatTime(duration || 30)}</span>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <label className="text-sm font-medium text-gray-700">볼륨</label>
          <div className="flex items-center space-x-2">
            <Volume2 className="h-4 w-4 text-gray-600" />
            <input
              type="range"
              min="0"
              max="1"
              step="0.1"
              value={volume}
              onChange={handleVolumeChange}
              className="flex-1 h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
            />
            <span className="text-sm text-gray-600 w-8">{Math.round(volume * 100)}%</span>
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
      </div>

      <div className="space-y-2">
        <label className="text-sm font-medium text-gray-700">트랙 선택</label>
        <div className="flex space-x-2">
          {currentMIDIData.tracks?.map((track: unknown, index: number) => (
            <button
              key={index}
              onClick={() => setSelectedTrack(index)}
              className={`px-3 py-1 text-xs rounded ${
                selectedTrack === index
                  ? 'bg-primary-600 text-white'
                  : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
              }`}
            >
              트랙 {index + 1}
            </button>
          ))}
        </div>
      </div>

      <div className="text-xs text-gray-500">
        <p>• MIDI 시뮬레이션 모드 (실제 MIDI 파일이 없을 때)</p>
        <p>• 클릭하여 재생/일시정지</p>
        <p>• 템포와 볼륨 조절 가능</p>
      </div>
    </div>
  )
}
