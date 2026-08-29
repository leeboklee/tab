'use client'

import { useEffect, useState } from 'react'
import {
  AudioLines,
  Cpu,
  ListMusic,
  Search,
  Upload,
} from 'lucide-react'
import toast from 'react-hot-toast'

import FavoritesManager from '@/components/FavoritesManager'
import Navigation, { type AppSection } from '@/components/Navigation'
import NotationViewer from '@/components/NotationViewer'
import YouTubePlayer from '@/components/YouTubePlayer'
import { RealAudioAPI, type AudioHealthResponse } from './lib/real-audio-api'

interface UITabData {
  title: string
  artist: string
  duration: number
  tempo: number
  key: string
  difficulty: string
  tabs: {
    measure: number
    frets: number[]
    notes: string[]
    technique: string
  }[]
  chord_progressions: {
    chord: string
    start_time: number
    duration: number
    confidence: number
  }[]
  metadata: {
    view_count?: number
    upload_date?: string
    tags?: string[]
    analysis_method?: string
    video_id?: string
    thumbnail?: string
    techniques?: string[]
    difficulty?: string
    result_mode?: string
    status_summary?: string
    tab_source?: string
    pipeline_status?: Record<string, string>
    pipeline_diagnostics?: Record<string, unknown>
  }
}

interface AnalysisNotice {
  mode: 'audio_verified' | 'metadata_fallback' | 'preview_only'
  title: string
  detail: string
}

const sampleUrls = [
  'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
  'https://www.youtube.com/watch?v=fAVQnVkB2ho',
  'https://youtu.be/ktvTqknDobU',
]

const extractVideoId = (url: string): string | null => {
  const patterns = [
    /(?:youtube\.com\/watch\?v=|youtu\.be\/)([a-zA-Z0-9_-]{11})/,
    /youtube\.com\/embed\/([a-zA-Z0-9_-]{11})/,
    /youtube\.com\/shorts\/([a-zA-Z0-9_-]{11})/,
  ]

  for (const pattern of patterns) {
    const match = url.match(pattern)
    if (match) {
      return match[1]
    }
  }

  return null
}

const seededNumber = (seed: string, offset: number, min: number, max: number) => {
  const total = `${seed}:${offset}`.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0)
  const ratio = Math.abs(Math.sin(total)) % 1
  return Math.round(min + ratio * (max - min))
}

const buildFallbackAnalysis = (title: string, artist: string, videoId: string): UITabData => {
  const tempo = seededNumber(videoId, 1, 88, 154)
  const duration = seededNumber(videoId, 2, 150, 280)
  const keyOptions = ['C', 'G', 'D', 'A', 'E', 'F', 'Am', 'Em']
  const key = keyOptions[seededNumber(videoId, 3, 0, keyOptions.length - 1)]
  const difficulty = tempo >= 145 ? '고급' : tempo >= 110 ? '중급' : '초급'
  const maxFret = difficulty === '고급' ? 12 : difficulty === '중급' ? 8 : 5
  const totalMeasures = Math.max(12, Math.floor(duration / 6))
  const tabs = Array.from({ length: totalMeasures }).map((_, index) => {
    const activeCount = seededNumber(videoId, index + 5, 1, 3)
    const frets = [0, 0, 0, 0, 0, 0]

    for (let i = 0; i < activeCount; i += 1) {
      const stringIndex = seededNumber(videoId, index * 10 + i, 0, 5)
      frets[stringIndex] = seededNumber(videoId, index * 11 + i, 0, maxFret)
    }

    return {
      measure: index + 1,
      frets,
      notes: ['E', 'B', 'G', 'D', 'A', 'E'],
      technique: difficulty === '고급' ? 'lead' : difficulty === '중급' ? 'rhythm' : 'basic',
    }
  })

  const progressionBase = {
    C: ['C', 'Am', 'F', 'G'],
    G: ['G', 'Em', 'C', 'D'],
    D: ['D', 'Bm', 'G', 'A'],
    A: ['A', 'F#m', 'D', 'E'],
    E: ['E', 'C#m', 'A', 'B'],
    F: ['F', 'Dm', 'Bb', 'C'],
    Am: ['Am', 'F', 'C', 'G'],
    Em: ['Em', 'C', 'G', 'D'],
  }

  const chords = progressionBase[key as keyof typeof progressionBase] || progressionBase.C
  const chord_progressions = Array.from({ length: 8 }).map((_, index) => ({
    chord: chords[index % chords.length],
    start_time: index * 8,
    duration: 8,
    confidence: 0.72 + index * 0.02,
  }))

  return {
    title,
    artist,
    duration,
    tempo,
    key,
    difficulty,
    tabs,
    chord_progressions,
    metadata: {
      view_count: seededNumber(videoId, 8, 50000, 950000),
      upload_date: new Date().toISOString().slice(0, 10),
      tags: ['fallback', 'preview', 'youtube'],
      analysis_method: 'metadata_preview',
      result_mode: 'preview_only',
      status_summary: '실제 분석 서버 없이 미리보기 분석 생성',
      video_id: videoId,
      thumbnail: `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`,
      techniques: [difficulty === '고급' ? 'slide' : 'basic'],
      difficulty,
      pipeline_status: {
        youtube_extraction: 'preview',
        audio_analysis: 'preview',
        tab_generation: 'preview',
      },
    },
  }
}

