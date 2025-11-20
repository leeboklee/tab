// 오선보 테스트 스크립트
const testData = {
  title: "테스트 곡",
  artist: "테스트 아티스트",
  duration: 180,
  tempo: 120,
  key: "C",
  difficulty: "중급",
  tabs: [
    { measure: 1, frets: [0, 0, 0, 2, 3, 0], notes: ['E', 'B', 'G', 'D', 'A', 'E'], technique: 'basic' },
    { measure: 2, frets: [0, 0, 0, 0, 2, 3], notes: ['E', 'B', 'G', 'D', 'A', 'E'], technique: 'basic' },
    { measure: 3, frets: [0, 0, 2, 3, 2, 0], notes: ['E', 'B', 'G', 'D', 'A', 'E'], technique: 'basic' },
    { measure: 4, frets: [0, 2, 2, 1, 0, 0], notes: ['E', 'B', 'G', 'D', 'A', 'E'], technique: 'basic' },
    { measure: 5, frets: [0, 0, 1, 2, 2, 0], notes: ['E', 'B', 'G', 'D', 'A', 'E'], technique: 'basic' },
    { measure: 6, frets: [0, 0, 2, 2, 1, 0], notes: ['E', 'B', 'G', 'D', 'A', 'E'], technique: 'basic' },
    { measure: 7, frets: [1, 3, 3, 2, 1, 1], notes: ['E', 'B', 'G', 'D', 'A', 'E'], technique: 'basic' },
    { measure: 8, frets: [0, 0, 0, 2, 3, 2], notes: ['E', 'B', 'G', 'D', 'A', 'E'], technique: 'basic' }
  ],
  chord_progressions: [
    { chord: "C", start_time: 0, duration: 15, confidence: 0.8 },
    { chord: "Am", start_time: 15, duration: 15, confidence: 0.7 },
    { chord: "F", start_time: 30, duration: 15, confidence: 0.9 },
    { chord: "G", start_time: 45, duration: 15, confidence: 0.8 }
  ],
  metadata: {
    view_count: 1000000,
    upload_date: "2024-01-01",
    tags: ["test", "guitar", "tablature"],
    analysis_method: "metadata_based"
  }
};

console.log("테스트 데이터:", JSON.stringify(testData, null, 2));

// 오선보 생성 함수 테스트
function generateSheetMusic(tabs) {
  const notes = ['C', 'D', 'E', 'F', 'G', 'A', 'B'];
  const guitarStrings = ['E', 'B', 'G', 'D', 'A', 'E'];
  const sheetNotes = [];
  
  tabs.forEach((tab, measureIndex) => {
    const activeFrets = tab.frets.map((fret, stringIndex) => ({
      fret,
      stringIndex,
      string: guitarStrings[stringIndex]
    })).filter(item => item.fret > 0);
    
    if (activeFrets.length > 0) {
      const measureNotes = activeFrets.map((item, index) => {
        const baseNote = item.string;
        const noteIndex = notes.indexOf(baseNote);
        const newNoteIndex = (noteIndex + item.fret) % 7;
        const octave = 4 + Math.floor((noteIndex + item.fret) / 7);
        
        return {
          note: notes[newNoteIndex],
          octave: octave,
          duration: activeFrets.length > 1 ? '♫' : '♪',
          measure: measureIndex + 1,
          string: item.stringIndex + 1,
          fret: item.fret,
          position: index * 30
        };
      });
      
      sheetNotes.push(...measureNotes);
    }
  });
  
  return sheetNotes.slice(0, 24);
}

const sheetNotes = generateSheetMusic(testData.tabs);
console.log("생성된 오선보 음표들:", sheetNotes);

// 오선보 표시 테스트
console.log("\n=== 오선보 표시 테스트 ===");
console.log("곡명:", testData.title);
console.log("아티스트:", testData.artist);
console.log("템포:", testData.tempo, "BPM");
console.log("키:", testData.key);
console.log("난이도:", testData.difficulty);
console.log("\n음표들:");
sheetNotes.forEach((note, index) => {
  console.log(`${index + 1}. ${note.note}${note.octave} (${note.duration}) - 마디 ${note.measure}`);
});

console.log("\n✅ 오선보 생성 완료! 타브 정보 없이 순수한 음표만 표시됩니다.");
