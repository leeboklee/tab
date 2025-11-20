'use client'

import { useState, useEffect } from 'react'
import Confetti from 'react-confetti'
import { Trophy, Star, Zap, Target } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'

interface Achievement {
  id: string
  title: string
  description: string
  icon: React.ReactNode
  color: string
  condition: () => boolean
}

interface AchievementCelebrationProps {
  isPlaying: boolean
  currentBeat: number
  totalBeats: number
  difficulty: number
}

export default function AchievementCelebration({ 
  isPlaying, 
  currentBeat, 
  totalBeats, 
  difficulty 
}: AchievementCelebrationProps) {
  const [showConfetti, setShowConfetti] = useState(false)
  const [achievements, setAchievements] = useState<Achievement[]>([])
  const [windowSize, setWindowSize] = useState({ width: 0, height: 0 })

  // 윈도우 크기 감지
  useEffect(() => {
    const updateWindowSize = () => {
      setWindowSize({ width: window.innerWidth, height: window.innerHeight })
    }
    
    updateWindowSize()
    window.addEventListener('resize', updateWindowSize)
    return () => window.removeEventListener('resize', updateWindowSize)
  }, [])

  // 성취 조건들
  const achievementDefinitions: Achievement[] = [
    {
      id: 'first_play',
      title: '첫 연주',
      description: '첫 번째 마디를 연주했습니다!',
      icon: <Star className="h-6 w-6" />,
      color: 'text-yellow-600 bg-yellow-100',
      condition: () => currentBeat >= 1 && !achievements.some(a => a.id === 'first_play')
    },
    {
      id: 'quarter_complete',
      title: '25% 완주',
      description: '곡의 1/4을 완주했습니다!',
      icon: <Target className="h-6 w-6" />,
      color: 'text-blue-600 bg-blue-100',
      condition: () => currentBeat >= totalBeats * 0.25 && !achievements.some(a => a.id === 'quarter_complete')
    },
    {
      id: 'half_complete',
      title: '50% 완주',
      description: '곡의 절반을 완주했습니다!',
      icon: <Zap className="h-6 w-6" />,
      color: 'text-purple-600 bg-purple-100',
      condition: () => currentBeat >= totalBeats * 0.5 && !achievements.some(a => a.id === 'half_complete')
    },
    {
      id: 'three_quarters',
      title: '75% 완주',
      description: '곡의 3/4을 완주했습니다!',
      icon: <Trophy className="h-6 w-6" />,
      color: 'text-orange-600 bg-orange-100',
      condition: () => currentBeat >= totalBeats * 0.75 && !achievements.some(a => a.id === 'three_quarters')
    },
    {
      id: 'full_complete',
      title: '완전 완주',
      description: '곡을 처음부터 끝까지 완주했습니다!',
      icon: <Trophy className="h-6 w-6" />,
      color: 'text-red-600 bg-red-100',
      condition: () => currentBeat >= totalBeats && !achievements.some(a => a.id === 'full_complete')
    },
    {
      id: 'difficult_song',
      title: '고난도 도전',
      description: '어려운 곡에 도전했습니다!',
      icon: <Zap className="h-6 w-6" />,
      color: 'text-red-600 bg-red-100',
      condition: () => difficulty >= 4 && !achievements.some(a => a.id === 'difficult_song')
    }
  ]

  // 성취 체크
  useEffect(() => {
    if (!isPlaying) return

    const newAchievements = achievementDefinitions.filter(achievement => 
      achievement.condition()
    )

    if (newAchievements.length > 0) {
      setAchievements(prev => [...prev, ...newAchievements])
      setShowConfetti(true)
      
      // 3초 후 컨페티 숨기기
      setTimeout(() => setShowConfetti(false), 3000)
    }
  }, [currentBeat, isPlaying, difficulty, totalBeats])

  return (
    <>
      {/* 컨페티 효과 */}
      <AnimatePresence>
        {showConfetti && (
          <Confetti
            width={windowSize.width}
            height={windowSize.height}
            recycle={false}
            numberOfPieces={200}
            gravity={0.3}
          />
        )}
      </AnimatePresence>

      {/* 성취 알림 */}
      <AnimatePresence>
        {achievements.length > 0 && (
          <div className="fixed top-4 right-4 z-50 space-y-2">
            {achievements.slice(-3).map((achievement, index) => (
              <motion.div
                key={achievement.id}
                initial={{ opacity: 0, x: 300, scale: 0.8 }}
                animate={{ opacity: 1, x: 0, scale: 1 }}
                exit={{ opacity: 0, x: 300, scale: 0.8 }}
                transition={{ 
                  delay: index * 0.1,
                  type: "spring",
                  stiffness: 300,
                  damping: 30
                }}
                className="bg-white/95 backdrop-blur-sm rounded-lg p-4 shadow-lg border border-gray-200 max-w-sm"
              >
                <div className="flex items-start space-x-3">
                  <div className={`p-2 rounded-full ${achievement.color}`}>
                    {achievement.icon}
                  </div>
                  <div className="flex-1">
                    <h4 className="font-semibold text-gray-900 text-sm">
                      {achievement.title}
                    </h4>
                    <p className="text-xs text-gray-600 mt-1">
                      {achievement.description}
                    </p>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </AnimatePresence>

      {/* 성취 통계 */}
      {achievements.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white/80 backdrop-blur-sm rounded-lg p-4 border border-gray-200"
        >
          <h3 className="font-semibold text-gray-900 mb-3 flex items-center">
            <Trophy className="h-5 w-5 text-yellow-600 mr-2" />
            성취 현황
          </h3>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
            {achievements.map((achievement) => (
              <div
                key={achievement.id}
                className={`flex items-center space-x-2 p-2 rounded-lg ${achievement.color}`}
              >
                {achievement.icon}
                <span className="text-sm font-medium">{achievement.title}</span>
              </div>
            ))}
          </div>
        </motion.div>
      )}
    </>
  )
}
