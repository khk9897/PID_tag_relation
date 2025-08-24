/**
 * P&ID Tag Mapping System - 메인 애플리케이션 클래스
 * 
 * 이 파일은 P&ID 태그 매핑 시스템의 핵심 컨트롤러입니다.
 * PDF 파일을 업로드하여 태그를 자동 인식하고, 태그 간의 관계를 매핑하여 Excel로 내보내는 기능을 제공합니다.
 * 
 * 주요 기능:
 * - PDF 파일 업로드 및 렌더링
 * - 태그 자동 인식 (Equipment, Line, Instrument)
 * - 태그 간 관계 매핑 (Connection, Installation)
 * - 태그 다중 선택 및 관리
 * - Excel 파일로 데이터 내보내기
 * - 프로젝트 저장 및 불러오기
 */

// 각 모듈을 ES6 모듈 시스템으로 가져옵니다
import { PDFManager } from './modules/pdfManager.js';      // PDF 관리 (렌더링, 하이라이트 등)
import { TagManager } from './modules/tagManager.js';      // 태그 인식 및 관리
import { RelationshipManager } from './modules/relationshipManager.js'; // 태그 관계 관리
import { StorageManager } from './modules/storageManager.js'; // 로컬 저장소 관리
import { ExportManager } from './modules/exportManager.js';   // Excel 내보내기 관리
import { PatternUI } from './modules/patternUI.js';          // 패턴 설정 UI 관리

/**
 * PIDApp 클래스 - 애플리케이션의 메인 컨트롤러
 * 
 * 이 클래스는 모든 모듈들을 통합하고 관리하는 중앙 컨트롤러 역할을 합니다.
 * 사용자 인터페이스와 각 기능 모듈 간의 통신을 담당합니다.
 */
class PIDApp {
    constructor() {
        // 각 모듈의 인스턴스를 생성합니다
        this.pdfManager = new PDFManager();           // PDF 파일 관리 모듈
        this.tagManager = new TagManager();           // 태그 인식 및 관리 모듈
        this.relationshipManager = new RelationshipManager(); // 태그 관계 관리 모듈
        this.storageManager = new StorageManager();   // 로컬 저장소 관리 모듈
        this.exportManager = new ExportManager();     // Excel 내보내기 모듈
        this.patternUI = new PatternUI(this);         // 패턴 설정 UI 모듈
        
        // 애플리케이션 상태 변수들
        this.currentProject = null;          // 현재 작업 중인 프로젝트 데이터
        this.mappingMode = 'normal';         // 현재 매핑 모드: 'normal', 'connection', 'installation'
        this.selectedTags = [];              // 관계 매핑용 선택된 태그들 (레거시)
        
        // PDF 하이라이트 클릭 시 콜백 함수 설정 (단일 선택 - 레거시)
        // PDF에서 태그 하이라이트를 클릭했을 때 실행됩니다
        this.pdfManager.onHighlightClick = (tagId, tagCategory) => {
            this.selectTagFromPDF(tagId, tagCategory);
        };
        
        // PDF 다중 선택 콜백 함수 설정
        // PDF에서 드래그나 Ctrl+클릭으로 여러 태그를 선택했을 때 실행됩니다
        this.pdfManager.onMultipleTagsSelected = (tagIds, categories) => {
            this.handleMultipleTagSelection(tagIds, categories);
        };

        // 선택된 태그 관리 객체 초기화
        // 태그 보드에서 사용하는 선택된 태그들을 관리합니다
        this.selectedTagsManager = {
            selectedTags: new Set(),                    // 선택된 태그 ID들을 저장하는 Set 객체
            updateUI: () => this.updateSelectedTagsUI(),     // 선택된 태그 UI 업데이트 함수
            add: (tagId, category) => this.addToSelectedTags(tagId, category),    // 태그 추가 함수
            remove: (tagId) => this.removeFromSelectedTags(tagId),                // 태그 제거 함수
            clear: () => this.clearSelectedTags(),                               // 모든 선택 해제 함수
            getAll: () => Array.from(this.selectedTagsManager.selectedTags)     // 모든 선택된 태그 반환 함수
        };
        
        // PDF 페이지 렌더링 완료 시 콜백 함수 설정
        // 페이지가 새로 그려질 때마다 태그 목록을 현재 페이지에 맞게 업데이트합니다
        this.pdfManager.onPageRendered = () => {
            this.updateTagListsForCurrentPage();
        };
        
        // 애플리케이션 초기화 실행
        this.init();
    }

    /**
     * 애플리케이션 초기화 메서드
     * 애플리케이션 시작 시 필요한 모든 초기 설정을 수행합니다
     */
    init() {
        this.setupEventListeners();    // 이벤트 리스너 설정
        this.setupKeyboardShortcuts();  // 키보드 단축키 설정
        this.setupTabSwitching();       // 탭 전환 기능 설정
        this.loadAutoSave();            // 자동 저장된 프로젝트 복원
        
        // 개발/테스트를 위한 자동 PDF 로드
        this.autoLoadTestPDF();
    }
    
