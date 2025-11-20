/**
 * 실제 오디오 분석 API 클라이언트
 */

const REAL_AUDIO_API_BASE = 'http://localhost:8002'

export interface AudioAnalysisRequest {
  url: string
  analysis_type?: 'full' | 'tempo_only' | 'key_only' | 'chords_only'
}

export interface AudioAnalysisResponse {
  success: boolean
  data?: any
  error?: string
  processing_time?: number
}

export class RealAudioAPI {
  /**
   * 실제 오디오 분석 수행
   */
  static async analyzeAudio(url: string, analysisType: string = 'full'): Promise<AudioAnalysisResponse> {
    try {
      // Backend expects /analyze with { url }
      const response = await fetch(`${REAL_AUDIO_API_BASE}/analyze`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          url
        })
      })

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }

      const data = await response.json()
      return data
    } catch (error) {
      console.error('Real audio analysis failed:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      }
    }
  }

  /**
   * 템포만 빠르게 분석
   */
  static async analyzeTempoOnly(url: string): Promise<AudioAnalysisResponse> {
    try {
      // Fallback to full analyze when dedicated endpoint is unavailable
      const response = await fetch(`${REAL_AUDIO_API_BASE}/analyze`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ url })
      })

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }

      const data = await response.json()
      return data
    } catch (error) {
      console.error('Tempo analysis failed:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      }
    }
  }

  /**
   * 테스트용 오디오 분석
   */
  static async testAudioAnalysis(): Promise<AudioAnalysisResponse> {
    try {
      const response = await fetch(`${REAL_AUDIO_API_BASE}/test-audio-analysis`)

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }

      const data = await response.json()
      return data
    } catch (error) {
      console.error('Test audio analysis failed:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      }
    }
  }

  /**
   * 서버 상태 확인
   */
  static async checkHealth(): Promise<boolean> {
    try {
      const response = await fetch(`${REAL_AUDIO_API_BASE}/health`)
      return response.ok
    } catch (error) {
      console.error('Health check failed:', error)
      return false
    }
  }
}
