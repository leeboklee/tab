'use client'

import { useState } from 'react'
import { Guitar, Music, Zap, Mic, Volume2 } from 'lucide-react'

interface PlayingTechniquesProps {
  techniques?: string[]
  onTechniqueSelect?: (technique: string) => void
}

export default function PlayingTechniques({ techniques = [], onTechniqueSelect }: PlayingTechniquesProps) {
  const [selectedTechnique, setSelectedTechnique] = useState<string | null>(null)
  const [showDetails, setShowDetails] = useState<string | null>(null)

  const techniqueDetails = {
    'hammer-on': {
      name: '해머온',
      description: '프렛을 누르지 않고 손가락으로 현을 때려서 소리를 내는 기법',
      icon: <Zap className="h-5 w-5" />,
      color: 'bg-yellow-100 text-yellow-800',
      examples: ['1-3-5-7-8-7-5-3-1', '0-2-4-5-4-2-0']
    },
    'pull-off': {
      name: '풀오프',
      description: '높은 프렛에서 낮은 프렛으로 손가락을 떼면서 소리를 내는 기법',
      icon: <Zap className="h-5 w-5" />,
      color: 'bg-orange-100 text-orange-800',
      examples: ['8-7-5-3-1', '5-3-1-0']
    },
    'slide': {
      name: '슬라이드',
      description: '한 프렛에서 다른 프렛으로 손가락을 미끄러뜨리며 연주하는 기법',
      icon: <Music className="h-5 w-5" />,
      color: 'bg-blue-100 text-blue-800',
      examples: ['1/3', '5/7', '3\\1']
    },
    'bend': {
      name: '벤드',
      description: '현을 위로 당겨서 음을 높이는 기법',
      icon: <Volume2 className="h-5 w-5" />,
      color: 'bg-red-100 text-red-800',
      examples: ['3b', '5b', '7b']
    },
    'vibrato': {
      name: '비브라토',
      description: '프렛을 빠르게 흔들어 음을 떨리게 하는 기법',
      icon: <Mic className="h-5 w-5" />,
      color: 'bg-purple-100 text-purple-800',
      examples: ['3~', '5~', '7~']
    },
    'mute': {
      name: '뮤트',
      description: '현을 손바닥으로 가볍게 누르거나 터치하여 소리를 죽이는 기법',
      icon: <Guitar className="h-5 w-5" />,
      color: 'bg-gray-100 text-gray-800',
      examples: ['x', 'x-x-x-x']
    },
    'palm-mute': {
      name: '팜뮤트',
      description: '손바닥을 브리지 근처에 올려놓고 연주하는 기법',
      icon: <Guitar className="h-5 w-5" />,
      color: 'bg-indigo-100 text-indigo-800',
      examples: ['PM', 'PM-3-5-7']
    },
    'harmonics': {
      name: '하모닉스',
      description: '현의 특정 지점을 가볍게 터치하여 배음을 내는 기법',
      icon: <Music className="h-5 w-5" />,
      color: 'bg-green-100 text-green-800',
      examples: ['<12>', '<7>', '<5>']
    },
    'tapping': {
      name: '태핑',
      description: '피킹 손가락으로 프렛을 직접 때려서 연주하는 기법',
      icon: <Zap className="h-5 w-5" />,
      color: 'bg-pink-100 text-pink-800',
      examples: ['T-5-7-8-7-5-T', 'T-12-15-17']
    },
    'sweep-picking': {
      name: '스윕피킹',
      description: '피크를 현에 걸리지 않게 미끄러뜨리며 연주하는 기법',
      icon: <Music className="h-5 w-5" />,
      color: 'bg-teal-100 text-teal-800',
      examples: ['스윕 아르페지오', '고속 스케일']
    }
  }

  const handleTechniqueClick = (technique: string) => {
    setSelectedTechnique(technique)
    onTechniqueSelect?.(technique)
  }

  const toggleDetails = (technique: string) => {
    setShowDetails(showDetails === technique ? null : technique)
  }

  const getTechniqueCount = (technique: string) => {
    return techniques.filter(t => t === technique).length
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h4 className="text-lg font-semibold text-gray-900">사용된 연주 기법</h4>
        <span className="text-sm text-gray-600">{techniques.length}개 기법</span>
      </div>

      <div className="grid grid-cols-2 gap-2">
        {Object.entries(techniqueDetails).map(([key, detail]) => {
          const count = getTechniqueCount(key)
          const isSelected = selectedTechnique === key
          const isExpanded = showDetails === key
          
          return (
            <div key={key} className="space-y-2">
              <button
                onClick={() => handleTechniqueClick(key)}
                className={`w-full p-3 rounded-lg border-2 transition-all ${
                  isSelected
                    ? 'border-primary-500 bg-primary-50'
                    : 'border-gray-200 bg-white hover:border-gray-300'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <div className={`p-1 rounded ${detail.color}`}>
                      {detail.icon}
                    </div>
                    <div className="text-left">
                      <div className="font-medium text-sm">{detail.name}</div>
                      {count > 0 && (
                        <div className="text-xs text-gray-500">{count}회 사용</div>
                      )}
                    </div>
                  </div>
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      toggleDetails(key)
                    }}
                    className="text-gray-400 hover:text-gray-600"
                  >
                    {isExpanded ? '−' : '+'}
                  </button>
                </div>
              </button>

              {isExpanded && (
                <div className="p-3 bg-gray-50 rounded-lg text-sm space-y-2">
                  <p className="text-gray-700">{detail.description}</p>
                  <div>
                    <div className="font-medium text-gray-800 mb-1">예시:</div>
                    <div className="space-y-1">
                      {detail.examples.map((example, index) => (
                        <div key={index} className="font-mono text-xs bg-white px-2 py-1 rounded">
                          {example}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>
          )
        })}
      </div>

      {techniques.length === 0 && (
        <div className="text-center py-8 text-gray-500">
          <Guitar className="h-12 w-12 mx-auto mb-2 text-gray-300" />
          <p>사용된 연주 기법이 없습니다.</p>
          <p className="text-sm">타브 악보를 분석하면 기법이 표시됩니다.</p>
        </div>
      )}

      <div className="text-xs text-gray-500">
        <p>• 기법을 클릭하여 선택</p>
        <p>• + 버튼으로 상세 정보 확인</p>
        <p>• 사용 횟수와 예시 제공</p>
      </div>
    </div>
  )
}
