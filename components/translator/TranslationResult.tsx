'use client';

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { BookOpen, FileText, Compass, Globe, Info, CornerDownRight } from 'lucide-react';

interface GlossaryItem {
  term: string;
  originalLanguage: string;
  koreanTerm: string;
  explanation: string;
}

interface TranslationData {
  bookTitle: string;
  chapterTitle: string;
  koreanTranslation: string;
  glossary: GlossaryItem[];
  philosophicalCommentary: string;
  originalText?: string;
}

interface TranslationResultProps {
  data: TranslationData;
  isLoading: boolean;
}

type TabType = 'translation' | 'original' | 'glossary' | 'commentary';

export default function TranslationResult({ data, isLoading }: TranslationResultProps) {
  const [activeTab, setActiveTab] = useState<TabType>('translation');

  if (isLoading) {
    return (
      <div className="w-full bg-slate-900/40 border border-white/5 rounded-2xl p-8 flex flex-col items-center justify-center min-h-[300px]">
        <div className="relative w-16 h-16 mb-4">
          <div className="absolute inset-0 rounded-full border-4 border-slate-800 border-t-amber-500 animate-spin" />
          <div className="absolute inset-2 rounded-full border-4 border-slate-800 border-b-indigo-500 animate-spin-reverse" />
        </div>
        <p className="text-sm font-semibold text-slate-200 animate-pulse">Gemini AI 분석 서버가 원문을 검독하고 있습니다...</p>
        <p className="text-xs text-slate-500 mt-2">고어(古語) 대조 및 용어 사전 생성 중...</p>
      </div>
    );
  }

  const tabs = [
    { id: 'translation', label: '한글 번역', icon: LanguagesIcon },
    { id: 'original', label: '영어/원문 대조', icon: Globe },
    { id: 'glossary', label: '용어 사전', icon: BookOpen },
    { id: 'commentary', label: '철학적 해설', icon: Compass },
  ];

  return (
    <div className="w-full space-y-6">
      {/* Title Card */}
      <div className="w-full bg-gradient-to-r from-slate-900/90 to-slate-950/90 border border-white/10 rounded-2xl p-5 shadow-xl relative overflow-hidden flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-500/5 rounded-full blur-3xl pointer-events-none" />
        <div>
          <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-400 text-[10px] font-semibold uppercase tracking-wider mb-2.5">
            <Info className="w-3 h-3" />
            <span>분석 완료</span>
          </div>
          <h2 className="text-xl font-extrabold text-white tracking-tight">
            {data.bookTitle}
          </h2>
          <p className="text-xs text-slate-400 font-medium flex items-center gap-1.5 mt-1">
            <CornerDownRight className="w-3.5 h-3.5 text-indigo-400" />
            <span>{data.chapterTitle}</span>
          </p>
        </div>
      </div>

      {/* Tabs list */}
      <div className="flex overflow-x-auto gap-1.5 p-1 bg-slate-950/80 border border-white/5 rounded-xl scrollbar-none">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as TabType)}
              className={`flex-1 min-w-[100px] flex items-center justify-center gap-2 py-3 px-2 rounded-lg text-xs font-bold transition-all relative ${
                isActive ? 'text-white' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              {isActive && (
                <motion.div
                  layoutId="activeTabGlow"
                  className="absolute inset-0 bg-white/5 rounded-lg border border-white/10 shadow-inner"
                  transition={{ type: 'spring', stiffness: 380, damping: 30 }}
                />
              )}
              <Icon className={`w-3.5 h-3.5 ${isActive ? 'text-amber-400' : 'text-slate-400'}`} />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* Tab Panels */}
      <div className="bg-slate-900/40 border border-white/5 rounded-2xl p-6 shadow-2xl min-h-[250px] relative overflow-hidden">
        <div className="absolute top-0 right-0 w-32 h-32 bg-amber-500/5 rounded-full blur-3xl pointer-events-none" />

        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.15 }}
            className="w-full h-full text-slate-200 text-sm leading-relaxed"
          >
            {/* Translation Tab */}
            {activeTab === 'translation' && (
              <div className="space-y-4">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-amber-400/80 mb-2">한국어 번역본</h3>
                <div className="whitespace-pre-line bg-slate-950/40 border border-white/5 rounded-xl p-5 text-slate-100 font-serif leading-8 text-[15px] shadow-inner">
                  {data.koreanTranslation}
                </div>
              </div>
            )}

            {/* Original Text Tab */}
            {activeTab === 'original' && (
              <div className="space-y-4">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-indigo-400/80 mb-2">영문/원문</h3>
                <div className="whitespace-pre-line bg-slate-950/40 border border-white/5 rounded-xl p-5 text-slate-300 font-mono text-xs leading-relaxed shadow-inner overflow-x-auto max-h-[500px]">
                  {data.originalText || '제공된 영문/원문 텍스트가 없습니다. 주소를 통해 파싱한 경우에만 대조가 가능합니다.'}
                </div>
              </div>
            )}

            {/* Glossary Tab */}
            {activeTab === 'glossary' && (
              <div className="space-y-4">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-amber-400/80 mb-4">핵심 고어 및 철학 용어 사전</h3>
                {data.glossary && data.glossary.length > 0 ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {data.glossary.map((item, idx) => (
                      <motion.div
                        key={idx}
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ delay: idx * 0.05 }}
                        className="bg-slate-950/50 border border-white/10 rounded-xl p-4 shadow-md flex flex-col justify-between hover:border-amber-500/30 transition-all duration-300 group"
                      >
                        <div>
                          <div className="flex items-center justify-between gap-2 mb-2">
                            <span className="font-bold text-amber-200 text-sm group-hover:text-amber-400 transition-colors">
                              {item.term}
                            </span>
                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-800 border border-white/10 text-slate-400 font-medium">
                              {item.originalLanguage}
                            </span>
                          </div>
                          <div className="text-xs font-bold text-slate-100 mb-2 bg-indigo-500/10 border border-indigo-500/20 px-2 py-1 rounded inline-block">
                            {item.koreanTerm}
                          </div>
                          <p className="text-xs text-slate-400 leading-relaxed">
                            {item.explanation}
                          </p>
                        </div>
                      </motion.div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-10 text-slate-500">
                    추출된 핵심 철학 용어가 없습니다.
                  </div>
                )}
              </div>
            )}

            {/* Commentary Tab */}
            {activeTab === 'commentary' && (
              <div className="space-y-4">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-indigo-400/80 mb-2">AI 철학적 해설 및 맥락</h3>
                <div className="whitespace-pre-line bg-slate-950/40 border border-white/5 rounded-xl p-6 text-slate-200 leading-7 text-sm font-sans shadow-inner">
                  {data.philosophicalCommentary}
                </div>
              </div>
            )}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}

// Custom icon for languages
function LanguagesIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      <path d="m5 8 6 6" />
      <path d="m4 14 6-6 2-3" />
      <path d="M2 5h12" />
      <path d="M7 2h1" />
      <path d="m22 22-5-10-5 10" />
      <path d="M14 18h6" />
    </svg>
  );
}
