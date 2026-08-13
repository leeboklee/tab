const REAL_AUDIO_API_BASE =
  process.env.NEXT_PUBLIC_REAL_AUDIO_API_BASE?.trim() || 'http://localhost:8002'

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
    }
    audio_analysis_deps?: {
      librosa?: boolean
      numpy?: boolean
    }
    cloud_analysis?: {
      configured?: boolean
      api_key_configured?: boolean
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
  private static readonly HEALTH_TIMEOUT_MS = 5000

  static async analyzeAudio(url: string, quality: 'balanced' | 'cloud' = 'balanced'): Promise<AudioAnalysisResponse> {
    return this.request('/analyze', { method: 'POST', body: JSON.stringify({ url, quality }) })
  }

  static async extractAudio(url: string): Promise<AudioAnalysisResponse> {
    return this.request('/extract-audio', { method: 'POST', body: JSON.stringify({ url }) })
  }

  static async analyzeFromAudio(audioId: string, quality: 'balanced' | 'local_quality' = 'balanced'): Promise<AudioAnalysisResponse> {
    return this.request('/analyze-from-audio', { method: 'POST', body: JSON.stringify({ audio_id: audioId, quality }) })
  }

  static async testAudioAnalysis(): Promise<AudioAnalysisResponse> {
    return this.request('/test-audio-analysis')
  }

  static async getHealth(): Promise<AudioHealthResponse | null> {
    const controller = new AbortController()
    const timeout = window.setTimeout(() => controller.abort(), this.HEALTH_TIMEOUT_MS)

    try {
      const response = await fetch(`${REAL_AUDIO_API_BASE}/health`, { signal: controller.signal, cache: 'no-store' })
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

  private static async request(path: string, init?: RequestInit): Promise<AudioAnalysisResponse> {
    const controller = new AbortController()
    const timeout = window.setTimeout(() => controller.abort(), this.REQUEST_TIMEOUT_MS)

    try {
      const response = await fetch(`${REAL_AUDIO_API_BASE}${path}`, {
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