async function analyzeFromOEmbed(url: string): Promise<UITabData> {
  const videoId = extractVideoId(url)
  if (!videoId) {
    throw new Error('유효한 YouTube URL이 아닙니다.')
  }

  try {
    const oembedUrl = `https://www.youtube.com/oembed?url=${encodeURIComponent(url)}&format=json`
    const response = await fetch(oembedUrl)
    if (!response.ok) {
      throw new Error('oEmbed 응답 실패')
    }

    const info = await response.json()
    return buildFallbackAnalysis(info.title || 'Unknown Title', info.author_name || 'Unknown Artist', videoId)
  } catch (error) {
    console.error('oEmbed fallback failed:', error)
    return buildFallbackAnalysis('Unknown Title', 'Unknown Artist', videoId)
  }
}

export default function Home() {
  const [youtubeUrl, setYoutubeUrl] = useState('')
  const [uploadFile, setUploadFile] = useState<File | null>(null)
  const [activeSection, setActiveSection] = useState<AppSection>('discover')
  const [useRealAnalysis, setUseRealAnalysis] = useState(true)
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [tabData, setTabData] = useState<UITabData | null>(null)
  const [analysisNotice, setAnalysisNotice] = useState<AnalysisNotice | null>(null)
  const [health, setHealth] = useState<AudioHealthResponse | null>(null)
  const [healthError, setHealthError] = useState<string | null>(null)
  const [healthLoading, setHealthLoading] = useState(true)

  useEffect(() => {
    let mounted = true
    let interval: number | null = null

    const loadHealth = async () => {
      const nextHealth = await RealAudioAPI.getHealth()
      if (!mounted) {
        return
      }

      setHealthLoading(false)
      if (nextHealth) {
        setHealth(nextHealth)
        setHealthError(null)
      } else {
        setHealth(null)
        setHealthError('실제 분석 서버와 연결되지 않았습니다.')
      }
    }

    const startPolling = () => {
      if (interval !== null) {
        window.clearInterval(interval)
      }

      interval = window.setInterval(() => {
        if (document.visibilityState === 'visible') {
          void loadHealth()
        }
      }, 30000)
    }

    void loadHealth()
    startPolling()

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        void loadHealth()
      }
    }

    document.addEventListener('visibilitychange', handleVisibilityChange)

    return () => {
      mounted = false
      document.removeEventListener('visibilitychange', handleVisibilityChange)
      if (interval !== null) {
        window.clearInterval(interval)
      }
    }
  }, [])

  const pipelineReady = Boolean(health?.status === 'healthy')
  const pipelineLabel = healthLoading ? '확인 중…' : pipelineReady ? '연결됨' : '미리보기'
  const ffmpegReady = Boolean(health?.services?.audio_pipeline?.ffmpeg_available)
  const librosaReady = Boolean(health?.services?.audio_analysis_deps?.librosa)

  const handleAnalyze = async (overrideUrl?: string) => {
    const targetUrl = (overrideUrl || youtubeUrl).trim()
    if (!targetUrl) {
      toast('YouTube URL을 먼저 입력하세요.', { icon: '⚠️' })
      return
    }

    if (!extractVideoId(targetUrl)) {
      toast('지원하지 않는 YouTube URL 형식입니다.', { icon: '❌' })
      return
    }

    setIsAnalyzing(true)

    try {
      let nextData: UITabData

      if (useRealAnalysis && pipelineReady) {
        const result = await RealAudioAPI.analyzeAudio(targetUrl)
        if (!result.success || !result.data) {
          const failedStage = result.data?.failed_stage
          const failureCategory =
            result.data?.diagnostics?.failure?.category || result.data?.diagnostics?.category
          const isBotBlock =
            failedStage === 'youtube_extraction' ||
            failureCategory === 'bot_detection' ||
            String(result.error || '').toLowerCase().includes('bot')
          nextData = await analyzeFromOEmbed(targetUrl)
          setAnalysisNotice({
            mode: 'preview_only',
            title: isBotBlock ? 'YouTube 차단 — 음원 업로드 권장' : '실패 후 미리보기 전환',
            detail: isBotBlock
              ? `${result.error || 'YouTube 봇 차단'}\n아래 음원 파일 업로드로 같은 분석을 할 수 있습니다.`
              : result.error || '실제 분석 실패로 미리보기 결과를 대신 표시합니다.',
          })
          toast(
            isBotBlock
              ? 'YouTube 추출이 막혔습니다. 음원 파일을 업로드해 보세요.'
              : '실제 분석이 실패해 미리보기 결과로 전환했습니다.',
            { icon: '⚠️' }
          )
        } else {
          nextData = result.data as UITabData
          const resultMode = nextData.metadata?.result_mode === 'audio_verified' ? 'audio_verified' : 'metadata_fallback'
          setAnalysisNotice({
            mode: resultMode,
            title: resultMode === 'audio_verified' ? '실제 오디오 분석 완료' : '추출 후 메타데이터 폴백',
            detail:
              nextData.metadata?.status_summary ||
              (resultMode === 'audio_verified'
                ? '실제 음원 추출과 파형 분석이 정상적으로 끝났습니다.'
                : '추출은 성공했지만 오디오 분석 단계에서 폴백이 적용됐습니다.'),
          })
          toast(resultMode === 'audio_verified' ? '실제 분석 결과를 불러왔습니다.' : '추출은 성공했지만 메타데이터 폴백이 적용되었습니다.', {
            icon: resultMode === 'audio_verified' ? '✅' : '⚠️',
          })
        }
      } else {
        nextData = await analyzeFromOEmbed(targetUrl)
        setAnalysisNotice({
          mode: 'preview_only',
          title: '미리보기 분석',
          detail: pipelineReady
            ? '실제 분석이 꺼져 있어 미리보기 분석을 사용했습니다.'
            : '실제 분석 서버가 준비되지 않아 미리보기 분석을 사용했습니다.',
        })
        toast('실제 분석 서버가 준비되지 않아 미리보기 분석을 보여줍니다.', { icon: 'ℹ️' })
      }

      setYoutubeUrl(targetUrl)
      setTabData(nextData)
      setActiveSection('workspace')
    } catch (error) {
      console.error(error)
      toast(`분석 실패: ${error instanceof Error ? error.message : '알 수 없는 오류'}`, { icon: '❌' })
    } finally {
      setIsAnalyzing(false)
    }
  }

  const handleAnalyzeUpload = async () => {
    if (!uploadFile) {
      toast('분석할 음원 파일을 선택하세요.', { icon: '⚠️' })
      return
    }
    if (!pipelineReady) {
      toast('실제 분석 서버가 필요합니다. 서버를 먼저 실행하세요.', { icon: '❌' })
      return
    }

    setIsAnalyzing(true)
    try {
      const result = await RealAudioAPI.analyzeUpload(uploadFile, {
        title: uploadFile.name.replace(/\.[^.]+$/, ''),
      })
      if (!result.success || !result.data) {
        toast(`업로드 분석 실패: ${result.error || '알 수 없는 오류'}`, { icon: '❌' })
        return
      }

      const nextData = result.data as UITabData
      const resultMode = nextData.metadata?.result_mode === 'audio_verified' ? 'audio_verified' : 'metadata_fallback'
      setAnalysisNotice({
        mode: resultMode,
        title: '업로드 음원 분석 완료',
        detail:
          nextData.metadata?.status_summary ||
          'YouTube 없이 업로드한 음원으로 분석을 완료했습니다.',
      })
      setTabData(nextData)
      setActiveSection('workspace')
      toast('업로드 음원 분석을 완료했습니다.', { icon: '✅' })
    } catch (error) {
      console.error(error)
      toast(`업로드 분석 실패: ${error instanceof Error ? error.message : '알 수 없는 오류'}`, { icon: '❌' })
    } finally {
      setIsAnalyzing(false)
    }
  }

  const resultMode = analysisNotice?.mode || (tabData?.metadata?.result_mode as AnalysisNotice['mode'] | undefined) || 'preview_only'
  const notationData = tabData
    ? {
        ...tabData,
        metadata: {
          view_count: tabData.metadata.view_count ?? 0,
          upload_date: tabData.metadata.upload_date ?? '',
          tags: tabData.metadata.tags ?? [],
          analysis_method: tabData.metadata.analysis_method ?? 'unknown',
          result_mode: tabData.metadata.result_mode ?? 'preview_only',
          status_summary: tabData.metadata.status_summary ?? '',
          video_id: tabData.metadata.video_id ?? '',
          thumbnail: tabData.metadata.thumbnail,
          tab_source: tabData.metadata.tab_source,
          audio_id: (tabData.metadata as { audio_id?: string }).audio_id ?? '',
        },
      }
    : null
  const resultTone =
    resultMode === 'audio_verified' ? 'text-[#8ef5b5] border-[#8ef5b5]/30 bg-[#8ef5b5]/10' : resultMode === 'metadata_fallback'
      ? 'text-[#ffd76a] border-[#ffd76a]/30 bg-[#ffd76a]/10'
      : 'text-[#8cc8ff] border-[#8cc8ff]/30 bg-[#8cc8ff]/10'

  const summaryCards = [
    {
      label: '엔진',
      value: healthLoading ? '…' : ffmpegReady ? 'OK' : '—',
      tone: healthLoading ? 'idle' : ffmpegReady ? 'ok' : 'warn',
      icon: AudioLines,
    },
    {
      label: '분석',
      value: librosaReady ? 'OK' : '—',
      tone: librosaReady ? 'ok' : 'warn',
      icon: Cpu,
    },
    {
      label: '결과',
      value: tabData ? tabData.title : '—',
      tone: tabData ? 'ok' : 'idle',
      icon: ListMusic,
    },
  ]

  return (
    <main className="min-h-screen bg-[#080b12] text-white">
      <Navigation
        activeSection={activeSection}
        onSectionChange={setActiveSection}
        pipelineStatusLabel={pipelineLabel}
      />

      <div className="mx-auto max-w-5xl px-4 pb-12 pt-6 sm:px-6">
        <section className="grid gap-5 lg:grid-cols-[1fr,220px]">
          <div className="rounded-2xl border border-white/8 bg-[#0f131c] p-5 sm:p-6">
            <div className="mb-5">
              <h2 className="text-2xl font-semibold text-white sm:text-3xl">YouTube URL → 기타 탭</h2>
              <p className="mt-1 text-sm text-white/50">링크 넣고 분석 시작</p>
            </div>

            <div className="space-y-3">
              <div className="flex flex-col gap-3 sm:flex-row">
                <input
                  value={youtubeUrl}
                  onChange={(event) => setYoutubeUrl(event.target.value)}
                  placeholder="https://www.youtube.com/watch?v=..."
                  className="min-h-[48px] flex-1 rounded-xl border border-white/10 bg-white/5 px-4 text-sm text-white outline-none placeholder:text-white/30 focus:border-[#ff8a3d]"
                />
                <button
                  onClick={() => handleAnalyze()}
                  disabled={isAnalyzing}
                  className="inline-flex min-h-[48px] items-center justify-center gap-2 rounded-xl bg-[#ff8a3d] px-5 text-sm font-semibold text-white transition hover:bg-[#ff9f5a] disabled:opacity-50"
                >
                  {isAnalyzing ? (
                    <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                  ) : (
                    <Search className="h-4 w-4" />
                  )}
                  {isAnalyzing ? '분석 중' : '분석'}
                </button>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                {sampleUrls.map((url) => (
                  <button
                    key={url}
                    onClick={() => {
                      setYoutubeUrl(url)
                      void handleAnalyze(url)
                    }}
                    className="rounded-lg border border-white/8 bg-white/5 px-2.5 py-1 text-xs text-white/55 hover:bg-white/10"
                  >
                    샘플
                  </button>
                ))}
                <label className="ml-auto flex cursor-pointer items-center gap-2 text-xs text-white/50">
                  <input
                    checked={useRealAnalysis}
                    onChange={(event) => setUseRealAnalysis(event.target.checked)}
                    type="checkbox"
                    className="h-3.5 w-3.5 accent-[#ff8a3d]"
                  />
                  실제 분석
                </label>
              </div>

              <div className="border-t border-white/8 pt-4">
                <p className="mb-2 text-xs text-white/45">또는 음원 업로드 · mp3, wav, m4a</p>
                <div className="flex flex-col gap-2 sm:flex-row">
                  <label className="flex min-h-[44px] flex-1 cursor-pointer items-center gap-2 rounded-xl border border-dashed border-white/15 bg-white/[0.02] px-3 text-sm text-white/60 hover:border-white/25">
                    <Upload className="h-4 w-4 shrink-0 text-white/40" />
                    <span className="truncate">{uploadFile ? uploadFile.name : '파일 선택'}</span>
                    <input
                      type="file"
                      accept=".wav,.mp3,.m4a,.webm,.ogg,.opus,.aac,.flac,audio/*"
                      className="hidden"
                      onChange={(event) => setUploadFile(event.target.files?.[0] || null)}
                    />
                  </label>
                  <button
                    onClick={() => void handleAnalyzeUpload()}
                    disabled={isAnalyzing || !uploadFile}
                    className="min-h-[44px] rounded-xl border border-white/10 px-4 text-sm text-white/80 hover:bg-white/5 disabled:opacity-40"
                  >
                    업로드 분석
                  </button>
                </div>
              </div>
            </div>
          </div>

          <div className="flex flex-col gap-2">
            {summaryCards.map((card) => {
              const Icon = card.icon
              const color =
                card.tone === 'ok' ? 'text-emerald-400' : card.tone === 'warn' ? 'text-amber-400' : 'text-white/50'
              return (
                <div key={card.label} className="rounded-xl border border-white/8 bg-[#0f131c] px-4 py-3">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs text-white/45">{card.label}</span>
                    <Icon className={`h-3.5 w-3.5 ${color}`} />
                  </div>
                  <p className="mt-1 truncate text-sm font-medium text-white">{card.value}</p>
                </div>
              )
            })}
            {!pipelineReady && !healthLoading && (
              <p className="px-1 text-xs text-amber-400/80">{healthError || '서버 미연결'}</p>
            )}
          </div>
        </section>

        <section className="mt-6">
          {activeSection === 'discover' && pipelineReady && (
            <div className="flex flex-wrap gap-2 text-xs text-white/45">
              <span className="rounded-lg border border-white/8 bg-white/5 px-2.5 py-1">
                yt-dlp {health?.services?.audio_pipeline?.yt_dlp_version || '—'}
              </span>
              <span className="rounded-lg border border-white/8 bg-white/5 px-2.5 py-1">
                ffmpeg {ffmpegReady ? 'OK' : '—'}
              </span>
            </div>
          )}

          {activeSection === 'workspace' && (
            <div className="rounded-2xl border border-white/8 bg-[#0f131c] p-5">
              {tabData ? (
                <>
                  <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <h3 className="text-lg font-semibold text-white">{tabData.title}</h3>
                      <p className="text-sm text-white/50">{tabData.artist}</p>
                    </div>
                    <div className="flex flex-wrap gap-1.5 text-xs">
                      <span className={`rounded-md border px-2 py-0.5 ${resultTone}`}>
                        {analysisNotice?.title || '분석 완료'}
                      </span>
                      <span className="rounded-md border border-white/10 px-2 py-0.5 text-white/60">{tabData.key}</span>
                      <span className="rounded-md border border-white/10 px-2 py-0.5 text-white/60">{tabData.tempo} BPM</span>
                    </div>
                  </div>
                  <div className="grid gap-4 lg:grid-cols-[1fr,1.2fr]">
                    <div className="rounded-xl border border-white/8 bg-black/30 p-2">
                      <YouTubePlayer url={youtubeUrl} />
                    </div>
                    <div className="overflow-hidden rounded-xl border border-white/8 bg-[#f7f4ec] p-1 text-black">
                      {notationData ? <NotationViewer data={notationData} /> : null}
                    </div>
                  </div>
                </>
              ) : (
                <p className="py-8 text-center text-sm text-white/45">URL 분석 후 결과가 여기 표시됩니다.</p>
              )}
            </div>
          )}

          {activeSection === 'practice' && tabData && (
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="rounded-xl border border-white/8 bg-[#0f131c] p-4">
                <p className="text-xs text-white/45">템포</p>
                <p className="mt-1 text-xl font-semibold">{tabData.tempo} BPM</p>
              </div>
              <div className="rounded-xl border border-white/8 bg-[#0f131c] p-4">
                <p className="text-xs text-white/45">키</p>
                <p className="mt-1 text-xl font-semibold">{tabData.key}</p>
              </div>
              <div className="rounded-xl border border-white/8 bg-[#0f131c] p-4">
                <p className="text-xs text-white/45">난이도</p>
                <p className="mt-1 text-xl font-semibold">{tabData.difficulty}</p>
              </div>
            </div>
          )}

          {activeSection === 'practice' && !tabData && (
            <p className="text-sm text-white/45">먼저 곡을 분석하세요.</p>
          )}

          {activeSection === 'library' && (
            <div className="rounded-2xl border border-white/8 bg-[#0f131c] p-5">
              <FavoritesManager
                onFavoriteClick={(url) => {
                  setYoutubeUrl(url)
                  setActiveSection('discover')
                  toast('URL 입력됨', { icon: '🎯' })
                }}
              />
            </div>
          )}
        </section>
      </div>
    </main>
  )
}
