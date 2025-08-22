import fitz  # PDF 파일 처리를 위한 PyMuPDF 라이브러리
import re  # 정규식 처리를 위한 모듈
import pandas as pd  # 데이터프레임 생성 및 엑셀 저장을 위한 라이브러리
from typing import List, Tuple, Dict, Optional, Any  # 타입 힌트를 위한 모듈
import tempfile  # 임시 파일 생성을 위한 모듈
import os  # 파일 시스템 작업을 위한 모듈
import logging  # 로깅을 위한 모듈
from dataclasses import dataclass, field  # 데이터 클래스를 정의하기 위한 모듈
import streamlit as st  # 웹 UI를 위한 Streamlit 라이브러리
import uuid  # 고유 ID 생성을 위한 모듈
import zipfile  # ZIP 파일 생성을 위한 모듈
from io import BytesIO  # 메모리 내 파일 처리를 위한 모듈
from datetime import datetime  # 타임스탬프 생성을 위한 모듈

# 로깅 설정: INFO 레벨 이상의 로그를 시간, 이름, 레벨, 메시지 형식으로 출력
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger("PDFApp")  # "PDFApp" 이름으로 로거 객체 생성

# 패턴 정보를 저장하기 위한 데이터 클래스
@dataclass
class PatternInfo:
    pattern: str  # 정규식 패턴 문자열
    color: Tuple[float, float, float]  # 하이라이트 색상 (RGB 값, 0~1 범위)
    description: str  # 패턴에 대한 설명

# PDF 처리 결과를 저장하기 위한 데이터 클래스
@dataclass
class ProcessingResult:
    data: List[List[Any]] = field(default_factory=list)  # 처리된 데이터 리스트 (페이지, SN, 텍스트, 패턴, 위 텍스트, 위치)
    doc: Any = None  # 열린 PDF 문서 객체
    raw_text_data: List[List[Any]] = field(default_factory=list)  # 원본 텍스트와 위치 정보 리스트
    error: Optional[str] = None  # 처리 중 발생한 오류 메시지

