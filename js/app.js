// P&ID Tag Mapping System - Main Application
import { PDFManager } from './modules/pdfManager.js';
import { TagManager } from './modules/tagManager.js';
import { RelationshipManager } from './modules/relationshipManager.js';
import { StorageManager } from './modules/storageManager.js';
import { ExportManager } from './modules/exportManager.js';
import { PatternUI } from './modules/patternUI.js';

class PIDApp {
    constructor() {
        this.pdfManager = new PDFManager();
        this.tagManager = new TagManager();
        this.relationshipManager = new RelationshipManager();
        this.storageManager = new StorageManager();
        this.exportManager = new ExportManager();
        this.patternUI = new PatternUI(this);
        
        this.currentProject = null;
        this.mappingMode = 'normal'; // normal, connection, installation
        this.selectedTags = [];
        
        // Set up PDF highlight click callback (legacy single selection)
        this.pdfManager.onHighlightClick = (tagId, tagCategory) => {
            this.selectTagFromPDF(tagId, tagCategory);
        };
        
        // Set up PDF multi-selection callback
        this.pdfManager.onMultipleTagsSelected = (tagIds, categories) => {
            this.handleMultipleTagSelection(tagIds, categories);
        };

        // Initialize selected tags management
        this.selectedTagsManager = {
            selectedTags: new Set(),
            updateUI: () => this.updateSelectedTagsUI(),
            add: (tagId, category) => this.addToSelectedTags(tagId, category),
            remove: (tagId) => this.removeFromSelectedTags(tagId),
            clear: () => this.clearSelectedTags(),
            getAll: () => Array.from(this.selectedTagsManager.selectedTags)
        };
        
        // Set up PDF page rendering callback for highlight updates
        this.pdfManager.onPageRendered = () => {
            this.updateTagListsForCurrentPage();
        };
        
        this.init();
    }

    init() {
        this.setupEventListeners();
        this.setupKeyboardShortcuts();
        this.setupTabSwitching();
        this.loadAutoSave();
    }

    setupEventListeners() {
        // PDF Upload
        document.getElementById('pdf-upload').addEventListener('change', (e) => {
            this.handlePDFUpload(e.target.files[0]);
        });

        document.getElementById('upload-btn').addEventListener('click', () => {
            document.getElementById('pdf-upload').click();
        });

        // 초기화 버튼 이벤트
        document.getElementById('reset-btn').addEventListener('click', () => {
            if (confirm('모든 태그, 관계, 저장 데이터를 초기화하시겠습니까?')) {
                this.resetProject();
            }
        });

        // PDF 컨트롤 이벤트
        document.getElementById('zoom-in').addEventListener('click', () => {
            this.pdfManager.zoomIn();
        });

        document.getElementById('zoom-out').addEventListener('click', () => {
            this.pdfManager.zoomOut();
        });

        document.getElementById('zoom-fit').addEventListener('click', () => {
            this.pdfManager.fitToScreen();
        });

        // PDF 페이지 넘김 버튼 이벤트
        document.getElementById('prev-page').addEventListener('click', () => {
            this.pdfManager.previousPage();
            this.updateTagListsForCurrentPage();
        });
        document.getElementById('next-page').addEventListener('click', () => {
            this.pdfManager.nextPage();
            this.updateTagListsForCurrentPage();
        });

        // 프로젝트 관리 이벤트
        document.getElementById('save-btn').addEventListener('click', () => {
            this.saveProject();
        });

        document.getElementById('load-btn').addEventListener('click', () => {
            this.loadProject();
        });

        document.getElementById('export-btn').addEventListener('click', () => {
            this.exportToExcel();
        });

        // 자동 인식 및 패턴 설정 이벤트
        document.getElementById('auto-recognize').addEventListener('click', () => {
            this.autoRecognizeTags();
        });

        document.getElementById('pattern-settings').addEventListener('click', () => {
            console.log('패턴 설정 버튼 클릭');
            try {
                this.openPatternModal();
            } catch (error) {
                console.error('패턴 모달 열기 오류:', error);
            }
        });

        // Selected Tags Management
        document.getElementById('clear-selected').addEventListener('click', () => {
            this.clearSelectedTags();
        });

        document.getElementById('create-connection').addEventListener('click', () => {
            this.createConnectionFromSelected();
        });

        document.getElementById('create-installation').addEventListener('click', () => {
            this.createInstallationFromSelected();
        });

        // Relationships panel toggle
        document.getElementById('toggle-relationships').addEventListener('click', () => {
            this.toggleRelationshipsPanel();
        });

        // 태그 검색 이벤트
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
                this.switchTagTab(e.target.dataset.tab);
            });
        });

        // Relationship tabs
        document.querySelectorAll('.relationship-tabs .tab-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                this.switchRelationshipTab(e.target.dataset.relTab);
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
        document.querySelector(`[data-tab="${tabName}"]`).classList.add('active');

        // Update content
        document.querySelectorAll('.tag-list').forEach(list => {
            list.classList.remove('active');
        });
        document.getElementById(`${tabName}-list`).classList.add('active');
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
            const textWithPositions = await this.pdfManager.extractTextWithPositions();
            
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
        this.updateRelationshipsList();
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

        this.updateRelationshipsList();
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