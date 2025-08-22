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

        // PDF Controls
        document.getElementById('zoom-in').addEventListener('click', () => {
            this.pdfManager.zoomIn();
        });

        document.getElementById('zoom-out').addEventListener('click', () => {
            this.pdfManager.zoomOut();
        });

        document.getElementById('zoom-fit').addEventListener('click', () => {
            this.pdfManager.fitToScreen();
        });

        document.getElementById('prev-page').addEventListener('click', () => {
            this.pdfManager.previousPage();
        });

        document.getElementById('next-page').addEventListener('click', () => {
            this.pdfManager.nextPage();
        });

        // Project Management
        document.getElementById('save-btn').addEventListener('click', () => {
            this.saveProject();
        });

        document.getElementById('load-btn').addEventListener('click', () => {
            this.loadProject();
        });

        document.getElementById('export-btn').addEventListener('click', () => {
            this.exportToExcel();
        });

        // Auto Recognition
        document.getElementById('auto-recognize').addEventListener('click', () => {
            this.autoRecognizeTags();
        });

        // Pattern Settings
        document.getElementById('pattern-settings').addEventListener('click', () => {
            this.openPatternModal();
        });

        // Tag Search
        document.getElementById('tag-search').addEventListener('input', (e) => {
            this.filterTags(e.target.value);
        });
    }

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
    }

    clearTagHighlights() {
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
            
            // Update UI
            this.updateTagLists();
            
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
            
            this.currentProject.tags[type].forEach((tag, index) => {
                const item = this.createTagItem(tag, type, index);
                container.appendChild(item);
            });
        });
    }

    createTagItem(tag, type, index) {
        const li = document.createElement('li');
        li.className = 'tag-item';
        li.dataset.type = type;
        li.dataset.index = index;
        li.dataset.id = tag.id;

        // Create display content based on tag type
        let tagInfo = tag.type || '';
        let tagDetails = tag.spec || '';
        
        // Special handling for instrument tags with functions
        if (type === 'instrument' && tag.function) {
            tagInfo = `${tag.function} - ${tag.type}`;
            tagDetails = `Function: ${tag.function}`;
        }

        li.innerHTML = `
            <div>
                <div class="tag-name">${tag.name}</div>
                <div class="tag-info">${tagInfo} ${tagDetails}</div>
                ${tag.function ? `<div class="tag-function">${tag.function}</div>` : ''}
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
            // Normal mode - just highlight
            this.clearTagHighlights();
            element.classList.add('selected');
            return;
        }

        // Mapping mode - create relationships
        if (this.selectedTags.length === 0) {
            // First tag selection
            this.selectedTags.push({ tag, type, element });
            element.classList.add('selected');
        } else if (this.selectedTags.length === 1) {
            // Second tag selection - create relationship
            const firstTag = this.selectedTags[0];
            
            if (firstTag.tag.id === tag.id) {
                // Same tag - deselect
                firstTag.element.classList.remove('selected');
                this.selectedTags = [];
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
        this.currentProject.relationships.connections.forEach((rel, index) => {
            const item = this.createRelationshipItem(rel, 'connections', index);
            connectionsContainer.appendChild(item);
        });

        // Update installations
        const installationsContainer = document.getElementById('installations-list');
        installationsContainer.innerHTML = '';
        this.currentProject.relationships.installations.forEach((rel, index) => {
            const item = this.createRelationshipItem(rel, 'installations', index);
            installationsContainer.appendChild(item);
        });
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