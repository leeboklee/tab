'use client'

import { Activity, FolderHeart, Music2, Radio } from 'lucide-react'

export type AppSection = 'discover' | 'workspace' | 'practice' | 'library'

interface NavigationProps {
  activeSection: AppSection
  onSectionChange: (section: AppSection) => void
  pipelineStatusLabel: string
}

const sections: { id: AppSection; label: string; icon: typeof Radio }[] = [
  { id: 'discover', label: '탐색', icon: Radio },
  { id: 'workspace', label: '결과', icon: Activity },
  { id: 'practice', label: '연습', icon: Music2 },
  { id: 'library', label: '보관함', icon: FolderHeart },
]

export default function Navigation({
  activeSection,
  onSectionChange,
  pipelineStatusLabel,
}: NavigationProps) {
  const connected = pipelineStatusLabel.includes('연결')

  return (
    <nav className="sticky top-0 z-50 border-b border-white/8 bg-[#0a0d14]/90 backdrop-blur-md">
      <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-4 py-3 sm:px-6">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#ff8a3d]">
            <Music2 className="h-4 w-4 text-white" />
          </div>
          <div>
            <h1 className="text-base font-semibold text-white">Guitar2Tabs</h1>
            <p className="text-xs text-white/45">YouTube → 기타 탭</p>
          </div>
        </div>

        <div className="hidden items-center gap-1 sm:flex">
          {sections.map(({ id, label, icon: Icon }) => {
            const active = id === activeSection
            return (
              <button
                key={id}
                onClick={() => onSectionChange(id)}
                className={`flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm transition ${
                  active ? 'bg-white/10 text-white' : 'text-white/55 hover:bg-white/5 hover:text-white/80'
                }`}
              >
                <Icon className="h-3.5 w-3.5" />
                {label}
              </button>
            )
          })}
        </div>

        <div className="flex items-center gap-2 text-xs">
          <span className={`h-2 w-2 rounded-full ${connected ? 'bg-emerald-400' : 'bg-amber-400'}`} />
          <span className="text-white/70">{pipelineStatusLabel}</span>
        </div>
      </div>
    </nav>
  )
}
