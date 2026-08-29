'use client'

import { useState, useRef, useEffect } from 'react'
import { motion } from 'framer-motion'
import { Music, Guitar, FileText, Play, Pause, RotateCcw, Download } from 'lucide-react'
import toast from 'react-hot-toast'
import AdvancedAudioPlayer from './AdvancedAudioPlayer'
import MIDIPlayer from './MIDIPlayer'
import { RealAudioAPI } from '@/app/lib/real-audio-api'

interface TabData {
  title: string
  artist: string
  duration: number
  tempo: number
  key: string
  difficulty: string
  tabs: {
    measure: number
    frets: number[]
    notes: string[]
    technique: string
  }[]
  chord_progressions: {
    chord: string
    start_time: number
    duration: number
    confidence: number
  }[]
  metadata: {
    view_count: number
    upload_date: string
    tags: string[]
    analysis_method: string
    video_id: string
    thumbnail?: string
    audio_id?: string
    result_mode?: string
    status_summary?: string
    tab_source?: string
    pipeline_diagnostics?: Record<string, unknown>
  }
}

interface NotationViewerProps {
  data: TabData
}

type NotationType = 'tab' | 'sheet' | 'chord' | 'melody'

export default function NotationViewer({ data }: NotationViewerProps) {
  const [activeNotation, setActiveNotation] = useState<NotationType>('tab')
  const [isPlaying, setIsPlaying] = useState(false)
  const [currentBeat, setCurrentBeat] = useState(0)
  const [playbackSpeed, setPlaybackSpeed] = useState(1)
  const [showTabNotation, setShowTabNotation] = useState(true)
  const [showTechDetails, setShowTechDetails] = useState(false)
  const [tempo, setTempo] = useState(data.tempo)
  const intervalRef = useRef<NodeJS.Timeout | null>(null)
  const audioContextRef = useRef<AudioContext | null>(null)

  const notationTypes = [
    {
      id: 'tab' as NotationType,
      label: '타브 악보',
      icon: <Guitar className="h-5 w-5" />,
      description: '기타 프렛 표기법'
    },
    {
      id: 'sheet' as NotationType,
      label: '오선보',
      icon: <Music className="h-5 w-5" />,
      description: '표준 악보 표기법'
    },
    {
      id: 'melody' as NotationType,
      label: '멜로디',
      icon: <Music className="h-5 w-5" />,
      description: '추출된 멜로디 라인'
    },
    {
      id: 'chord' as NotationType,
      label: '코드 악보',
      icon: <FileText className="h-5 w-5" />,
      description: '가사 + 코드 진행'
    }
  ]

  const guitarStrings = ['E', 'B', 'G', 'D', 'A', 'E']

  // 오디오 컨텍스트 초기화
  useEffect(() => {
    if (typeof window !== 'undefined') {
      audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)()
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
      }

      if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
        void audioContextRef.current.close().catch(() => undefined)
      }
    }
  }, [])

  useEffect(() => {
    setTempo(data.tempo)
    setCurrentBeat(0)
    setIsPlaying(false)
    if (intervalRef.current) {
      clearInterval(intervalRef.current)
      intervalRef.current = null
    }
  }, [data.tempo, data.title, data.artist])

  // 기타 소리 생성 함수 (오류 처리 개선)
  const generateGuitarSound = (fret: number, stringIndex: number) => {
    try {
      const audioContext = audioContextRef.current
      if (!audioContext) {
        return
      }

      // 오디오 컨텍스트 상태 확인
      if (audioContext.state === 'suspended') {
        audioContext.resume().catch(console.error)
      }

      const oscillator = audioContext.createOscillator()
      const gainNode = audioContext.createGain()
      
      // 화면 표기 순서: high E, B, G, D, A, low E
      const baseFrequencies = [329.63, 246.94, 196.00, 146.83, 110.00, 82.41]
      
      // 인덱스 범위 확인
      if (stringIndex < 0 || stringIndex >= baseFrequencies.length) {
        return
      }
      
      const frequency = baseFrequencies[stringIndex] * Math.pow(2, fret / 12)
      
      // 주파수 범위 확인 (20Hz - 20kHz)
      if (frequency < 20 || frequency > 20000) {
        return
      }
      
      oscillator.frequency.setValueAtTime(frequency, audioContext.currentTime)
      oscillator.type = 'sawtooth'
      
      gainNode.gain.setValueAtTime(0.1, audioContext.currentTime)
      gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.5)
      
      oscillator.connect(gainNode)
      gainNode.connect(audioContext.destination)
      
      oscillator.start(audioContext.currentTime)
      oscillator.stop(audioContext.currentTime + 0.5)
    } catch (error) {
      console.error('기타 소리 생성 오류:', error)
    }
  }

  // 재생/정지 핸들러
  const handlePlay = () => {
    if (isPlaying) {
      setIsPlaying(false)
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
        intervalRef.current = null
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
              intervalRef.current = null
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

  // 리셋 핸들러
  const handleReset = () => {
    setCurrentBeat(0)
    setIsPlaying(false)
    if (intervalRef.current) {
      clearInterval(intervalRef.current)
      intervalRef.current = null
    }
  }

  // JPG 내보내기 함수 (오류 처리 개선)
  const handleDownloadJPG = async () => {
    try {
      const tabElement = document.getElementById('tab-notation')
      if (!tabElement) {
        toast('내보낼 타브 영역을 찾지 못했습니다.', { icon: '⚠️' })
        return
      }

      // html2canvas 라이브러리를 동적으로 로드
      const html2canvas = await import('html2canvas')
      
      const canvas = await html2canvas.default(tabElement, {
        backgroundColor: '#ffffff',
        scale: 2,
        useCORS: true,
        allowTaint: true,
        logging: false
      })
      
      const link = document.createElement('a')
      link.download = `${data.title || 'guitar-tab'}.jpg`
      link.href = canvas.toDataURL('image/jpeg', 0.9)
      link.click()
      toast('JPG 내보내기를 완료했습니다.', { icon: '🖼️' })
    } catch (error) {
      console.error('JPG 다운로드 오류:', error)
      toast('JPG 다운로드에 실패했습니다. 다시 시도해주세요.', { icon: '❌' })
    }
  }

  const handleDownload = (format: string) => {
    if (format === 'jpg') {
      handleDownloadJPG()
      return
    }

    toast(`${format.toUpperCase()} 내보내기는 준비 중입니다.`, { icon: 'ℹ️' })
  }

  // 오선보용 음표 생성 (실제 타브 데이터 기반)
  const generateSheetMusic = (): Array<{
    note: string;
    octave: number;
    duration: string;
    measure: number;
    string: number;
    fret: number;
    position: number;
  }> => {
    if (!data.tabs || data.tabs.length === 0) {
      return []
    }
    
    const notes = ['C', 'D', 'E', 'F', 'G', 'A', 'B']
    const sheetNotes: Array<{
      note: string;
      octave: number;
      duration: string;
      measure: number;
      string: number;
      fret: number;
      position: number;
    }> = []
    
    // 타브 데이터를 기반으로 실제 음표 생성
    data.tabs.forEach((tab, measureIndex) => {
      // 각 마디에서 활성화된 프렛들을 수집
      const activeFrets = tab.frets.map((fret, stringIndex) => ({
        fret,
        stringIndex,
        string: guitarStrings[stringIndex]
      })).filter(item => item.fret > 0)
      
      // 마디별로 음표 그룹 생성
      if (activeFrets.length > 0) {
        const measureNotes = activeFrets.map((item, index) => {
          // 프렛을 음표로 변환
          const baseNote = item.string
          const noteIndex = notes.indexOf(baseNote)
          const newNoteIndex = (noteIndex + item.fret) % 7
          const octave = 4 + Math.floor((noteIndex + item.fret) / 7)
          
          const note = {
            note: notes[newNoteIndex],
            octave: octave,
            duration: activeFrets.length > 1 ? '♫' : '♪', // 화음이면 2분음표, 단음이면 4분음표
            measure: measureIndex + 1,
            string: item.stringIndex + 1,
            fret: item.fret,
            position: index * 30 // 음표 간격
          }
          return note
        })
        
        sheetNotes.push(...measureNotes)
      }
    })
    return sheetNotes.slice(0, 24) // 최대 24개 음표
  }

  const sheetNotes = generateSheetMusic()

  // 멜로디 추출 함수
  const extractMelody = (): Array<{
    note: string;
    octave: number;
    measure: number;
    string: number;
    fret: number;
    technique: string;
  }> => {
    if (!data.tabs || data.tabs.length === 0) {
      return []
    }
    
    const melody: Array<{
      note: string;
      octave: number;
      measure: number;
      string: number;
      fret: number;
      technique: string;
    }> = []
    const notes = ['C', 'D', 'E', 'F', 'G', 'A', 'B']
    
    data.tabs.forEach((tab, measureIndex) => {
      // 각 마디에서 가장 높은 음을 멜로디로 선택
      const activeFrets = tab.frets.map((fret, stringIndex) => ({
        fret,
        stringIndex,
        string: guitarStrings[stringIndex]
      })).filter(item => item.fret > 0)
      
      if (activeFrets.length > 0) {
        // 가장 높은 음 찾기 (낮은 줄 번호 = 높은 음)
        const highestNote = activeFrets.reduce((prev, current) => {
          const prevPitch = (6 - prev.stringIndex) * 12 + prev.fret
          const currentPitch = (6 - current.stringIndex) * 12 + current.fret
          return currentPitch > prevPitch ? current : prev
        })
        
        // 프렛을 음표로 변환
        const baseNote = highestNote.string
        const noteIndex = notes.indexOf(baseNote)
        const newNoteIndex = (noteIndex + highestNote.fret) % 7
        const octave = 4 + Math.floor((noteIndex + highestNote.fret) / 7)
        
        melody.push({
          note: notes[newNoteIndex],
          octave: octave,
          measure: measureIndex + 1,
          string: highestNote.stringIndex + 1,
          fret: highestNote.fret,
          technique: tab.technique
        })
      }
    })
    
    return melody
  }

  const melody = extractMelody()

  // 가사 더보기 상태
  const [showAllLyrics, setShowAllLyrics] = useState(false)

  // 실제 가사 데이터 사용
  const getLyrics = () => {
    const safeData: any = data as any
    if (safeData.lyrics && safeData.lyrics.length > 0) {
      return safeData.lyrics.map((line: any) => ({
        text: line.text || line,
        chords: line.chords || [],
        line_type: line.line_type || 'normal'
      }))
    }
    
    // 기본 가사 (폴백)
    return [
      { text: "사랑이 남긴 상처들도 감싸줄게", chords: [], line_type: 'verse' },
      { text: "어쩌면 우린 벌써 알고 있어", chords: [], line_type: 'verse' },
      { text: "그토록 찾아 헤맨 사랑의 꿈", chords: [], line_type: 'verse' },
      { text: "외롭게만 하는 걸", chords: [], line_type: 'verse' },
      { text: "시간이 흘러도 변하지 않을", chords: [], line_type: 'chorus' },
      { text: "우리의 마음은 영원할 거야", chords: [], line_type: 'chorus' },
      { text: "함께 걸어가는 이 길에서", chords: [], line_type: 'chorus' },
      { text: "서로를 지켜주며 살아가자", chords: [], line_type: 'chorus' }
    ]
  }

  const lyrics = getLyrics()
  const audioStreamUrl = data.metadata.audio_id ? RealAudioAPI.audioStreamUrl(data.metadata.audio_id) : undefined
  const durationLabel = `${Math.floor(data.duration / 60)}:${(data.duration % 60).toString().padStart(2, '0')}`
  const audioDiag = data.metadata.pipeline_diagnostics?.audio_analysis as Record<string, unknown> | undefined

  return (
    <div className="space-y-4 text-white">
      {/* 재생 */}
      <div className="rounded-xl border border-white/10 bg-[#141820] p-4">
        <AdvancedAudioPlayer
          audioUrl={audioStreamUrl}
          tabs={data.tabs || []}
          tempo={tempo}
          isPlaying={isPlaying}
          onPlay={() => setIsPlaying(true)}
          onPause={() => setIsPlaying(false)}
          onReset={handleReset}
          compact
        />
        <div className="mt-3 flex items-center justify-between border-t border-white/8 pt-3">
          <MIDIPlayer tabs={data.tabs || []} tempo={tempo} compact />
          <div className="flex gap-3 text-xs text-white/45">
            <span>{data.key}</span>
            <span>{tempo} BPM</span>
            <span>{durationLabel}</span>
            <span>{data.tabs?.length ?? 0}마디</span>
          </div>
        </div>
      </div>

      {/* 악보 타입 */}
      <div className="flex flex-wrap gap-1.5">
        {notationTypes.map((type) => (
          <button
            key={type.id}
            onClick={() => setActiveNotation(type.id)}
            className={`rounded-lg px-3 py-1.5 text-xs transition ${
              activeNotation === type.id
                ? 'bg-[#ff8a3d] text-white'
                : 'bg-white/5 text-white/60 hover:bg-white/10'
            }`}
          >
            {type.label}
          </button>
        ))}
        <div className="ml-auto flex items-center gap-2">
          <select
            value={playbackSpeed}
            onChange={(e) => setPlaybackSpeed(Number(e.target.value))}
            className="rounded-lg border border-white/10 bg-white/5 px-2 py-1 text-xs text-white/70"
          >
            <option value={0.5}>0.5x</option>
            <option value={0.75}>0.75x</option>
            <option value={1}>1x</option>
            <option value={1.25}>1.25x</option>
            <option value={1.5}>1.5x</option>
          </select>
          <button
            onClick={() => setShowTabNotation(!showTabNotation)}
            className="text-xs text-white/45 hover:text-white/70"
          >
            {showTabNotation ? '악보 숨기기' : '악보 보기'}
          </button>
        </div>
      </div>

      {/* 기술 정보 (접기) */}
      {(data.metadata.analysis_method || audioDiag) && (
        <div className="rounded-xl border border-white/8 bg-white/[0.02]">
          <button
            onClick={() => setShowTechDetails(!showTechDetails)}
            className="flex w-full items-center justify-between px-4 py-2.5 text-xs text-white/45 hover:text-white/65"
          >
            <span>기술 정보</span>
            <span>{showTechDetails ? '▲' : '▼'}</span>
          </button>
          {showTechDetails && (
            <div className="space-y-1 border-t border-white/8 px-4 py-3 text-xs text-white/40">
              {data.metadata.status_summary && <p>{data.metadata.status_summary}</p>}
              {data.metadata.analysis_method && <p>분석: {data.metadata.analysis_method}</p>}
              {data.metadata.tab_source && <p>탭: {data.metadata.tab_source}</p>}
              {typeof audioDiag?.pitch_tab_confidence === 'number' && (
                <p>신뢰도: {Math.round((audioDiag.pitch_tab_confidence as number) * 100)}%</p>
              )}
            </div>
          )}
        </div>
      )}

      {/* 악보 */}
      {showTabNotation && (
      <div className="overflow-hidden rounded-xl border border-white/10 bg-[#f7f4ec] text-gray-900">
        <div className="bg-gray-50 px-4 py-2 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <h4 className="font-semibold text-gray-900">
              {notationTypes.find(t => t.id === activeNotation)?.label}
            </h4>
            <div className="flex items-center space-x-4">
              <div className="flex items-center space-x-2">
                <span className="text-sm text-gray-600">난이도:</span>
                <span className={`px-2 py-1 rounded text-xs font-medium ${
                  data.difficulty === '초급' ? 'bg-green-100 text-green-700' :
                  data.difficulty === '중급' ? 'bg-yellow-100 text-yellow-700' :
                  'bg-red-100 text-red-700'
                }`}>
                  {data.difficulty}
                </span>
              </div>
              
              {/* 다운로드 버튼들 */}
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
        </div>

        <div className="p-6">
          {activeNotation === 'tab' && (
            <div className="space-y-4">
              {/* 타브 악보 */}
              <div className="overflow-x-auto">
                <div id="tab-notation" className="min-w-max">
                  {/* 줄 라벨 */}
                  <div className="flex mb-2">
                    <div className="w-8"></div>
                    {guitarStrings.map((string, index) => (
                      <div key={index} className="w-12 text-center font-semibold text-guitar-700">
                        {string}
                      </div>
                    ))}
                  </div>

                  {/* 타브 라인 */}
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
                              <span className="font-mono text-lg text-guitar-700">
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
              </div>
            </div>
          )}

          {activeNotation === 'sheet' && (
            <div className="space-y-4">
              {/* 오선보 */}
              <div className="bg-white border-2 border-gray-300 rounded-lg p-6">
                <div className="text-center mb-4">
                  <h5 className="text-lg font-semibold text-gray-900">{data.title}</h5>
                  <p className="text-sm text-gray-600">{data.artist}</p>
                  <p className="text-xs text-gray-500">{data.tempo} BPM • {data.key} Key</p>
                </div>
                
                {/* 오선 */}
                <div className="relative">
                  {[1, 2, 3, 4, 5].map(line => (
                    <div key={line} className="absolute w-full h-0.5 bg-gray-800" 
                         style={{ top: `${20 + line * 8}px` }} />
                  ))}
                  
                  {/* 조표 (키 시그니처) */}
                  <div className="absolute left-4" style={{ top: '20px' }}>
                    <div className="text-sm font-bold text-gray-800">
                      {data.key}
                    </div>
                  </div>
                  
                  {/* 박자표 */}
                  <div className="absolute left-16" style={{ top: '20px' }}>
                    <div className="text-sm text-gray-600">4/4</div>
                  </div>
                  
                  {/* 음표들 */}
                  <div className="relative h-40">
                    {sheetNotes.length > 0 ? (
                      <div className="relative">
                        {sheetNotes.map((note, index) => {
                          // 오선 위에 음표 배치 (정확한 위치 계산)
                          const notePositions = {
                            'C': 0, 'D': 1, 'E': 2, 'F': 3, 'G': 4, 'A': 5, 'B': 6
                          }
                          
                          // 기본 위치 (4옥타브 C = 중간 오선)
                          const baseLine = 20 + 2 * 8 // 중간 오선 (3번째 줄)
                          const noteOffset = (notePositions[note.note as keyof typeof notePositions] || 0) * 2
                          const octaveOffset = (note.octave - 4) * 7 * 2
                          const linePosition = baseLine - noteOffset - octaveOffset
                          const leftPosition = 20 + index * 60
                          
                          return (
                            <div
                              key={index}
                              className="absolute"
                              style={{
                                left: `${leftPosition}px`,
                                top: `${linePosition - 12}px`
                              }}
                            >
                              <div className="relative">
                                <div className="text-2xl font-bold text-gray-800">
                                  {note.note}
                                </div>
                                <div className="text-xs text-gray-600 mt-1">
                                  {note.duration}
                                </div>
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    ) : (
                      <div className="absolute inset-0 flex items-center justify-center text-gray-500">
                        <div className="text-center">
                          <div className="text-lg font-semibold mb-2">오선보 생성 중...</div>
                          <div className="text-sm">타브 데이터를 분석하여 실제 음표를 생성합니다</div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeNotation === 'melody' && (
            <div className="space-y-4">
              {/* 멜로디 라인 */}
              <div className="bg-white border-2 border-gray-300 rounded-lg p-6">
                <div className="text-center mb-4">
                  <h5 className="text-lg font-semibold text-gray-900">추출된 멜로디</h5>
                  <p className="text-sm text-gray-600">{data.title} - {data.artist}</p>
                  <p className="text-xs text-gray-500">{data.tempo} BPM • {data.key} Key</p>
                </div>
                
                {/* 멜로디 표시 */}
                <div className="bg-gray-50 rounded-lg p-4">
                  {melody.length > 0 ? (
                    <div className="space-y-2">
                      <div className="text-sm font-semibold text-gray-700 mb-3">멜로디 진행:</div>
                      <div className="flex flex-wrap gap-2">
                        {melody.map((note, index) => (
                          <motion.div
                            key={index}
                            className="bg-blue-100 text-blue-800 px-3 py-2 rounded-lg text-sm font-medium"
                            initial={{ opacity: 0, scale: 0.8 }}
                            animate={{ opacity: 1, scale: 1 }}
                            transition={{ delay: index * 0.1 }}
                          >
                            <div className="text-center">
                              <div className="text-lg font-bold">{note.note}{note.octave}</div>
                              <div className="text-xs text-blue-600">
                                {note.string}줄 {note.fret}프렛
                              </div>
                              <div className="text-xs text-blue-500">
                                마디 {note.measure}
                              </div>
                            </div>
                          </motion.div>
                        ))}
                      </div>
                      
                      {/* 멜로디 정보 */}
                      <div className="mt-4 p-3 bg-white rounded border">
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                          <div>
                            <span className="text-gray-600">총 음표:</span>
                            <span className="ml-2 font-semibold">{melody.length}개</span>
                          </div>
                          <div>
                            <span className="text-gray-600">마디 수:</span>
                            <span className="ml-2 font-semibold">{Math.max(...melody.map(n => n.measure))}마디</span>
                          </div>
                          <div>
                            <span className="text-gray-600">최고음:</span>
                            <span className="ml-2 font-semibold">
                              {melody.length > 0 ? melody.reduce((prev, current) => 
                                current.octave > prev.octave || 
                                (current.octave === prev.octave && current.note > prev.note) ? current : prev
                              ).note + melody.reduce((prev, current) => 
                                current.octave > prev.octave || 
                                (current.octave === prev.octave && current.note > prev.note) ? current : prev
                              ).octave : 'N/A'}
                            </span>
                          </div>
                          <div>
                            <span className="text-gray-600">기법:</span>
                            <span className="ml-2 font-semibold">
                              {Array.from(new Set(melody.map(n => n.technique))).join(', ')}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="text-center py-8 text-gray-500">
                      <div className="text-lg font-semibold mb-2">멜로디 추출 중...</div>
                      <div className="text-sm">타브 데이터에서 멜로디 라인을 추출합니다</div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {activeNotation === 'chord' && (
            <div className="space-y-4">
              {/* 코드 악보 */}
              <div className="bg-white border-2 border-gray-300 rounded-lg p-6">
                <div className="text-center mb-6">
                  <h5 className="text-lg font-semibold text-gray-900">{data.title}</h5>
                  <p className="text-sm text-gray-600">{data.artist}</p>
                  <p className="text-xs text-gray-500">{data.tempo} BPM • {data.key} Key</p>
                </div>
                
                {/* 코드 진행 */}
                <div className="mb-6">
                  <h6 className="text-sm font-semibold text-gray-700 mb-2">코드 진행:</h6>
                  <div className="flex flex-wrap gap-2">
                    {data.chord_progressions.map((chord, index) => (
                      <motion.span
                        key={index}
                        className="px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-sm font-medium"
                        initial={{ opacity: 0, scale: 0.8 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ delay: index * 0.1 }}
                      >
                        {chord.chord}
                      </motion.span>
                    ))}
                  </div>
                </div>

                {/* 가사 + 코드 */}
                <div className="space-y-2">
                  <h6 className="text-sm font-semibold text-gray-700 mb-2">가사 + 코드:</h6>
                  {lyrics.slice(0, showAllLyrics ? lyrics.length : 20).map((lyric: any, index: number) => (
                    <div key={index} className="flex items-start space-x-4 py-2 border-b border-gray-100">
                      <div className="flex flex-wrap gap-1 min-w-[80px]">
                        {lyric.chords && lyric.chords.length > 0 ? (
                          lyric.chords.map((chord: string, chordIndex: number) => (
                            <span key={chordIndex} className="text-sm font-medium text-blue-600 bg-blue-50 px-2 py-1 rounded">
                              {chord}
                            </span>
                          ))
                        ) : (
                          <span className="text-sm text-gray-400">-</span>
                        )}
                      </div>
                      <div className="flex-1">
                        <span className="text-gray-800">{lyric.text}</span>
                        {lyric.line_type && lyric.line_type !== 'normal' && (
                          <span className="ml-2 text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded">
                            {lyric.line_type}
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                  
                  {/* 더보기 / 접기 */}
                  {lyrics.length > 20 && (
                    <div className="mt-3">
                      <button
                        onClick={() => setShowAllLyrics(!showAllLyrics)}
                        className="text-sm px-3 py-1 rounded bg-gray-100 hover:bg-gray-200"
                      >
                        {showAllLyrics ? '접기' : `더보기 (${lyrics.length - 20}줄)`}
                      </button>
                    </div>
                  )}

                  {/* 추출 정보 표시 */}
                  {((data as any)?.metadata?.lyrics_extracted) && (
                    <div className="mt-4 p-3 bg-green-50 rounded-lg">
                      <div className="flex items-center space-x-2">
                        <span className="text-green-600">✅</span>
                        <span className="text-sm text-green-800">
                          유튜브에서 실제 가사와 코드를 추출했습니다
                        </span>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
      )}

    </div>
  )
}
