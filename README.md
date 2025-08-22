# P&ID Tag Mapping System

P&ID PDF 파일에서 equipment, line, instrument 태그를 자동 인식하고 관계를 매핑하여 Excel로 출력하는 웹 애플리케이션입니다.

## 기능

- **PDF 뷰어**: 벡터 기반 P&ID PDF 파일 로딩 및 표시
- **사용자 정의 정규식 패턴**: 사용자가 직접 입력하는 정규식으로 태그 인식
- **패턴 설정 UI**: 정규식 패턴 생성, 편집, 테스트 기능
- **자동 태그 인식**: 사용자 정의 패턴 매칭을 통한 태그 자동 추출
- **수동 태그 관리**: 태그 추가, 수정, 삭제
- **핫키 기반 관계 매핑**: 
  - `R` 키: 연결 관계 (A → B)
  - `I` 키: 설치 관계 (A installed on B)
  - `Esc` 키: 모드 취소
- **로컬 저장**: 프로젝트 저장/불러오기
- **Excel 출력**: Equipment List, Line List, Instrument List 시트 생성

## 설치 및 실행

### 1. 의존성 설치
```bash
npm install
```

### 2. 개발 서버 실행
```bash
npm run dev
```

브라우저에서 `http://localhost:3000`으로 접속합니다.

### 3. 프로덕션 실행
```bash
npm start
```

## 사용법

### 1. PDF 업로드
- "PDF 업로드" 버튼을 클릭하여 P&ID PDF 파일을 선택합니다
- 벡터 기반 PDF만 지원됩니다 (스캔된 이미지 PDF 불가)

### 2. 패턴 설정
- "패턴 설정" 버튼을 클릭하여 정규식 패턴을 설정합니다
- 기본 패턴을 사용하거나 사용자 정의 패턴을 추가할 수 있습니다
- 패턴 테스트 탭에서 정규식을 실시간으로 테스트할 수 있습니다

### 3. 태그 인식
- 업로드 후 자동으로 태그 인식이 실행됩니다
- "자동 인식" 버튼으로 재실행 가능합니다
- Equipment, Line, Instrument 탭에서 인식된 태그를 확인할 수 있습니다

### 4. 관계 매핑
- `R` 키를 눌러 연결 관계 모드 진입
- 첫 번째 태그 클릭 → 두 번째 태그 클릭으로 관계 생성
- `I` 키로 설치 관계 모드 전환
- `Esc` 키로 모드 취소

### 5. 저장 및 출력
- "저장" 버튼으로 프로젝트 저장
- "Excel 출력" 버튼으로 결과 다운로드

## 패턴 설정

### 기본 패턴
애플리케이션에는 다음과 같은 기본 정규식 패턴이 포함되어 있습니다:

- **Line_number**: `^.+-[A-Z\d]{1,4}-\s?\d{3,5}-[A-Z\d]{3,7}$`
  - 예: 100-PS-1234-A1B2
- **Equipment_number**: `^[A-Z\d]+-[A-Z]{1,2}-\d{4}$`
  - 예: V28-E-0003
- **Instrument_number**: `^\d{4}\s?[A-Za-z0-9-]{0,3}$`
  - 예: 1234, 5678A
- **Instrument_function**: `^[A-Z]{2,4}$`
  - 예: PT, TT, FIC

### 사용자 정의 패턴
- 패턴 설정 UI에서 새로운 정규식 패턴을 추가할 수 있습니다
- 각 패턴에 대해 색상, 카테고리, 설명을 설정 가능합니다
- 실시간 패턴 테스트 기능으로 정규식을 검증할 수 있습니다

### 패턴 관리 기능
- 패턴 활성화/비활성화
- 패턴 내보내기/가져오기 (JSON 형식)
- 기본값으로 초기화

## 출력 형식

### Equipment List
- P&ID Number
- Equipment Tag
- Equipment Type
- Short Specification

### Line List
- P&ID Number
- Line Tag
- Line Size
- From Equipment
- To Equipment

### Instrument List
- P&ID Number
- Instrument Tag
- Instrument Type
- Installed On

## 브라우저 호환성

- Chrome (권장)
- Edge
- Firefox

## 제한사항

- 벡터 기반 PDF만 지원
- 최대 50MB PDF 파일
- 브라우저 로컬 저장만 지원 (클라우드 저장 없음)

## 개발정보

- Frontend: Vanilla JavaScript + PDF.js
- Export: SheetJS (XLSX)
- Storage: LocalStorage + IndexedDB

## 문의

기술적 문의사항이나 버그 리포트는 프로젝트 관리자에게 연락해 주세요.