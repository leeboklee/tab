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
  }
}

export class RealAudioAPI {
  static async analyzeAudio(url: string): Promise<AudioAnalysisResponse> {
    return this.request('/analyze', { method: 'POST', body: JSON.stringify({ url }) })
  }

  static async extractAudio(url: string): Promise<AudioAnalysisResponse> {
    return this.request('/extract-audio', { method: 'POST', body: JSON.stringify({ url }) })
  }

  static async analyzeFromAudio(audioId: string): Promise<AudioAnalysisResponse> {
    return this.request('/analyze-from-audio', { method: 'POST', body: JSON.stringify({ audio_id: audioId }) })
  }

  static async testAudioAnalysis(): Promise<AudioAnalysisResponse> {
    return this.request('/test-audio-analysis')
  }

  static async getHealth(): Promise<AudioHealthResponse | null> {
    try {
      const response = await fetch(`${REAL_AUDIO_API_BASE}/health`)
      if (!response.ok) {
        return null
      }

      return await response.json()
    } catch (error) {
      console.error('Health check failed:', error)
      return null
    }
  }

  static async checkHealth(): Promise<boolean> {
    const health = await this.getHealth()
    return Boolean(health?.status === 'healthy')
  }

  private static async request(path: string, init?: RequestInit): Promise<AudioAnalysisResponse> {
    try {
      const response = await fetch(`${REAL_AUDIO_API_BASE}${path}`, {
        headers: {
          'Content-Type': 'application/json',
        },
        ...init,
      })

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }

      return await response.json()
    } catch (error) {
      console.error(`Audio API request failed for ${path}:`, error)
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      }
    }
  }
}
