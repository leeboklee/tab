const REAL_AUDIO_API_BASE = 'http://localhost:8002'

export interface AudioAnalysisResponse {
  success: boolean
  data?: any
  error?: string
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

  static async checkHealth(): Promise<boolean> {
    try {
      const response = await fetch(`${REAL_AUDIO_API_BASE}/health`)
      return response.ok
    } catch (error) {
      console.error('Health check failed:', error)
      return false
    }
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
