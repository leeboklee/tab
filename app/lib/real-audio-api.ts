const LOCAL_BACKEND = 'http://localhost:8002'
const SAME_ORIGIN_BACKEND = '/api/python'

function isLocalBackendUrl(url: string): boolean {
  return /localhost:8002|127\.0\.0\.1:8002/.test(url)
}

/** Browser uses same-origin proxy so port-forwarding needs only :3019. */
function resolveAudioApiBase(): string {
  const configured = process.env.NEXT_PUBLIC_REAL_AUDIO_API_BASE?.trim()

  if (typeof window !== 'undefined') {
    if (!configured || isLocalBackendUrl(configured)) {
      return SAME_ORIGIN_BACKEND
    }
    return configured
  }

  return configured || LOCAL_BACKEND
}

export interface AudioAnalysisResponse {
  success: boolean
  data?: any
  error?: string
}

export interface AudioHealthResponse {
  status: string
  services?: {
    audio_pipeline?: {
      ffmpeg_available?: boolean
      ffmpeg_source?: string
      yt_dlp_version?: string
      cookie_file_configured?: boolean
      cookies_from_browser_configured?: boolean
      pot_provider_installed?: boolean
    }
    audio_analysis_deps?: {
      librosa?: boolean
      numpy?: boolean
    }
    cloud_analysis?: {
      configured?: boolean
      api_key_configured?: boolean
    }
    analysis_cache?: {
      maxsize?: number
      ttl_sec?: number
      current_size?: number
    }
    analysis_inflight_locks?: {
      maxsize?: number
      ttl_sec?: number
      current_size?: number
    }
    high_quality?: {
      demucs_available?: boolean
      cuda_available?: boolean
      device?: string
      model?: string
    }
  }
}

export class RealAudioAPI {
  private static readonly REQUEST_TIMEOUT_MS = 180000
  private static readonly HEALTH_TIMEOUT_MS = 2500

  private static apiBase(): string {
    return resolveAudioApiBase()
  }

  static async analyzeAudio(url: string, quality: 'balanced' | 'cloud' = 'balanced'): Promise<AudioAnalysisResponse> {
    let last: AudioAnalysisResponse = { success: false, error: 'Unknown error' }
    for (let attempt = 0; attempt < 2; attempt += 1) {
      last = await this.request('/analyze', { method: 'POST', body: JSON.stringify({ url, quality }) })
      if (last.success) return last
      const err = (last.error || '').toLowerCase()
      const retryable = err.includes('status: 500') || err.includes('status: 502') || err.includes('status: 503') || err.includes('fetch') || err.includes('abort')
      if (!retryable || attempt === 1) break
      await new Promise((r) => setTimeout(r, 1200))
    }
    return last
  }

  static async extractAudio(url: string): Promise<AudioAnalysisResponse> {
    return this.request('/extract-audio', { method: 'POST', body: JSON.stringify({ url }) })
  }

  static async analyzeFromAudio(audioId: string, quality: 'balanced' | 'local_quality' = 'balanced'): Promise<AudioAnalysisResponse> {
    return this.request('/analyze-from-audio', { method: 'POST', body: JSON.stringify({ audio_id: audioId, quality }) })
  }

  static async analyzeUpload(
    file: File,
    options?: { title?: string; artist?: string; quality?: 'balanced' | 'local_quality' }
  ): Promise<AudioAnalysisResponse> {
    const form = new FormData()
    form.append('file', file)
    if (options?.title) form.append('title', options.title)
    if (options?.artist) form.append('artist', options.artist)
    form.append('quality', options?.quality || 'balanced')
    return this.requestForm('/analyze-upload', form)
  }

  static async uploadAudio(file: File, options?: { title?: string; artist?: string }): Promise<AudioAnalysisResponse> {
    const form = new FormData()
    form.append('file', file)
    if (options?.title) form.append('title', options.title)
    if (options?.artist) form.append('artist', options.artist)
    return this.requestForm('/upload-audio', form)
  }

  static async testAudioAnalysis(): Promise<AudioAnalysisResponse> {
    return this.request('/test-audio-analysis')
  }

  static async getHealth(): Promise<AudioHealthResponse | null> {
    const controller = new AbortController()
    const timeout = window.setTimeout(() => controller.abort(), this.HEALTH_TIMEOUT_MS)

    try {
      const response = await fetch(`${this.apiBase()}/health`, { signal: controller.signal, cache: 'no-store' })
      if (!response.ok) {
        return null
      }

      return await response.json()
    } catch (error) {
      console.error('Health check failed:', error)
      return null
    } finally {
      window.clearTimeout(timeout)
    }
  }

  static async checkHealth(): Promise<boolean> {
    const health = await this.getHealth()
    return Boolean(health?.status === 'healthy')
  }

  static audioStreamUrl(audioId: string): string {
    return `${this.apiBase()}/audio/${encodeURIComponent(audioId)}/stream`
  }

  private static async requestForm(path: string, form: FormData): Promise<AudioAnalysisResponse> {
    const controller = new AbortController()
    const timeout = window.setTimeout(() => controller.abort(), this.REQUEST_TIMEOUT_MS)

    try {
      const response = await fetch(`${this.apiBase()}${path}`, {
        method: 'POST',
        body: form,
        signal: controller.signal,
      })

      if (!response.ok) {
        try {
          const body = await response.json()
          if (body && typeof body === 'object' && ('error' in body || 'success' in body)) {
            return {
              success: Boolean(body.success),
              data: body.data,
              error: typeof body.error === 'string' ? body.error : `HTTP error! status: ${response.status}`,
            }
          }
        } catch {
          // fall through
        }
        throw new Error(`HTTP error! status: ${response.status}`)
      }

      return await response.json()
    } catch (error) {
      console.error(`Audio API form request failed for ${path}:`, error)
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      }
    } finally {
      window.clearTimeout(timeout)
    }
  }

  private static async request(path: string, init?: RequestInit): Promise<AudioAnalysisResponse> {
    const controller = new AbortController()
    const timeout = window.setTimeout(() => controller.abort(), this.REQUEST_TIMEOUT_MS)

    try {
      const response = await fetch(`${this.apiBase()}${path}`, {
        headers: {
          'Content-Type': 'application/json',
        },
        signal: controller.signal,
        ...init,
      })

      if (!response.ok) {
        try {
          const body = await response.json()
          if (body && typeof body === 'object' && ('error' in body || 'success' in body)) {
            return {
              success: Boolean(body.success),
              data: body.data,
              error: typeof body.error === 'string' ? body.error : `HTTP error! status: ${response.status}`,
            }
          }
        } catch {
          // fall through to generic HTTP error
        }
        throw new Error(`HTTP error! status: ${response.status}`)
      }

      return await response.json()
    } catch (error) {
      console.error(`Audio API request failed for ${path}:`, error)
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      }
    } finally {
      window.clearTimeout(timeout)
    }
  }
}
