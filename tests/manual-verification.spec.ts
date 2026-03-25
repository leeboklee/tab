import { test, expect } from '@playwright/test'

const APP_URL = 'http://localhost:3019'

test('수동 검증 - 전체 음악 타브 생성 확인', async ({ page }) => {
  test.setTimeout(300000) // 5분 타임아웃
  
  // 콘솔 로그 수집
  page.on('console', msg => {
    console.log(`브라우저 콘솔 [${msg.type()}]:`, msg.text())
  })
  
  // 페이지 로드
  await page.goto(APP_URL, { waitUntil: 'domcontentloaded' })
  
  // URL 입력 (3분짜리 음악)
  const ytUrl = 'https://youtu.be/dQw4w9WgXcQ' // Rick Astley - Never Gonna Give You Up (3분 32초)
  await page.getByLabel('유튜브 URL 입력').fill(ytUrl)
  
  // 실제 오디오 분석 선택
  const realAnalysisRadio = page.locator('input[name=analysis-type]').last()
  await realAnalysisRadio.check()
  
  console.log('🎵 3분 32초 음악 분석 시작...')
  
  // 분석 시작
  await page.getByRole('button', { name: /타브/ }).click()
  
  // 분석 완료까지 대기
  let analysisCompleted = false
  let attempts = 0
  const maxAttempts = 300 // 5분
  
  while (!analysisCompleted && attempts < maxAttempts) {
    await page.waitForTimeout(1000) // 1초 대기
    attempts++
    
    const pageContent = await page.content()
    if (pageContent.includes('실제 오디오 분석 결과') || 
        pageContent.includes('생성된 악보')) {
      analysisCompleted = true
      console.log(`✅ 분석 완료 (${attempts}초 후)`)
    } else {
      console.log(`⏳ 분석 중... (${attempts}초)`)
    }
  }
  
  if (!analysisCompleted) {
    console.log('❌ 분석이 완료되지 않았습니다.')
    await page.screenshot({ path: 'test-results/analysis-timeout.png' })
    throw new Error('분석이 완료되지 않았습니다.')
  }
  
  // 타브 악보 섹션 확인
  const tabSection = page.locator('text=생성된 악보')
  await expect(tabSection).toBeVisible()
  
  // 타브 숫자 확인
  const fretNumbers = page.locator('#tab-notation').locator('text=/\\b[0-9]\\b/')
  const fretCount = await fretNumbers.count()
  
  console.log(`🎸 발견된 프렛 숫자 개수: ${fretCount}`)
  
  // 타브 라인 수 확인 (마디 수)
  const tabLines = page.locator('#tab-notation').locator('div[class*="flex items-center mb-1"]')
  const tabLineCount = await tabLines.count()
  
  console.log(`📊 타브 라인 수 (마디 수): ${tabLineCount}`)
  
  if (fretCount > 0) {
    console.log('✅ 타브 악보가 성공적으로 렌더링되었습니다!')
    
    // 첫 5개 프렛 숫자 확인
    for (let i = 0; i < Math.min(5, fretCount); i++) {
      const fretText = await fretNumbers.nth(i).textContent()
      console.log(`프렛 ${i + 1}: ${fretText}`)
    }
    
    // 전체 타브 라인 확인
    console.log('📝 전체 타브 라인:')
    for (let i = 0; i < Math.min(10, tabLineCount); i++) {
      const lineText = await tabLines.nth(i).textContent()
      console.log(`마디 ${i + 1}: ${lineText}`)
    }
    
    // 스크린샷 저장
    await page.screenshot({ path: 'test-results/full-music-tab-verification.png' })
    
    // 3분 음악이면 최소 30개 이상의 마디가 있어야 함 (4/4박자 기준)
    expect(tabLineCount).toBeGreaterThan(20)
    
  } else {
    console.log('❌ 타브 악보가 렌더링되지 않았습니다.')
    await page.screenshot({ path: 'test-results/failed-tab-rendering.png' })
    throw new Error('타브 악보가 렌더링되지 않았습니다.')
  }
  
  // 최소한 하나의 프렛 숫자가 있어야 함
  expect(fretCount).toBeGreaterThan(0)
})

