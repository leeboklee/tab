'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { Trash2, History, Book, ChevronRight, RefreshCw } from 'lucide-react';

export interface HistoryItem {
  id: string;
  url?: string;
  bookTitle: string;
  chapterTitle: string;
  timestamp: number;
  data: any;
}

interface HistoryListProps {
  items: HistoryItem[];
  onSelect: (item: HistoryItem) => void;
  onDelete: (id: string) => void;
  onClearAll: () => void;
}

export default function HistoryList({ items, onSelect, onDelete, onClearAll }: HistoryListProps) {
  if (items.length === 0) {
    return (
      <div className="w-full bg-slate-900/40 border border-white/5 rounded-2xl p-6 text-center text-slate-500 text-xs">
        <History className="w-8 h-8 text-slate-600 mx-auto mb-2" />
        <span>이전 번역 기록이 없습니다.</span>
      </div>
    );
  }

  const formatTime = (timestamp: number) => {
    const diff = Date.now() - timestamp;
    const mins = Math.floor(diff / 60000);
    const hours = Math.floor(mins / 60);
    const days = Math.floor(hours / 24);

    if (mins < 1) return '방금 전';
    if (mins < 60) return `${mins}분 전`;
    if (hours < 24) return `${hours}시간 전`;
    return `${days}일 전`;
  };

  return (
    <div className="w-full space-y-4">
      <div className="flex items-center justify-between px-1">
        <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
          <History className="w-3.5 h-3.5 text-indigo-400" />
          <span>최근 번역 기록 ({items.length})</span>
        </h3>
        <button
          onClick={onClearAll}
          className="text-[10px] font-bold text-red-400/80 hover:text-red-400 transition-colors"
        >
          기록 전체 삭제
        </button>
      </div>

      <div className="space-y-2.5 max-h-[400px] overflow-y-auto pr-1 scrollbar-thin">
        {items.map((item, idx) => (
          <motion.div
            key={item.id}
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: idx * 0.03 }}
            className="flex items-center gap-2 group"
          >
            {/* Main Item Button */}
            <button
              onClick={() => onSelect(item)}
              className="flex-1 flex items-center justify-between bg-slate-950/40 border border-white/5 hover:border-indigo-500/30 rounded-xl p-3.5 text-left transition-all duration-300 shadow-inner group-hover:bg-slate-950/60"
            >
              <div className="flex items-start gap-3 min-w-0">
                <div className="p-2 rounded-lg bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 mt-0.5">
                  <Book className="w-3.5 h-3.5" />
                </div>
                <div className="min-w-0">
                  <h4 className="text-xs font-bold text-slate-200 truncate group-hover:text-amber-300 transition-colors">
                    {item.bookTitle}
                  </h4>
                  <p className="text-[10px] text-slate-400 truncate mt-0.5">
                    {item.chapterTitle}
                  </p>
                  <div className="flex items-center gap-2 mt-1.5">
                    <span className={`text-[8px] px-1 py-0.2 rounded font-bold uppercase ${
                      item.url ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20' : 'bg-indigo-500/10 text-indigo-400 border border-indigo-500/20'
                    }`}>
                      {item.url ? 'URL' : '텍스트'}
                    </span>
                    <span className="text-[9px] text-slate-500">
                      {formatTime(item.timestamp)}
                    </span>
                  </div>
                </div>
              </div>
              <ChevronRight className="w-4 h-4 text-slate-600 group-hover:text-slate-400 transition-colors" />
            </button>

            {/* Delete button */}
            <button
              onClick={() => onDelete(item.id)}
              className="p-3 bg-red-950/20 border border-red-900/10 hover:border-red-500/30 text-red-400 hover:text-red-300 rounded-xl transition-all active:scale-95"
              title="삭제"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </motion.div>
        ))}
      </div>
    </div>
  );
}