# PDF 파일을 처리하고 패턴을 찾는 클래스
class PDFProcessor:
    def __init__(self):
        # 기본 패턴 정의: 각 패턴에 대한 정규식, 색상, 설명을 포함
        self.default_patterns = {
            "Line_number (Yellow)": PatternInfo(
                pattern=r'^.+-[A-Z\d]{1,4}-\s?\d{3,5}-[A-Z\d]{3,7}$',
                color=(1, 1, 0),  # 노란색
                description="Line number format (e.g., 100-PS-1234-A1B2)"
            ),
            "Instrument_number (Red)": PatternInfo(
                pattern=r'^\d{4}\s?[A-Za-z0-9-]{0,3}$',
                color=(1, 0, 0),  # 빨간색
                description="Instrument number format (e.g., 1234)"
            ),
            "Instrument_function (Blue)": PatternInfo(
                pattern=r'^[A-Z]{2,4}$',
                color=(0, 0, 1),  # 파란색
                description="Instrument function code (e.g., PT, TT, FT)"
            ),
            "Equipment_number (Green)": PatternInfo(
                pattern=r'^[A-Z\d]+-[A-Z]{1,2}-\d{4}$',
                color=(0, 0.5, 0),  # 초록색
                description="Equipment number format (e.g., V28-E-0003)"
            )
        }

    def process_pdf(self, input_file: str, extraction_mode: str, 
                   patterns: Dict[str, Dict[str, Any]], search_height: float = 6.0,
                   progress_callback=None) -> ProcessingResult:
        """
        PDF 파일을 열고 페이지별로 패턴을 찾아 처리 결과를 반환합니다.
        
        Args:
            input_file: 처리할 PDF 파일 경로
            extraction_mode: 텍스트 추출 방식 ('spans' 또는 'blocks')
            patterns: 사용자 정의 패턴 딕셔너리
            search_height: Instrument number 위에서 function을 찾을 최대 높이 (포인트 단위)
            progress_callback: 진행 상황을 업데이트하기 위한 콜백 함수
        
        Returns:
            ProcessingResult: 처리된 데이터와 문서 객체를 포함한 결과
        """
        result = ProcessingResult()
        
        try:
            doc = fitz.open(input_file)  # PDF 파일 열기
            result.doc = doc
            total_pages = len(doc)  # 전체 페이지 수
            
            # 각 페이지를 순회하며 처리
            for page_num in range(total_pages):
                if progress_callback:
                    progress = (page_num + 1) / total_pages  # 진행률 계산
                    progress_callback(progress, f"Processing... ({page_num + 1}/{total_pages} pages)")
                
                try:
                    page = doc.load_page(page_num)  # 페이지 로드
                    text_data = self._extract_text(page, extraction_mode)  # 텍스트 추출
                    matches = self._find_patterns(page, text_data, patterns, page_num, extraction_mode, result)  # 패턴 찾기 및 원본 텍스트 저장
                    self._find_instrument_functions(page, text_data, patterns, matches, search_height, extraction_mode)  # Instrument function 찾기
                    # 결과 필터링: Line, Equipment 또는 function이 있는 Instrument만 포함
                    for row in matches:
                        if row[3] != "Instrument_number" or row[4]:
                            result.data.append(row)
                except Exception as e:
                    logger.error(f"Error processing page {page_num+1}: {str(e)}")  # 페이지 처리 오류 기록
            
            return result
            
        except Exception as e:
            error_msg = f"Error processing PDF: {str(e)}"  # PDF 전체 처리 오류 메시지
            logger.error(error_msg)
            result.error = error_msg
            return result

    def _extract_text(self, page, mode: str) -> Any:
        """
        페이지에서 텍스트를 추출합니다.
        
        Args:
            page: 처리할 PDF 페이지 객체
            mode: 추출 모드 ('spans' 또는 'blocks')
        
        Returns:
            텍스트 데이터 (dict 또는 list 형식)
        """
        try:
            if mode == 'spans':
                return page.get_text("dict")  # 세부 텍스트 단위로 추출
            else:
                return page.get_text("blocks")  # 블록 단위로 추출
        except Exception as e:
            logger.error(f"Error extracting text: {str(e)}")  # 텍스트 추출 오류 기록
            raise

    def _find_patterns(self, page, text_data, patterns, page_num, mode, result: ProcessingResult):
        """
        페이지에서 정의된 패턴을 찾아 리스트로 반환하고, 원본 텍스트를 result.raw_text_data에 저장합니다.
        
        Args:
            page: PDF 페이지 객체
            text_data: 추출된 텍스트 데이터
            patterns: 사용할 패턴 딕셔너리
            page_num: 현재 페이지 번호
            mode: 텍스트 추출 모드
            result: 처리 결과 객체 (원본 텍스트 저장용)
        
        Returns:
            List: [페이지 번호, 일련번호, 텍스트, 패턴 이름, 위 텍스트, 위치] 형식의 매칭 결과
        """
        matches = []
        sn = 1  # 일련번호 초기화
        
        if mode == 'spans':
            # 블록, 라인, 스팬 단위로 텍스트 순회
            for block in text_data.get("blocks", []):
                for line in block.get("lines", []):
                    for span in line.get("spans", []):
                        text = span.get("text", "").strip()  # 텍스트 추출 및 공백 제거
                        bbox = span.get("bbox")  # 텍스트의 경계 상자 (x1, y1, x2, y2)
                        if not text or not isinstance(bbox, (list, tuple)) or len(bbox) < 4:
                            continue  # 유효하지 않은 데이터는 건너뜀
                        # 모든 원본 텍스트를 result.raw_text_data에 저장
                        result.raw_text_data.append([page_num+1, text, bbox[0], bbox[1], bbox[2], bbox[3]])
                        match_info = self._match_pattern(page, text, bbox, patterns)  # 패턴 매칭 확인
                        if match_info:
                            clean_name = match_info[0]  # 패턴 이름 (색상 제외)
                            # Line_number와 Equipment_number는 즉시 하이라이트
                            if clean_name in ["Line_number", "Equipment_number"]:
                                try:
                                    highlight = page.add_highlight_annot(bbox)
                                    highlight.set_colors({"stroke": patterns[match_info[1]]["color"]})
                                    highlight.update()
                                except Exception as e:
                                    logger.warning(f"Error highlighting {clean_name}: {str(e)}")
                            matches.append([page_num+1, sn, text, clean_name, "", bbox])
                            sn += 1
        else:
            # 블록 단위로 텍스트 순회
            for block in text_data:
                text = block[4].strip()  # 블록의 텍스트
                bbox = block[:4]  # 블록의 경계 상자
                if not text or not isinstance(bbox, (list, tuple)) or len(bbox) < 4:
                    continue
                # 모든 원본 텍스트를 result.raw_text_data에 저장
                result.raw_text_data.append([page_num+1, text, bbox[0], bbox[1], bbox[2], bbox[3]])
                match_info = self._match_pattern(page, text, bbox, patterns)
                if match_info:
                    clean_name = match_info[0]
                    if clean_name in ["Line_number", "Equipment_number"]:
                        try:
                            highlight = page.add_highlight_annot(bbox)
                            highlight.set_colors({"stroke": patterns[match_info[1]]["color"]})
                            highlight.update()
                        except Exception as e:
                            logger.warning(f"Error highlighting {clean_name}: {str(e)}")
                    matches.append([page_num+1, sn, text, clean_name, "", bbox])
                    sn += 1
                    
        return matches

    def _match_pattern(self, page, text, bbox, patterns):
        """
        주어진 텍스트가 패턴에 매칭되는지 확인합니다.
        
        Args:
            page: PDF 페이지 객체
            text: 확인할 텍스트
            bbox: 텍스트의 경계 상자
            patterns: 패턴 딕셔너리
        
        Returns:
            Tuple[str, str] | None: (깔끔한 이름, 전체 이름) 또는 None
        """
        pattern_priority = ["Line_number (Yellow)", "Equipment_number (Green)", "Instrument_number (Red)"]
        
        for pattern_name in pattern_priority:
            pattern_info = patterns.get(pattern_name)
            if not pattern_info:
                continue
            try:
                if re.match(pattern_info["pattern"], text):  # 정규식 매칭 확인
                    clean_name = pattern_name.split(" ")[0]  # 색상 부분 제거
                    return clean_name, pattern_name
            except re.error as e:
                logger.warning(f"Regex error ({pattern_name}): {str(e)}")  # 정규식 오류 기록
        return None

    def _find_instrument_functions(self, page, text_data, patterns, matches, search_height, mode):
        """
        Instrument_number 위에 Instrument_function을 찾아 결과를 업데이트합니다.
        
        Args:
            page: PDF 페이지 객체
            text_data: 추출된 텍스트 데이터
            patterns: 패턴 딕셔너리
            matches: 기존 매칭 결과 리스트
            search_height: 검색 높이
            mode: 텍스트 추출 모드
        """
        # Instrument_number만 필터링
        instrument_rows = [row for row in matches if row[3] == "Instrument_number"]
        if not instrument_rows:
            return
            
        function_pattern = patterns.get("Instrument_function (Blue)", {}).get("pattern")
        if not function_pattern:
            return
            
        for result_row in instrument_rows:
            match_bbox = result_row[5]
            if not isinstance(match_bbox, (list, tuple)) or len(match_bbox) < 4:
                continue
            x1, y1, x2, y2 = match_bbox  # Instrument_number의 위치
            if mode == 'spans':
                self._search_functions_in_spans(page, text_data, function_pattern, patterns, result_row, x1, x2, y1, search_height)
            else:
                self._search_functions_in_blocks(page, text_data, function_pattern, patterns, result_row, x1, x2, y1, search_height)
            
            # Function이 발견된 경우에만 하이라이트
            if result_row[4]:
                try:
                    highlight = page.add_highlight_annot(match_bbox)
                    highlight.set_colors({"stroke": patterns["Instrument_number (Red)"]["color"]})
                    highlight.update()
                except Exception as e:
                    logger.warning(f"Error highlighting Instrument_number: {str(e)}")

    def _search_functions_in_spans(self, page, text_data, function_pattern, patterns, result_row, x1, x2, y1, search_height):
        """
        Spans 모드에서 Instrument_function을 검색합니다.
        
        Args:
            page: PDF 페이지 객체
            text_data: 텍스트 데이터
            function_pattern: Function 패턴 정규식
            patterns: 패턴 딕셔너리
            result_row: 업데이트할 결과 행
            x1, x2, y1: Instrument_number의 좌표
            search_height: 검색 높이
        """
        for block in text_data.get("blocks", []):
            for line in block.get("lines", []):
                for span in line.get("spans", []):
                    text = span.get("text", "").strip()
                    bbox = span.get("bbox")
                    if not text or not isinstance(bbox, (list, tuple)) or len(bbox) < 4:
                        continue
                    try:
                        if re.match(function_pattern, text):
                            cx1, cy1, cx2, cy2 = bbox
                            # Function이 Instrument_number 위에 있고 x 범위 내에 있는지 확인
                            if y1 > (cy1 + cy2) / 2 > y1 - search_height and x1 < (cx1 + cx2) / 2 < x2:
                                try:
                                    highlight = page.add_highlight_annot(bbox)
                                    highlight.set_colors({"stroke": patterns["Instrument_function (Blue)"]["color"]})
                                    highlight.update()
                                    result_row[4] = text  # Function 텍스트 추가
                                except Exception as e:
                                    logger.warning(f"Error highlighting function: {str(e)}")
                    except re.error as e:
                        logger.warning(f"Function regex error: {str(e)}")

    def _search_functions_in_blocks(self, page, text_data, function_pattern, patterns, result_row, x1, x2, y1, search_height):
        """
        Blocks 모드에서 Instrument_function을 검색합니다.
        """
        for block in text_data:
            text = block[4].strip()
            bbox = block[:4]
            if not text or not isinstance(bbox, (list, tuple)) or len(bbox) < 4:
                continue
            try:
                if re.match(function_pattern, text):
                    cx1, cy1, cx2, cy2 = bbox
                    if y1 > (cy1 + cy2) / 2 > y1 - search_height and x1 < (cx1 + cx2) / 2 < x2:
                        try:
                            highlight = page.add_highlight_annot(bbox)
                            highlight.set_colors({"stroke": patterns["Instrument_function (Blue)"]["color"]})
                            highlight.update()
                            result_row[4] = text
                        except Exception as e:
                            logger.warning(f"Error highlighting function: {str(e)}")
            except re.error as e:
                logger.warning(f"Function regex error: {str(e)}")

