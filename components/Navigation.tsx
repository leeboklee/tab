'use client'

import { useState } from 'react'
import { motion } from 'framer-motion'
import { Home, Search, Music, Settings, Menu, X } from 'lucide-react'

interface NavigationProps {
  onHomeClick: () => void
  onSearchClick: () => void
  currentPage: 'home' | 'result'
}

export default function Navigation({ onHomeClick, onSearchClick, currentPage }: NavigationProps) {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)

  const navItems = [
    {
      id: 'home',
      label: '홈',
      icon: <Home className="h-5 w-5" />,
      onClick: onHomeClick,
      active: currentPage === 'home'
    },
    {
      id: 'search',
      label: '새 검색',
      icon: <Search className="h-5 w-5" />,
      onClick: onSearchClick,
      active: currentPage === 'result'
    }
  ]

  return (
    <nav className="bg-white/95 backdrop-blur-sm border-b border-gray-200 sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* 로고 */}
          <motion.div 
            className="flex items-center space-x-3"
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.5 }}
          >
            <div className="p-2 bg-primary-100 rounded-lg">
              <Music className="h-8 w-8 text-primary-600" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Guitar2Tabs</h1>
              <p className="text-sm text-gray-600">AI 기반 유튜브 음악 분석</p>
            </div>
          </motion.div>

          {/* 데스크톱 네비게이션 */}
          <div className="hidden md:flex items-center space-x-1">
            {navItems.map((item) => (
              <motion.button
                key={item.id}
                onClick={item.onClick}
                className={`flex items-center space-x-2 px-4 py-2 rounded-lg transition-all duration-200 ${
                  item.active
                    ? 'bg-primary-100 text-primary-700 shadow-sm'
                    : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
                }`}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
              >
                {item.icon}
                <span className="font-medium">{item.label}</span>
              </motion.button>
            ))}
          </div>

          {/* AI 표시 */}
          <motion.div 
            className="hidden md:flex items-center space-x-2"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.5, delay: 0.2 }}
          >
            <span className="text-sm text-gray-600">Powered by AI</span>
            <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
          </motion.div>

          {/* 모바일 메뉴 버튼 */}
          <button
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            className="md:hidden p-2 rounded-lg text-gray-600 hover:bg-gray-100 hover:text-gray-900 transition-colors duration-200"
          >
            {isMobileMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
          </button>
        </div>

        {/* 모바일 메뉴 */}
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ 
            opacity: isMobileMenuOpen ? 1 : 0,
            height: isMobileMenuOpen ? 'auto' : 0
          }}
          transition={{ duration: 0.3 }}
          className="md:hidden overflow-hidden"
        >
          <div className="py-4 space-y-2 border-t border-gray-200">
            {navItems.map((item) => (
              <motion.button
                key={item.id}
                onClick={() => {
                  item.onClick()
                  setIsMobileMenuOpen(false)
                }}
                className={`w-full flex items-center space-x-3 px-4 py-3 rounded-lg transition-all duration-200 ${
                  item.active
                    ? 'bg-primary-100 text-primary-700'
                    : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
                }`}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
              >
                {item.icon}
                <span className="font-medium">{item.label}</span>
              </motion.button>
            ))}
            
            <div className="flex items-center justify-center pt-2">
              <span className="text-xs text-gray-500">Powered by AI</span>
              <div className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse ml-2"></div>
            </div>
          </div>
        </motion.div>
      </div>
    </nav>
  )
}
