import { test, expect } from '@playwright/test'

const APP_URL = 'http://localhost:3009'

test('단계별 디버그 - 분석 과정 확인', async ({ page }) => {
  test.setTimeout(120000)
  
  // 콘솔 로그 수집
  page.on('console', msg => {
    console.log(`브라우저 콘솔 [${msg.type()}]:`, msg.text())
  })
  
  // 페이지 로드
  await page.goto(APP_URL, { waitUntil: 'domcontentloaded' })
  
  // 초기 상태 확인
  console.log('=== 초기 상태 확인 ===')
  const initialContent = await page.content()
  console.log('초기 페이지에 "분석 중" 텍스트가 있는가?', initialContent.includes('분석 중'))
  console.log('초기 페이지에 "생성된 악보" 텍스트가 있는가?', initialContent.includes('생성된 악보'))
  
  // URL 입력
  const ytUrl = 'https://youtu.be/8Q2SrN6J8uc?si=jDixxt4FuOfFvsmi'
  await page.getByLabel('유튜브 URL 입력').fill(ytUrl)
  console.log('URL 입력 완료:', ytUrl)
  
  // 빠른 분석 선택 (기본값)
  const quickAnalysisRadio = page.locator('input[name=analysis-type]').first()
  await quickAnalysisRadio.check()
  console.log('빠른 분석 선택 완료')
  
  // 분석 시작 버튼 클릭
  const analyzeButton = page.getByRole('button', { name: /타브/ })
  await analyzeButton.click()
  console.log('분석 시작 버튼 클릭 완료')
  
  // 분석 중 상태 확인
  await page.waitForTimeout(1000)
  const analyzingContent = await page.content()
  console.log('=== 분석 중 상태 확인 ===')
  console.log('분석 중 텍스트가 있는가?', analyzingContent.includes('분석 중'))
  console.log('분석 중 텍스트가 있는가?', analyzingContent.includes('음악을 분석하고 있습니다'))
  console.log('로딩 스피너가 있는가?', analyzingContent.includes('LoadingSpinner'))
  
  // 분석 완료까지 대기
  let analysisCompleted = false
  let attempts = 0
  const maxAttempts = 30
  
  while (!analysisCompleted && attempts < maxAttempts) {
    await page.waitForTimeout(2000)
    attempts++
    
    const pageContent = await page.content()
    console.log(`=== 시도 ${attempts} (${attempts * 2}초) ===`)
    
    // 각 단계별 확인
    const hasAnalyzing = pageContent.includes('분석 중') || pageContent.includes('음악을 분석하고 있습니다')
    const hasResult = pageContent.includes('생성된 악보') || pageContent.includes('원본 영상') || pageContent.includes('타브 악보')
    const hasYouTubePlayer = pageContent.includes('YouTube Player')
    const hasNotationViewer = pageContent.includes('NotationViewer')
    
    console.log('분석 중 상태:', hasAnalyzing)
    console.log('결과 상태:', hasResult)
    console.log('YouTube Player:', hasYouTubePlayer)
    console.log('NotationViewer:', hasNotationViewer)
    
    if (hasResult || hasYouTubePlayer) {
      analysisCompleted = true
      console.log(`✅ 분석 완료 (${attempts * 2}초 후)`)
      
      // 결과 페이지 스크린샷
      await page.screenshot({ path: 'test-results/step-by-step-result.png', fullPage: true })
      
      // 최종 상태 확인
      console.log('=== 최종 상태 확인 ===')
      const finalContent = await page.content()
      console.log('생성된 악보 텍스트:', finalContent.includes('생성된 악보'))
      console.log('원본 영상 텍스트:', finalContent.includes('원본 영상'))
      console.log('타브 악보 텍스트:', finalContent.includes('타브 악보'))
      console.log('YouTube Player:', finalContent.includes('YouTube Player'))
      console.log('NotationViewer:', finalContent.includes('NotationViewer'))
      
      // 타브 악보 섹션 확인
      const tabSection = page.locator('text=/생성된 악보|타브 악보/')
      const tabSectionCount = await tabSection.count()
      console.log(`타브 악보 섹션 개수: ${tabSectionCount}`)
      
      // 타브 숫자 확인
      const fretNumbers = page.locator('#tab-notation').locator('text=/\\b[0-9]\\b/')
      const fretCount = await fretNumbers.count()
      console.log(`발견된 프렛 숫자 개수: ${fretCount}`)
      
    } else {
      console.log(`⏳ 분석 중... (${attempts * 2}초)`)
    }
  }
  
  if (!analysisCompleted) {
    console.log('❌ 분석이 완료되지 않았습니다.')
    await page.screenshot({ path: 'test-results/step-by-step-timeout.png', fullPage: true })
  }
})
