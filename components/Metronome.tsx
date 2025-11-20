'use client'

import { useState, useEffect, useRef } from 'react'
import { Play, Pause, Volume2, VolumeX } from 'lucide-react'
import { motion } from 'framer-motion'

interface MetronomeProps {
  tempo: number
  isPlaying: boolean
  onTempoChange: (tempo: number) => void
}

export default function Metronome({ tempo, isPlaying, onTempoChange }: MetronomeProps) {
  const [isMetronomeOn, setIsMetronomeOn] = useState(false)
  const [volume, setVolume] = useState(0.5)
  const [isMuted, setIsMuted] = useState(false)
  const intervalRef = useRef<NodeJS.Timeout | null>(null)
  const audioContextRef = useRef<AudioContext | null>(null)

  // 오디오 컨텍스트 초기화
  useEffect(() => {
    if (typeof window !== 'undefined') {
      audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)()
    }
  }, [])

  // 메트로놈 소리 생성
  const playMetronomeClick = () => {
    if (!audioContextRef.current || isMuted) return

    const oscillator = audioContextRef.current.createOscillator()
    const gainNode = audioContextRef.current.createGain()
    
    // 메트로놈 클릭 소리 (800Hz)
    oscillator.frequency.setValueAtTime(800, audioContextRef.current!.currentTime)
    oscillator.type = 'sine'
    
    gainNode.gain.setValueAtTime(volume * 0.3, audioContextRef.current!.currentTime)
    gainNode.gain.exponentialRampToValueAtTime(0.01, audioContextRef.current!.currentTime + 0.1)
    
    oscillator.connect(gainNode)
    gainNode.connect(audioContextRef.current.destination)
    
    oscillator.start(audioContextRef.current!.currentTime)
    oscillator.stop(audioContextRef.current!.currentTime + 0.1)
  }

  // 메트로놈 시작/정지
  useEffect(() => {
    if (isMetronomeOn && isPlaying) {
      const interval = 60000 / tempo // BPM을 밀리초로 변환
      intervalRef.current = setInterval(playMetronomeClick, interval)
    } else {
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
      }
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
      }
    }
  }, [isMetronomeOn, isPlaying, tempo, volume, isMuted])

  const handleMetronomeToggle = () => {
    setIsMetronomeOn(!isMetronomeOn)
  }

  const handleMuteToggle = () => {
    setIsMuted(!isMuted)
  }

  return (
    <div className="bg-white/80 backdrop-blur-sm rounded-lg p-4 border border-gray-200">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-gray-900 flex items-center">
          <Volume2 className="h-5 w-5 mr-2" />
          메트로놈
        </h3>
        <div className="flex items-center space-x-2">
          <button
            onClick={handleMuteToggle}
            className={`p-2 rounded-full transition-colors ${
              isMuted ? 'bg-red-100 text-red-600' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
            title={isMuted ? '음소거 해제' : '음소거'}
          >
            {isMuted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
          </button>
          <button
            onClick={handleMetronomeToggle}
            className={`p-2 rounded-full transition-colors ${
              isMetronomeOn ? 'bg-primary-100 text-primary-600' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
            title={isMetronomeOn ? '메트로놈 정지' : '메트로놈 시작'}
          >
            {isMetronomeOn ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
          </button>
        </div>
      </div>

      <div className="space-y-4">
        {/* 템포 조절 */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            템포: {tempo} BPM
          </label>
          <input
            type="range"
            min="60"
            max="200"
            value={tempo}
            onChange={(e) => onTempoChange(Number(e.target.value))}
            className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer slider"
          />
          <div className="flex justify-between text-xs text-gray-500 mt-1">
            <span>60</span>
            <span>130</span>
            <span>200</span>
          </div>
        </div>

        {/* 볼륨 조절 */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            볼륨: {Math.round(volume * 100)}%
          </label>
          <input
            type="range"
            min="0"
            max="1"
            step="0.1"
            value={volume}
            onChange={(e) => setVolume(Number(e.target.value))}
            className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer slider"
          />
        </div>

        {/* 상태 표시 */}
        <div className="flex items-center justify-center">
          <motion.div
            className={`w-3 h-3 rounded-full ${
              isMetronomeOn && isPlaying ? 'bg-green-500' : 'bg-gray-300'
            }`}
            animate={{
              scale: isMetronomeOn && isPlaying ? [1, 1.2, 1] : 1,
            }}
            transition={{
              duration: 60 / tempo,
              repeat: isMetronomeOn && isPlaying ? Infinity : 0,
            }}
          />
          <span className="ml-2 text-sm text-gray-600">
            {isMetronomeOn && isPlaying ? '메트로놈 재생 중' : '메트로놈 정지'}
          </span>
        </div>
      </div>

      <style jsx>{`
        .slider::-webkit-slider-thumb {
          appearance: none;
          height: 20px;
          width: 20px;
          border-radius: 50%;
          background: #3b82f6;
          cursor: pointer;
          box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
        }
        .slider::-moz-range-thumb {
          height: 20px;
          width: 20px;
          border-radius: 50%;
          background: #3b82f6;
          cursor: pointer;
          border: none;
          box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
        }
      `}</style>
    </div>
  )
}
