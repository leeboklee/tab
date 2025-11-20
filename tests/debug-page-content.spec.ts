import { test, expect } from '@playwright/test'

const APP_URL = 'http://localhost:3009'

test('페이지 내용 디버그', async ({ page }) => {
  test.setTimeout(120000)
  
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
    await page.waitForTimeout(1000)
    attempts++
    
    const pageContent = await page.content()
    console.log(`=== 시도 ${attempts} ===`)
    console.log('페이지 제목:', await page.title())
    
    // 결과 섹션 찾기
    const resultSections = await page.locator('h2, h3').allTextContents()
    console.log('발견된 헤딩들:', resultSections)
    
    // 생성된 악보 관련 텍스트 찾기
    const tabRelatedText = await page.locator('text=/악보|타브|생성/').allTextContents()
    console.log('악보/타브 관련 텍스트:', tabRelatedText)
    
    if (pageContent.includes('실제 오디오 분석 결과') || 
        pageContent.includes('생성된 악보') ||
        pageContent.includes('타브 악보') ||
        pageContent.includes('원본 영상')) {
      analysisCompleted = true
      console.log(`✅ 분석 완료 (${attempts}초 후)`)
    } else {
      console.log(`⏳ 분석 중... (${attempts}초)`)
    }
  }
  
  // 최종 페이지 내용 스크린샷
  await page.screenshot({ path: 'test-results/debug-page-content.png', fullPage: true })
  
  // 페이지의 모든 텍스트 출력
  const allText = await page.textContent('body')
  console.log('=== 전체 페이지 텍스트 ===')
  console.log(allText)
})
