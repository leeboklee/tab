import { test, expect } from '@playwright/test'

const APP_URL = 'http://localhost:3019'

test('상세 디버그 - 분석 결과 데이터 확인', async ({ page }) => {
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
  
  // 빠른 분석 선택 (기본값)
  const quickAnalysisRadio = page.locator('input[name=analysis-type]').first()
  await quickAnalysisRadio.check()
  
  // 분석 시작
  await page.getByRole('button', { name: /타브/ }).click()
  
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
      await page.screenshot({ path: 'test-results/detailed-debug-result.png', fullPage: true })
      
      // 페이지의 모든 텍스트 출력
      const allText = await page.textContent('body')
      console.log('=== 전체 페이지 텍스트 ===')
      console.log(allText)
      
      // NotationViewer 컴포넌트 확인
      const notationViewer = page.locator('[data-testid="notation-viewer"]')
      const notationViewerCount = await notationViewer.count()
      console.log(`NotationViewer 컴포넌트 개수: ${notationViewerCount}`)
      
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
      
      // 모든 div 요소 확인
      const allDivs = await page.locator('div').allTextContents()
      console.log('=== 모든 div 텍스트 ===')
      allDivs.forEach((text, index) => {
        if (text.trim() && text.includes('타브') || text.includes('악보') || text.includes('기타')) {
          console.log(`Div ${index}: ${text.trim()}`)
        }
      })
      
    } else {
      console.log(`⏳ 분석 중... (${attempts * 2}초)`)
    }
  }
  
  if (!analysisCompleted) {
    console.log('❌ 분석이 완료되지 않았습니다.')
    await page.screenshot({ path: 'test-results/detailed-debug-timeout.png', fullPage: true })
  }
})

