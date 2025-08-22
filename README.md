# P&ID Tag Mapping System

P&ID PDF 파일에서 equipment, line, instrument 태그를 자동 인식하고 관계를 매핑하여 Excel로 출력하는 웹 애플리케이션입니다.

## 주요 기능

### 📄 PDF 뷰어 및 시각화
- **PDF 로딩 및 표시**: 벡터 기반 P&ID PDF 파일 지원
- **실시간 태그 하이라이트**: 인식된 태그들이 PDF 위에 색상별로 표시
- **줌 반응형 하이라이트**: 확대/축소 시 태그 위치 자동 조정
- **양방향 태그 선택**: PDF 하이라이트 클릭 ↔ 태그 패널 선택 동기화
- **페이지별 태그 필터링**: 현재 페이지의 태그만 우측 패널에 표시
- **시각적 피드백**: 선택된 태그 애니메이션 및 색상 복원

### 🔍 태그 인식 시스템
- **사용자 정의 정규식 패턴**: 사용자가 직접 입력하는 정규식으로 태그 인식
- **패턴 설정 UI**: 정규식 패턴 생성, 편집, 테스트 기능
- **공간 기반 Instrument 매칭**: Number와 Function의 위치 관계로 계기 태그 인식
- **실시간 패턴 테스트**: 정규식을 즉시 검증할 수 있는 테스트 환경

### 🎯 관계 매핑 및 관리
- **핫키 기반 관계 매핑**: 
  - `R` 키: 연결 관계 (A → B)
  - `I` 키: 설치 관계 (A installed on B)
  - `Esc` 키: 모드 취소
- **수동 태그 관리**: 태그 추가, 수정, 삭제
- **자동 저장**: 작업 내용 자동 저장

### 💾 데이터 관리 및 출력
- **로컬 저장**: 프로젝트 저장/불러오기
- **프로젝트 초기화**: 모든 데이터 및 패턴 완전 초기화 기능
- **Excel 출력**: Equipment List, Line List, Instrument List 시트 생성
- **패턴 내보내기/가져오기**: JSON 형식으로 패턴 공유

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

### 3. 태그 인식 및 시각화
- 업로드 후 자동으로 태그 인식이 실행됩니다
- 인식된 태그들이 PDF 위에 색상별 하이라이트로 표시됩니다
  - 🟢 Equipment 태그: 녹색
  - 🟡 Line 태그: 노란색  
  - 🔵 Instrument 태그: 파란색
- 현재 페이지의 태그만 우측 패널에 표시됩니다
- "자동 인식" 버튼으로 재실행 가능합니다

### 4. 태그 선택 및 네비게이션
- 우측 패널에서 태그를 클릭하면 PDF에서 해당 태그가 강조됩니다
- 다른 페이지의 태그를 선택하면 자동으로 해당 페이지로 이동합니다
- Instrument 태그는 "Function: Number" 형식으로 표시됩니다

### 5. 관계 매핑
- `R` 키를 눌러 연결 관계 모드 진입
- 첫 번째 태그 클릭 → 두 번째 태그 클릭으로 관계 생성
- `I` 키로 설치 관계 모드 전환
- `Esc` 키로 모드 취소

### 6. 저장 및 출력
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

## 기술 스택 및 아키텍처

### Frontend
- **Vanilla JavaScript ES6+**: 모듈화된 클래스 기반 아키텍처
- **PDF.js**: PDF 렌더링 및 텍스트 추출
- **Canvas API**: PDF 오버레이 및 하이라이트 시스템
- **CSS3**: 애니메이션, 그리드 레이아웃, 반응형 디자인

### 데이터 처리
- **SheetJS (XLSX)**: Excel 파일 생성 및 출력
- **LocalStorage**: 패턴 및 프로젝트 설정 저장
- **IndexedDB**: 대용량 프로젝트 데이터 저장

### 태그 인식 엔진
- **정규식 패턴 매칭**: 사용자 정의 패턴 기반 인식
- **공간 분석 알고리즘**: 좌표 기반 Instrument 매칭
- **실시간 패턴 검증**: 정규식 유효성 검사 및 테스트

### 모듈 구조
```
js/
├── app.js                    # 메인 애플리케이션 컨트롤러
├── modules/
│   ├── pdfManager.js        # PDF 렌더링 및 하이라이트 시스템
│   ├── tagManager.js        # 태그 인식 및 관리
│   ├── instrumentMatcher.js # 공간 기반 계기 태그 매칭
│   ├── patternManager.js    # 정규식 패턴 관리
│   ├── patternUI.js        # 패턴 설정 UI
│   ├── relationshipManager.js # 태그 관계 관리
│   ├── storageManager.js    # 데이터 저장/로드
│   └── exportManager.js     # Excel 출력
```

## 문의

기술적 문의사항이나 버그 리포트는 프로젝트 관리자에게 연락해 주세요.