def save_results_to_excel(result_data, output_excel, mode="Simple"):
    """
    처리 결과를 엑셀 파일로 저장합니다.
    
    Args:
        result_data: 처리된 데이터 리스트
        output_excel: 저장할 엑셀 파일 경로
        mode: 출력 모드 ('Simple' 또는 'Detailed')
    
    Returns:
        pd.DataFrame: 생성된 데이터프레임
    """
    try:
        if not result_data or not all(len(row) == 6 for row in result_data):
            logger.warning("Invalid result_data format")  # 데이터 형식 오류 경고
            return pd.DataFrame()
            
        # 데이터프레임 생성
        df = pd.DataFrame(result_data, columns=["Page", "SN", "Text", "Pattern", "Above Text", "Location"])
        pattern_mapping = {'Line_number': 'Line', 'Instrument_number': 'Instrument', 'Equipment_number': 'Equipment'}
        df['Pattern'] = df['Pattern'].replace(pattern_mapping)  # 패턴 이름 간소화
        
        if mode == "Simple":
            df = df.rename(columns={"Text": "Number", "Above Text": "Function"})
            df = df[["Page", "Pattern", "Number", "Function"]]  # 간단한 형식으로 열 선택
        else:
            # 상세 모드: 위치 좌표 추가
            df['x1'] = df['Location'].apply(lambda x: round(x[0], 1) if isinstance(x, (list, tuple)) and len(x) >= 4 else None)
            df['y1'] = df['Location'].apply(lambda x: round(x[1], 1) if isinstance(x, (list, tuple)) and len(x) >= 4 else None)
            df['x2'] = df['Location'].apply(lambda x: round(x[2], 1) if isinstance(x, (list, tuple)) and len(x) >= 4 else None)
            df['y2'] = df['Location'].apply(lambda x: round(x[3], 1) if isinstance(x, (list, tuple)) and len(x) >= 4 else None)
            df = df.rename(columns={"Text": "Number", "Above Text": "Function"})
            df = df[["Page", "Pattern", "Number", "Function", "x1", "y1", "x2", "y2"]]
        
        df.to_excel(output_excel, index=False)  # 엑셀 파일로 저장
        return df
    except Exception as e:
        logger.error(f"Error saving to Excel: {str(e)}")  # 엑셀 저장 오류 기록
        raise

