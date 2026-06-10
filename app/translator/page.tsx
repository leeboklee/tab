'use client';

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Compass, Sparkles, BookOpen, HelpCircle } from 'lucide-react';
import toast from 'react-hot-toast';
import Header from '@/components/translator/Header';
import TranslateInput from '@/components/translator/TranslateInput';
import TranslationResult from '@/components/translator/TranslationResult';
import HistoryList, { HistoryItem } from '@/components/translator/HistoryList';

export default function TranslatorPage() {
  const [activeData, setActiveData] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [history, setHistory] = useState<HistoryItem[]>([]);

  // Load history from localStorage on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem('wisdom_translator_history');
      if (stored) {
        setHistory(JSON.parse(stored));
      }
    } catch (e) {
      console.error('Failed to load history:', e);
    }
  }, []);

  // Save history to state and localStorage
  const saveHistory = (newHistory: HistoryItem[]) => {
    setHistory(newHistory);
    try {
      localStorage.setItem('wisdom_translator_history', JSON.stringify(newHistory));
    } catch (e) {
      console.error('Failed to save history:', e);
    }
  };

  const handleAnalyze = async (url: string, rawText?: string) => {
    setIsLoading(true);
    setActiveData(null);

    try {
      let bookTitle = '직접 입력한 원문';
      let chapterTitle = '텍스트 해석';
      let contentToTranslate = rawText || '';
      let footnotesContext = '';
      let originalTextForDisplay = rawText || '';

      // 1. If URL is provided, scrape it first
      if (url) {
        toast.loading('웹페이지에서 경전 본문을 추출하는 중입니다...', { id: 'scrape-toast' });
        const scrapeResponse = await fetch('/api/scrape', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ url }),
        });

        const scrapeResult = await scrapeResponse.json();
        toast.dismiss('scrape-toast');

        if (!scrapeResult.success) {
          throw new Error(scrapeResult.error || '웹페이지를 가져오는 데 실패했습니다.');
        }

        bookTitle = scrapeResult.bookTitle;
        chapterTitle = scrapeResult.chapterTitle;
        contentToTranslate = scrapeResult.content;
        footnotesContext = scrapeResult.footnotes;
        originalTextForDisplay = scrapeResult.content;

        if (!contentToTranslate) {
          throw new Error('웹페이지에서 유효한 텍스트 본문을 추출하지 못했습니다.');
        }
        
        toast.success('본문 추출 완료! AI 번역을 시작합니다.');
      } else {
        toast.success('텍스트 입력을 확인했습니다. AI 번역을 시작합니다.');
      }

      // 2. Call Translation API with the text
      const translateResponse = await fetch('/api/translate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          content: contentToTranslate,
          footnotes: footnotesContext,
          bookTitle,
          chapterTitle,
        }),
      });

      const translateResult = await translateResponse.json();

      if (!translateResult.success) {
        throw new Error(translateResult.error || 'AI 번역 중 오류가 발생했습니다.');
      }

      const resultData = translateResult.data;
      // Add the original text to the result for display comparison
      resultData.originalText = originalTextForDisplay;

      setActiveData(resultData);

      // 3. Save to history
      const newHistoryItem: HistoryItem = {
        id: Math.random().toString(36).substring(2, 9) + Date.now().toString(),
        url: url || undefined,
        bookTitle: resultData.bookTitle,
        chapterTitle: resultData.chapterTitle,
        timestamp: Date.now(),
        data: resultData,
      };

      const updatedHistory = [newHistoryItem, ...history.filter(item => {
        // Prevent duplicate entries for the exact same book & chapter
        return !(item.bookTitle === resultData.bookTitle && item.chapterTitle === resultData.chapterTitle);
      })].slice(0, 30); // Keep last 30 items

      saveHistory(updatedHistory);
      toast.success('경전 분석 및 용어 해설이 완료되었습니다!');

      // Scroll to result on mobile
      setTimeout(() => {
        const resultElement = document.getElementById('translation-result-view');
        if (resultElement) {
          resultElement.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
      }, 300);

    } catch (error: any) {
      console.error('Analysis error:', error);
      toast.error(error.message || '요청 처리 중 오류가 발생했습니다.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSelectHistory = (item: HistoryItem) => {
    setActiveData(item.data);
    toast.success(`${item.bookTitle} 기록을 불러왔습니다.`);
    
    setTimeout(() => {
      const resultElement = document.getElementById('translation-result-view');
      if (resultElement) {
        resultElement.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }, 100);
  };

  const handleDeleteHistory = (id: string) => {
    const updated = history.filter((item) => item.id !== id);
    saveHistory(updated);
    toast.success('기록이 삭제되었습니다.');
  };

  const handleClearHistory = () => {
    if (window.confirm('정말로 모든 번역 기록을 지우시겠습니까?')) {
      saveHistory([]);
      toast.success('모든 기록이 초기화되었습니다.');
    }
  };

  return (
    <div className="bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-slate-900 via-slate-950 to-black min-h-screen text-slate-100 flex flex-col font-sans selection:bg-indigo-500/30 selection:text-white">
      {/* Background ambient glowing elements */}
      <div className="absolute top-20 left-1/4 w-[500px] h-[500px] bg-indigo-500/10 rounded-full blur-3xl pointer-events-none -z-10 animate-pulse-slow" />
      <div className="absolute top-80 right-1/4 w-[400px] h-[400px] bg-amber-500/5 rounded-full blur-3xl pointer-events-none -z-10 animate-pulse-slow" />

      {/* Header */}
      <Header />

      {/* Main Workspace */}
      <main className="flex-1 w-full max-w-4xl mx-auto px-4 py-8 md:py-10 grid grid-cols-1 md:grid-cols-12 gap-8 relative z-10">
        
        {/* Left Side: Input Form & History */}
        <div className="col-span-1 md:col-span-5 space-y-6 flex flex-col">
          <div className="space-y-1">
            <h2 className="text-xl font-bold tracking-tight text-slate-200 flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-amber-400" />
              <span>원문 입력 및 스크랩</span>
            </h2>
            <p className="text-xs text-slate-400">
              불교, 자이나교 등의 경전 주소를 입력하거나 원문을 직접 복사해서 넣어주세요.
            </p>
          </div>

          <TranslateInput onAnalyze={handleAnalyze} isLoading={isLoading} />

          {/* Divider */}
          <div className="h-[1px] w-full bg-white/5 my-2" />

          {/* History */}
          <HistoryList
            items={history}
            onSelect={handleSelectHistory}
            onDelete={handleDeleteHistory}
            onClearAll={handleClearHistory}
          />
        </div>

        {/* Right Side: Translation & Interpretation Result */}
        <div id="translation-result-view" className="col-span-1 md:col-span-7 space-y-6">
          <div className="space-y-1">
            <h2 className="text-xl font-bold tracking-tight text-slate-200 flex items-center gap-2">
              <BookOpen className="w-5 h-5 text-indigo-400" />
              <span>AI 번역 및 심층 분석</span>
            </h2>
            <p className="text-xs text-slate-400">
              경전 본문에 맞춰 어원 사전식 용어 풀이와 철학적 해석이 제공됩니다.
            </p>
          </div>

          <AnimatePresence mode="wait">
            {isLoading || activeData ? (
              <motion.div
                key={isLoading ? 'loading' : 'result'}
                initial={{ opacity: 0, scale: 0.98 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.98 }}
                transition={{ duration: 0.2 }}
                className="w-full"
              >
                <TranslationResult data={activeData} isLoading={isLoading} />
              </motion.div>
            ) : (
              <motion.div
                key="empty"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="w-full border-2 border-dashed border-white/5 rounded-2xl p-10 text-center flex flex-col items-center justify-center min-h-[350px] bg-slate-900/10 backdrop-blur-sm"
              >
                <div className="w-12 h-12 rounded-xl bg-slate-950/60 border border-white/10 flex items-center justify-center text-slate-500 mb-4 shadow-md">
                  <HelpCircle className="w-6 h-6 text-slate-400 animate-pulse" />
                </div>
                <h3 className="text-sm font-bold text-slate-300">원문을 입력하고 분석을 시작해보세요</h3>
                <p className="text-xs text-slate-500 max-w-[280px] mx-auto mt-2 leading-relaxed">
                  WisdomLib이나 SuttaCentral의 주소를 입력하면 해당 경전의 장과 절을 정확히 스캔하여 번역해 줍니다.
                </p>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </main>

      {/* Footer */}
      <footer className="w-full py-6 px-6 border-t border-white/5 bg-slate-950/30 text-center text-slate-600 text-[10px] tracking-wider uppercase font-medium">
        <span>© {new Date().getFullYear()} Wisdom AI. Powered by Gemini Pro Advanced Agent.</span>
      </footer>
    </div>
  );
}
