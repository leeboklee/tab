'use client'

import { useState, useRef, useEffect } from 'react'
import { Download, Play, Pause, RotateCcw, ToggleLeft, ToggleRight, Music } from 'lucide-react'
import { motion } from 'framer-motion'
import Metronome from './Metronome'
import ChordAnalyzer from './ChordAnalyzer'
import AchievementCelebration from './AchievementCelebration'

interface TabData {
  title: string
  artist: string
  duration: number
  tempo: number
  key: string
  tabs: {
    string: number
    frets: number[]
  }[]
}

interface TabViewerProps {
  data: TabData
}

export default function TabViewer({ data }: TabViewerProps) {
  const [isPlaying, setIsPlaying] = useState(false)
  const [currentBeat, setCurrentBeat] = useState(0)
  const [playbackSpeed, setPlaybackSpeed] = useState(1)
  const [showTabNotation, setShowTabNotation] = useState(true)
  const [audioContext, setAudioContext] = useState<AudioContext | null>(null)
  const [tempo, setTempo] = useState(data.tempo)
  const intervalRef = useRef<NodeJS.Timeout | null>(null)

  const guitarStrings = ['E', 'B', 'G', 'D', 'A', 'E']
  const maxFrets = data.tabs && data.tabs.length > 0 
    ? Math.max(...data.tabs.flatMap(tab => tab.frets || []))
    : 0

  // 오디오 컨텍스트 초기화
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const ctx = new (window.AudioContext || (window as any).webkitAudioContext)()
      setAudioContext(ctx)
    }
  }, [])

  // 기타 소리 생성 함수
  const generateGuitarSound = (fret: number, stringIndex: number) => {
    if (!audioContext) return

    const oscillator = audioContext.createOscillator()
    const gainNode = audioContext.createGain()
    
    // 기타 줄의 기본 주파수 (6번 줄부터 1번 줄까지)
    const baseFrequencies = [82.41, 110.00, 146.83, 196.00, 246.94, 329.63] // E, A, D, G, B, E
    const frequency = baseFrequencies[stringIndex] * Math.pow(2, fret / 12)
    
    oscillator.frequency.setValueAtTime(frequency, audioContext.currentTime)
    oscillator.type = 'sawtooth'
    
    gainNode.gain.setValueAtTime(0.1, audioContext.currentTime)
    gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.5)
    
    oscillator.connect(gainNode)
    gainNode.connect(audioContext.destination)
    
    oscillator.start(audioContext.currentTime)
    oscillator.stop(audioContext.currentTime + 0.5)
  }

  const handlePlay = () => {
    if (isPlaying) {
      setIsPlaying(false)
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
      }
    } else {
      setIsPlaying(true)
      const beatInterval = 60000 / (tempo * playbackSpeed) // BPM을 밀리초로 변환
      
      intervalRef.current = setInterval(() => {
        setCurrentBeat(prev => {
          const nextBeat = prev + 1
          if (nextBeat >= (data.tabs?.length || 0)) {
            setIsPlaying(false)
            if (intervalRef.current) {
              clearInterval(intervalRef.current)
            }
            return 0
          }
          
          // 현재 마디의 기타 소리 재생
          if (data.tabs && data.tabs[nextBeat]) {
            data.tabs[nextBeat].frets.forEach((fret, stringIndex) => {
              if (fret > 0) {
                generateGuitarSound(fret, stringIndex)
              }
            })
          }
          
          return nextBeat
        })
      }, beatInterval)
    }
  }

  const handleReset = () => {
    setCurrentBeat(0)
    setIsPlaying(false)
    if (intervalRef.current) {
      clearInterval(intervalRef.current)
    }
  }

  // JPG 내보내기 함수
  const handleDownloadJPG = () => {
    const tabElement = document.getElementById('tab-notation')
    if (!tabElement) return

    // html2canvas 라이브러리를 동적으로 로드
    import('html2canvas').then(html2canvas => {
      html2canvas.default(tabElement, {
        backgroundColor: '#ffffff',
        scale: 2,
        useCORS: true
      }).then(canvas => {
        const link = document.createElement('a')
        link.download = `${data.title || 'guitar-tab'}.jpg`
        link.href = canvas.toDataURL('image/jpeg', 0.9)
        link.click()
      })
    }).catch(() => {
      // html2canvas가 없으면 기본 다운로드
      console.log('JPG 다운로드 기능을 사용하려면 html2canvas 라이브러리가 필요합니다.')
    })
  }

  const handleDownload = (format: string) => {
    if (format === 'jpg') {
      handleDownloadJPG()
      return
    }
    
    // 다른 형식들은 기존 로직
    console.log(`Downloading as ${format}`)
  }

  return (
    <div className="space-y-6">
      {/* Achievement Celebration */}
      <AchievementCelebration
        isPlaying={isPlaying}
        currentBeat={currentBeat}
        totalBeats={data.tabs?.length || 0}
        difficulty={Math.round(Math.random() * 3) + 2} // 임시 난이도
      />

      {/* Song Info */}
      <div className="bg-gray-50 rounded-lg p-4">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
          <div>
            <span className="text-gray-600">템포:</span>
            <span className="ml-2 font-semibold">{tempo} BPM</span>
          </div>
          <div>
            <span className="text-gray-600">키:</span>
            <span className="ml-2 font-semibold">{data.key}</span>
          </div>
          <div>
            <span className="text-gray-600">길이:</span>
            <span className="ml-2 font-semibold">{Math.floor(data.duration / 60)}:{(data.duration % 60).toString().padStart(2, '0')}</span>
          </div>
          <div>
            <span className="text-gray-600">마디:</span>
            <span className="ml-2 font-semibold">{data.tabs ? data.tabs.length : 0}</span>
          </div>
        </div>
      </div>

      {/* Metronome */}
      <Metronome
        tempo={tempo}
        isPlaying={isPlaying}
        onTempoChange={setTempo}
      />

      {/* Chord Analysis */}
      {data.tabs && data.tabs.length > 0 && (
        <ChordAnalyzer
          tabs={data.tabs}
          tempo={tempo}
        />
      )}

      {/* Controls */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <button
            onClick={handlePlay}
            className="bg-primary-600 hover:bg-primary-700 text-white rounded-full p-3 transition-colors duration-200"
            title={isPlaying ? "정지" : "재생"}
          >
            {isPlaying ? <Pause className="h-5 w-5" /> : <Play className="h-5 w-5" />}
          </button>
          
          <button
            onClick={handleReset}
            className="bg-gray-200 hover:bg-gray-300 text-gray-700 rounded-full p-3 transition-colors duration-200"
            title="처음으로"
          >
            <RotateCcw className="h-5 w-5" />
          </button>
        </div>

        <div className="flex items-center space-x-4">
          {/* 기타 악보 보기 토글 */}
          <div className="flex items-center space-x-2">
            <span className="text-sm text-gray-600">기타 악보:</span>
            <button
              onClick={() => setShowTabNotation(!showTabNotation)}
              className="flex items-center space-x-2 text-sm"
            >
              {showTabNotation ? (
                <ToggleRight className="h-5 w-5 text-primary-600" />
              ) : (
                <ToggleLeft className="h-5 w-5 text-gray-400" />
              )}
              <span className={showTabNotation ? "text-primary-600" : "text-gray-500"}>
                {showTabNotation ? "켜짐" : "꺼짐"}
              </span>
            </button>
          </div>

          <div className="flex items-center space-x-2">
            <span className="text-sm text-gray-600">속도:</span>
            <select
              value={playbackSpeed}
              onChange={(e) => setPlaybackSpeed(Number(e.target.value))}
              className="text-sm border border-gray-300 rounded px-2 py-1"
            >
              <option value={0.5}>0.5x</option>
              <option value={0.75}>0.75x</option>
              <option value={1}>1x</option>
              <option value={1.25}>1.25x</option>
              <option value={1.5}>1.5x</option>
            </select>
          </div>
        </div>
      </div>

      {/* Tab Display */}
      <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
        <div className="bg-gray-50 px-4 py-2 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <h4 className="font-semibold text-gray-900">기타 타브 악보</h4>
            <div className="flex space-x-2">
              <button
                onClick={() => handleDownload('jpg')}
                className="text-xs bg-red-100 text-red-700 px-3 py-1 rounded hover:bg-red-200 transition-colors duration-200"
                title="JPG 이미지로 다운로드"
              >
                JPG
              </button>
              <button
                onClick={() => handleDownload('pdf')}
                className="text-xs bg-primary-100 text-primary-700 px-3 py-1 rounded hover:bg-primary-200 transition-colors duration-200"
                title="PDF 문서로 다운로드"
              >
                PDF
              </button>
              <button
                onClick={() => handleDownload('gpx')}
                className="text-xs bg-guitar-100 text-guitar-700 px-3 py-1 rounded hover:bg-guitar-200 transition-colors duration-200"
                title="GPX 파일로 다운로드"
              >
                GPX
              </button>
              <button
                onClick={() => handleDownload('musicxml')}
                className="text-xs bg-green-100 text-green-700 px-3 py-1 rounded hover:bg-green-200 transition-colors duration-200"
                title="MusicXML 파일로 다운로드"
              >
                MusicXML
              </button>
            </div>
          </div>
        </div>

        <div className="p-4 overflow-x-auto">
          {showTabNotation ? (
            <div id="tab-notation" className="min-w-max">
              {/* String Labels */}
              <div className="flex mb-2">
                <div className="w-8"></div>
                {guitarStrings.map((string, index) => (
                  <div key={index} className="w-12 text-center font-semibold text-guitar-700">
                    {string}
                  </div>
                ))}
              </div>

              {/* Tab Lines */}
              {data.tabs && data.tabs.length > 0 ? data.tabs.map((tab, beatIndex) => (
                <motion.div
                  key={beatIndex}
                  className={`flex items-center mb-1 py-2 px-2 rounded ${
                    currentBeat === beatIndex ? 'bg-primary-50 border-l-4 border-primary-500' : 'hover:bg-gray-50'
                  }`}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.3, delay: beatIndex * 0.05 }}
                >
                  <div className="w-8 text-sm text-gray-600 font-mono">
                    {beatIndex + 1}
                  </div>
                  
                  {guitarStrings.map((_, stringIndex) => {
                    const fret = tab.frets[stringIndex] || 0
                    return (
                      <div key={stringIndex} className="w-12 text-center">
                        {fret > 0 ? (
                          <span className="tab-note font-mono text-lg">
                            {fret}
                          </span>
                        ) : (
                          <span className="text-gray-300">-</span>
                        )}
                      </div>
                    )
                  })}
                </motion.div>
              )) : (
                <div className="text-center py-8 text-gray-500">
                  타브 악보 데이터가 없습니다.
                </div>
              )}
            </div>
          ) : (
            <div className="text-center py-12">
              <Music className="h-16 w-16 text-gray-300 mx-auto mb-4" />
              <p className="text-gray-500 text-lg">기타 악보 보기가 꺼져있습니다</p>
              <p className="text-gray-400 text-sm mt-2">토글을 켜서 악보를 확인하세요</p>
            </div>
          )}
        </div>
      </div>

      {/* Progress Bar */}
      <div className="space-y-2">
        <div className="flex justify-between text-sm text-gray-600">
          <span>진행률</span>
          <span>{data.tabs && data.tabs.length > 0 ? Math.round((currentBeat / data.tabs.length) * 100) : 0}%</span>
        </div>
        <div className="w-full bg-gray-200 rounded-full h-2">
          <div
            className="bg-primary-600 h-2 rounded-full transition-all duration-300"
            style={{ width: `${data.tabs && data.tabs.length > 0 ? (currentBeat / data.tabs.length) * 100 : 0}%` }}
          />
        </div>
      </div>
    </div>
  )
}

