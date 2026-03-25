import { test, expect } from '@playwright/test'

const APP_URL = 'http://localhost:3019'

test('타브 데이터 생성 디버깅', async ({ page }) => {
  test.setTimeout(60000)
  
  // 콘솔 로그 수집
  page.on('console', msg => {
    console.log(`브라우저 콘솔 [${msg.type()}]:`, msg.text())
  })
  
  // 페이지 로드
  await page.goto(APP_URL, { waitUntil: 'domcontentloaded' })
  
  // URL 입력
  const ytUrl = 'https://youtu.be/8Q2SrN6J8uc?si=jDixxt4FuOfFvsmi'
  await page.getByLabel('유튜브 URL 입력').fill(ytUrl)
  
  // 빠른 분석 선택
  const quickAnalysisRadio = page.locator('input[name=analysis-type]').first()
  await quickAnalysisRadio.check()
  
  // 분석 버튼 클릭
  const analyzeButton = page.getByRole('button', { name: /타브/ })
  await analyzeButton.click()
  
  // 분석 완료까지 대기
  await page.waitForTimeout(5000)
  
  // 페이지 내용 확인
  const pageContent = await page.content()
  console.log('=== 페이지 내용 분석 ===')
  console.log('생성된 악보 포함:', pageContent.includes('생성된 악보'))
  console.log('원본 영상 포함:', pageContent.includes('원본 영상'))
  console.log('타브 악보 포함:', pageContent.includes('타브 악보'))
  
  // 타브 악보 섹션 찾기
  const tabSection = page.locator('#tab-notation')
  const tabSectionCount = await tabSection.count()
  console.log(`타브 악보 섹션 개수: ${tabSectionCount}`)
  
  if (tabSectionCount > 0) {
    const tabSectionContent = await tabSection.textContent()
    console.log('타브 악보 섹션 내용:', tabSectionContent)
    
    // 프렛 숫자 찾기
    const fretNumbers = tabSection.locator('span').filter({ hasText: /^[0-9]+$/ })
    const fretCount = await fretNumbers.count()
    console.log(`발견된 프렛 숫자 개수: ${fretCount}`)
    
    // 모든 span 요소 확인
    const allSpans = tabSection.locator('span')
    const spanCount = await allSpans.count()
    console.log(`전체 span 개수: ${spanCount}`)
    
    for (let i = 0; i < Math.min(10, spanCount); i++) {
      const spanText = await allSpans.nth(i).textContent()
      console.log(`Span ${i}: "${spanText}"`)
    }
  }
  
  // 스크린샷 저장
  await page.screenshot({ path: 'test-results/debug-tab-data.png', fullPage: true })
})

