'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { Compass, Sparkles, Languages } from 'lucide-react';
import Link from 'next/link';

export default function Header() {
  return (
    <header className="w-full py-5 px-6 border-b border-white/10 bg-slate-950/80 backdrop-blur-md sticky top-0 z-50">
      <div className="max-w-4xl mx-auto flex items-center justify-between">
        <Link href="/translator" className="flex items-center gap-3 group">
          <div className="relative flex items-center justify-center w-10 h-10 rounded-xl bg-gradient-to-tr from-amber-500 to-indigo-600 shadow-lg shadow-indigo-500/20 group-hover:scale-105 transition-transform duration-300">
            <Compass className="w-5 h-5 text-white animate-spin-slow" />
            <div className="absolute -top-1 -right-1 bg-amber-400 text-[10px] text-slate-950 px-1 rounded-full font-bold flex items-center gap-0.5">
              <Sparkles className="w-2.5 h-2.5" /> AI
            </div>
          </div>
          <div>
            <h1 className="text-lg font-bold tracking-tight bg-gradient-to-r from-amber-200 via-white to-indigo-200 bg-clip-text text-transparent">
              Wisdom AI Translator
            </h1>
            <p className="text-[10px] text-slate-400 font-medium tracking-wide uppercase">
              동양 철학 & 경전 심층 해설
            </p>
          </div>
        </Link>

        <div className="flex items-center gap-2 bg-white/5 border border-white/10 px-3 py-1.5 rounded-lg text-xs font-medium text-slate-300 shadow-inner">
          <Languages className="w-3.5 h-3.5 text-amber-400" />
          <span>Gemini 1.5 Flash</span>
        </div>
      </div>
    </header>
  );
}
