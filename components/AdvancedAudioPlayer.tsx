'use client'

import { useState, useEffect, useRef } from 'react'
import { Play, Pause, RotateCcw, Volume2, VolumeX, Settings } from 'lucide-react'
import { motion } from 'framer-motion'

interface AdvancedAudioPlayerProps {
  tabs: {
    measure: number
    frets: number[]
    notes: string[]
    technique: string
  }[]
  tempo: number
  isPlaying: boolean
  onPlay: () => void
  onPause: () => void
  onReset: () => void
}

export default function AdvancedAudioPlayer({ 
  tabs, 
  tempo, 
  isPlaying, 
  onPlay, 
  onPause, 
  onReset 
}: AdvancedAudioPlayerProps) {
  const [volume, setVolume] = useState(0.7)
  const [isMuted, setIsMuted] = useState(false)
  const [showSettings, setShowSettings] = useState(false)
  const [audioContext, setAudioContext] = useState<AudioContext | null>(null)
  const [gainNode, setGainNode] = useState<GainNode | null>(null)
  const [reverbNode, setReverbNode] = useState<ConvolverNode | null>(null)
  const [distortionNode, setDistortionNode] = useState<WaveShaperNode | null>(null)
  const [currentBeat, setCurrentBeat] = useState(0)
  const intervalRef = useRef<NodeJS.Timeout | null>(null)

  // 오디오 컨텍스트 초기화
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const ctx = new (window.AudioContext || (window as any).webkitAudioContext)()
      setAudioContext(ctx)
      
      // 게인 노드 생성
      const gain = ctx.createGain()
      gain.gain.setValueAtTime(volume, ctx.currentTime)
      setGainNode(gain)
      
      // 리버브 노드 생성
      const reverb = ctx.createConvolver()
      createReverbImpulse(ctx, reverb)
      setReverbNode(reverb)
      
      // 디스토션 노드 생성
      const distortion = ctx.createWaveShaper()
      distortion.curve = makeDistortionCurve(20)
      distortion.oversample = '4x'
      setDistortionNode(distortion)
      
      // 오디오 그래프 연결
      gain.connect(reverb)
      reverb.connect(distortion)
      distortion.connect(ctx.destination)
    }
  }, [])

  // 리버브 임펄스 생성
  const createReverbImpulse = (ctx: AudioContext, reverb: ConvolverNode) => {
    const length = ctx.sampleRate * 2
    const impulse = ctx.createBuffer(2, length, ctx.sampleRate)
    
    for (let channel = 0; channel < 2; channel++) {
      const channelData = impulse.getChannelData(channel)
      for (let i = 0; i < length; i++) {
        channelData[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / length, 2)
      }
    }
    
    reverb.buffer = impulse
  }

  // 디스토션 커브 생성
  const makeDistortionCurve = (amount: number) => {
    const samples = 44100
    const curve = new Float32Array(samples)
    const deg = Math.PI / 180
    
    for (let i = 0; i < samples; i++) {
      const x = (i * 2) / samples - 1
      curve[i] = ((3 + amount) * x * 20 * deg) / (Math.PI + amount * Math.abs(x))
    }
    
    return curve
  }

  // 기타 소리 생성 (고급)
  const generateGuitarSound = (fret: number, stringIndex: number, technique: string) => {
    if (!audioContext || !gainNode || !reverbNode || !distortionNode) return

    const oscillator = audioContext.createOscillator()
    const envelope = audioContext.createGain()
    const filter = audioContext.createBiquadFilter()
    
    // 기타 줄의 기본 주파수
    const baseFrequencies = [82.41, 110.00, 146.83, 196.00, 246.94, 329.63] // E, A, D, G, B, E
    const frequency = baseFrequencies[stringIndex] * Math.pow(2, fret / 12)
    
    oscillator.frequency.setValueAtTime(frequency, audioContext.currentTime)
    
    // 기법에 따른 오실레이터 타입 설정
    switch (technique) {
      case 'hammer-on':
        oscillator.type = 'sawtooth'
        break
      case 'pull-off':
        oscillator.type = 'triangle'
        break
      case 'slide':
        oscillator.type = 'sine'
        break
      case 'bend':
        oscillator.type = 'sawtooth'
        // 벤드 효과
        oscillator.frequency.exponentialRampToValueAtTime(
          frequency * 1.1, 
          audioContext.currentTime + 0.1
        )
        break
      case 'vibrato':
        oscillator.type = 'sine'
        // 비브라토 효과
        const lfo = audioContext.createOscillator()
        const lfoGain = audioContext.createGain()
        lfo.frequency.setValueAtTime(5, audioContext.currentTime)
        lfoGain.gain.setValueAtTime(5, audioContext.currentTime)
        lfo.connect(lfoGain)
        lfoGain.connect(oscillator.frequency)
        lfo.start()
        lfo.stop(audioContext.currentTime + 1)
        break
      default:
        oscillator.type = 'sawtooth'
    }
    
    // 필터 설정 (기타 특성)
    filter.type = 'lowpass'
    filter.frequency.setValueAtTime(2000, audioContext.currentTime)
    filter.Q.setValueAtTime(1, audioContext.currentTime)
    
    // 엔벨로프 설정
    const now = audioContext.currentTime
    envelope.gain.setValueAtTime(0, now)
    envelope.gain.linearRampToValueAtTime(volume * 0.3, now + 0.01)
    envelope.gain.exponentialRampToValueAtTime(0.01, now + 0.5)
    
    // 오디오 그래프 연결
    oscillator.connect(filter)
    filter.connect(envelope)
    envelope.connect(gainNode)
    
    oscillator.start(now)
    oscillator.stop(now + 0.5)
  }

  // 재생/정지 핸들러
  const handlePlayPause = () => {
    if (isPlaying) {
      onPause()
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
      }
    } else {
      onPlay()
      const beatInterval = 60000 / tempo
      
      intervalRef.current = setInterval(() => {
        setCurrentBeat(prev => {
          const nextBeat = prev + 1
          if (nextBeat >= tabs.length) {
            onPause()
            if (intervalRef.current) {
              clearInterval(intervalRef.current)
            }
            return 0
          }
          
          // 현재 마디의 기타 소리 재생
          if (tabs[nextBeat]) {
            tabs[nextBeat].frets.forEach((fret, stringIndex) => {
              if (fret > 0) {
                generateGuitarSound(fret, stringIndex, tabs[nextBeat].technique)
              }
            })
          }
          
          return nextBeat
        })
      }, beatInterval)
    }
  }

  // 리셋 핸들러
  const handleReset = () => {
    setCurrentBeat(0)
    onReset()
    if (intervalRef.current) {
      clearInterval(intervalRef.current)
    }
  }

  // 볼륨 변경
  useEffect(() => {
    if (gainNode) {
      gainNode.gain.setValueAtTime(isMuted ? 0 : volume, audioContext?.currentTime || 0)
    }
  }, [volume, isMuted, gainNode, audioContext])

  return (
    <div className="bg-white/80 backdrop-blur-sm rounded-lg p-4 border border-gray-200">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-gray-900 flex items-center">
          <Volume2 className="h-5 w-5 mr-2" />
          고급 오디오 플레이어
        </h3>
        <button
          onClick={() => setShowSettings(!showSettings)}
          className="p-2 rounded-full bg-gray-100 text-gray-600 hover:bg-gray-200 transition-colors"
          title="설정"
        >
          <Settings className="h-4 w-4" />
        </button>
      </div>

      {/* 컨트롤 버튼들 */}
      <div className="flex items-center justify-center space-x-4 mb-4">
        <button
          onClick={handlePlayPause}
          className="bg-primary-600 hover:bg-primary-700 text-white rounded-full p-4 transition-colors duration-200"
          title={isPlaying ? "정지" : "재생"}
        >
          {isPlaying ? <Pause className="h-6 w-6" /> : <Play className="h-6 w-6" />}
        </button>
        
        <button
          onClick={handleReset}
          className="bg-gray-200 hover:bg-gray-300 text-gray-700 rounded-full p-4 transition-colors duration-200"
          title="처음으로"
        >
          <RotateCcw className="h-6 w-6" />
        </button>
        
        <button
          onClick={() => setIsMuted(!isMuted)}
          className={`p-4 rounded-full transition-colors ${
            isMuted ? 'bg-red-100 text-red-600' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
          }`}
          title={isMuted ? '음소거 해제' : '음소거'}
        >
          {isMuted ? <VolumeX className="h-6 w-6" /> : <Volume2 className="h-6 w-6" />}
        </button>
      </div>

      {/* 진행률 표시 */}
      <div className="mb-4">
        <div className="flex justify-between text-sm text-gray-600 mb-2">
          <span>진행률</span>
          <span>{tabs.length > 0 ? Math.round((currentBeat / tabs.length) * 100) : 0}%</span>
        </div>
        <div className="w-full bg-gray-200 rounded-full h-2">
          <motion.div
            className="bg-primary-600 h-2 rounded-full"
            initial={{ width: 0 }}
            animate={{ width: `${tabs.length > 0 ? (currentBeat / tabs.length) * 100 : 0}%` }}
            transition={{ duration: 0.3 }}
          />
        </div>
      </div>

      {/* 설정 패널 */}
      <motion.div
        initial={false}
        animate={{ height: showSettings ? 'auto' : 0, opacity: showSettings ? 1 : 0 }}
        className="overflow-hidden"
      >
        <div className="space-y-4 pt-4 border-t border-gray-200">
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

          {/* 오디오 효과 정보 */}
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div className="bg-blue-50 p-3 rounded-lg">
              <h4 className="font-medium text-blue-900">리버브</h4>
              <p className="text-blue-700">홀 효과</p>
            </div>
            <div className="bg-purple-50 p-3 rounded-lg">
              <h4 className="font-medium text-purple-900">디스토션</h4>
              <p className="text-purple-700">기타 앰프 효과</p>
            </div>
          </div>
        </div>
      </motion.div>

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