def save_raw_text_to_excel(raw_text_data, output_excel):
    """
    원본 텍스트와 위치 정보를 엑셀 파일로 저장합니다.
    
    Args:
        raw_text_data: 원본 텍스트 데이터 리스트
        output_excel: 저장할 엑셀 파일 경로
    
    Returns:
        pd.DataFrame: 생성된 데이터프레임
    """
    try:
        if not raw_text_data or not all(len(row) == 6 for row in raw_text_data):
            logger.warning("Invalid raw_text_data format")  # 데이터 형식 오류 경고
            return pd.DataFrame()
        
        # 데이터프레임 생성
        df = pd.DataFrame(raw_text_data, columns=["Page", "Text", "x1", "y1", "x2", "y2"])
        df.to_excel(output_excel, index=False)  # 엑셀 파일로 저장
        return df
    except Exception as e:
        logger.error(f"Error saving raw text to Excel: {str(e)}")  # 엑셀 저장 오류 기록
        raise

# Streamlit 앱 함수
def init_session_state():
    """Streamlit 세션 상태를 초기화합니다."""
    if 'user_id' not in st.session_state:
        st.session_state.user_id = str(uuid.uuid4())[:8]  # 고유 사용자 ID
    if 'processing_completed' not in st.session_state:
        st.session_state.processing_completed = False  # 처리 완료 여부
    if 'process_result' not in st.session_state:
        st.session_state.process_result = None  # 처리 결과 저장용

