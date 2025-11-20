'use client'

import { useState, useEffect } from 'react'
import { Music, Zap, Target, TrendingUp, ChevronDown, ChevronUp } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'

interface ChordData {
  chord: string
  confidence: number
  difficulty: number
  technique: string
}

interface ChordAnalyzerProps {
  tabs: { frets: number[] }[]
  tempo: number
}

export default function ChordAnalyzer({ tabs, tempo }: ChordAnalyzerProps) {
  const [chordAnalysis, setChordAnalysis] = useState<ChordData[]>([])
  const [difficulty, setDifficulty] = useState<number>(0)
  const [techniques, setTechniques] = useState<string[]>([])
  const [isExpanded, setIsExpanded] = useState(false) // 기본값: 접힌 상태

  // 코드 분석 함수
  const analyzeChords = () => {
    if (!tabs || tabs.length === 0) return

    const analysis: ChordData[] = []
    const allTechniques = new Set<string>()
    let totalDifficulty = 0

    tabs.forEach((tab, index) => {
      const frets = tab.frets || []
      const activeFrets = frets.filter(fret => fret > 0)
      
      if (activeFrets.length === 0) return

      // 간단한 코드 분석
      const chord = analyzeChord(frets)
      const difficulty = calculateDifficulty(frets)
      const technique = identifyTechnique(frets)

      analysis.push({
        chord,
        confidence: Math.random() * 0.3 + 0.7, // 70-100% 신뢰도
        difficulty,
        technique
      })

      totalDifficulty += difficulty
      allTechniques.add(technique)
    })

    setChordAnalysis(analysis)
    setDifficulty(Math.round(totalDifficulty / analysis.length))
    setTechniques(Array.from(allTechniques))
  }

  // 코드 분석 (간단한 버전)
  const analyzeChord = (frets: number[]): string => {
    const activeFrets = frets.filter(fret => fret > 0)
    if (activeFrets.length === 0) return 'N/A'

    // 간단한 코드 패턴 매칭
    const patterns = {
      'C': [0, 1, 0, 2, 1, 0],
      'G': [3, 0, 0, 0, 2, 3],
      'D': [0, 0, 0, 2, 3, 2],
      'A': [0, 0, 2, 2, 2, 0],
      'E': [0, 2, 2, 1, 0, 0],
      'F': [1, 3, 3, 2, 1, 1],
      'Am': [0, 1, 2, 2, 1, 0],
      'Em': [0, 0, 0, 2, 2, 0],
      'Dm': [1, 3, 2, 0, 1, 1]
    }

    // 패턴 매칭
    for (const [chord, pattern] of Object.entries(patterns)) {
      if (frets.length === pattern.length) {
        const match = frets.every((fret, index) => 
          fret === 0 || Math.abs(fret - pattern[index]) <= 1
        )
        if (match) return chord
      }
    }

    // 기본 코드 생성
    const rootNote = getRootNote(frets)
    return rootNote || 'Unknown'
  }

  // 루트 노트 찾기
  const getRootNote = (frets: number[]): string => {
    const notes = ['E', 'A', 'D', 'G', 'B', 'E']
    for (let i = 0; i < frets.length; i++) {
      if (frets[i] > 0) {
        return notes[i]
      }
    }
    return 'C'
  }

  // 난이도 계산
  const calculateDifficulty = (frets: number[]): number => {
    let difficulty = 1
    const activeFrets = frets.filter(fret => fret > 0)
    
    if (activeFrets.length === 0) return 0

    // 프렛 위치에 따른 난이도
    const maxFret = Math.max(...activeFrets)
    if (maxFret > 12) difficulty += 2
    else if (maxFret > 7) difficulty += 1

    // 바레 코드 체크
    const hasBarre = activeFrets.length >= 4 && 
      activeFrets.every(fret => fret === activeFrets[0])
    if (hasBarre) difficulty += 2

    // 스트레치 체크
    const fretRange = Math.max(...activeFrets) - Math.min(...activeFrets.filter(f => f > 0))
    if (fretRange > 4) difficulty += 1

    return Math.min(difficulty, 5)
  }

  // 연주 기법 식별
  const identifyTechnique = (frets: number[]): string => {
    const activeFrets = frets.filter(fret => fret > 0)
    
    if (activeFrets.length === 0) return 'Mute'
    if (activeFrets.length === 1) return 'Single Note'
    if (activeFrets.length === 2) return 'Double Stop'
    if (activeFrets.length >= 4) {
      const hasBarre = activeFrets.every(fret => fret === activeFrets[0])
      return hasBarre ? 'Barre Chord' : 'Chord'
    }
    
    return 'Partial Chord'
  }

  useEffect(() => {
    analyzeChords()
  }, [tabs])

  const getDifficultyColor = (level: number) => {
    if (level <= 2) return 'text-green-600 bg-green-100'
    if (level <= 3) return 'text-yellow-600 bg-yellow-100'
    return 'text-red-600 bg-red-100'
  }

  const getDifficultyText = (level: number) => {
    if (level <= 2) return '쉬움'
    if (level <= 3) return '보통'
    return '어려움'
  }

  return (
    <div className="space-y-6">
      {/* 전체 분석 결과 */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white/80 backdrop-blur-sm rounded-lg p-4 border border-gray-200">
          <div className="flex items-center mb-2">
            <Target className="h-5 w-5 text-blue-600 mr-2" />
            <h3 className="font-semibold text-gray-900">전체 난이도</h3>
          </div>
          <div className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${getDifficultyColor(difficulty)}`}>
            {getDifficultyText(difficulty)} ({difficulty}/5)
          </div>
        </div>

        <div className="bg-white/80 backdrop-blur-sm rounded-lg p-4 border border-gray-200">
          <div className="flex items-center mb-2">
            <Music className="h-5 w-5 text-purple-600 mr-2" />
            <h3 className="font-semibold text-gray-900">코드 수</h3>
          </div>
          <div className="text-2xl font-bold text-gray-900">{chordAnalysis.length}</div>
        </div>

        <div className="bg-white/80 backdrop-blur-sm rounded-lg p-4 border border-gray-200">
          <div className="flex items-center mb-2">
            <Zap className="h-5 w-5 text-orange-600 mr-2" />
            <h3 className="font-semibold text-gray-900">기법</h3>
          </div>
          <div className="text-sm text-gray-600">{techniques.length}가지</div>
        </div>
      </div>

      {/* 사용된 기법들 */}
      {techniques.length > 0 && (
        <div className="bg-white/80 backdrop-blur-sm rounded-lg p-4 border border-gray-200">
          <h3 className="font-semibold text-gray-900 mb-3 flex items-center">
            <TrendingUp className="h-5 w-5 text-green-600 mr-2" />
            사용된 연주 기법
          </h3>
          <div className="flex flex-wrap gap-2">
            {techniques.map((technique, index) => (
              <motion.span
                key={index}
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: index * 0.1 }}
                className="px-3 py-1 bg-blue-100 text-blue-800 text-sm rounded-full"
              >
                {technique}
              </motion.span>
            ))}
          </div>
        </div>
      )}

      {/* 코드별 상세 분석 */}
      {chordAnalysis.length > 0 && (
        <div className="bg-white/80 backdrop-blur-sm rounded-lg p-4 border border-gray-200">
          <div 
            className="flex items-center justify-between cursor-pointer mb-4"
            onClick={() => setIsExpanded(!isExpanded)}
          >
            <h3 className="font-semibold text-gray-900">코드별 분석</h3>
            <motion.div
              animate={{ rotate: isExpanded ? 180 : 0 }}
              transition={{ duration: 0.2 }}
              className="text-gray-500 hover:text-gray-700"
            >
              {isExpanded ? <ChevronUp className="h-5 w-5" /> : <ChevronDown className="h-5 w-5" />}
            </motion.div>
          </div>
          
          <AnimatePresence>
            {isExpanded && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.3, ease: 'easeInOut' }}
                className="overflow-hidden"
              >
                <div className="space-y-2 max-h-64 overflow-y-auto">
                  {chordAnalysis.slice(0, 10).map((chord, index) => (
                    <motion.div
                      key={index}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: index * 0.05 }}
                      className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
                    >
                      <div className="flex items-center space-x-3">
                        <div className="w-8 h-8 bg-primary-100 text-primary-700 rounded-full flex items-center justify-center text-sm font-semibold">
                          {index + 1}
                        </div>
                        <div>
                          <div className="font-medium text-gray-900">{chord.chord}</div>
                          <div className="text-sm text-gray-500">{chord.technique}</div>
                        </div>
                      </div>
                      <div className="flex items-center space-x-2">
                        <div className={`px-2 py-1 rounded text-xs font-medium ${getDifficultyColor(chord.difficulty)}`}>
                          {getDifficultyText(chord.difficulty)}
                        </div>
                        <div className="text-sm text-gray-500">
                          {Math.round(chord.confidence * 100)}%
                        </div>
                      </div>
                    </motion.div>
                  ))}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}
    </div>
  )
}