    /**
     * 테스트용 PDF 자동 로드 기능
     * PID.pdf 파일을 자동으로 로드하여 테스트 편의성 제공
     */
    async autoLoadTestPDF() {
        try {
            // PDF 파일 자동 로드
            console.log('테스트용 PDF 자동 로드 시도...');
            const response = await fetch('./PDF/PID.pdf');
            if (response.ok) {
                const blob = await response.blob();
                const file = new File([blob], 'PID.pdf', { type: 'application/pdf' });
                
                console.log('PDF 파일 자동 로드 성공');
                await this.handlePDFUpload(file);
                
                // 3초 후 자동 태그 인식 실행
                setTimeout(() => {
                    console.log('자동 태그 인식 실행...');
                    this.autoRecognizeTags();
                }, 3000);
                
            } else {
                console.log('PDF 파일을 찾을 수 없습니다. 수동으로 업로드해주세요.');
            }
        } catch (error) {
            console.log('PDF 자동 로드 실패:', error.message, '- 수동으로 업로드해주세요.');
        }
    }

    /**
     * 이벤트 리스너 설정 메서드
     * 사용자 인터페이스의 모든 버튼과 입력 요소에 이벤트 리스너를 연결합니다
     */
    setupEventListeners() {
        // === PDF 업로드 관련 이벤트 ===
        // 숨겨진 파일 입력 요소에서 파일 선택 시 PDF 업로드 처리
        document.getElementById('pdf-upload').addEventListener('change', (e) => {
            this.handlePDFUpload(e.target.files[0]);
        });

        // 업로드 버튼 클릭 시 파일 선택 대화상자 열기
        document.getElementById('upload-btn').addEventListener('click', () => {
            document.getElementById('pdf-upload').click();
        });

        // === 프로젝트 관리 관련 이벤트 ===
        // 초기화 버튼: 프로젝트를 완전히 초기화 (확인 대화상자 포함)
        document.getElementById('reset-btn').addEventListener('click', () => {
            if (confirm('모든 태그, 관계, 저장 데이터를 초기화하시겠습니까?')) {
                this.resetProject();
            }
        });

        // === PDF 뷰어 제어 관련 이벤트 ===
        // 확대 버튼: PDF를 확대합니다
        document.getElementById('zoom-in').addEventListener('click', () => {
            this.pdfManager.zoomIn();
        });

        // 축소 버튼: PDF를 축소합니다
        document.getElementById('zoom-out').addEventListener('click', () => {
            this.pdfManager.zoomOut();
        });

        // 화면 맞춤 버튼: PDF를 화면 크기에 맞춥니다
        document.getElementById('zoom-fit').addEventListener('click', () => {
            this.pdfManager.fitToScreen();
        });

        // === PDF 페이지 네비게이션 관련 이벤트 ===
        // 이전 페이지 버튼: 이전 페이지로 이동하고 태그 목록을 현재 페이지에 맞게 업데이트
        document.getElementById('prev-page').addEventListener('click', () => {
            this.pdfManager.previousPage();
            this.updateTagListsForCurrentPage();
        });
        
        // 다음 페이지 버튼: 다음 페이지로 이동하고 태그 목록을 현재 페이지에 맞게 업데이트
        document.getElementById('next-page').addEventListener('click', () => {
            this.pdfManager.nextPage();
            this.updateTagListsForCurrentPage();
        });

        // === 파일 저장/불러오기 관련 이벤트 ===
        // 저장 버튼: 현재 프로젝트를 브라우저 로컬 저장소에 저장
        document.getElementById('save-btn').addEventListener('click', () => {
            this.saveProject();
        });

        // 불러오기 버튼: 저장된 프로젝트를 불러오기
        document.getElementById('load-btn').addEventListener('click', () => {
            this.loadProject();
        });

        // 내보내기 버튼: 현재 프로젝트를 Excel 파일로 내보내기
        document.getElementById('export-btn').addEventListener('click', () => {
            this.exportToExcel();
        });

        // === 태그 인식 및 패턴 설정 관련 이벤트 ===
        // 자동 인식 버튼: PDF에서 태그를 자동으로 인식하고 분류
        document.getElementById('auto-recognize').addEventListener('click', () => {
            this.autoRecognizeTags();
        });

        // 패턴 설정 버튼: 태그 인식에 사용할 정규표현식 패턴 설정 모달 열기
        document.getElementById('pattern-settings').addEventListener('click', () => {
            console.log('패턴 설정 버튼 클릭');
            try {
                this.openPatternModal();
            } catch (error) {
                console.error('패턴 모달 열기 오류:', error);
            }
        });

        // === 선택된 태그 관리 관련 이벤트 ===
        // 선택 해제 버튼: 현재 선택된 모든 태그의 선택을 해제
        document.getElementById('clear-selected').addEventListener('click', () => {
            this.clearSelectedTags();
        });

        // 연결관계 생성 버튼: 선택된 2개 태그 간의 연결관계(connection) 생성
        document.getElementById('create-connection').addEventListener('click', () => {
            this.createConnectionFromSelected();
        });

        // 설치관계 생성 버튼: 선택된 태그들 간의 설치관계(installation) 생성
        document.getElementById('create-installation').addEventListener('click', () => {
            this.createInstallationFromSelected();
        });

        // === 관계 패널 및 검색 관련 이벤트 ===
        // 관계 패널 토글 버튼: 관계 목록 패널을 접기/펼치기
        document.getElementById('toggle-relationships').addEventListener('click', () => {
            this.toggleRelationshipsPanel();
        });

        // 태그 검색 입력 필드: 입력한 텍스트로 태그 목록을 실시간 필터링
        document.getElementById('tag-search').addEventListener('input', (e) => {
            this.filterTags(e.target.value);
        });
    }