def get_unique_filename(prefix, extension):
    """
    고유한 파일 이름을 생성합니다.
    
    Args:
        prefix: 파일 이름 접두사
        extension: 파일 확장자
    
    Returns:
        str: 고유한 파일 이름
    """
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")  # 현재 시간 문자열
    user_id = st.session_state.user_id
    return f"{prefix}_{user_id}_{timestamp}.{extension}"

def update_progress_callback(progress_bar, status_text):
    """
    진행 상황을 UI에 업데이트하는 콜백 함수를 반환합니다.
    
    Args:
        progress_bar: Streamlit 진행 바 객체
        status_text: Streamlit 상태 텍스트 객체
    
    Returns:
        callable: 진행 상황 업데이트 함수
    """
    def callback(progress, message):
        progress_bar.progress(progress)
        status_text.text(message)
    return callback

def process_uploaded_file(uploaded_file, extraction_mode, patterns, search_height, excel_mode):
    """
    업로드된 PDF 파일을 처리하고 결과를 반환합니다.
    
    Args:
        uploaded_file: 업로드된 파일 객체
        extraction_mode: 텍스트 추출 모드
        patterns: 패턴 딕셔너리
        search_height: 검색 높이
        excel_mode: 엑셀 출력 모드
    
    Returns:
        Dict: 처리 결과 (성공 여부, 메시지, 데이터, 파일 경로, ZIP 데이터)
    """
    result = {'success': False, 'message': '', 'data': None, 'output_files': {}, 'zip_data': None}
    
    # 임시 디렉토리와 파일 경로 설정
    temp_dir = tempfile.mkdtemp()
    temp_input = os.path.join(temp_dir, "input.pdf")
    output_pdf = os.path.join(temp_dir, get_unique_filename("highlighted", "pdf"))
    output_excel = os.path.join(temp_dir, get_unique_filename("results", "xlsx"))
    
    try:
        # 업로드된 파일을 임시 파일로 저장
        with open(temp_input, 'wb') as f:
            f.write(uploaded_file.getvalue())
        
        # 진행 상황 UI 요소 생성
        progress_bar = st.progress(0)
        status_text = st.empty()
        
        # PDF 처리
        processor = PDFProcessor()
        progress_callback = update_progress_callback(progress_bar, status_text)
        process_result = processor.process_pdf(temp_input, extraction_mode, patterns, search_height, progress_callback)
        st.session_state.process_result = process_result  # 세션 상태에 결과 저장
        
        if process_result.error:
            result['message'] = process_result.error  # 오류 발생 시 메시지 설정
            return result
            
        if process_result.doc:
            process_result.doc.save(output_pdf)  # 하이라이트된 PDF 저장
            process_result.doc.close()
            df = save_results_to_excel(process_result.data, output_excel, excel_mode)  # 엑셀 파일 생성
            
            # ZIP 파일 생성
            zip_buffer = BytesIO()
            with zipfile.ZipFile(zip_buffer, 'w', zipfile.ZIP_DEFLATED) as zip_file:
                if os.path.exists(output_pdf):
                    with open(output_pdf, 'rb') as f:
                        zip_file.writestr(os.path.basename(output_pdf), f.read())
                if os.path.exists(output_excel):
                    with open(output_excel, 'rb') as f:
                        zip_file.writestr(os.path.basename(output_excel), f.read())
            
            zip_buffer.seek(0)
            result['success'] = True
            result['data'] = df
            result['output_files'] = {'pdf': output_pdf, 'excel': output_excel}
            result['zip_data'] = zip_buffer.getvalue()
            
            # 진행 상황 UI 요소 제거
            progress_bar.empty()
            status_text.empty()
            st.session_state.processing_completed = True
            
    except Exception as e:
        error_message = f"Error processing file: {str(e)}"
        logger.error(error_message)  # 파일 처리 오류 기록
        result['message'] = error_message
        
    finally:
        # 임시 파일 정리
        if os.path.exists(temp_input):
            try:
                os.remove(temp_input)
            except Exception as e:
                logger.warning(f"Error removing temp file: {str(e)}")
        
    return result

