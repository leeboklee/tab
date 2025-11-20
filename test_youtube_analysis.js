// YouTube URL 분석 테스트 스크립트
const testUrl = 'https://youtu.be/1bZNp9d7pLM?si=zH89d6xW1XNtF8QN';

// YouTube oEmbed API로 영상 정보 가져오기
async function getYouTubeInfo(url) {
  try {
    const response = await fetch(`https://www.youtube.com/oembed?url=${encodeURIComponent(url)}&format=json`);
    const data = await response.json();
    return data;
  } catch (error) {
    console.error('YouTube 정보 가져오기 실패:', error);
    return null;
  }
}

// 비디오 ID 추출
function extractVideoId(url) {
  const patterns = [
    /(?:youtube\.com\/watch\?v=|youtu\.be\/)([a-zA-Z0-9_-]{11})/,
    /youtube\.com\/embed\/([a-zA-Z0-9_-]{11})/,
    /youtube\.com\/v\/([a-zA-Z0-9_-]{11})/
  ];
  
  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match) {
      return match[1];
    }
  }
  return null;
}

// 메타데이터 기반 음악 분석 (실제 앱과 동일한 로직)
function analyzeMusicFromMetadata(title, artist, videoId) {
  const seed = videoId.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
  const random = (multiplier = 1) => {
    const x = Math.sin(seed * multiplier) * 10000;
    return x - Math.floor(x);
  };

  const titleLower = title.toLowerCase();
  const artistLower = artist.toLowerCase();
  
  // 템포 분석
  let tempo = 120;
  if (titleLower.includes('fast') || titleLower.includes('quick') || titleLower.includes('빠른') || titleLower.includes('신나') || titleLower.includes('댄스')) {
    tempo = Math.floor(130 + random(1) * 30);
  } else if (titleLower.includes('slow') || titleLower.includes('ballad') || titleLower.includes('느린') || titleLower.includes('발라드') || titleLower.includes('슬로우')) {
    tempo = Math.floor(60 + random(2) * 30);
  } else if (titleLower.includes('rock') || titleLower.includes('metal') || titleLower.includes('록') || titleLower.includes('메탈')) {
    tempo = Math.floor(140 + random(3) * 40);
  } else {
    tempo = Math.floor(100 + random(4) * 40);
  }

  // 키 분석
  const keys = ['C', 'G', 'D', 'A', 'E', 'B', 'F#', 'C#', 'G#', 'D#', 'A#', 'F'];
  const key = keys[Math.floor(random(5) * keys.length)];

  // 난이도 분석
  let difficulty = "중급";
  if (titleLower.includes('easy') || titleLower.includes('simple') || titleLower.includes('쉬운') || titleLower.includes('간단') || titleLower.includes('초급')) {
    difficulty = "초급";
  } else if (titleLower.includes('hard') || titleLower.includes('difficult') || titleLower.includes('advanced') || titleLower.includes('어려운') || titleLower.includes('고급') || titleLower.includes('전문')) {
    difficulty = "고급";
  } else if (titleLower.includes('rock') || titleLower.includes('metal') || titleLower.includes('jazz') || titleLower.includes('blues') || titleLower.includes('록') || titleLower.includes('메탈') || titleLower.includes('재즈') || titleLower.includes('블루스')) {
    difficulty = "고급";
  }

  // 코드 진행 생성
  const chordPatterns = {
    'C': ['C', 'Am', 'F', 'G'],
    'G': ['G', 'Em', 'C', 'D'],
    'D': ['D', 'Bm', 'G', 'A'],
    'A': ['A', 'F#m', 'D', 'E'],
    'E': ['E', 'C#m', 'A', 'B'],
    'B': ['B', 'G#m', 'E', 'F#'],
    'F#': ['F#', 'D#m', 'B', 'C#'],
    'C#': ['C#', 'A#m', 'F#', 'G#'],
    'G#': ['G#', 'Fm', 'C#', 'D#'],
    'D#': ['D#', 'Cm', 'G#', 'A#'],
    'A#': ['A#', 'Fm', 'D#', 'F'],
    'F': ['F', 'Dm', 'Bb', 'C']
  };
  
  const baseChords = chordPatterns[key] || ['C', 'Am', 'F', 'G'];
  const chordProgressions = [];
  
  for (let i = 0; i < 8; i++) {
    const chord = baseChords[i % baseChords.length];
    chordProgressions.push({
      chord,
      start_time: i * 15,
      duration: 15,
      confidence: 0.7 + random(7 + i) * 0.25
    });
  }

  // 타브 생성
  const tabs = [];
  const maxFret = difficulty === "초급" ? 3 : difficulty === "중급" ? 7 : 12;
  
  // 음악 길이에 맞춰 마디 수 계산 (4/4 박자 기준)
  const duration = Math.floor(180 + random(6) * 120); // 3-5분
  const beatDuration = 60.0 / tempo;
  const totalBeats = Math.ceil(duration / beatDuration);
  const totalMeasures = Math.ceil(totalBeats / 4); // 4비트 = 1마디
  
  for (let i = 0; i < totalMeasures; i++) {
    const tab = {
      measure: i + 1,
      frets: [0, 0, 0, 0, 0, 0],
      notes: ['E', 'B', 'G', 'D', 'A', 'E'],
      technique: 'basic'
    };
    
    // 제목과 아티스트 기반 패턴 생성
    if (titleLower.includes('love') || titleLower.includes('사랑')) {
      if (i % 2 === 0) tab.frets[0] = 1;
      if (i % 3 === 0) tab.frets[1] = 2;
    } else if (titleLower.includes('rock') || titleLower.includes('록')) {
      tab.frets[0] = Math.floor(1 + random(8 + i) * maxFret);
      tab.frets[1] = Math.floor(1 + random(9 + i) * maxFret);
      tab.frets[2] = Math.floor(1 + random(10 + i) * maxFret);
    } else if (titleLower.includes('jazz') || titleLower.includes('재즈')) {
      for (let j = 0; j < 6; j++) {
        tab.frets[j] = Math.floor(1 + random(11 + i + j) * maxFret);
      }
    } else {
      if (i % 2 === 0) tab.frets[0] = Math.floor(1 + random(12 + i) * Math.min(3, maxFret));
      if (i % 3 === 0) tab.frets[1] = Math.floor(1 + random(13 + i) * Math.min(3, maxFret));
      if (i % 4 === 0) tab.frets[2] = Math.floor(1 + random(14 + i) * Math.min(3, maxFret));
    }
    
    // 기술 설정
    if (difficulty === "고급") {
      const techniques = ['hammer-on', 'pull-off', 'slide', 'bend', 'vibrato'];
      tab.technique = techniques[Math.floor(random(15 + i) * techniques.length)];
    } else if (difficulty === "중급") {
      const techniques = ['hammer-on', 'pull-off', 'slide'];
      tab.technique = techniques[Math.floor(random(16 + i) * techniques.length)];
    }
    
    tabs.push(tab);
  }

  return {
    duration,
    tempo,
    key,
    difficulty,
    tabs,
    chord_progressions: chordProgressions
  };
}

