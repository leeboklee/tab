// 프론트엔드 API 테스트
const fetch = require('node-fetch');

const REAL_AUDIO_API_BASE = 'http://localhost:8001';

class RealAudioAPI {
  static async analyzeAudio(url, analysisType = 'full') {
    try {
      const response = await fetch(`${REAL_AUDIO_API_BASE}/analyze-audio`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          url,
          analysis_type: analysisType
        })
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      return data;
    } catch (error) {
      console.error('Real audio analysis failed:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  static async checkHealth() {
    try {
      const response = await fetch(`${REAL_AUDIO_API_BASE}/health`);
      return response.ok;
    } catch (error) {
      console.error('Health check failed:', error);
      return false;
    }
  }
}

async function testFrontendAPI() {
  console.log('=== 프론트엔드 API 테스트 시작 ===');

  // 1. 헬스 체크
  console.log('\n1. 서버 상태 확인...');
  const isHealthy = await RealAudioAPI.checkHealth();
  if (!isHealthy) {
    console.log('❌ 서버가 실행되지 않고 있습니다.');
    return;
  }
  console.log('✅ 서버 상태 정상');

  // 2. 실제 YouTube 분석
  console.log('\n2. YouTube 실제 분석 테스트...');
  const testUrl = 'https://youtu.be/kQuxJbP6s8Y?si=05CIHlaApP6s8YTI';
  console.log(`분석할 URL: ${testUrl}`);

  const result = await RealAudioAPI.analyzeAudio(testUrl, 'full');

  if (result.success) {
    console.log('✅ 분석 성공!');
    console.log(`처리 시간: ${result.processing_time?.toFixed(2)}초`);
    console.log(`템포: ${result.data?.tempo?.toFixed(2)} BPM`);
    console.log(`키: ${result.data?.key}`);
    console.log(`난이도: ${result.data?.difficulty}`);
    console.log(`지속시간: ${result.data?.duration?.toFixed(1)}초`);
    console.log(`코드 진행 수: ${result.data?.chord_progression?.length}`);
    console.log(`탭 마디 수: ${result.data?.tabs?.length}`);

    // 탭 데이터 샘플 출력
    if (result.data?.tabs && result.data.tabs.length > 0) {
      console.log('\n=== 첫 번째 탭 마디 ===');
      console.log(JSON.stringify(result.data.tabs[0], null, 2));
    }
  } else {
    console.log('❌ 분석 실패:', result.error);
  }

  console.log('\n=== 테스트 완료 ===');
}

// 실행
testFrontendAPI().catch(console.error);