def render_sidebar_settings():
    """사이드바에서 설정 UI를 렌더링합니다."""
    processor = PDFProcessor()
    st.sidebar.header("Settings")
    
    st.sidebar.subheader("1. Pattern Settings")
    patterns = {}
    for pattern_name, pattern_info in processor.default_patterns.items():
        use_pattern = st.sidebar.checkbox(f"Use {pattern_name}", value=True)
        if use_pattern:
            custom_pattern = st.sidebar.text_input(f"Regex Pattern", value=pattern_info.pattern, help=pattern_info.description, key=f"pattern_{pattern_name}")
            test_text = st.sidebar.text_input(f"Test text ({pattern_name})", help="Enter text to test regex", key=f"test_{pattern_name}")
            if test_text:
                try:
                    if re.match(custom_pattern, test_text):
                        st.sidebar.success("Match found! ✅")
                    else:
                        st.sidebar.error("No match found ❌")
                except re.error as e:
                    st.sidebar.error(f"Invalid regex: {str(e)}")
            patterns[pattern_name] = {"pattern": custom_pattern, "color": pattern_info.color}
    
    st.sidebar.subheader("2. Text Extraction Mode")
    extraction_mode = 'spans'
    if st.sidebar.checkbox("Use Block Mode", help="Enable if text extraction is incorrect"):
        extraction_mode = 'blocks'
    
    st.sidebar.subheader("3. Function Search Settings")
    search_height = st.sidebar.number_input("Max height to search for function (points)", min_value=1.0, max_value=20.0, value=10.0, step=0.5)
    
    st.sidebar.subheader("4. Excel Output Settings")
    excel_mode = "Simple"
    if st.sidebar.checkbox("Use Detailed Mode", help="Include all text in output"):
        excel_mode = "Detailed"
    
    return patterns, extraction_mode, search_height, excel_mode

def render_main_ui():
    """메인 UI를 렌더링합니다."""
    st.title("PDF Pattern Search and Highlight")
    patterns, extraction_mode, search_height, excel_mode = render_sidebar_settings()
    
    uploaded_file = st.file_uploader("Select PDF file", type="pdf")
    if uploaded_file:
        if st.button("Start Processing", type="primary"):
            with st.spinner('Processing PDF...'):
                result = process_uploaded_file(uploaded_file, extraction_mode, patterns, search_height, excel_mode)
                if result['success']:
                    st.success("Processing Complete!")
                    if result['data'] is not None:
                        st.subheader("Results")
                        df = result['data']
                        display_height = 600 if excel_mode == "Detailed" else 400
                        st.dataframe(df, use_container_width=True, height=display_height)
                        st.subheader("Pattern Statistics")
                        st.write(df['Pattern'].value_counts())
                        st.download_button(
                            label="Download Results (ZIP)",
                            data=result['zip_data'],
                            file_name="results.zip",
                            mime="application/zip"
                        )
                        # 원본 텍스트 다운로드 버튼 추가
                        if st.session_state.process_result and st.session_state.process_result.raw_text_data:
                            temp_dir = tempfile.mkdtemp()
                            raw_output_excel = os.path.join(temp_dir, get_unique_filename("raw_text", "xlsx"))
                            raw_df = save_raw_text_to_excel(st.session_state.process_result.raw_text_data, raw_output_excel)
                            with open(raw_output_excel, 'rb') as f:
                                st.download_button(
                                    label="Download Raw Text (Excel)",
                                    data=f.read(),
                                    file_name="raw_text.xlsx",
                                    mime="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                                )
                    else:
                        st.warning("No data to display.")
                else:
                    st.error(result['message'])

def main():
    """앱의 진입점입니다."""
    init_session_state()
    render_main_ui()

if __name__ == "__main__":
    main()