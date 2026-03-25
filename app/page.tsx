'use client'

import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import {
  AlertTriangle,
  AudioLines,
  CheckCircle2,
  Cpu,
  FolderHeart,
  Gauge,
  ListMusic,
  Search,
  Sparkles,
  Wand2,
} from 'lucide-react'
import toast from 'react-hot-toast'

import FavoritesManager from '@/components/FavoritesManager'
import LoadingSpinner from '@/components/LoadingSpinner'
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
    pipeline_status?: Record<string, string>
    pipeline_diagnostics?: Record<string, unknown>
  }
}

const sectionDescriptions: Record<AppSection, string> = {
  discover: '입력, 추출 안정성, 실제 분석 준비 상태를 한 번에 확인합니다.',
  workspace: '분석 결과, 탭, 코드 진행, 메타데이터를 워크스페이스로 분리합니다.',
  practice: '연습용 보조 정보와 실제 분석 신뢰도를 확인합니다.',
  library: '즐겨찾기 곡과 추천 작업 흐름을 관리합니다.',
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
  const [activeSection, setActiveSection] = useState<AppSection>('discover')
  const [currentPage, setCurrentPage] = useState<'home' | 'result'>('home')
  const [useRealAnalysis, setUseRealAnalysis] = useState(true)
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [tabData, setTabData] = useState<UITabData | null>(null)
  const [health, setHealth] = useState<AudioHealthResponse | null>(null)
  const [healthError, setHealthError] = useState<string | null>(null)

  useEffect(() => {
    let mounted = true

    const loadHealth = async () => {
      const nextHealth = await RealAudioAPI.getHealth()
      if (!mounted) {
        return
      }

      if (nextHealth) {
        setHealth(nextHealth)
        setHealthError(null)
      } else {
        setHealth(null)
        setHealthError('실제 분석 서버와 연결되지 않았습니다.')
      }
    }

    loadHealth()
    const interval = window.setInterval(loadHealth, 15000)

    return () => {
      mounted = false
      window.clearInterval(interval)
    }
  }, [])

  const pipelineReady = Boolean(health?.status === 'healthy')
  const pipelineLabel = pipelineReady ? '실제 분석 연결됨' : '미리보기 모드'
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
          throw new Error(result.error || '실제 분석 응답이 비었습니다.')
        }
        nextData = result.data as UITabData
        toast('실제 분석 결과를 불러왔습니다.', { icon: '✅' })
      } else {
        nextData = await analyzeFromOEmbed(targetUrl)
        toast('실제 분석 서버가 준비되지 않아 미리보기 분석을 보여줍니다.', { icon: 'ℹ️' })
      }

      setYoutubeUrl(targetUrl)
      setTabData(nextData)
      setCurrentPage('result')
      setActiveSection('workspace')
    } catch (error) {
      console.error(error)
      toast(`분석 실패: ${error instanceof Error ? error.message : '알 수 없는 오류'}`, { icon: '❌' })
    } finally {
      setIsAnalyzing(false)
    }
  }

  const metadataMode = tabData?.metadata?.analysis_method?.includes('metadata') || tabData?.metadata?.analysis_method?.includes('preview')
  const extractAttempts =
    (tabData?.metadata?.pipeline_diagnostics?.extract_attempts as { name?: string; status?: string; error?: string }[] | undefined) || []
  const notationData = tabData
    ? {
        ...tabData,
        metadata: {
          view_count: tabData.metadata.view_count ?? 0,
          upload_date: tabData.metadata.upload_date ?? '',
          tags: tabData.metadata.tags ?? [],
          analysis_method: tabData.metadata.analysis_method ?? 'unknown',
          video_id: tabData.metadata.video_id ?? '',
          thumbnail: tabData.metadata.thumbnail,
        },
      }
    : null

  const summaryCards = [
    {
      label: '추출 엔진',
      value: ffmpegReady ? `FFmpeg 연결 (${health?.services?.audio_pipeline?.ffmpeg_source || 'system'})` : 'FFmpeg 미연결',
      tone: ffmpegReady ? 'ok' : 'warn',
      icon: AudioLines,
    },
    {
      label: '오디오 분석',
      value: librosaReady ? '파형 분석 준비됨' : '메타데이터 폴백 가능성 높음',
      tone: librosaReady ? 'ok' : 'warn',
      icon: Cpu,
    },
    {
      label: '현재 결과',
      value: tabData ? `${tabData.title} / ${tabData.difficulty}` : '아직 결과 없음',
      tone: tabData ? 'ok' : 'idle',
      icon: ListMusic,
    },
  ]

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top,#24304d_0%,#0b1020_45%,#06070b_100%)] text-white">
      <Navigation
        activeSection={activeSection}
        currentPage={currentPage}
        onSectionChange={setActiveSection}
        pipelineStatusLabel={pipelineLabel}
      />

      <div className="mx-auto max-w-7xl px-4 pb-16 pt-8 sm:px-6 lg:px-8">
        <section className="grid gap-6 lg:grid-cols-[1.4fr,0.8fr]">
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            className="overflow-hidden rounded-[32px] border border-white/10 bg-[linear-gradient(140deg,rgba(255,255,255,0.12),rgba(255,255,255,0.02))] p-6 shadow-[0_32px_80px_rgba(0,0,0,0.38)]"
          >
            <div className="flex flex-wrap items-center gap-3">
              <span className="rounded-full border border-[#ffcf66]/35 bg-[#ffcf66]/12 px-3 py-1 text-xs font-semibold uppercase tracking-[0.24em] text-[#ffcf66]">
                Competitive Review Applied
              </span>
              <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-white/70">
                {sectionDescriptions[activeSection]}
              </span>
            </div>

            <div className="mt-6 max-w-3xl">
              <h2 className="text-4xl font-semibold leading-tight text-white sm:text-5xl">
                YouTube 음원추출 안정성을 먼저 올리고
                <br />
                탭 워크스페이스를 메뉴형 구조로 분리합니다.
              </h2>
              <p className="mt-4 text-base leading-7 text-white/72">
                입력, 실제 분석 상태, 결과, 연습도구, 보관함을 한 화면에 뒤섞지 않고 분리했습니다.
                실제 서버가 준비되지 않으면 미리보기 모드로 명확히 표시합니다.
              </p>
            </div>

            <div className="mt-8 rounded-[28px] border border-white/10 bg-[#0d1326] p-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-medium text-white/60">YouTube URL</p>
                  <p className="mt-1 text-xs text-white/45">짧은 링크, watch, embed, shorts 형식을 지원합니다.</p>
                </div>
                <label className="flex cursor-pointer items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-2 text-sm text-white/80">
                  <input
                    checked={useRealAnalysis}
                    onChange={(event) => setUseRealAnalysis(event.target.checked)}
                    type="checkbox"
                    className="h-4 w-4 accent-[#ff9f43]"
                  />
                  실제 분석 우선
                </label>
              </div>

              <div className="mt-4 flex flex-col gap-3 sm:flex-row">
                <input
                  value={youtubeUrl}
                  onChange={(event) => setYoutubeUrl(event.target.value)}
                  placeholder="https://www.youtube.com/watch?v=..."
                  className="min-h-[56px] flex-1 rounded-2xl border border-white/12 bg-white/5 px-4 text-base text-white outline-none transition placeholder:text-white/30 focus:border-[#ff9f43]"
                />
                <button
                  onClick={() => handleAnalyze()}
                  disabled={isAnalyzing}
                  className="inline-flex min-h-[56px] items-center justify-center gap-2 rounded-2xl bg-[linear-gradient(135deg,#ff8a3d,#ffcf66)] px-5 font-semibold text-[#171717] transition hover:scale-[1.01] disabled:cursor-not-allowed disabled:opacity-55"
                >
                  {isAnalyzing ? <LoadingSpinner /> : <Search className="h-5 w-5" />}
                  <span>{isAnalyzing ? '분석 중' : '분석 시작'}</span>
                </button>
              </div>

              <div className="mt-4 flex flex-wrap gap-2">
                {sampleUrls.map((url) => (
                  <button
                    key={url}
                    onClick={() => {
                      setYoutubeUrl(url)
                      void handleAnalyze(url)
                    }}
                    className="rounded-full border border-white/10 bg-white/5 px-3 py-2 text-xs text-white/70 transition hover:bg-white/10"
                  >
                    샘플 실행
                  </button>
                ))}
              </div>
            </div>
          </motion.div>

          <div className="grid gap-4">
            {summaryCards.map((card) => {
              const Icon = card.icon
              const color =
                card.tone === 'ok' ? 'text-[#8ef5b5]' : card.tone === 'warn' ? 'text-[#ffd76a]' : 'text-white/72'
              return (
                <div key={card.label} className="rounded-[28px] border border-white/10 bg-white/5 p-5">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-white/55">{card.label}</span>
                    <Icon className={`h-5 w-5 ${color}`} />
                  </div>
                  <p className="mt-3 text-lg font-semibold text-white">{card.value}</p>
                </div>
              )
            })}

            <div className="rounded-[28px] border border-white/10 bg-[#111827] p-5">
              <div className="flex items-start gap-3">
                {pipelineReady ? (
                  <CheckCircle2 className="mt-0.5 h-5 w-5 text-[#7ef0a5]" />
                ) : (
                  <AlertTriangle className="mt-0.5 h-5 w-5 text-[#ffcf66]" />
                )}
                <div>
                  <p className="text-sm font-semibold text-white">{pipelineLabel}</p>
                  <p className="mt-2 text-sm leading-6 text-white/65">
                    {pipelineReady
                      ? '실제 음원 추출과 오디오 분석 엔드포인트가 응답 중입니다.'
                      : healthError || '실제 분석 서버가 내려가 있거나 포트 충돌이 있습니다.'}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="mt-8 grid gap-6 lg:grid-cols-[1.15fr,0.85fr]">
          {activeSection === 'discover' && (
            <>
              <div className="rounded-[32px] border border-white/10 bg-white/5 p-6">
                <h3 className="text-xl font-semibold text-white">추출 안정성 진단</h3>
                <div className="mt-5 grid gap-4 md:grid-cols-2">
                  <div className="rounded-3xl border border-white/8 bg-[#0d1326] p-5">
                    <p className="text-sm text-white/50">실제 분석 서버</p>
                    <p className="mt-2 text-lg font-semibold text-white">{pipelineReady ? '정상 응답' : '연결 실패 또는 포트 충돌'}</p>
                    <p className="mt-2 text-sm text-white/60">백엔드가 이미 떠 있는데 `npm run dev`가 다시 같은 8002 포트를 잡으면 즉시 죽습니다.</p>
                  </div>
                  <div className="rounded-3xl border border-white/8 bg-[#0d1326] p-5">
                    <p className="text-sm text-white/50">yt-dlp / FFmpeg</p>
                    <p className="mt-2 text-lg font-semibold text-white">
                      {health?.services?.audio_pipeline?.yt_dlp_version || '버전 미확인'}
                    </p>
                    <p className="mt-2 text-sm text-white/60">
                      FFmpeg {ffmpegReady ? '연결됨' : '미연결'} / 쿠키 파일{' '}
                      {health?.services?.audio_pipeline?.cookie_file_configured ? '설정됨' : '미설정'}
                    </p>
                  </div>
                </div>
              </div>

              <div className="rounded-[32px] border border-white/10 bg-white/5 p-6">
                <h3 className="text-xl font-semibold text-white">경쟁사에서 가져온 구조 기준</h3>
                <div className="mt-5 space-y-4 text-sm leading-6 text-white/72">
                  <div className="rounded-3xl border border-white/8 bg-[#0d1326] p-5">
                    <p className="font-semibold text-white">Songsterr형</p>
                    <p className="mt-2">검색과 결과를 분리하고, 플레이어와 탭을 워크스페이스로 고정해 탐색 피로를 줄입니다.</p>
                  </div>
                  <div className="rounded-3xl border border-white/8 bg-[#0d1326] p-5">
                    <p className="font-semibold text-white">Moises형</p>
                    <p className="mt-2">분리, BPM, 키, 섹션, 메트로놈 같은 연습 가치를 상단 카드로 노출해 실제 효용을 먼저 보여줍니다.</p>
                  </div>
                </div>
              </div>
            </>
          )}

          {activeSection === 'workspace' && (
            <>
              <div className="rounded-[32px] border border-white/10 bg-white/5 p-6">
                {tabData ? (
                  <>
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <p className="text-sm text-white/45">현재 워크스페이스</p>
                        <h3 className="mt-1 text-2xl font-semibold text-white">{tabData.title}</h3>
                        <p className="mt-2 text-sm text-white/60">{tabData.artist}</p>
                      </div>
                      <div className="flex gap-2">
                        <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-sm text-white/75">
                          {tabData.key}
                        </span>
                        <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-sm text-white/75">
                          {tabData.tempo} BPM
                        </span>
                        <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-sm text-white/75">
                          {tabData.difficulty}
                        </span>
                      </div>
                    </div>

                    <div className="mt-6 grid gap-4 lg:grid-cols-[0.78fr,1.22fr]">
                      <div className="rounded-[28px] border border-white/10 bg-[#0d1326] p-4">
                        <YouTubePlayer url={youtubeUrl} />
                      </div>
                      <div className="overflow-hidden rounded-[28px] border border-white/10 bg-[#f7f4ec] p-1 text-black">
                        {notationData ? <NotationViewer data={notationData} /> : null}
                      </div>
                    </div>
                  </>
                ) : (
                  <div className="rounded-3xl border border-dashed border-white/14 bg-[#0d1326] p-10 text-center text-white/60">
                    결과가 아직 없습니다. 탐색 메뉴에서 URL을 넣고 분석을 시작하세요.
                  </div>
                )}
              </div>

              <div className="rounded-[32px] border border-white/10 bg-white/5 p-6">
                <h3 className="text-xl font-semibold text-white">결과 신뢰도</h3>
                {tabData ? (
                  <div className="mt-5 space-y-4">
                    <div className="rounded-3xl border border-white/8 bg-[#0d1326] p-5">
                      <p className="text-sm text-white/50">분석 방식</p>
                      <p className="mt-2 text-lg font-semibold text-white">{tabData.metadata.analysis_method || 'unknown'}</p>
                      <p className="mt-2 text-sm text-white/60">
                        {metadataMode ? '실제 추출 실패 또는 서버 미연결 시 생성된 미리보기 성격 결과입니다.' : '실제 음원 추출 이후 생성된 결과입니다.'}
                      </p>
                    </div>
                    <div className="rounded-3xl border border-white/8 bg-[#0d1326] p-5">
                      <p className="text-sm text-white/50">추출 시도</p>
                      {extractAttempts.length > 0 ? (
                        <div className="mt-3 space-y-2">
                          {extractAttempts.slice(0, 4).map((attempt, index) => (
                            <p key={`${attempt.name || 'attempt'}-${index}`} className="text-sm text-white/72">
                              {attempt.name}: {attempt.status}
                              {attempt.error ? ` / ${attempt.error}` : ''}
                            </p>
                          ))}
                        </div>
                      ) : (
                        <p className="mt-2 text-sm text-white/60">추출 진단 정보가 아직 없습니다.</p>
                      )}
                    </div>
                  </div>
                ) : (
                  <p className="mt-4 text-sm text-white/60">분석 후 신뢰도 요약이 여기에 표시됩니다.</p>
                )}
              </div>
            </>
          )}

          {activeSection === 'practice' && (
            <>
              <div className="rounded-[32px] border border-white/10 bg-white/5 p-6">
                <h3 className="text-xl font-semibold text-white">연습용 신호</h3>
                <div className="mt-5 grid gap-4 md:grid-cols-3">
                  <div className="rounded-3xl border border-white/8 bg-[#0d1326] p-5">
                    <Gauge className="h-5 w-5 text-[#7ef0a5]" />
                    <p className="mt-3 text-sm text-white/50">템포</p>
                    <p className="mt-2 text-2xl font-semibold text-white">{tabData?.tempo ?? '--'} BPM</p>
                  </div>
                  <div className="rounded-3xl border border-white/8 bg-[#0d1326] p-5">
                    <Sparkles className="h-5 w-5 text-[#ffcf66]" />
                    <p className="mt-3 text-sm text-white/50">기법</p>
                    <p className="mt-2 text-2xl font-semibold text-white">{tabData?.metadata.techniques?.join(', ') || '--'}</p>
                  </div>
                  <div className="rounded-3xl border border-white/8 bg-[#0d1326] p-5">
                    <Wand2 className="h-5 w-5 text-[#8cc8ff]" />
                    <p className="mt-3 text-sm text-white/50">코드 진행</p>
                    <p className="mt-2 text-2xl font-semibold text-white">{tabData?.chord_progressions.length ?? 0}</p>
                  </div>
                </div>
              </div>

              <div className="rounded-[32px] border border-white/10 bg-white/5 p-6">
                <h3 className="text-xl font-semibold text-white">연습 흐름 추천</h3>
                <div className="mt-5 space-y-4 text-sm leading-6 text-white/72">
                  <div className="rounded-3xl border border-white/8 bg-[#0d1326] p-5">
                    1. 실제 분석 결과면 워크스페이스에서 탭을 먼저 확인합니다.
                  </div>
                  <div className="rounded-3xl border border-white/8 bg-[#0d1326] p-5">
                    2. 미리보기 결과면 먼저 추출 안정화부터 해결한 뒤 다시 분석합니다.
                  </div>
                  <div className="rounded-3xl border border-white/8 bg-[#0d1326] p-5">
                    3. BPM과 코드 진행이 안정적으로 나오면 그다음에 세부 주법 컴포넌트를 확장합니다.
                  </div>
                </div>
              </div>
            </>
          )}

          {activeSection === 'library' && (
            <>
              <div className="rounded-[32px] border border-white/10 bg-white/5 p-6">
                <div className="mb-5 flex items-center gap-3">
                  <FolderHeart className="h-5 w-5 text-[#ff9f43]" />
                  <h3 className="text-xl font-semibold text-white">즐겨찾기 보관함</h3>
                </div>
                <FavoritesManager
                  onFavoriteClick={(url) => {
                    setYoutubeUrl(url)
                    setActiveSection('discover')
                    toast('URL을 입력창에 채웠습니다. 분석을 시작하세요.', { icon: '🎯' })
                  }}
                />
              </div>

              <div className="rounded-[32px] border border-white/10 bg-white/5 p-6">
                <h3 className="text-xl font-semibold text-white">지금 구조에서 남은 작업</h3>
                <div className="mt-5 space-y-4 text-sm leading-6 text-white/72">
                  <div className="rounded-3xl border border-white/8 bg-[#0d1326] p-5">
                    추출 성공/실패와 미리보기 폴백을 사용자에게 더 명확히 나눠 보여줘야 합니다.
                  </div>
                  <div className="rounded-3xl border border-white/8 bg-[#0d1326] p-5">
                    결과 워크스페이스의 세부 플레이어와 코드 분석은 별도 메뉴 페이지로 더 분리할 수 있습니다.
                  </div>
                  <div className="rounded-3xl border border-white/8 bg-[#0d1326] p-5">
                    서버 기동 스크립트는 포트 중복 실행을 피하도록 정리해야 합니다.
                  </div>
                </div>
              </div>
            </>
          )}
        </section>
      </div>
    </main>
  )
}