    // 프로젝트 및 저장 데이터 초기화
    resetProject() {
        // 현재 프로젝트 초기화
        this.currentProject = null;
        
        // 매핑 모드 초기화
        this.setMappingMode('normal');
        this.selectedTags = [];
        
        // 저장 데이터 초기화
        this.storageManager.clearAllData();
        
        // PDF 관련 초기화
        if (this.pdfManager.currentPDF) {
            this.pdfManager.currentPDF = null;
            this.pdfManager.currentPage = 1;
            this.pdfManager.scale = 1.0;
        }
        
        // PDF 캔버스 및 오버레이 초기화
        if (this.pdfManager.clearHighlights) {
            this.pdfManager.clearHighlights();
        }
        
        const canvas = document.getElementById('pdf-canvas');
        const ctx = canvas.getContext('2d');
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        
        const overlay = document.getElementById('pdf-overlay');
        overlay.innerHTML = '';
        
        // PDF 플레이스홀더 표시
        document.getElementById('pdf-placeholder').style.display = 'flex';
        
        // UI 갱신
        this.updateTagLists();
        this.updateRelationshipLists();
        this.updatePageTagCounters();
        
        // 페이지 정보 초기화
        document.getElementById('page-info').textContent = '1 / 1';
        document.getElementById('zoom-level').textContent = '100%';
        
        // 검색 필드 초기화
        document.getElementById('tag-search').value = '';
        
        // 패턴 설정 초기화 (기본 패턴으로 복원)
        if (this.patternUI && this.patternUI.patternManager) {
            this.patternUI.patternManager.resetToDefaults();
        }
        
        alert('프로젝트가 완전히 초기화되었습니다.');
    }

    // PDF 하이라이트 클릭 시 태그 선택
    selectTagFromPDF(tagId, tagCategory) {
        console.log('PDF에서 태그 선택:', tagId, tagCategory);
        
        if (!this.currentProject || !this.currentProject.tags) {
            return;
        }
        
        // 해당 카테고리의 탭을 활성화
        this.switchToTab(tagCategory);
        
        // 기존 선택 해제
        this.clearTagHighlights();
        
        // PDF에서 태그 하이라이트
        this.pdfManager.highlightSelectedTag(tagId);
        
        // 태그 목록에서 해당 태그를 찾아서 선택 표시
        console.log('태그 ID로 검색:', tagId);
        
        // 오른쪽 패널의 태그 아이템 찾기 (PDF 하이라이트가 아닌)
        let tagElement = null;
        
        // 모든 태그 아이템을 검사해서 직접 찾기
        const allTagItems = document.querySelectorAll('.tag-item');
        for (const item of allTagItems) {
            if (item.dataset.tagId === tagId || item.dataset.id === tagId) {
                tagElement = item;
                break;
            }
        }
        
        console.log('찾은 태그 엘리먼트:', tagElement);
        
        if (tagElement) {
            tagElement.classList.add('selected');
            tagElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
        } else {
            console.log('태그 엘리먼트를 찾을 수 없습니다:', tagId);
        }
    }

    // 다중 태그 선택 핸들러
    handleMultipleTagSelection(tagIds, categories) {
        console.log('다중 태그 선택:', tagIds, categories);
        
        if (tagIds.length === 0) {
            this.clearTagHighlights();
            return;
        }
        
        // 단일 카테고리인 경우 해당 탭으로 전환
        if (categories.length === 1) {
            this.switchToTab(categories[0]);
        }
        
        // 태그 패널에서 해당 태그들을 모두 선택 표시 (PDF 다중 선택은 보존)
        this.clearTagPanelSelections();
        
        // PDF에서도 선택된 태그들을 하이라이트
        if (tagIds.length === 1) {
            // 단일 선택 시에는 기존 단일 선택 스타일 사용
            this.pdfManager.highlightSelectedTag(tagIds[0]);
        }
        // 다중 선택 시에는 PDF에서 이미 다중 선택 스타일이 적용되어 있으므로 그대로 유지
        
        tagIds.forEach(tagId => {
            // 모든 태그 아이템을 검사해서 찾기
            const allTagItems = document.querySelectorAll('.tag-item');
            for (const item of allTagItems) {
                if (item.dataset.tagId === tagId || item.dataset.id === tagId) {
                    item.classList.add('selected');
                    console.log('태그 패널에서 선택 표시:', tagId, item);
                    break;
                }
            }
        });
        
        // 첫 번째 선택된 태그로 스크롤
        if (tagIds.length > 0) {
            // Use direct dataset comparison to avoid CSS selector issues with special characters
            const allTagItems = document.querySelectorAll('.tag-item');
            let firstTagElement = null;
            for (const item of allTagItems) {
                if (item.dataset.tagId === tagIds[0] || item.dataset.id === tagIds[0]) {
                    firstTagElement = item;
                    break;
                }
            }
            if (firstTagElement) {
                firstTagElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }
        }
        
        // 선택 정보 표시
        this.showSelectionInfo(tagIds.length, categories);
    }

