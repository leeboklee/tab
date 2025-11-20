import logging
from typing import Dict, Any, List
import json
import asyncio
from datetime import datetime

logger = logging.getLogger(__name__)

class TabGenerator:
    def __init__(self):
        self.guitar_strings = ['E', 'B', 'G', 'D', 'A', 'E']  # 6번 줄부터 1번 줄
        self.supported_formats = ['json', 'txt', 'gpx', 'musicxml', 'pdf']
        
    async def generate_tab(self, ai_result: Dict[str, Any], audio_info: Dict[str, Any]) -> Dict[str, Any]:
        """
        AI 처리 결과를 기반으로 최종 타브 악보를 생성합니다.
        """
        try:
            logger.info("Generating final tab...")
            
            # 기본 정보 설정
            tab_data = {
                'title': audio_info.get('title', 'Unknown'),
                'artist': audio_info.get('artist', 'Unknown'),
                'duration': audio_info.get('duration', 0),
                'tempo': ai_result.get('tempo', 120),
                'key': ai_result.get('key', 'C'),
                'mode': ai_result.get('mode', 'major'),
                'difficulty': ai_result.get('difficulty', 'beginner'),
                'techniques': ai_result.get('techniques', []),
                'created_at': datetime.now().isoformat(),
                'tabs': self._format_tabs(ai_result.get('tabs', [])),
                'chord_progression': ai_result.get('chord_progression', []),
                'metadata': {
                    'generator': 'Guitar2Tabs AI',
                    'version': '1.0.0',
                    'ai_confidence': self._calculate_overall_confidence(ai_result),
                    'processing_time': audio_info.get('processing_time', 0)
                }
            }
            
            logger.info("Tab generation completed successfully")
            return tab_data
            
        except Exception as e:
            logger.error(f"Error generating tab: {str(e)}")
            raise
    
    def _format_tabs(self, raw_tabs: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """원시 타브 데이터를 프론트엔드 호환 형식으로 변환"""
        formatted_tabs = []
        
        for i, tab in enumerate(raw_tabs):
            beat = tab.get('beat', i)
            frets = tab.get('frets', [0, 0, 0, 0, 0, 0])
            technique = tab.get('technique', 'basic')
            
            # 프론트엔드 NotationViewer가 기대하는 형식으로 변환
            formatted_tab = {
                'measure': i + 1,  # 1부터 시작하는 마디 번호
                'frets': frets,    # 6개 프렛 배열
                'notes': ['E', 'B', 'G', 'D', 'A', 'E'],  # 기타 줄 이름
                'technique': technique
            }
            
            formatted_tabs.append(formatted_tab)
        
        return formatted_tabs
    
    def _calculate_overall_confidence(self, ai_result: Dict[str, Any]) -> float:
        """전체 AI 신뢰도 계산"""
        try:
            tabs = ai_result.get('tabs', [])
            if not tabs:
                return 0.0
            
            total_confidence = 0.0
            count = 0
            
            for tab in tabs:
                notes = tab.get('notes', [])
                for note in notes:
                    if isinstance(note, dict) and 'confidence' in note:
                        total_confidence += note['confidence']
                        count += 1
            
            return total_confidence / count if count > 0 else 0.0
            
        except Exception as e:
            logger.error(f"Error calculating confidence: {str(e)}")
            return 0.5
    
    async def export_tab(self, tab_data: Dict[str, Any], format: str) -> str:
        """타브를 지정된 형식으로 내보내기"""
        try:
            if format == 'json':
                return await self._export_json(tab_data)
            elif format == 'txt':
                return await self._export_txt(tab_data)
            elif format == 'gpx':
                return await self._export_gpx(tab_data)
            elif format == 'musicxml':
                return await self._export_musicxml(tab_data)
            elif format == 'pdf':
                return await self._export_pdf(tab_data)
            else:
                raise ValueError(f"Unsupported format: {format}")
                
        except Exception as e:
            logger.error(f"Error exporting tab: {str(e)}")
            raise
    
    async def _export_json(self, tab_data: Dict[str, Any]) -> str:
        """JSON 형식으로 내보내기"""
        return json.dumps(tab_data, indent=2, ensure_ascii=False)
    
    async def _export_txt(self, tab_data: Dict[str, Any]) -> str:
        """텍스트 형식으로 내보내기"""
        lines = []
        
        # 헤더 정보
        lines.append(f"Title: {tab_data.get('title', 'Unknown')}")
        lines.append(f"Artist: {tab_data.get('artist', 'Unknown')}")
        lines.append(f"Tempo: {tab_data.get('tempo', 120)} BPM")
        lines.append(f"Key: {tab_data.get('key', 'C')} {tab_data.get('mode', 'major')}")
        lines.append(f"Difficulty: {tab_data.get('difficulty', 'beginner')}")
        lines.append("")
        
        # 타브 악보
        tabs = tab_data.get('tabs', [])
        if tabs:
            lines.append("Tab:")
            lines.append("")
            
            # 줄 라벨
            string_labels = " ".join([f"{s:>2}" for s in self.guitar_strings])
            lines.append(f"    {string_labels}")
            
            # 타브 라인
            for tab in tabs:
                frets = tab.get('frets', [0, 0, 0, 0, 0, 0])
                fret_line = " ".join([f"{f:>2}" if f > 0 else " -" for f in frets])
                lines.append(f"{tab.get('beat', 0):>3}: {fret_line}")
        
        return "\n".join(lines)
    
    async def _export_gpx(self, tab_data: Dict[str, Any]) -> str:
        """Guitar Pro 형식으로 내보내기 (간단한 XML)"""
        # 실제 GPX는 바이너리 형식이므로 간단한 XML로 대체
        xml_lines = []
        xml_lines.append('<?xml version="1.0" encoding="UTF-8"?>')
        xml_lines.append('<guitarpro version="7">')
        xml_lines.append(f'  <title>{tab_data.get("title", "Unknown")}</title>')
        xml_lines.append(f'  <artist>{tab_data.get("artist", "Unknown")}</artist>')
        xml_lines.append(f'  <tempo>{tab_data.get("tempo", 120)}</tempo>')
        xml_lines.append('  <tracks>')
        xml_lines.append('    <track>')
        xml_lines.append('      <name>Guitar</name>')
        xml_lines.append('      <strings>')
        
        for string in self.guitar_strings:
            xml_lines.append(f'        <string>{string}</string>')
        
        xml_lines.append('      </strings>')
        xml_lines.append('    </track>')
        xml_lines.append('  </tracks>')
        xml_lines.append('  <measures>')
        
        # 타브 데이터
        tabs = tab_data.get('tabs', [])
        for tab in tabs:
            xml_lines.append('    <measure>')
            xml_lines.append('      <beats>')
            frets = tab.get('frets', [0, 0, 0, 0, 0, 0])
            for i, fret in enumerate(frets):
                if fret > 0:
                    xml_lines.append(f'        <note string="{i+1}" fret="{fret}"/>')
            xml_lines.append('      </beats>')
            xml_lines.append('    </measure>')
        
        xml_lines.append('  </measures>')
        xml_lines.append('</guitarpro>')
        
        return "\n".join(xml_lines)
    
    async def _export_musicxml(self, tab_data: Dict[str, Any]) -> str:
        """MusicXML 형식으로 내보내기"""
        xml_lines = []
        xml_lines.append('<?xml version="1.0" encoding="UTF-8"?>')
        xml_lines.append('<!DOCTYPE score-partwise PUBLIC "-//Recordare//DTD MusicXML 3.1 Partwise//EN" "http://www.musicxml.org/dtds/partwise.dtd">')
        xml_lines.append('<score-partwise version="3.1">')
        xml_lines.append('  <work>')
        xml_lines.append(f'    <work-title>{tab_data.get("title", "Unknown")}</work-title>')
        xml_lines.append('  </work>')
        xml_lines.append('  <identification>')
        xml_lines.append('    <creator type="composer">Guitar2Tabs AI</creator>')
        xml_lines.append('  </identification>')
        xml_lines.append('  <part-list>')
        xml_lines.append('    <score-part id="P1">')
        xml_lines.append('      <part-name>Guitar</part-name>')
        xml_lines.append('    </score-part>')
        xml_lines.append('  </part-list>')
        xml_lines.append('  <part id="P1">')
        
        # 타브 데이터를 MusicXML로 변환
        tabs = tab_data.get('tabs', [])
        for tab in tabs:
            xml_lines.append('    <measure>')
            xml_lines.append('      <attributes>')
            xml_lines.append('        <divisions>1</divisions>')
            xml_lines.append('        <time>')
            xml_lines.append('          <beats>4</beats>')
            xml_lines.append('          <beat-type>4</beat-type>')
            xml_lines.append('        </time>')
            xml_lines.append('      </attributes>')
            xml_lines.append('      <note>')
            xml_lines.append('        <pitch>')
            xml_lines.append('          <step>C</step>')
            xml_lines.append('          <octave>4</octave>')
            xml_lines.append('        </pitch>')
            xml_lines.append('        <duration>1</duration>')
            xml_lines.append('        <type>quarter</type>')
            xml_lines.append('      </note>')
            xml_lines.append('    </measure>')
        
        xml_lines.append('  </part>')
        xml_lines.append('</score-partwise>')
        
        return "\n".join(xml_lines)
    
    async def _export_pdf(self, tab_data: Dict[str, Any]) -> str:
        """PDF 형식으로 내보내기 (간단한 텍스트 기반)"""
        # 실제 PDF 생성은 reportlab 등 라이브러리 필요
        # 여기서는 간단한 텍스트 형식으로 대체
        txt_content = await self._export_txt(tab_data)
        
        # PDF 헤더 추가 (실제로는 PDF 라이브러리 사용)
        pdf_content = f"""
%PDF-1.4
1 0 obj
<<
/Type /Catalog
/Pages 2 0 R
>>
endobj

2 0 obj
<<
/Type /Pages
/Kids [3 0 R]
/Count 1
>>
endobj

3 0 obj
<<
/Type /Page
/Parent 2 0 R
/MediaBox [0 0 612 792]
/Contents 4 0 R
>>
endobj

4 0 obj
<<
/Length {len(txt_content)}
>>
stream
{txt_content}
endstream
endobj

xref
0 5
0000000000 65535 f 
0000000009 00000 n 
0000000058 00000 n 
0000000115 00000 n 
0000000204 00000 n 
trailer
<<
/Size 5
/Root 1 0 R
>>
startxref
{len(txt_content) + 200}
%%EOF
"""
        
        return pdf_content
    
    def get_supported_formats(self) -> List[str]:
        """지원되는 내보내기 형식 반환"""
        return self.supported_formats
    
    def validate_tab_data(self, tab_data: Dict[str, Any]) -> bool:
        """타브 데이터 유효성 검사"""
        required_fields = ['title', 'artist', 'tempo', 'tabs']
        
        for field in required_fields:
            if field not in tab_data:
                logger.error(f"Missing required field: {field}")
                return False
        
        # 타브 데이터 검사
        tabs = tab_data.get('tabs', [])
        if not isinstance(tabs, list):
            logger.error("Tabs must be a list")
            return False
        
        for tab in tabs:
            if not isinstance(tab, dict):
                logger.error("Each tab must be a dictionary")
                return False
            
            if 'frets' not in tab:
                logger.error("Each tab must have 'frets' field")
                return False
            
            frets = tab['frets']
            if not isinstance(frets, list) or len(frets) != 6:
                logger.error("Frets must be a list of 6 elements")
                return False
        
        return True

