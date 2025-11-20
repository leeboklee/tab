'use client'

import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Heart, Plus, X, Edit3, Trash2, Star } from 'lucide-react'
import { toast } from 'react-hot-toast'

interface Favorite {
  id: string
  title: string
  url: string
  description: string
  addedAt: string
}

interface FavoritesManagerProps {
  onFavoriteClick: (url: string) => void
}

export default function FavoritesManager({ onFavoriteClick }: FavoritesManagerProps) {
  const [favorites, setFavorites] = useState<Favorite[]>([])
  const [isAdding, setIsAdding] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [newFavorite, setNewFavorite] = useState({
    title: '',
    url: '',
    description: ''
  })

  // 로컬 스토리지에서 즐겨찾기 로드
  useEffect(() => {
    const savedFavorites = localStorage.getItem('guitar2tabs-favorites')
    if (savedFavorites) {
      try {
        setFavorites(JSON.parse(savedFavorites))
      } catch (error) {
        console.error('Error loading favorites:', error)
      }
    } else {
      // 기본 즐겨찾기 추가
      const defaultFavorites: Favorite[] = [
        {
          id: 'default-1',
          title: '자주 듣는 곡',
          url: 'https://youtu.be/fAVQnVkB2ho?si=DaCOk9ogSSWexyl_',
          description: '좋아하는 음악',
          addedAt: new Date().toISOString()
        }
      ]
      setFavorites(defaultFavorites)
      localStorage.setItem('guitar2tabs-favorites', JSON.stringify(defaultFavorites))
    }
  }, [])

  // 즐겨찾기 저장
  const saveFavorites = (newFavorites: Favorite[]) => {
    setFavorites(newFavorites)
    localStorage.setItem('guitar2tabs-favorites', JSON.stringify(newFavorites))
  }

  // 즐겨찾기 추가
  const handleAddFavorite = () => {
    if (!newFavorite.title.trim() || !newFavorite.url.trim()) {
      toast.error('제목과 URL을 모두 입력해주세요!')
      return
    }

    // URL 유효성 검사
    const youtubeRegex = /^(https?:\/\/)?(www\.)?(youtube\.com\/watch\?v=|youtu\.be\/)[\w-]+/
    if (!youtubeRegex.test(newFavorite.url)) {
      toast.error('올바른 유튜브 URL을 입력해주세요!')
      return
    }

    const favorite: Favorite = {
      id: Date.now().toString(),
      title: newFavorite.title.trim(),
      url: newFavorite.url.trim(),
      description: newFavorite.description.trim() || '즐겨찾기',
      addedAt: new Date().toISOString()
    }

    const updatedFavorites = [...favorites, favorite]
    saveFavorites(updatedFavorites)
    
    setNewFavorite({ title: '', url: '', description: '' })
    setIsAdding(false)
    toast.success('즐겨찾기가 추가되었습니다!')
  }

  // 즐겨찾기 삭제
  const handleDeleteFavorite = (id: string) => {
    const updatedFavorites = favorites.filter(fav => fav.id !== id)
    saveFavorites(updatedFavorites)
    toast.success('즐겨찾기가 삭제되었습니다!')
  }

  // 즐겨찾기 편집
  const handleEditFavorite = (id: string) => {
    const favorite = favorites.find(fav => fav.id === id)
    if (favorite) {
      setNewFavorite({
        title: favorite.title,
        url: favorite.url,
        description: favorite.description
      })
      setEditingId(id)
      setIsAdding(true)
    }
  }

  // 즐겨찾기 수정
  const handleUpdateFavorite = () => {
    if (!newFavorite.title.trim() || !newFavorite.url.trim()) {
      toast.error('제목과 URL을 모두 입력해주세요!')
      return
    }

    const youtubeRegex = /^(https?:\/\/)?(www\.)?(youtube\.com\/watch\?v=|youtu\.be\/)[\w-]+/
    if (!youtubeRegex.test(newFavorite.url)) {
      toast.error('올바른 유튜브 URL을 입력해주세요!')
      return
    }

    const updatedFavorites = favorites.map(fav => 
      fav.id === editingId 
        ? {
            ...fav,
            title: newFavorite.title.trim(),
            url: newFavorite.url.trim(),
            description: newFavorite.description.trim() || '즐겨찾기'
          }
        : fav
    )
    
    saveFavorites(updatedFavorites)
    setNewFavorite({ title: '', url: '', description: '' })
    setEditingId(null)
    setIsAdding(false)
    toast.success('즐겨찾기가 수정되었습니다!')
  }

  // 취소
  const handleCancel = () => {
    setNewFavorite({ title: '', url: '', description: '' })
    setEditingId(null)
    setIsAdding(false)
  }

  return (
    <div className="space-y-4">
      {/* 헤더 */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <Star className="h-5 w-5 text-yellow-500" />
          <h3 className="text-lg font-semibold text-gray-900">즐겨찾기</h3>
          <span className="text-sm text-gray-500">({favorites.length})</span>
        </div>
        <button
          onClick={() => setIsAdding(true)}
          className="flex items-center space-x-1 px-3 py-1 bg-primary-100 text-primary-700 rounded-lg hover:bg-primary-200 transition-colors duration-200 text-sm"
        >
          <Plus className="h-4 w-4" />
          <span>추가</span>
        </button>
      </div>

      {/* 즐겨찾기 목록 */}
      <div className="space-y-2">
        <AnimatePresence>
          {favorites.map((favorite) => (
            <motion.div
              key={favorite.id}
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="group p-4 bg-white/60 hover:bg-white/80 border border-gray-200 hover:border-primary-300 rounded-lg transition-all duration-200"
            >
              <div className="flex items-center justify-between">
                <div 
                  className="flex-1 cursor-pointer"
                  onClick={() => onFavoriteClick(favorite.url)}
                >
                  <div className="flex items-center space-x-2 mb-1">
                    <Heart className="h-4 w-4 text-red-500" />
                    <span className="font-medium text-gray-900">{favorite.title}</span>
                  </div>
                  <p className="text-sm text-gray-600 mb-1">{favorite.description}</p>
                  <p className="text-xs text-gray-500 font-mono truncate">{favorite.url}</p>
                </div>
                
                <div className="flex items-center space-x-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button
                    onClick={() => handleEditFavorite(favorite.id)}
                    className="p-1 text-gray-400 hover:text-blue-600 transition-colors"
                    title="편집"
                  >
                    <Edit3 className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => handleDeleteFavorite(favorite.id)}
                    className="p-1 text-gray-400 hover:text-red-600 transition-colors"
                    title="삭제"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      {/* 추가/편집 폼 */}
      <AnimatePresence>
        {isAdding && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="bg-white/80 backdrop-blur-sm rounded-lg p-4 border border-gray-200"
          >
            <h4 className="font-medium text-gray-900 mb-3">
              {editingId ? '즐겨찾기 편집' : '새 즐겨찾기 추가'}
            </h4>
            
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  제목 *
                </label>
                <input
                  type="text"
                  value={newFavorite.title}
                  onChange={(e) => setNewFavorite(prev => ({ ...prev, title: e.target.value }))}
                  placeholder="곡 제목을 입력하세요"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  YouTube URL *
                </label>
                <input
                  type="url"
                  value={newFavorite.url}
                  onChange={(e) => setNewFavorite(prev => ({ ...prev, url: e.target.value }))}
                  placeholder="https://www.youtube.com/watch?v=..."
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  설명
                </label>
                <input
                  type="text"
                  value={newFavorite.description}
                  onChange={(e) => setNewFavorite(prev => ({ ...prev, description: e.target.value }))}
                  placeholder="설명을 입력하세요 (선택사항)"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                />
              </div>
              
              <div className="flex items-center space-x-2 pt-2">
                <button
                  onClick={editingId ? handleUpdateFavorite : handleAddFavorite}
                  className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors duration-200 text-sm"
                >
                  {editingId ? '수정' : '추가'}
                </button>
                <button
                  onClick={handleCancel}
                  className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors duration-200 text-sm"
                >
                  취소
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
