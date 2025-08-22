// Pattern UI Manager - Handles pattern settings modal and interactions
export class PatternUI {
    constructor(app) {
        this.app = app;
        this.patternManager = app.tagManager.getPatternManager();
        this.currentEditingPattern = null;
        this.init();
    }

    init() {
        this.setupEventListeners();
        this.loadPatternSuggestions();
    }

    setupEventListeners() {
        // Pattern tab switching
        document.querySelectorAll('.pattern-tab-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                this.switchPatternTab(e.target.dataset.tab);
            });
        });

        // Add new pattern
        document.getElementById('add-pattern-btn').addEventListener('click', () => {
            this.showAddPatternForm();
        });

        // Save pattern
        document.getElementById('save-pattern-btn').addEventListener('click', () => {
            this.savePattern();
        });

        // Cancel pattern
        document.getElementById('cancel-pattern-btn').addEventListener('click', () => {
            this.hideAddPatternForm();
        });

        // Test pattern
        document.getElementById('test-pattern-btn').addEventListener('click', () => {
            this.testPattern();
        });

        // Pattern import/export
        document.getElementById('export-patterns-btn').addEventListener('click', () => {
            this.exportPatterns();
        });

        document.getElementById('import-patterns-btn').addEventListener('click', () => {
            document.getElementById('import-patterns-file').click();
        });

        document.getElementById('import-patterns-file').addEventListener('change', (e) => {
            this.importPatterns(e.target.files[0]);
        });

        // Reset patterns
        document.getElementById('reset-patterns-btn').addEventListener('click', () => {
            this.resetPatterns();
        });

        // Real-time pattern testing
        document.getElementById('test-text').addEventListener('input', () => {
            this.realTimeTest();
        });

        document.getElementById('test-pattern-select').addEventListener('change', () => {
            this.realTimeTest();
        });
    }

    openModal() {
        document.getElementById('pattern-settings-modal').style.display = 'flex';
        this.refreshPatternLists();
        this.populateTestPatternSelect();
    }

    closeModal() {
        document.getElementById('pattern-settings-modal').style.display = 'none';
        this.hideAddPatternForm();
    }

    switchPatternTab(tabName) {
        // Update tab buttons
        document.querySelectorAll('.pattern-tab-btn').forEach(btn => {
            btn.classList.remove('active');
        });
        document.querySelector(`[data-tab="${tabName}"]`).classList.add('active');

        // Update content
        document.querySelectorAll('.pattern-tab-content').forEach(content => {
            content.classList.remove('active');
        });
        document.getElementById(`${tabName}-patterns-tab`).classList.add('active');

        // Load content based on tab
        if (tabName === 'default') {
            this.renderDefaultPatterns();
        } else if (tabName === 'custom') {
            this.renderCustomPatterns();
        } else if (tabName === 'test') {
            this.populateTestPatternSelect();
        }
    }

    refreshPatternLists() {
        this.renderDefaultPatterns();
        this.renderCustomPatterns();
    }

    renderDefaultPatterns() {
        const container = document.getElementById('default-patterns-list');
        container.innerHTML = '';

        const defaultPatterns = this.patternManager.defaultPatterns;
        
        Object.entries(defaultPatterns).forEach(([name, pattern]) => {
            const patternElement = this.createPatternElement(name, pattern, true);
            container.appendChild(patternElement);
        });
    }

    renderCustomPatterns() {
        const container = document.getElementById('custom-patterns-list');
        container.innerHTML = '';

        const userPatterns = this.patternManager.userPatterns;
        
        if (Object.keys(userPatterns).length === 0) {
            container.innerHTML = '<p class="text-muted">아직 사용자 정의 패턴이 없습니다.</p>';
            return;
        }

        Object.entries(userPatterns).forEach(([name, pattern]) => {
            const patternElement = this.createPatternElement(name, pattern, false);
            container.appendChild(patternElement);
        });
    }

    createPatternElement(name, pattern, isDefault) {
        const div = document.createElement('div');
        div.className = `pattern-item ${pattern.enabled ? 'enabled' : ''}`;
        
        div.innerHTML = `
            <div class="pattern-item-header">
                <div style="display: flex; align-items: center;">
                    <span class="pattern-name">${name}</span>
                    <div class="pattern-color" style="background-color: ${pattern.color}"></div>
                    <span class="pattern-category ${pattern.category}">${pattern.category}</span>
                </div>
                <div style="display: flex; align-items: center; gap: 0.5rem;">
                    <label class="toggle-switch">
                        <input type="checkbox" ${pattern.enabled ? 'checked' : ''} 
                               onchange="patternUI.togglePattern('${name}', this.checked)">
                        <span class="toggle-slider"></span>
                    </label>
                </div>
            </div>
            <div class="pattern-regex">${pattern.pattern}</div>
            <div class="pattern-description">${pattern.description}</div>
            <div class="pattern-actions">
                <button class="btn btn-sm btn-secondary" onclick="patternUI.editPattern('${name}')">
                    ${isDefault ? '수정' : '편집'}
                </button>
                ${!isDefault ? `<button class="btn btn-sm btn-danger" onclick="patternUI.deletePattern('${name}')">삭제</button>` : ''}
                <button class="btn btn-sm btn-primary" onclick="patternUI.testSinglePattern('${name}')">테스트</button>
            </div>
        `;

        return div;
    }

    showAddPatternForm() {
        document.getElementById('add-pattern-form').style.display = 'block';
        document.getElementById('new-pattern-name').focus();
    }

    hideAddPatternForm() {
        document.getElementById('add-pattern-form').style.display = 'none';
        this.clearAddPatternForm();
        this.currentEditingPattern = null;
    }

    clearAddPatternForm() {
        document.getElementById('new-pattern-name').value = '';
        document.getElementById('new-pattern-regex').value = '';
        document.getElementById('new-pattern-category').value = 'equipment';
        document.getElementById('new-pattern-color').value = '#808080';
        document.getElementById('new-pattern-description').value = '';
    }

    savePattern() {
        const name = document.getElementById('new-pattern-name').value.trim();
        const regex = document.getElementById('new-pattern-regex').value.trim();
        const category = document.getElementById('new-pattern-category').value;
        const color = document.getElementById('new-pattern-color').value;
        const description = document.getElementById('new-pattern-description').value.trim();

        if (!name || !regex) {
            alert('패턴 이름과 정규식은 필수입니다.');
            return;
        }

        try {
            const patternData = {
                pattern: regex,
                category: category,
                color: color,
                description: description,
                enabled: true
            };

            if (this.currentEditingPattern) {
                this.patternManager.updatePattern(this.currentEditingPattern, patternData);
            } else {
                this.patternManager.saveUserPattern(name, patternData);
            }

            this.hideAddPatternForm();
            this.refreshPatternLists();
            this.populateTestPatternSelect();
            
            // Refresh tag recognition in main app
            if (this.app.currentProject) {
                this.app.autoRecognizeTags();
            }

        } catch (error) {
            alert(`패턴 저장 실패: ${error.message}`);
        }
    }

    editPattern(name) {
        const patterns = { ...this.patternManager.defaultPatterns, ...this.patternManager.userPatterns };
        const pattern = patterns[name];
        
        if (!pattern) {
            alert('패턴을 찾을 수 없습니다.');
            return;
        }

        // Fill form with existing data
        document.getElementById('new-pattern-name').value = name;
        document.getElementById('new-pattern-regex').value = pattern.pattern;
        document.getElementById('new-pattern-category').value = pattern.category;
        document.getElementById('new-pattern-color').value = pattern.color;
        document.getElementById('new-pattern-description').value = pattern.description || '';

        // Disable name field for editing
        document.getElementById('new-pattern-name').disabled = true;
        
        this.currentEditingPattern = name;
        this.showAddPatternForm();
    }

    deletePattern(name) {
        if (confirm(`패턴 '${name}'을(를) 삭제하시겠습니까?`)) {
            this.patternManager.deleteUserPattern(name);
            this.refreshPatternLists();
            this.populateTestPatternSelect();
            
            // Refresh tag recognition in main app
            if (this.app.currentProject) {
                this.app.autoRecognizeTags();
            }
        }
    }

    togglePattern(name, enabled) {
        this.patternManager.togglePattern(name, enabled);
        this.refreshPatternLists();
        
        // Refresh tag recognition in main app
        if (this.app.currentProject) {
            this.app.autoRecognizeTags();
        }
    }

    populateTestPatternSelect() {
        const select = document.getElementById('test-pattern-select');
        select.innerHTML = '<option value="">패턴을 선택하세요</option>';

        const activePatterns = this.patternManager.getActivePatterns();
        Object.keys(activePatterns).forEach(name => {
            const option = document.createElement('option');
            option.value = name;
            option.textContent = `${name} (${activePatterns[name].category})`;
            select.appendChild(option);
        });
    }

    testPattern() {
        const text = document.getElementById('test-text').value.trim();
        const patternName = document.getElementById('test-pattern-select').value;

        if (!text || !patternName) {
            alert('테스트 텍스트와 패턴을 모두 선택해주세요.');
            return;
        }

        this.performPatternTest(text, patternName);
    }

    testSinglePattern(patternName) {
        // Switch to test tab
        this.switchPatternTab('test');
        
        // Select the pattern
        document.getElementById('test-pattern-select').value = patternName;
        
        // Test if there's text
        const text = document.getElementById('test-text').value.trim();
        if (text) {
            this.performPatternTest(text, patternName);
        }
    }

    performPatternTest(text, patternName) {
        const resultsContainer = document.getElementById('test-results');
        
        try {
            const activePatterns = this.patternManager.getActivePatterns();
            const pattern = activePatterns[patternName];
            
            if (!pattern) {
                throw new Error('패턴을 찾을 수 없습니다.');
            }

            const isMatch = this.patternManager.testPattern(pattern.pattern, text);
            
            resultsContainer.className = `test-results ${isMatch ? 'test-success' : 'test-failure'}`;
            resultsContainer.innerHTML = `
                <h6>테스트 결과</h6>
                <p><strong>텍스트:</strong> ${text}</p>
                <p><strong>패턴:</strong> ${pattern.pattern}</p>
                <p><strong>결과:</strong> ${isMatch ? '✅ 매칭됨' : '❌ 매칭되지 않음'}</p>
                <p><strong>카테고리:</strong> ${pattern.category}</p>
            `;
            
        } catch (error) {
            resultsContainer.className = 'test-results test-error';
            resultsContainer.innerHTML = `
                <h6>테스트 오류</h6>
                <p>${error.message}</p>
            `;
        }
    }

    realTimeTest() {
        const text = document.getElementById('test-text').value.trim();
        const patternName = document.getElementById('test-pattern-select').value;

        if (text && patternName) {
            this.performPatternTest(text, patternName);
        }
    }

    loadPatternSuggestions() {
        const suggestions = this.patternManager.getPatternSuggestions();
        const container = document.getElementById('pattern-suggestions-list');
        
        container.innerHTML = '';
        
        Object.entries(suggestions).forEach(([groupName, patterns]) => {
            const groupDiv = document.createElement('div');
            groupDiv.className = 'suggestion-group';
            
            const title = document.createElement('h6');
            title.textContent = groupName;
            groupDiv.appendChild(title);
            
            patterns.forEach(pattern => {
                const item = document.createElement('span');
                item.className = 'suggestion-item';
                item.textContent = pattern;
                item.onclick = () => {
                    document.getElementById('new-pattern-regex').value = pattern;
                };
                groupDiv.appendChild(item);
            });
            
            container.appendChild(groupDiv);
        });
    }

    exportPatterns() {
        try {
            const exportData = this.patternManager.exportPatterns();
            const dataStr = JSON.stringify(exportData, null, 2);
            const dataBlob = new Blob([dataStr], { type: 'application/json' });
            
            const link = document.createElement('a');
            link.href = URL.createObjectURL(dataBlob);
            link.download = `pid_patterns_${new Date().toISOString().split('T')[0]}.json`;
            link.click();
            
            URL.revokeObjectURL(link.href);
            
        } catch (error) {
            alert(`패턴 내보내기 실패: ${error.message}`);
        }
    }

    importPatterns(file) {
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const importData = JSON.parse(e.target.result);
                this.patternManager.importPatterns(importData);
                
                this.refreshPatternLists();
                this.populateTestPatternSelect();
                
                // Refresh tag recognition in main app
                if (this.app.currentProject) {
                    this.app.autoRecognizeTags();
                }
                
                alert('패턴을 성공적으로 가져왔습니다.');
                
            } catch (error) {
                alert(`패턴 가져오기 실패: ${error.message}`);
            }
        };
        
        reader.readAsText(file);
        
        // Reset file input
        document.getElementById('import-patterns-file').value = '';
    }

    resetPatterns() {
        if (confirm('모든 패턴을 기본값으로 초기화하시겠습니까? 사용자 정의 패턴은 모두 삭제됩니다.')) {
            this.patternManager.resetToDefaults();
            this.refreshPatternLists();
            this.populateTestPatternSelect();
            
            // Refresh tag recognition in main app
            if (this.app.currentProject) {
                this.app.autoRecognizeTags();
            }
            
            alert('패턴이 기본값으로 초기화되었습니다.');
        }
    }
}

// Global functions for HTML onclick handlers
window.patternUI = null;

window.openPatternModal = function() {
    if (window.patternUI) {
        window.patternUI.openModal();
    }
};

window.closePatternModal = function() {
    if (window.patternUI) {
        window.patternUI.closeModal();
    }
};