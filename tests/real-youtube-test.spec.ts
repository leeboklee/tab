import { test, expect } from '@playwright/test'

const APP_URL = 'http://localhost:3009'

test('실제 YouTube URL로 타브 악보 생성 테스트', async ({ page }) => {
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
  console.log('URL 입력 완료:', ytUrl)
  
  // 빠른 분석 선택 (기본값)
  const quickAnalysisRadio = page.locator('input[name=analysis-type]').first()
  await quickAnalysisRadio.check()
  console.log('빠른 분석 선택 완료')
  
  // 분석 버튼 클릭
  const analyzeButton = page.getByRole('button', { name: /타브/ })
  await analyzeButton.click()
  console.log('분석 버튼 클릭 완료')
  
  // 분석 완료까지 대기
  let analysisCompleted = false
  let attempts = 0
  const maxAttempts = 30
  
  while (!analysisCompleted && attempts < maxAttempts) {
    await page.waitForTimeout(2000)
    attempts++
    
    const pageContent = await page.content()
    console.log(`=== 시도 ${attempts} (${attempts * 2}초) ===`)
    
    if (pageContent.includes('생성된 악보') ||
        pageContent.includes('원본 영상') ||
        pageContent.includes('타브 악보') ||
        pageContent.includes('YouTube Player')) {
      analysisCompleted = true
      console.log(`✅ 분석 완료 (${attempts * 2}초 후)`)
      
      // 결과 페이지 스크린샷
      await page.screenshot({ path: 'test-results/real-youtube-test-result.png', fullPage: true })
      
      // 타브 악보 섹션 확인
      const tabSection = page.locator('text=/생성된 악보|타브 악보/')
      const tabSectionCount = await tabSection.count()
      console.log(`타브 악보 섹션 개수: ${tabSectionCount}`)
      
      // 타브 숫자 확인
      const fretNumbers = page.locator('#tab-notation').locator('text=/\\b[0-9]\\b/')
      const fretCount = await fretNumbers.count()
      console.log(`발견된 프렛 숫자 개수: ${fretCount}`)
      
      // 기타 줄 라벨 확인
      const guitarStringLabels = page.locator('text=/E|B|G|D|A/')
      const guitarStringCount = await guitarStringLabels.count()
      console.log(`기타 줄 라벨 개수: ${guitarStringCount}`)
      
      // 마디 번호 확인
      const measureNumbers = page.locator('text=/^[0-9]+$/')
      const measureCount = await measureNumbers.count()
      console.log(`마디 번호 개수: ${measureCount}`)
      
      if (fretCount > 0) {
        console.log('✅ 타브 악보가 성공적으로 렌더링되었습니다!')
        
        // 첫 5개 프렛 숫자 확인
        for (let i = 0; i < Math.min(5, fretCount); i++) {
          const fretText = await fretNumbers.nth(i).textContent()
          console.log(`프렛 ${i + 1}: ${fretText}`)
        }
        
        // 타브 악보 섹션 스크린샷
        await page.screenshot({ path: 'test-results/tab-notation-detail.png' })
      } else {
        console.log('❌ 타브 악보가 렌더링되지 않았습니다.')
      }
      
    } else {
      console.log(`⏳ 분석 중... (${attempts * 2}초)`)
    }
  }
  
  if (!analysisCompleted) {
    console.log('❌ 분석이 완료되지 않았습니다.')
    await page.screenshot({ path: 'test-results/real-youtube-test-timeout.png', fullPage: true })
    throw new Error('분석이 완료되지 않았습니다.')
  }
  
  // 최종 검증
  expect(analysisCompleted).toBe(true)
})

