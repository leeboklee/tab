'use client';

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Link2, Clipboard, ArrowRight, FileText, Sparkles, AlertCircle } from 'lucide-react';
import toast from 'react-hot-toast';

interface TranslateInputProps {
  onAnalyze: (url: string, rawText?: string) => void;
  isLoading: boolean;
}

export default function TranslateInput({ onAnalyze, isLoading }: TranslateInputProps) {
  const [inputMode, setInputMode] = useState<'url' | 'text'>('url');
  const [url, setUrl] = useState('');
  const [rawText, setRawText] = useState('');

  const handlePasteUrl = async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (text.startsWith('http://') || text.startsWith('https://')) {
        setUrl(text);
        toast.success('클립보드에서 주소를 가져왔습니다.');
      } else {
        toast.error('클립보드에 올바른 URL이 없습니다.');
      }
    } catch (err) {
      toast.error('클립보드 읽기 권한이 필요합니다.');
    }
  };

  const handlePasteText = async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (text) {
        setRawText(text);
        toast.success('클립보드에서 텍스트를 가져왔습니다.');
      }
    } catch (err) {
      toast.error('클립보드 읽기 권한이 필요합니다.');
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (inputMode === 'url') {
      if (!url.trim()) {
        toast.error('분석할 웹사이트 주소를 입력해주세요.');
        return;
      }
      onAnalyze(url.trim());
    } else {
      if (!rawText.trim()) {
        toast.error('분석할 원문 내용을 입력해주세요.');
        return;
      }
      onAnalyze('', rawText.trim());
    }
  };

  return (
    <div className="w-full bg-slate-900/60 border border-white/5 rounded-2xl p-5 shadow-2xl backdrop-blur-md relative overflow-hidden">
      {/* Glow highlight */}
      <div className="absolute -top-24 -left-24 w-48 h-48 bg-amber-500/10 rounded-full blur-3xl" />
      <div className="absolute -bottom-24 -right-24 w-48 h-48 bg-indigo-500/10 rounded-full blur-3xl" />

      {/* Tabs */}
      <div className="flex gap-2 mb-5 p-1 bg-slate-950/60 rounded-xl border border-white/5">
        <button
          type="button"
          onClick={() => setInputMode('url')}
          className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-xs font-semibold tracking-wide transition-all ${
            inputMode === 'url'
              ? 'bg-gradient-to-r from-amber-500 to-amber-600 text-slate-950 shadow-lg'
              : 'text-slate-400 hover:text-white'
          }`}
        >
          <Link2 className="w-3.5 h-3.5" />
          <span>경전 URL 주소 입력</span>
        </button>
        <button
          type="button"
          onClick={() => setInputMode('text')}
          className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-xs font-semibold tracking-wide transition-all ${
            inputMode === 'text'
              ? 'bg-gradient-to-r from-indigo-500 to-indigo-600 text-white shadow-lg'
              : 'text-slate-400 hover:text-white'
          }`}
        >
          <FileText className="w-3.5 h-3.5" />
          <span>직접 텍스트 붙여넣기</span>
        </button>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4 relative z-10">
        <AnimatePresence mode="wait">
          {inputMode === 'url' ? (
            <motion.div
              key="url-input"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.15 }}
              className="space-y-3"
            >
              <label className="block text-xs font-semibold text-slate-300">
                경전 또는 논서 웹사이트 주소
              </label>
              <div className="relative flex items-center">
                <input
                  type="url"
                  placeholder="https://www.wisdomlib.org/... 또는 https://suttacentral.net/..."
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  className="w-full bg-slate-950/80 border border-white/10 rounded-xl py-3.5 pl-4 pr-12 text-sm text-white placeholder-slate-500 outline-none focus:border-amber-500/50 focus:ring-1 focus:ring-amber-500/30 transition-all shadow-inner"
                  disabled={isLoading}
                />
                <button
                  type="button"
                  onClick={handlePasteUrl}
                  disabled={isLoading}
                  className="absolute right-3.5 p-1.5 rounded-lg bg-white/5 border border-white/10 hover:bg-white/10 text-slate-400 hover:text-amber-400 transition-colors"
                  title="클립보드 주소 붙여넣기"
                >
                  <Clipboard className="w-4 h-4" />
                </button>
              </div>
              <p className="text-[11px] text-slate-400 flex items-center gap-1.5 px-1">
                <AlertCircle className="w-3 h-3 text-amber-500/70" />
                <span>WisdomLib, SuttaCentral 등 대부분의 텍스트 사이트 자동 파싱 지원</span>
              </p>
            </motion.div>
          ) : (
            <motion.div
              key="text-input"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.15 }}
              className="space-y-3"
            >
              <div className="flex justify-between items-center">
                <label className="block text-xs font-semibold text-slate-300">
                  직접 복사한 영문/원문 텍스트
                </label>
                <button
                  type="button"
                  onClick={handlePasteText}
                  disabled={isLoading}
                  className="flex items-center gap-1 text-[11px] font-medium text-indigo-400 hover:text-indigo-300 transition-colors"
                >
                  <Clipboard className="w-3 h-3" />
                  <span>클립보드 전체 붙여넣기</span>
                </button>
              </div>
              <textarea
                placeholder="해석하고 싶은 원문 텍스트를 여기에 직접 입력하거나 붙여넣어 주세요."
                value={rawText}
                onChange={(e) => setRawText(e.target.value)}
                rows={6}
                className="w-full bg-slate-950/80 border border-white/10 rounded-xl p-4 text-sm text-white placeholder-slate-500 outline-none focus:border-indigo-500/50 focus:ring-1 focus:ring-indigo-500/30 transition-all shadow-inner resize-none"
                disabled={isLoading}
              />
            </motion.div>
          )}
        </AnimatePresence>

        <button
          type="submit"
          disabled={isLoading}
          className={`w-full py-4 rounded-xl font-bold text-sm tracking-wider flex items-center justify-center gap-2 transition-all duration-300 shadow-lg ${
            isLoading
              ? 'bg-slate-800 text-slate-500 cursor-not-allowed border border-white/5'
              : inputMode === 'url'
              ? 'bg-gradient-to-r from-amber-500 via-amber-600 to-indigo-600 hover:from-amber-400 hover:to-indigo-500 text-white shadow-amber-500/10 hover:shadow-indigo-500/20 active:scale-[0.98]'
              : 'bg-gradient-to-r from-indigo-500 via-indigo-600 to-amber-500 hover:from-indigo-400 hover:to-amber-500 text-white shadow-indigo-500/10 hover:shadow-amber-500/20 active:scale-[0.98]'
          }`}
        >
          {isLoading ? (
            <>
              <div className="w-4 h-4 border-2 border-slate-500 border-t-amber-400 rounded-full animate-spin" />
              <span>AI 경전 분석 및 번역 중...</span>
            </>
          ) : (
            <>
              <Sparkles className="w-4.5 h-4.5 animate-pulse" />
              <span>AI 경전 분석 및 번역하기</span>
              <ArrowRight className="w-4.5 h-4.5" />
            </>
          )}
        </button>
      </form>
    </div>
  );
}
