'use client'

import { useState, useEffect, useRef } from 'react'
import { Music, Download, Upload, Play, Pause } from 'lucide-react'
import { motion } from 'framer-motion'

interface MIDIPlayerProps {
  tabs: {
    measure: number
    frets: number[]
    notes: string[]
    technique: string
  }[]
  tempo: number
}

export default function MIDIPlayer({ tabs, tempo }: MIDIPlayerProps) {
  const [isPlaying, setIsPlaying] = useState(false)
  const [currentBeat, setCurrentBeat] = useState(0)
  const [midiData, setMidiData] = useState<Uint8Array | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const intervalRef = useRef<NodeJS.Timeout | null>(null)

  // MIDI 데이터 생성
  const generateMIDI = async () => {
    setIsLoading(true)
    try {
      // @tonejs/midi 동적 임포트
      const { Midi } = await import('@tonejs/midi')
      
      const midi = new Midi()
      const track = midi.addTrack()
      
      // 템포 설정
      midi.header.setTempo(tempo)
      
      // 각 마디를 MIDI 이벤트로 변환
      tabs.forEach((tab, beatIndex) => {
        const startTime = beatIndex * (60 / tempo) // 초 단위
        
        tab.frets.forEach((fret, stringIndex) => {
          if (fret > 0) {
            // 기타 줄의 MIDI 노트 번호 계산
            const midiNote = getMIDINote(stringIndex, fret)
            
            // 노트 온 이벤트
            track.addNote({
              midi: midiNote,
              time: startTime,
              duration: 0.5, // 0.5초 지속
              velocity: 80
            })
          }
        })
      })
      
      // MIDI 데이터를 Uint8Array로 변환
      const midiArray = midi.toArray()
      setMidiData(midiArray)
      
    } catch (error) {
      console.error('MIDI 생성 오류:', error)
    } finally {
      setIsLoading(false)
    }
  }

  // 기타 줄과 프렛을 MIDI 노트 번호로 변환
  const getMIDINote = (stringIndex: number, fret: number): number => {
    // 기타 줄의 기본 MIDI 노트 번호 (6번 줄부터 1번 줄까지)
    const baseNotes = [40, 45, 50, 55, 59, 64] // E, A, D, G, B, E
    return baseNotes[stringIndex] + fret
  }

  // MIDI 재생 (Web MIDI API 사용)
  const playMIDI = async () => {
    if (!midiData) {
      await generateMIDI()
      return
    }

    try {
      // Web MIDI API 요청
      const midiAccess = await navigator.requestMIDIAccess()
      const outputs = Array.from(midiAccess.outputs.values())
      
      if (outputs.length === 0) {
        alert('MIDI 출력 장치가 없습니다.')
        return
      }

      const output = outputs[0]
      setIsPlaying(true)
      
      // MIDI 데이터 재생 (간단한 버전)
      tabs.forEach((tab, beatIndex) => {
        setTimeout(() => {
          tab.frets.forEach((fret, stringIndex) => {
            if (fret > 0) {
              const midiNote = getMIDINote(stringIndex, fret)
              
              // 노트 온
              output.send([0x90, midiNote, 80])
              
              // 0.5초 후 노트 오프
              setTimeout(() => {
                output.send([0x80, midiNote, 0])
              }, 500)
            }
          })
        }, beatIndex * (60000 / tempo))
      })

      // 재생 완료 후 정지
      setTimeout(() => {
        setIsPlaying(false)
      }, tabs.length * (60000 / tempo))

    } catch (error) {
      console.error('MIDI 재생 오류:', error)
      alert('MIDI 재생에 실패했습니다.')
    }
  }

  // MIDI 정지
  const stopMIDI = () => {
    setIsPlaying(false)
    if (intervalRef.current) {
      clearInterval(intervalRef.current)
    }
  }

  // MIDI 파일 다운로드
  const downloadMIDI = () => {
    if (!midiData) return

    const blob = new Blob([midiData], { type: 'audio/midi' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = 'guitar-tab.mid'
    link.click()
    URL.revokeObjectURL(url)
  }

  // MIDI 파일 업로드
  const handleMIDIUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    const reader = new FileReader()
    reader.onload = (e) => {
      const arrayBuffer = e.target?.result as ArrayBuffer
      setMidiData(new Uint8Array(arrayBuffer))
    }
    reader.readAsArrayBuffer(file)
  }

  return (
    <div className="bg-white/80 backdrop-blur-sm rounded-lg p-4 border border-gray-200">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-gray-900 flex items-center">
          <Music className="h-5 w-5 mr-2" />
          MIDI 플레이어
        </h3>
        <div className="flex items-center space-x-2">
          <span className="text-sm text-gray-600">{tempo} BPM</span>
        </div>
      </div>

      {/* 컨트롤 버튼들 */}
      <div className="flex items-center justify-center space-x-4 mb-4">
        <button
          onClick={isPlaying ? stopMIDI : playMIDI}
          disabled={isLoading}
          className="bg-primary-600 hover:bg-primary-700 disabled:bg-gray-400 text-white rounded-full p-3 transition-colors duration-200"
          title={isPlaying ? "정지" : "재생"}
        >
          {isLoading ? (
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-white"></div>
          ) : isPlaying ? (
            <Pause className="h-6 w-6" />
          ) : (
            <Play className="h-6 w-6" />
          )}
        </button>
        
        <button
          onClick={generateMIDI}
          disabled={isLoading}
          className="bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white rounded-full p-3 transition-colors duration-200"
          title="MIDI 생성"
        >
          <Music className="h-6 w-6" />
        </button>
        
        <button
          onClick={downloadMIDI}
          disabled={!midiData}
          className="bg-green-600 hover:bg-green-700 disabled:bg-gray-400 text-white rounded-full p-3 transition-colors duration-200"
          title="MIDI 다운로드"
        >
          <Download className="h-6 w-6" />
        </button>
      </div>

      {/* MIDI 파일 업로드 */}
      <div className="mb-4">
        <label className="block text-sm font-medium text-gray-700 mb-2">
          MIDI 파일 업로드
        </label>
        <input
          type="file"
          accept=".mid,.midi"
          onChange={handleMIDIUpload}
          className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
        />
      </div>

      {/* MIDI 정보 */}
      <div className="bg-gray-50 rounded-lg p-4">
        <h4 className="font-medium text-gray-900 mb-2">MIDI 정보</h4>
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <span className="text-gray-600">마디 수:</span>
            <span className="ml-2 font-semibold">{tabs.length}</span>
          </div>
          <div>
            <span className="text-gray-600">템포:</span>
            <span className="ml-2 font-semibold">{tempo} BPM</span>
          </div>
          <div>
            <span className="text-gray-600">MIDI 상태:</span>
            <span className={`ml-2 font-semibold ${
              midiData ? 'text-green-600' : 'text-gray-500'
            }`}>
              {midiData ? '준비됨' : '생성 필요'}
            </span>
          </div>
          <div>
            <span className="text-gray-600">재생 상태:</span>
            <span className={`ml-2 font-semibold ${
              isPlaying ? 'text-blue-600' : 'text-gray-500'
            }`}>
              {isPlaying ? '재생 중' : '정지'}
            </span>
          </div>
        </div>
      </div>

      {/* MIDI 노트 매핑 정보 */}
      <div className="mt-4 bg-blue-50 rounded-lg p-4">
        <h4 className="font-medium text-blue-900 mb-2">기타 줄 MIDI 노트</h4>
        <div className="grid grid-cols-3 gap-2 text-sm">
          {['E (6번 줄)', 'A (5번 줄)', 'D (4번 줄)', 'G (3번 줄)', 'B (2번 줄)', 'E (1번 줄)'].map((string, index) => (
            <div key={index} className="text-blue-700">
              {string}: {40 + index * 5}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