    // 선택 정보 표시
    showSelectionInfo(count, categories) {
        const selectionInfo = document.getElementById('selection-info');
        if (!selectionInfo) {
            // 선택 정보 표시용 엘리먼트 생성
            const info = document.createElement('div');
            info.id = 'selection-info';
            info.style.cssText = `
                position: fixed;
                top: 10px;
                right: 10px;
                background: #007bff;
                color: white;
                padding: 8px 16px;
                border-radius: 4px;
                font-size: 14px;
                z-index: 1000;
                box-shadow: 0 2px 8px rgba(0,0,0,0.2);
            `;
            document.body.appendChild(info);
        }
        
        const info = document.getElementById('selection-info');
        if (count > 0) {
            const categoryText = categories.length === 1 ? categories[0] : 'mixed';
            info.textContent = `${count}개 태그 선택됨 (${categoryText})`;
            info.style.display = 'block';
            
            // 3초 후 자동 숨김
            setTimeout(() => {
                if (info) {
                    info.style.display = 'none';
                }
            }, 3000);
        } else {
            info.style.display = 'none';
        }
    }

    // 탭 전환 헬퍼 함수
    switchToTab(category) {
        // 탭 버튼 업데이트
        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.classList.remove('active');
        });
        document.querySelector(`[data-tab="${category}"]`).classList.add('active');
        
        // 태그 리스트 업데이트
        document.querySelectorAll('.tag-list').forEach(list => {
            list.classList.remove('active');
        });
        document.getElementById(`${category}-list`).classList.add('active');
    }

    // ID로 태그 찾기 헬퍼 함수
    findTagById(tagId) {
        if (!this.currentProject || !this.currentProject.tags) {
            return null;
        }
        
        for (const category of ['equipment', 'line', 'instrument']) {
            const tag = this.currentProject.tags[category].find(t => t.id === tagId);
            if (tag) {
                return tag;
            }
        }
        
        return null;
    }

    // ...existing code...

    setupKeyboardShortcuts() {
        document.addEventListener('keydown', (e) => {
            // Prevent shortcuts when typing in input fields
            if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') {
                return;
            }

            switch (e.key.toLowerCase()) {
                case 'r':
                    e.preventDefault();
                    this.setMappingMode('connection');
                    break;
                case 'i':
                    e.preventDefault();
                    this.setMappingMode('installation');
                    break;
                case 'escape':
                    e.preventDefault();
                    this.setMappingMode('normal');
                    this.clearSelection();
                    // Also clear PDF multi-selections
                    this.pdfManager.clearSelections();
                    this.showSelectionInfo(0, []);
                    break;
                case '+':
                case '=':
                    if (e.ctrlKey || e.metaKey) {
                        e.preventDefault();
                        this.pdfManager.zoomIn();
                    }
                    break;
                case '-':
                    if (e.ctrlKey || e.metaKey) {
                        e.preventDefault();
                        this.pdfManager.zoomOut();
                    }
                    break;
                case 's':
                    if (e.ctrlKey || e.metaKey) {
                        e.preventDefault();
                        this.saveProject();
                    }
                    break;
            }
        });
    }

    setupTabSwitching() {
        // Tag tabs
        document.querySelectorAll('.tag-tabs .tab-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                // Use closest() to ensure we get the button element, not child elements
                const button = e.target.closest('.tab-btn');
                const tabName = button ? button.dataset.tab : null;
                if (tabName) {
                    this.switchTagTab(tabName);
                } else {
                    console.error('Tab name not found for button:', e.target);
                }
            });
        });

        // Relationship tabs
        document.querySelectorAll('.relationship-tabs .tab-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const button = e.target.closest('.tab-btn');
                const tabName = button ? button.dataset.relTab : null;
                if (tabName) {
                    this.switchRelationshipTab(tabName);
                } else {
                    console.error('Relationship tab name not found for button:', e.target);
                }
            });
        });
    }

    async handlePDFUpload(file) {
        if (!file || file.type !== 'application/pdf') {
            alert('PDF 파일만 업로드 가능합니다.');
            return;
        }

        try {
            // Hide placeholder
            document.getElementById('pdf-placeholder').style.display = 'none';
            
            // Load PDF
            await this.pdfManager.loadPDF(file);
            
            // Set up page render callback for tag highlights
            this.pdfManager.onPageRendered = () => {
                if (this.currentProject && this.currentProject.tags) {
                    this.pdfManager.refreshHighlights(this.currentProject.tags);
                    this.updateTagListsForCurrentPage();
                }
            };
            
            // Initialize new project
            this.currentProject = {
                name: file.name.replace('.pdf', ''),
                pdfFile: file,
                tags: {
                    equipment: [],
                    line: [],
                    instrument: []
                },
                relationships: {
                    connections: [],
                    installations: []
                },
                created: new Date().toISOString(),
                modified: new Date().toISOString()
            };

            // Auto-recognize tags
            setTimeout(() => {
                this.autoRecognizeTags();
            }, 1000);

        } catch (error) {
            console.error('PDF 로딩 실패:', error);
            alert('PDF 파일을 읽을 수 없습니다. 벡터 기반 PDF인지 확인해주세요.');
        }
    }

    setMappingMode(mode) {
        this.mappingMode = mode;
        this.selectedTags = [];
        
        const indicator = document.getElementById('mapping-mode');
        const modeText = indicator.querySelector('.mode-text');
        
        // Remove all mode classes
        indicator.classList.remove('connection-mode', 'installation-mode');
        
        switch (mode) {
            case 'connection':
                indicator.classList.add('connection-mode');
                modeText.textContent = '연결 관계 모드';
                break;
            case 'installation':
                indicator.classList.add('installation-mode');
                modeText.textContent = '설치 관계 모드';
                break;
            default:
                modeText.textContent = '일반 모드';
                break;
        }

        // Clear existing selections
        this.clearTagHighlights();
    }

    clearSelection() {
        this.selectedTags = [];
        this.clearTagHighlights();
        this.pdfManager.highlightSelectedTag(null);
    }

    clearTagHighlights() {
        // 오른쪽 패널의 태그 선택 해제
        document.querySelectorAll('.tag-item.selected').forEach(item => {
            item.classList.remove('selected');
        });
        
        // PDF 하이라이트도 초기화 (선택된 하이라이트를 기본 상태로 복원)
        if (this.pdfManager) {
            this.pdfManager.highlightSelectedTag(null);
        }
    }

    // 태그 패널의 선택만 해제 (PDF 다중 선택은 보존)
    clearTagPanelSelections() {
        // 오른쪽 패널의 태그 선택만 해제
        document.querySelectorAll('.tag-item.selected').forEach(item => {
            item.classList.remove('selected');
        });
    }

    switchTagTab(tabName) {
        // Update tab buttons
        document.querySelectorAll('.tag-tabs .tab-btn').forEach(btn => {
            btn.classList.remove('active');
        });
        
        // Find and activate the correct tab button
        const tabButton = document.querySelector(`.tag-tabs [data-tab="${tabName}"]`);
        if (tabButton) {
            tabButton.classList.add('active');
        } else {
            console.error('Tab button not found for:', tabName);
        }

        // Update content
        document.querySelectorAll('.tag-list').forEach(list => {
            list.classList.remove('active');
        });
        
        const tabContent = document.getElementById(`${tabName}-list`);
        if (tabContent) {
            tabContent.classList.add('active');
        } else {
            console.error('Tab content not found for:', tabName);
        }
    }

    switchRelationshipTab(tabName) {
        // Update tab buttons
        document.querySelectorAll('.relationship-tabs .tab-btn').forEach(btn => {
            btn.classList.remove('active');
        });
        document.querySelector(`[data-rel-tab="${tabName}"]`).classList.add('active');

        // Update content
        document.querySelectorAll('.relationship-list').forEach(list => {
            list.classList.remove('active');
        });
        document.getElementById(`${tabName}-list`).classList.add('active');
    }

    async autoRecognizeTags() {
        if (!this.pdfManager.currentPDF) {
            alert('먼저 PDF를 업로드해주세요.');
            return;
        }

        try {
            // Extract text with positions from PDF for advanced instrument matching
            // 테스트용으로 첫 페이지만 처리
            const textWithPositions = await this.pdfManager.extractTextWithPositions(true);
            
            // Recognize tags using positional patterns
            const recognizedTags = this.tagManager.recognizeTags(null, textWithPositions);
            
            // Update current project
            this.currentProject.tags = recognizedTags;
            this.currentProject.modified = new Date().toISOString();
            
            // Update UI with page filtering
            this.updateTagLists();
            this.updateTagListsForCurrentPage();
            
            // Update PDF highlights
            this.pdfManager.updateTagHighlights(recognizedTags);
            
            // Auto-save
            this.autoSave();
            
            console.log('태그 인식 완료:', recognizedTags);
            
            // Show instrument matching statistics
            if (recognizedTags.instrument.length > 0) {
                const stats = this.tagManager.instrumentMatcher.getMatchingStatistics(recognizedTags.instrument);
                console.log('Instrument 매칭 통계:', stats);
            }
            
        } catch (error) {
            console.error('태그 인식 실패:', error);
            alert('태그 자동 인식에 실패했습니다.');
        }
    }

    updateTagLists() {
        ['equipment', 'line', 'instrument'].forEach(type => {
            const container = document.getElementById(`${type}-tags`);
            container.innerHTML = '';
            
            if (this.currentProject && this.currentProject.tags) {
                this.currentProject.tags[type].forEach((tag, index) => {
                    const item = this.createTagItem(tag, type, index);
                    container.appendChild(item);
                });
            }
        });
        
        // Update tag counts in tabs
        this.updateTagCounts();
    }

    updateTagListsForCurrentPage() {
        if (!this.pdfManager.currentPage || !this.currentProject) return;
        
        const currentPage = this.pdfManager.currentPage;
        
        ['equipment', 'line', 'instrument'].forEach(type => {
            const container = document.getElementById(`${type}-tags`);
            const items = container.querySelectorAll('.tag-item');
            
            items.forEach(item => {
                const index = parseInt(item.dataset.index);
                const tag = this.currentProject.tags[type][index];
                
                // Show only tags from current page
                if (tag.position && tag.position.page === currentPage) {
                    item.style.display = 'flex';
                    item.classList.add('current-page');
                } else if (tag.position) {
                    item.style.display = 'none';
                    item.classList.remove('current-page');
                } else {
                    // Manual tags without position - show on all pages
                    item.style.display = 'flex';
                    item.classList.remove('current-page');
                }
            });
        });

        // Update page counters
        this.updatePageTagCounters();
    }

    updatePageTagCounters() {
        if (!this.currentProject || !this.pdfManager.currentPage) return;
        
        const currentPage = this.pdfManager.currentPage;
        const counters = {
            equipment: 0,
            line: 0,
            instrument: 0
        };

        ['equipment', 'line', 'instrument'].forEach(type => {
            counters[type] = this.currentProject.tags[type].filter(tag => 
                tag.position && tag.position.page === currentPage
            ).length;
            
            // Update header counters
            const header = document.querySelector(`#${type}-list .tag-list-header h3`);
            if (header) {
                const baseText = header.textContent.split('(')[0].trim();
                header.textContent = `${baseText} (${counters[type]}/${this.currentProject.tags[type].length})`;
            }
        });
    }

    createTagItem(tag, type, index) {
        const li = document.createElement('li');
        li.className = 'tag-item';
        li.dataset.type = type;
        li.dataset.index = index;
        li.dataset.id = tag.id;
        li.dataset.tagId = tag.id;  // 추가: PDF 하이라이트와 연결용

        // Create display content based on tag type
        let tagInfo = tag.type || '';
        let tagDetails = tag.spec || '';
        
        // Special handling for instrument tags with functions
        if (type === 'instrument') {
            tagInfo = tag.type || '';
            tagDetails = tag.function ? `Function: ${tag.function}` : '';
        }

        li.innerHTML = `
            <div>
                <div class="tag-name">${tag.name}</div>
                <div class="tag-info">${tagInfo} ${tagDetails}</div>
            </div>
            <div class="tag-actions">
                <button class="btn btn-sm btn-danger" onclick="app.deleteTag('${type}', ${index})">삭제</button>
            </div>
        `;

        // Add click handler for relationship mapping
        li.addEventListener('click', (e) => {
            if (e.target.tagName === 'BUTTON') return;
            this.handleTagClick(tag, type, li);
        });

        return li;
    }

    handleTagClick(tag, type, element) {
        if (this.mappingMode === 'normal') {
            // Normal mode - highlight tag in both panel and PDF
            this.clearTagHighlights();
            if (element) {
                element.classList.add('selected');
            }
            
            // Highlight in PDF if tag has position
            if (tag.position && this.pdfManager.currentPage === tag.position.page) {
                this.pdfManager.highlightSelectedTag(tag.id);
            } else if (tag.position && this.pdfManager.currentPage !== tag.position.page) {
                // Navigate to tag's page
                this.pdfManager.goToPage(tag.position.page);
            }
            return;
        }

        // Mapping mode - create relationships
        if (this.selectedTags.length === 0) {
            // First tag selection
            this.selectedTags.push({ tag, type, element });
            if (element) {
                element.classList.add('selected');
            }
            
            // Highlight in PDF
            if (tag.position && this.pdfManager.currentPage === tag.position.page) {
                this.pdfManager.highlightSelectedTag(tag.id);
            }
        } else if (this.selectedTags.length === 1) {
            // Second tag selection - create relationship
            const firstTag = this.selectedTags[0];
            
            if (firstTag.tag.id === tag.id) {
                // Same tag - deselect
                firstTag.element.classList.remove('selected');
                this.selectedTags = [];
                this.pdfManager.highlightSelectedTag(null); // Clear PDF highlight
                return;
            }

            // Create relationship
            this.createRelationship(firstTag, { tag, type, element });
            
            // Clear selections
            this.clearSelection();
            this.setMappingMode('normal');
        }
    }

    createRelationship(fromTag, toTag) {
        const relationship = {
            id: Date.now().toString(),
            from: {
                id: fromTag.tag.id,
                name: fromTag.tag.name,
                type: fromTag.type
            },
            to: {
                id: toTag.tag.id,
                name: toTag.tag.name,
                type: toTag.type
            },
            relationshipType: this.mappingMode,
            created: new Date().toISOString()
        };

        if (this.mappingMode === 'connection') {
            this.currentProject.relationships.connections.push(relationship);
        } else if (this.mappingMode === 'installation') {
            this.currentProject.relationships.installations.push(relationship);
        }

        this.currentProject.modified = new Date().toISOString();
        this.updateRelationshipLists();
        this.autoSave();

        console.log('관계 생성:', relationship);
    }

    updateRelationshipLists() {
        // Update connections
        const connectionsContainer = document.getElementById('connections-list');
        connectionsContainer.innerHTML = '';
        if (this.currentProject && this.currentProject.relationships) {
            this.currentProject.relationships.connections.forEach((rel, index) => {
                const item = this.createRelationshipItem(rel, 'connections', index);
                connectionsContainer.appendChild(item);
            });
        }

        // Update installations
        const installationsContainer = document.getElementById('installations-list');
        installationsContainer.innerHTML = '';
        if (this.currentProject && this.currentProject.relationships) {
            this.currentProject.relationships.installations.forEach((rel, index) => {
                const item = this.createRelationshipItem(rel, 'installations', index);
                installationsContainer.appendChild(item);
            });
        }
    }

    createRelationshipItem(relationship, type, index) {
        const li = document.createElement('li');
        li.className = 'relationship-item';
        
        const arrow = type === 'connections' ? '→' : '⚙';
        
        li.innerHTML = `
            <span>${relationship.from.name} ${arrow} ${relationship.to.name}</span>
            <button class="btn btn-sm btn-danger" onclick="app.deleteRelationship('${type}', ${index})">삭제</button>
        `;

        return li;
    }

    deleteTag(type, index) {
        if (confirm('이 태그를 삭제하시겠습니까?')) {
            this.currentProject.tags[type].splice(index, 1);
            this.currentProject.modified = new Date().toISOString();
            this.updateTagLists();
            this.autoSave();
        }
    }

    deleteRelationship(type, index) {
        if (confirm('이 관계를 삭제하시겠습니까?')) {
            this.currentProject.relationships[type].splice(index, 1);
            this.currentProject.modified = new Date().toISOString();
            this.updateRelationshipLists();
            this.autoSave();
        }
    }

    filterTags(searchTerm) {
        const term = searchTerm.toLowerCase();
        document.querySelectorAll('.tag-item').forEach(item => {
            const tagName = item.querySelector('.tag-name').textContent.toLowerCase();
            if (tagName.includes(term)) {
                item.style.display = 'flex';
            } else {
                item.style.display = 'none';
            }
        });
    }

    saveProject() {
        if (!this.currentProject) {
            alert('저장할 프로젝트가 없습니다.');
            return;
        }

        this.storageManager.saveProject(this.currentProject);
        alert('프로젝트가 저장되었습니다.');
    }

    loadProject() {
        this.storageManager.loadProject((project) => {
            this.currentProject = project;
            this.updateTagLists();
            this.updateRelationshipLists();
            console.log('프로젝트 로드 완료:', project);
        });
    }

    autoSave() {
        if (this.currentProject) {
            this.storageManager.autoSave(this.currentProject);
        }
    }

    loadAutoSave() {
        const autoSaved = this.storageManager.loadAutoSave();
        if (autoSaved) {
            this.currentProject = autoSaved;
            this.updateTagLists();
            this.updateRelationshipLists();
            console.log('자동 저장된 프로젝트 복원:', autoSaved);
        }
    }

    openPatternModal() {
        this.patternUI.openModal();
    }

    exportToExcel() {
        if (!this.currentProject) {
            alert('내보낼 데이터가 없습니다.');
            return;
        }

        this.exportManager.exportToExcel(this.currentProject);
    }

    // ===== SELECTED TAGS MANAGEMENT =====

    addToSelectedTags(tagId, category) {
        const tag = this.findTagById(tagId);
        if (!tag) return;

        this.selectedTagsManager.selectedTags.add(tagId);
        this.updateSelectedTagsUI();
        this.updateRelationshipButtonsState();
        console.log('태그 선택에 추가:', tagId, category);
    }

    removeFromSelectedTags(tagId) {
        this.selectedTagsManager.selectedTags.delete(tagId);
        this.updateSelectedTagsUI();
        this.updateRelationshipButtonsState();
        
        // Also remove from PDF selection
        if (this.pdfManager) {
            this.pdfManager.selectedTags.delete(tagId);
            // Remove visual selection from PDF
            const highlight = document.querySelector(`.tag-highlight[data-tag-id="${tagId}"]`);
            if (highlight && highlight.classList.contains('multi-selected')) {
                this.pdfManager.removeTagSelection(highlight);
            }
        }
        console.log('태그 선택에서 제거:', tagId);
    }

    clearSelectedTags() {
        this.selectedTagsManager.selectedTags.clear();
        this.updateSelectedTagsUI();
        this.updateRelationshipButtonsState();
        
        // Also clear PDF selections
        if (this.pdfManager) {
            this.pdfManager.clearSelections();
        }
        
        // Clear tag panel selections
        this.clearTagPanelSelections();
        console.log('모든 태그 선택 해제');
    }

    updateSelectedTagsUI() {
        const container = document.getElementById('selected-tags-container');
        const countElement = document.getElementById('selected-count');
        
        const selectedTags = Array.from(this.selectedTagsManager.selectedTags);
        countElement.textContent = selectedTags.length;
        
        if (selectedTags.length === 0) {
            container.innerHTML = '<div class="empty-selection">태그를 선택해주세요</div>';
            return;
        }
        
        const tagElements = selectedTags.map(tagId => {
            const tag = this.findTagById(tagId);
            if (!tag) return '';
            
            const categoryIcons = {
                equipment: '⚙️',
                line: '📏', 
                instrument: '🔧'
            };
            
            return `
                <div class="selected-tag-item" data-tag-id="${tagId}">
                    <span class="tag-category">${categoryIcons[tag.category] || ''}</span>
                    <span class="tag-name">${tag.name}</span>
                    <button class="remove-btn" onclick="app.removeFromSelectedTags('${tagId}')">×</button>
                </div>
            `;
        }).join('');
        
        container.innerHTML = tagElements;
    }

    updateRelationshipButtonsState() {
        const selectedCount = this.selectedTagsManager.selectedTags.size;
        const connectionBtn = document.getElementById('create-connection');
        const installationBtn = document.getElementById('create-installation');
        
        const canCreateConnection = selectedCount === 2;
        const canCreateInstallation = selectedCount >= 2;
        
        connectionBtn.disabled = !canCreateConnection;
        installationBtn.disabled = !canCreateInstallation;
        
        // Update button text with count info
        if (selectedCount < 2) {
            connectionBtn.textContent = `연결관계 (${selectedCount}/2)`;
            installationBtn.textContent = `설치관계 (${selectedCount}/2+)`;
        } else {
            connectionBtn.textContent = '연결관계 생성';
            installationBtn.textContent = '설치관계 생성';
        }
    }

    createConnectionFromSelected() {
        const selectedTags = Array.from(this.selectedTagsManager.selectedTags);
        if (selectedTags.length !== 2) {
            alert('연결관계는 정확히 2개의 태그가 필요합니다.');
            return;
        }

        const fromTag = this.findTagById(selectedTags[0]);
        const toTag = this.findTagById(selectedTags[1]);
        
        if (!fromTag || !toTag) {
            alert('선택된 태그를 찾을 수 없습니다.');
            return;
        }

        // Create connection relationship
        const connection = {
            id: Date.now().toString(),
            from: fromTag.id,
            to: toTag.id,
            fromName: fromTag.name,
            toName: toTag.name,
            type: 'connection',
            created: new Date().toISOString()
        };

        this.currentProject.relationships.connections.push(connection);
        this.updateRelationshipLists();
        this.clearSelectedTags();
        this.autoSave();
        
        console.log('연결관계 생성:', connection);
        alert(`연결관계가 생성되었습니다: ${fromTag.name} → ${toTag.name}`);
    }

    createInstallationFromSelected() {
        const selectedTags = Array.from(this.selectedTagsManager.selectedTags);
        if (selectedTags.length < 2) {
            alert('설치관계는 최소 2개의 태그가 필요합니다.');
            return;
        }

        const tags = selectedTags.map(id => this.findTagById(id)).filter(tag => tag);
        if (tags.length !== selectedTags.length) {
            alert('선택된 태그를 찾을 수 없습니다.');
            return;
        }

        // First tag is installed, others are installation targets
        const installedTag = tags[0];
        const installationTargets = tags.slice(1);

        installationTargets.forEach(target => {
            const installation = {
                id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
                installed: installedTag.id,
                target: target.id,
                installedName: installedTag.name,
                targetName: target.name,
                type: 'installation',
                created: new Date().toISOString()
            };

            this.currentProject.relationships.installations.push(installation);
        });

        this.updateRelationshipLists();
        this.clearSelectedTags();
        this.autoSave();
        
        console.log('설치관계 생성:', installationTargets.length, '개');
        alert(`설치관계가 생성되었습니다: ${installedTag.name} → ${installationTargets.map(t => t.name).join(', ')}`);
    }

    toggleRelationshipsPanel() {
        const content = document.getElementById('relationship-content');
        const button = document.getElementById('toggle-relationships');
        
        if (content.classList.contains('collapsed')) {
            content.classList.remove('collapsed');
            button.textContent = '접기';
        } else {
            content.classList.add('collapsed');
            button.textContent = '펼치기';
        }
    }

    // Override handleMultipleTagSelection to integrate with selected tags manager
    handleMultipleTagSelection(tagIds, categories) {
        console.log('다중 태그 선택:', tagIds, categories);
        
        if (tagIds.length === 0) {
            this.clearTagPanelSelections();
            return;
        }
        
        // Update selected tags manager
        this.selectedTagsManager.selectedTags.clear();
        tagIds.forEach(tagId => {
            this.selectedTagsManager.selectedTags.add(tagId);
        });
        this.updateSelectedTagsUI();
        this.updateRelationshipButtonsState();
        
        // 단일 카테고리인 경우 해당 탭으로 전환
        if (categories.length === 1) {
            this.switchToTab(categories[0]);
        }
        
        // 태그 패널에서 해당 태그들을 모두 선택 표시 (PDF 다중 선택은 보존)
        this.clearTagPanelSelections();
        
        // PDF에서도 선택된 태그들을 하이라이트
        if (tagIds.length === 1) {
            // 단일 선택 시에는 기존 단일 선택 스타일 사용
            this.pdfManager.highlightSelectedTag(tagIds[0]);
        }
        // 다중 선택 시에는 PDF에서 이미 다중 선택 스타일이 적용되어 있으므로 그대로 유지
        
        tagIds.forEach(tagId => {
            // 모든 태그 아이템을 검사해서 찾기
            const allTagItems = document.querySelectorAll('.tag-item');
            for (const item of allTagItems) {
                if (item.dataset.tagId === tagId || item.dataset.id === tagId) {
                    item.classList.add('selected');
                    console.log('태그 패널에서 선택 표시:', tagId, item);
                    break;
                }
            }
        });
        
        // 첫 번째 선택된 태그로 스크롤
        if (tagIds.length > 0) {
            // Use direct dataset comparison to avoid CSS selector issues with special characters
            const allTagItems = document.querySelectorAll('.tag-item');
            let firstTagElement = null;
            for (const item of allTagItems) {
                if (item.dataset.tagId === tagIds[0] || item.dataset.id === tagIds[0]) {
                    firstTagElement = item;
                    break;
                }
            }
            if (firstTagElement) {
                firstTagElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }
        }
        
        // 선택 정보 표시
        this.showSelectionInfo(tagIds.length, categories);
    }

    // Update tag counts in tabs
    updateTagCounts() {
        if (!this.currentProject) return;
        
        document.getElementById('equipment-count').textContent = this.currentProject.tags.equipment.length;
        document.getElementById('line-count').textContent = this.currentProject.tags.line.length;
        document.getElementById('instrument-count').textContent = this.currentProject.tags.instrument.length;
    }
}

// Global functions for HTML onclick handlers
window.addManualTag = function(type) {
    const tagName = prompt(`${type} 태그명을 입력하세요:`);
    if (tagName && tagName.trim()) {
        const tag = {
            id: Date.now().toString(),
            name: tagName.trim(),
            type: type,
            manual: true,
            created: new Date().toISOString()
        };

        window.app.currentProject.tags[type].push(tag);
        window.app.currentProject.modified = new Date().toISOString();
        window.app.updateTagLists();
        window.app.autoSave();
    }
};

// Initialize app when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.app = new PIDApp();
    window.patternUI = window.app.patternUI;
});