// 메인 테스트 함수
async function testYouTubeAnalysis() {
  console.log('🎵 YouTube URL 분석 테스트 시작...');
  console.log('URL:', testUrl);
  
  // 1. YouTube 정보 가져오기
  console.log('\n1. YouTube 정보 가져오기...');
  const videoInfo = await getYouTubeInfo(testUrl);
  if (!videoInfo) {
    console.error('❌ YouTube 정보를 가져올 수 없습니다.');
    return;
  }
  
  console.log('✅ YouTube 정보 성공적으로 가져옴:');
  console.log('   제목:', videoInfo.title);
  console.log('   아티스트:', videoInfo.author_name);
  console.log('   썸네일:', videoInfo.thumbnail_url);
  
  // 2. 비디오 ID 추출
  const videoId = extractVideoId(testUrl);
  console.log('\n2. 비디오 ID 추출:', videoId);
  
  // 3. 음악 분석
  console.log('\n3. 음악 분석 수행...');
  const analysis = analyzeMusicFromMetadata(videoInfo.title, videoInfo.author_name, videoId);
  
  console.log('✅ 분석 결과:');
  console.log('   템포:', analysis.tempo, 'BPM');
  console.log('   키:', analysis.key);
  console.log('   난이도:', analysis.difficulty);
  console.log('   길이:', Math.floor(analysis.duration / 60) + ':' + (analysis.duration % 60).toString().padStart(2, '0'));
  console.log('   마디 수:', analysis.tabs.length);
  console.log('   코드 수:', analysis.chord_progressions.length);
  
  // 4. 타브 악보 상세 정보
  console.log('\n4. 타브 악보 상세:');
  analysis.tabs.forEach((tab, index) => {
    const activeFrets = tab.frets.filter(fret => fret > 0);
    console.log(`   마디 ${tab.measure}: [${tab.frets.join(', ')}] - ${tab.technique} (활성 프렛: ${activeFrets.length}개)`);
  });
  
  // 5. 코드 진행
  console.log('\n5. 코드 진행:');
  analysis.chord_progressions.forEach((chord, index) => {
    console.log(`   ${chord.start_time}s: ${chord.chord} (신뢰도: ${Math.round(chord.confidence * 100)}%)`);
  });
  
  console.log('\n🎉 분석 완료! 실제 앱에서도 동일한 결과가 나올 것입니다.');
  
  return {
    videoInfo,
    analysis
  };
}

// 테스트 실행
testYouTubeAnalysis().catch(console.error);
