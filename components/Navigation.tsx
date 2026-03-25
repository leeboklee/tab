'use client'

import { motion } from 'framer-motion'
import { Activity, FolderHeart, Music2, Radio } from 'lucide-react'

export type AppSection = 'discover' | 'workspace' | 'practice' | 'library'

interface NavigationProps {
  activeSection: AppSection
  currentPage: 'home' | 'result'
  onSectionChange: (section: AppSection) => void
  pipelineStatusLabel: string
}

const sectionIcons = {
  discover: Radio,
  workspace: Activity,
  practice: Music2,
  library: FolderHeart,
}

const sections: { id: AppSection; label: string; description: string }[] = [
  { id: 'discover', label: '탐색', description: 'URL 입력과 진단' },
  { id: 'workspace', label: '워크스페이스', description: '분석 결과와 탭' },
  { id: 'practice', label: '연습도구', description: '템포·코드·재생' },
  { id: 'library', label: '보관함', description: '즐겨찾기와 최근 흐름' },
]

export default function Navigation({
  activeSection,
  currentPage,
  onSectionChange,
  pipelineStatusLabel,
}: NavigationProps) {
  return (
    <nav className="sticky top-0 z-50 border-b border-white/10 bg-[rgba(9,12,20,0.86)] backdrop-blur-xl">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-4 sm:px-6 lg:px-8">
        <div className="flex items-center gap-4">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[linear-gradient(135deg,#ff8a3d,#ffcf66)] shadow-[0_12px_30px_rgba(255,138,61,0.28)]">
            <Music2 className="h-5 w-5 text-[#171717]" />
          </div>
          <div>
            <p className="text-[11px] uppercase tracking-[0.28em] text-[#ffcf66]">TABE LAB</p>
            <h1 className="text-lg font-semibold text-white">YouTube to Tabs Workspace</h1>
          </div>
        </div>

        <div className="hidden items-center gap-2 lg:flex">
          {sections.map((section) => {
            const Icon = sectionIcons[section.id]
            const active = section.id === activeSection
            return (
              <motion.button
                key={section.id}
                onClick={() => onSectionChange(section.id)}
                className={`rounded-2xl px-4 py-3 text-left transition ${
                  active
                    ? 'bg-white text-[#0b1020] shadow-[0_14px_36px_rgba(255,255,255,0.18)]'
                    : 'bg-white/5 text-white/80 hover:bg-white/10'
                }`}
                whileHover={{ y: -2 }}
                whileTap={{ scale: 0.98 }}
              >
                <div className="flex items-center gap-2">
                  <Icon className="h-4 w-4" />
                  <span className="text-sm font-semibold">{section.label}</span>
                </div>
                <p className={`mt-1 text-xs ${active ? 'text-[#48506a]' : 'text-white/55'}`}>{section.description}</p>
              </motion.button>
            )
          })}
        </div>

        <div className="text-right">
          <p className="text-[11px] uppercase tracking-[0.24em] text-white/45">Pipeline</p>
          <p className="text-sm font-medium text-white">{pipelineStatusLabel}</p>
          <p className="text-xs text-white/55">{currentPage === 'result' ? '결과 워크스페이스 활성' : '입력 대기'}</p>
        </div>
      </div>
    </nav>
  )
}
