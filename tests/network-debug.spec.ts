import { test, expect } from '@playwright/test'

const APP_URL = 'http://localhost:3019'

test('네트워크 디버그 - 실제 오디오 분석 요청/응답 확인', async ({ page }) => {
  test.setTimeout(300000)
  
  // 네트워크 요청/응답 로깅
  page.on('request', request => {
    if (request.url().includes('analyze-audio')) {
      console.log('📤 요청:', request.method(), request.url())
      console.log('📤 요청 본문:', request.postData())
    }
  })
  
  page.on('response', response => {
    if (response.url().includes('analyze-audio')) {
      console.log('📥 응답 상태:', response.status())
      console.log('📥 응답 URL:', response.url())
    }
  })
  
  // 콘솔 로그 수집
  page.on('console', msg => {
    console.log(`브라우저 콘솔 [${msg.type()}]:`, msg.text())
  })
  
  // 페이지 로드
  await page.goto(APP_URL, { waitUntil: 'domcontentloaded' })
  
  // URL 입력
  const ytUrl = 'https://youtu.be/8Q2SrN6J8uc?si=jDixxt4FuOfFvsmi'
  await page.getByLabel('유튜브 URL 입력').fill(ytUrl)
  
  // 실제 오디오 분석 선택
  const realAnalysisRadio = page.locator('input[name=analysis-type]').last()
  await realAnalysisRadio.check()
  
  // 분석 시작
  await page.getByRole('button', { name: /타브/ }).click()
  
  // 분석 완료까지 대기
  let analysisCompleted = false
  let attempts = 0
  const maxAttempts = 60
  
  while (!analysisCompleted && attempts < maxAttempts) {
    await page.waitForTimeout(2000)
    attempts++
    
    const pageContent = await page.content()
    console.log(`=== 시도 ${attempts} (${attempts * 2}초) ===`)
    
    if (pageContent.includes('실제 오디오 분석 결과') || 
        pageContent.includes('생성된 악보') ||
        pageContent.includes('원본 영상')) {
      analysisCompleted = true
      console.log(`✅ 분석 완료 (${attempts * 2}초 후)`)
      
      // 결과 페이지 스크린샷
      await page.screenshot({ path: 'test-results/network-debug-result.png', fullPage: true })
      
      // 페이지의 모든 텍스트 출력
      const allText = await page.textContent('body')
      console.log('=== 전체 페이지 텍스트 ===')
      console.log(allText)
    } else {
      console.log(`⏳ 분석 중... (${attempts * 2}초)`)
    }
  }
  
  if (!analysisCompleted) {
    console.log('❌ 분석이 완료되지 않았습니다.')
    await page.screenshot({ path: 'test-results/network-debug-timeout.png', fullPage: true })
  }
})

