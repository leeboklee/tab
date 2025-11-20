const { chromium } = require('playwright');

async function testTabRendering() {
  console.log('🎸 타브 악보 렌더링 테스트 시작...');
  
  const browser = await chromium.launch({ headless: false });
  const page = await browser.newPage();
  
  try {
    // 1. 페이지 로드
    console.log('📱 페이지 로드 중...');
    await page.goto('http://localhost:3009', { waitUntil: 'domcontentloaded' });
    
    // 2. 서버 상태 확인
    console.log('🔍 서버 상태 확인...');
    const serverStatus = await page.evaluate(async () => {
      try {
        const response = await fetch('http://localhost:8002/health');
        return response.ok;
      } catch (e) {
        return false;
      }
    });
    console.log(`서버 상태: ${serverStatus ? '✅ 온라인' : '❌ 오프라인'}`);
    
    // 3. URL 입력
    console.log('📝 URL 입력 중...');
    await page.fill('input[placeholder*="유튜브"]', 'https://youtu.be/dQw4w9WgXcQ');
    
    // 4. 실제 오디오 분석 선택
    console.log('🎵 실제 오디오 분석 선택...');
    const realAnalysisRadio = page.locator('input[name="analysis-type"][value="real"]');
    if (await realAnalysisRadio.isEnabled()) {
      await realAnalysisRadio.check();
      console.log('✅ 실제 오디오 분석 선택됨');
    } else {
      console.log('❌ 실제 오디오 분석 비활성화됨');
    }
    
    // 5. 분석 시작
    console.log('🚀 분석 시작...');
    await page.click('button:has-text("AI로 타브 악보 생성하기")');
    
    // 6. 결과 대기 (더 긴 시간)
    console.log('⏳ 결과 대기 중... (최대 3분)');
    
    // 여러 선택자로 결과 확인
    const selectors = [
      'h3:has-text("생성된 악보")',
      'h3:has-text("실제 오디오 분석 결과")',
      '[data-testid="analysis-result"]',
      '.card h3',
      'text=타브 악보'
    ];
    
    let foundResult = false;
    for (const selector of selectors) {
      try {
        await page.waitForSelector(selector, { timeout: 10000 });
        console.log(`✅ 결과 섹션 발견: ${selector}`);
        foundResult = true;
        break;
      } catch (e) {
        console.log(`❌ ${selector} 찾기 실패`);
      }
    }
    
    if (!foundResult) {
      console.log('❌ 결과 섹션을 찾을 수 없습니다');
      
      // 현재 페이지 상태 확인
      const pageContent = await page.content();
      console.log('📄 페이지 내용 일부:');
      console.log(pageContent.substring(0, 1000));
      
      // 에러 메시지 확인
      const errorMessages = await page.locator('text=/오류|error|실패|failed/i').allTextContents();
      if (errorMessages.length > 0) {
        console.log('🚨 발견된 에러 메시지:');
        errorMessages.forEach(msg => console.log(`  - ${msg}`));
      }
      
      return false;
    }
    
    // 7. 타브 악보 확인
    console.log('🎸 타브 악보 확인 중...');
    
    // 타브 관련 요소들 찾기
    const tabSelectors = [
      '#tab-notation',
      '.tab-notation',
      'text=/\\b[0-9]\\b/',
      'text=/프렛|fret/',
      '[class*="tab"]'
    ];
    
    let foundTabs = false;
    for (const selector of tabSelectors) {
      try {
        const elements = await page.locator(selector).all();
        if (elements.length > 0) {
          console.log(`✅ 타브 요소 발견: ${selector} (${elements.length}개)`);
          
          // 숫자가 포함된 텍스트 확인
          for (let i = 0; i < Math.min(elements.length, 5); i++) {
            const text = await elements[i].textContent();
            if (text && /\d/.test(text)) {
              console.log(`  📊 타브 데이터: ${text.substring(0, 100)}`);
              foundTabs = true;
            }
          }
        }
      } catch (e) {
        console.log(`❌ ${selector} 확인 실패`);
      }
    }
    
    if (foundTabs) {
      console.log('🎉 타브 악보가 성공적으로 렌더링되었습니다!');
    } else {
      console.log('❌ 타브 악보를 찾을 수 없습니다');
      
      // 현재 화면 스크린샷
      await page.screenshot({ path: 'tab-test-failed.png' });
      console.log('📸 스크린샷 저장: tab-test-failed.png');
    }
    
    return foundTabs;
    
  } catch (error) {
    console.error('❌ 테스트 중 오류 발생:', error);
    await page.screenshot({ path: 'tab-test-error.png' });
    return false;
  } finally {
    await browser.close();
  }
}

testTabRendering().then(success => {
  console.log(success ? '✅ 테스트 성공' : '❌ 테스트 실패');
  process.exit(success ? 0 : 1);
});
