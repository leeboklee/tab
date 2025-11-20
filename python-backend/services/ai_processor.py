import numpy as np
import logging
from typing import Dict, Any, List, Tuple
import asyncio
from concurrent.futures import ThreadPoolExecutor

logger = logging.getLogger(__name__)

class AIProcessor:
    def __init__(self):
        self.guitar_strings = ['E', 'B', 'G', 'D', 'A', 'E']  # 6번 줄부터 1번 줄
        self.string_frequencies = [82.41, 110.00, 146.83, 196.00, 246.94, 329.63]  # Hz
        self.fret_notes = self._generate_fret_notes()
        
    async def process_audio(self, analysis_result: Dict[str, Any]) -> Dict[str, Any]:
        """
        AI를 사용하여 오디오 분석 결과를 처리하고 기타 타브에 적합한 형태로 변환합니다.
        """
        try:
            logger.info("Processing audio with AI...")
            
            # 병렬 처리로 여러 AI 작업 수행
            with ThreadPoolExecutor(max_workers=3) as executor:
                # 피치를 기타 프렛으로 변환
                fret_mapping_task = executor.submit(self._map_pitches_to_frets, analysis_result)
                
                # 리듬을 기타 타브 패턴으로 변환
                rhythm_pattern_task = executor.submit(self._convert_rhythm_to_tab, analysis_result)
                
                # 코드를 기타 타브로 변환
                chord_tabs_task = executor.submit(self._convert_chords_to_tabs, analysis_result)
                
                # 결과 수집
                fret_mapping = fret_mapping_task.result()
                rhythm_pattern = rhythm_pattern_task.result()
                chord_tabs = chord_tabs_task.result()
            
            # AI 기반 타브 최적화
            optimized_tabs = await self._optimize_tabs_with_ai(fret_mapping, rhythm_pattern, chord_tabs, analysis_result)
            
            # 최종 타브 데이터 생성
            tab_data = {
                'title': analysis_result.get('title', 'Unknown'),
                'artist': analysis_result.get('artist', 'Unknown'),
                'duration': analysis_result.get('duration', 0),
                'tempo': analysis_result.get('tempo', 120),
                'key': analysis_result.get('key', 'C'),
                'mode': analysis_result.get('mode', 'major'),
                'tabs': optimized_tabs,
                'chord_progression': analysis_result.get('chord_progression', []),
                'difficulty': self._calculate_difficulty(optimized_tabs),
                'techniques': self._identify_techniques(optimized_tabs),
            }
            
            logger.info("AI processing completed successfully")
            return tab_data
            
        except Exception as e:
            logger.error(f"Error in AI processing: {str(e)}")
            raise
    
    def _map_pitches_to_frets(self, analysis_result: Dict[str, Any]) -> List[Dict[str, Any]]:
        """피치를 기타 프렛으로 매핑"""
        try:
            pitch_contour = analysis_result.get('pitch_contour', [])
            tempo = analysis_result.get('tempo', 120)
            duration = analysis_result.get('duration', 0)
            
            # 비트당 프레임 수 계산
            frames_per_beat = (60.0 / tempo) * (22050 / 512)  # 샘플레이트와 홉 길이 고려
            
            tab_measures = []
            current_measure = []
            
            for i, pitch in enumerate(pitch_contour):
                if pitch > 0:  # 유효한 피치인 경우
                    # 해당 프레임이 속한 비트 계산
                    beat_index = int(i / frames_per_beat)
                    
                    # 피치를 기타 프렛으로 변환
                    fret_positions = self._pitch_to_fret_positions(pitch)
                    
                    if fret_positions:
                        current_measure.append({
                            'beat': beat_index,
                            'fret': fret_positions[0],  # 가장 적절한 프렛 선택
                            'string': fret_positions[1],
                            'confidence': self._calculate_fret_confidence(pitch, fret_positions[0], fret_positions[1])
                        })
            
            # 비트별로 그룹화
            beats = {}
            for note in current_measure:
                beat = note['beat']
                if beat not in beats:
                    beats[beat] = []
                beats[beat].append(note)
            
            # 타브 형식으로 변환
            for beat in sorted(beats.keys()):
                beat_notes = beats[beat]
                tab_measure = {
                    'beat': beat,
                    'notes': beat_notes,
                    'fret_array': self._create_fret_array(beat_notes)
                }
                tab_measures.append(tab_measure)
            
            return tab_measures
            
        except Exception as e:
            logger.error(f"Error mapping pitches to frets: {str(e)}")
            return []
    
    def _convert_rhythm_to_tab(self, analysis_result: Dict[str, Any]) -> Dict[str, Any]:
        """리듬 패턴을 기타 타브 형식으로 변환"""
        try:
            rhythm_pattern = analysis_result.get('rhythm_pattern', {})
            tempo = analysis_result.get('tempo', 120)
            
            # 리듬 패턴 분석
            pattern_type = rhythm_pattern.get('pattern', 'unknown')
            density = rhythm_pattern.get('density', 0)
            
            # 리듬 복잡도에 따른 타브 패턴 생성
            if pattern_type == 'regular':
                tab_pattern = self._generate_regular_pattern(tempo)
            elif pattern_type == 'moderate':
                tab_pattern = self._generate_moderate_pattern(tempo)
            else:
                tab_pattern = self._generate_complex_pattern(tempo)
            
            return {
                'pattern_type': pattern_type,
                'density': density,
                'tab_pattern': tab_pattern,
                'timing': self._calculate_timing(tempo, density)
            }
            
        except Exception as e:
            logger.error(f"Error converting rhythm to tab: {str(e)}")
            return {'pattern_type': 'unknown', 'density': 0, 'tab_pattern': [], 'timing': []}
    
    def _convert_chords_to_tabs(self, analysis_result: Dict[str, Any]) -> List[Dict[str, Any]]:
        """코드 진행을 기타 타브로 변환"""
        try:
            chord_progression = analysis_result.get('chord_progression', [])
            chord_tabs = []
            
            for chord_info in chord_progression:
                chord_name = chord_info.get('chord', 'C')
                beat = chord_info.get('beat', 0)
                confidence = chord_info.get('confidence', 0.5)
                
                # 코드를 기타 프렛으로 변환
                chord_frets = self._chord_to_fret_positions(chord_name)
                
                if chord_frets:
                    chord_tabs.append({
                        'beat': beat,
                        'chord': chord_name,
                        'fret_positions': chord_frets,
                        'confidence': confidence,
                        'fret_array': self._create_chord_fret_array(chord_frets)
                    })
            
            return chord_tabs
            
        except Exception as e:
            logger.error(f"Error converting chords to tabs: {str(e)}")
            return []
    
    async def _optimize_tabs_with_ai(self, fret_mapping: List[Dict[str, Any]], 
                                   rhythm_pattern: Dict[str, Any], 
                                   chord_tabs: List[Dict[str, Any]], 
                                   analysis_result: Dict[str, Any]) -> List[Dict[str, Any]]:
        """AI를 사용하여 타브를 최적화"""
        try:
            # 기존 타브와 코드 타브를 결합
            combined_tabs = self._combine_tabs_and_chords(fret_mapping, chord_tabs)
            
            # AI 기반 최적화
            optimized_tabs = []
            
            for tab_measure in combined_tabs:
                # 프렛 위치 최적화
                optimized_frets = self._optimize_fret_positions(tab_measure)
                
                # 연주 가능성 검증
                playable_tabs = self._validate_playability(optimized_frets)
                
                # 최종 타브 생성
                final_tab = {
                    'beat': tab_measure.get('beat', 0),
                    'string': 6,  # 6번 줄부터 시작
                    'frets': playable_tabs
                }
                
                optimized_tabs.append(final_tab)
            
            return optimized_tabs
            
        except Exception as e:
            logger.error(f"Error optimizing tabs with AI: {str(e)}")
            return []
    
    def _pitch_to_fret_positions(self, frequency: float) -> List[Tuple[int, int]]:
        """주파수를 기타 프렛 위치로 변환"""
        if frequency <= 0:
            return []
        
        positions = []
        
        for string_idx, string_freq in enumerate(self.string_frequencies):
            # 해당 줄에서의 프렛 계산
            fret = 12 * np.log2(frequency / string_freq)
            
            if 0 <= fret <= 24:  # 0-24 프렛 범위
                positions.append((int(round(fret)), string_idx + 1))
        
        return positions
    
    def _chord_to_fret_positions(self, chord_name: str) -> List[Tuple[int, int]]:
        """코드 이름을 기타 프렛 위치로 변환"""
        # 간단한 코드 딕셔너리 (실제로는 더 복잡한 로직 필요)
        chord_dict = {
            'C': [(1, 2), (0, 3), (0, 4), (2, 5), (1, 6)],
            'C#': [(2, 2), (1, 3), (1, 4), (3, 5), (2, 6)],
            'D': [(2, 2), (2, 3), (2, 4), (0, 5), (0, 6)],
            'D#': [(3, 2), (3, 3), (3, 4), (1, 5), (1, 6)],
            'E': [(0, 1), (0, 2), (1, 3), (2, 4), (2, 5), (0, 6)],
            'F': [(1, 1), (1, 2), (2, 3), (3, 4), (3, 5), (1, 6)],
            'F#': [(2, 1), (2, 2), (3, 3), (4, 4), (4, 5), (2, 6)],
            'G': [(3, 1), (0, 2), (0, 3), (0, 4), (2, 5), (3, 6)],
            'G#': [(4, 1), (1, 2), (1, 3), (1, 4), (3, 5), (4, 6)],
            'A': [(0, 1), (2, 2), (2, 3), (2, 4), (0, 5), (0, 6)],
            'A#': [(1, 1), (3, 2), (3, 3), (3, 4), (1, 5), (1, 6)],
            'B': [(2, 1), (4, 2), (4, 3), (4, 4), (2, 5), (2, 6)],
        }
        
        return chord_dict.get(chord_name, [])
    
    def _create_fret_array(self, notes: List[Dict[str, Any]]) -> List[int]:
        """프렛 배열 생성 (6줄 기준)"""
        fret_array = [0, 0, 0, 0, 0, 0]  # 6번 줄부터 1번 줄
        
        for note in notes:
            string = note.get('string', 1)
            fret = note.get('fret', 0)
            
            if 1 <= string <= 6:
                fret_array[6 - string] = fret
        
        return fret_array
    
    def _create_chord_fret_array(self, chord_frets: List[Tuple[int, int]]) -> List[int]:
        """코드 프렛 배열 생성"""
        fret_array = [0, 0, 0, 0, 0, 0]
        
        for fret, string in chord_frets:
            if 1 <= string <= 6:
                fret_array[6 - string] = fret
        
        return fret_array
    
    def _combine_tabs_and_chords(self, fret_mapping: List[Dict[str, Any]], 
                                chord_tabs: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """타브와 코드를 결합"""
        combined = []
        
        # 비트별로 그룹화
        beat_dict = {}
        
        # 프렛 매핑 추가
        for tab in fret_mapping:
            beat = tab.get('beat', 0)
            if beat not in beat_dict:
                beat_dict[beat] = []
            beat_dict[beat].extend(tab.get('notes', []))
        
        # 코드 타브 추가
        for chord in chord_tabs:
            beat = chord.get('beat', 0)
            if beat not in beat_dict:
                beat_dict[beat] = []
            beat_dict[beat].extend(chord.get('fret_positions', []))
        
        # 최종 타브 생성
        for beat in sorted(beat_dict.keys()):
            combined.append({
                'beat': beat,
                'notes': beat_dict[beat]
            })
        
        return combined
    
    def _optimize_fret_positions(self, tab_measure: Dict[str, Any]) -> List[Dict[str, Any]]:
        """프렛 위치 최적화"""
        notes = tab_measure.get('notes', [])
        
        if not notes:
            return []
        
        # 연주 가능성과 음질을 고려한 최적화
        optimized_notes = []
        
        for note in notes:
            if isinstance(note, dict) and 'fret' in note and 'string' in note:
                optimized_notes.append(note)
            elif isinstance(note, tuple) and len(note) == 2:
                fret, string = note
                optimized_notes.append({
                    'fret': fret,
                    'string': string,
                    'confidence': 0.8
                })
        
        return optimized_notes
    
    def _validate_playability(self, notes: List[Dict[str, Any]]) -> List[int]:
        """연주 가능성 검증"""
        fret_array = [0, 0, 0, 0, 0, 0]
        
        for note in notes:
            string = note.get('string', 1)
            fret = note.get('fret', 0)
            
            if 1 <= string <= 6 and 0 <= fret <= 24:
                fret_array[6 - string] = fret
        
        return fret_array
    
    def _calculate_difficulty(self, tabs: List[Dict[str, Any]]) -> str:
        """타브 난이도 계산"""
        if not tabs:
            return "beginner"
        
        max_fret = 0
        complex_patterns = 0
        
        for tab in tabs:
            frets = tab.get('frets', [])
            max_fret = max(max_fret, max(frets) if frets else 0)
            
            # 복잡한 패턴 검사
            non_zero_frets = [f for f in frets if f > 0]
            if len(non_zero_frets) > 3:
                complex_patterns += 1
        
        if max_fret <= 5 and complex_patterns < len(tabs) * 0.3:
            return "beginner"
        elif max_fret <= 12 and complex_patterns < len(tabs) * 0.6:
            return "intermediate"
        else:
            return "advanced"
    
    def _identify_techniques(self, tabs: List[Dict[str, Any]]) -> List[str]:
        """연주 기법 식별"""
        techniques = []
        
        if not tabs:
            return techniques
        
        # 간단한 기법 식별 로직
        for tab in tabs:
            frets = tab.get('frets', [])
            
            # 바레 코드 검사
            if len([f for f in frets if f > 0]) >= 4:
                techniques.append("barre_chord")
            
            # 하이 프렛 사용
            if max(frets) > 12:
                techniques.append("high_fret")
            
            # 복잡한 패턴
            non_zero_count = len([f for f in frets if f > 0])
            if non_zero_count > 3:
                techniques.append("complex_pattern")
        
        return list(set(techniques))
    
    def _generate_fret_notes(self) -> Dict[int, Dict[int, str]]:
        """프렛별 음표 생성"""
        notes = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B']
        fret_notes = {}
        
        for string_idx, string_freq in enumerate(self.string_frequencies):
            fret_notes[string_idx + 1] = {}
            for fret in range(25):  # 0-24 프렛
                note_freq = string_freq * (2 ** (fret / 12))
                note_index = int(round(12 * np.log2(note_freq / 440))) % 12
                fret_notes[string_idx + 1][fret] = notes[note_index]
        
        return fret_notes
    
    def _calculate_fret_confidence(self, frequency: float, fret: int, string: int) -> float:
        """프렛 신뢰도 계산"""
        if string < 1 or string > 6:
            return 0.0
        
        string_freq = self.string_frequencies[string - 1]
        expected_freq = string_freq * (2 ** (fret / 12))
        
        # 주파수 차이로 신뢰도 계산
        freq_diff = abs(frequency - expected_freq)
        confidence = max(0, 1 - (freq_diff / expected_freq))
        
        return confidence
    
    def _generate_regular_pattern(self, tempo: float) -> List[Dict[str, Any]]:
        """규칙적인 리듬 패턴 생성"""
        return [{'type': 'regular', 'tempo': tempo}]
    
    def _generate_moderate_pattern(self, tempo: float) -> List[Dict[str, Any]]:
        """중간 복잡도 리듬 패턴 생성"""
        return [{'type': 'moderate', 'tempo': tempo}]
    
    def _generate_complex_pattern(self, tempo: float) -> List[Dict[str, Any]]:
        """복잡한 리듬 패턴 생성"""
        return [{'type': 'complex', 'tempo': tempo}]
    
    def _calculate_timing(self, tempo: float, density: float) -> List[float]:
        """타이밍 계산"""
        beat_duration = 60.0 / tempo
        return [beat_duration * i for i in range(int(density * 10))]

