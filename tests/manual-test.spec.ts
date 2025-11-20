import { test, expect } from '@playwright/test'

const APP_URL = 'http://localhost:3009'

test('수동 테스트 - 유튜브 URL로 타브 생성', async ({ page }) => {
  test.setTimeout(300000) // 5분 타임아웃
  
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
  
  // 분석 완료까지 대기 (더 긴 시간)
  let analysisCompleted = false
  let attempts = 0
  const maxAttempts = 180 // 3분
  
  while (!analysisCompleted && attempts < maxAttempts) {
    await page.waitForTimeout(2000) // 2초 대기
    attempts++
    
    const pageContent = await page.content()
    console.log(`=== 시도 ${attempts} (${attempts * 2}초) ===`)
    
    // 결과 섹션 찾기
    const resultSections = await page.locator('h2, h3').allTextContents()
    console.log('발견된 헤딩들:', resultSections)
    
    // 생성된 악보 관련 텍스트 찾기
    const tabRelatedText = await page.locator('text=/악보|타브|생성|원본/').allTextContents()
    console.log('악보/타브 관련 텍스트:', tabRelatedText)
    
    if (pageContent.includes('실제 오디오 분석 결과') || 
        pageContent.includes('생성된 악보') ||
        pageContent.includes('원본 영상') ||
        pageContent.includes('타브 악보')) {
      analysisCompleted = true
      console.log(`✅ 분석 완료 (${attempts * 2}초 후)`)
      
      // 결과 페이지 스크린샷
      await page.screenshot({ path: 'test-results/analysis-completed.png', fullPage: true })
      
      // 타브 악보 섹션 확인
      const tabSection = page.locator('text=/생성된 악보|타브 악보/')
      if (await tabSection.count() > 0) {
        console.log('✅ 타브 악보 섹션 발견!')
        
        // 타브 숫자 확인
        const fretNumbers = page.locator('#tab-notation').locator('text=/\\b[0-9]\\b/')
        const fretCount = await fretNumbers.count()
        console.log(`발견된 프렛 숫자 개수: ${fretCount}`)
        
        if (fretCount > 0) {
          console.log('✅ 타브 악보가 성공적으로 렌더링되었습니다!')
          
          // 첫 5개 프렛 숫자 확인
          for (let i = 0; i < Math.min(5, fretCount); i++) {
            const fretText = await fretNumbers.nth(i).textContent()
            console.log(`프렛 ${i + 1}: ${fretText}`)
          }
        } else {
          console.log('❌ 타브 악보가 렌더링되지 않았습니다.')
        }
      }
    } else {
      console.log(`⏳ 분석 중... (${attempts * 2}초)`)
    }
  }
  
  if (!analysisCompleted) {
    console.log('❌ 분석이 완료되지 않았습니다.')
    await page.screenshot({ path: 'test-results/analysis-timeout.png', fullPage: true })
    throw new Error('분석이 완료되지 않았습니다.')
  }
})
