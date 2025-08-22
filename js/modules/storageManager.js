// Storage Manager - Handles local storage and project persistence
export class StorageManager {
    constructor() {
        this.storageKey = 'pid_tag_mapping_projects';
        this.autoSaveKey = 'pid_tag_mapping_autosave';
        this.settingsKey = 'pid_tag_mapping_settings';
        this.autoSaveInterval = 30000; // 30 seconds
        this.maxProjects = 50; // Maximum number of saved projects
        
        this.setupAutoSave();
    }

    // Save project to localStorage
    saveProject(project) {
        try {
            const projects = this.getAllProjects();
            
            // Add timestamp if not exists
            if (!project.saved) {
                project.saved = new Date().toISOString();
            }
            project.modified = new Date().toISOString();

            // Generate project ID if not exists
            if (!project.id) {
                project.id = this.generateProjectId();
            }

            // Add or update project
            const existingIndex = projects.findIndex(p => p.id === project.id);
            if (existingIndex >= 0) {
                projects[existingIndex] = project;
            } else {
                projects.unshift(project); // Add to beginning
            }

            // Limit number of projects
            if (projects.length > this.maxProjects) {
                projects.splice(this.maxProjects);
            }

            localStorage.setItem(this.storageKey, JSON.stringify(projects));
            console.log('프로젝트 저장 완료:', project.name);
            
            return project.id;
            
        } catch (error) {
            console.error('프로젝트 저장 실패:', error);
            throw new Error('프로젝트 저장에 실패했습니다. 브라우저 저장공간을 확인해주세요.');
        }
    }

    // Load all projects
    getAllProjects() {
        try {
            const stored = localStorage.getItem(this.storageKey);
            return stored ? JSON.parse(stored) : [];
        } catch (error) {
            console.error('프로젝트 목록 로딩 실패:', error);
            return [];
        }
    }

    // Load specific project by ID
    loadProjectById(projectId) {
        try {
            const projects = this.getAllProjects();
            return projects.find(p => p.id === projectId);
        } catch (error) {
            console.error('프로젝트 로딩 실패:', error);
            return null;
        }
    }

    // Delete project
    deleteProject(projectId) {
        try {
            const projects = this.getAllProjects();
            const filteredProjects = projects.filter(p => p.id !== projectId);
            localStorage.setItem(this.storageKey, JSON.stringify(filteredProjects));
            return true;
        } catch (error) {
            console.error('프로젝트 삭제 실패:', error);
            return false;
        }
    }

    // Load project with UI
    loadProject(callback) {
        const projects = this.getAllProjects();
        
        if (projects.length === 0) {
            alert('저장된 프로젝트가 없습니다.');
            return;
        }

        // Create project selection modal
        this.showProjectSelectionModal(projects, callback);
    }

    // Show project selection modal
    showProjectSelectionModal(projects, callback) {
        // Create modal HTML
        const modalHTML = `
            <div id="project-modal" class="modal-overlay">
                <div class="modal-content">
                    <div class="modal-header">
                        <h3>프로젝트 선택</h3>
                        <button class="modal-close" onclick="this.closest('.modal-overlay').remove()">&times;</button>
                    </div>
                    <div class="modal-body">
                        <div class="project-list">
                            ${projects.map((project, index) => `
                                <div class="project-item" data-project-id="${project.id}">
                                    <div class="project-info">
                                        <h4>${project.name}</h4>
                                        <p>태그: ${this.getProjectTagCount(project)} | 
                                           관계: ${this.getProjectRelationshipCount(project)}</p>
                                        <small>저장: ${new Date(project.saved || project.created).toLocaleString('ko-KR')}</small>
                                    </div>
                                    <div class="project-actions">
                                        <button class="btn btn-primary btn-sm" onclick="storageManager.selectProject('${project.id}', ${callback})">
                                            불러오기
                                        </button>
                                        <button class="btn btn-danger btn-sm" onclick="storageManager.deleteProjectFromModal('${project.id}')">
                                            삭제
                                        </button>
                                    </div>
                                </div>
                            `).join('')}
                        </div>
                    </div>
                </div>
            </div>
        `;

        // Add modal styles if not exists
        if (!document.getElementById('modal-styles')) {
            const styles = document.createElement('style');
            styles.id = 'modal-styles';
            styles.textContent = `
                .modal-overlay {
                    position: fixed;
                    top: 0;
                    left: 0;
                    right: 0;
                    bottom: 0;
                    background: rgba(0, 0, 0, 0.5);
                    display: flex;
                    justify-content: center;
                    align-items: center;
                    z-index: 1000;
                }
                .modal-content {
                    background: white;
                    border-radius: 8px;
                    width: 90%;
                    max-width: 600px;
                    max-height: 80vh;
                    overflow: hidden;
                    box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);
                }
                .modal-header {
                    padding: 1rem;
                    background: #f8f9fa;
                    border-bottom: 1px solid #dee2e6;
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                }
                .modal-close {
                    background: none;
                    border: none;
                    font-size: 1.5rem;
                    cursor: pointer;
                    color: #6c757d;
                }
                .modal-body {
                    padding: 1rem;
                    max-height: 60vh;
                    overflow-y: auto;
                }
                .project-item {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    padding: 1rem;
                    border: 1px solid #dee2e6;
                    border-radius: 4px;
                    margin-bottom: 0.5rem;
                }
                .project-info h4 {
                    margin: 0 0 0.5rem 0;
                    color: #2c3e50;
                }
                .project-info p {
                    margin: 0 0 0.25rem 0;
                    color: #6c757d;
                    font-size: 0.9rem;
                }
                .project-info small {
                    color: #6c757d;
                }
                .project-actions {
                    display: flex;
                    gap: 0.5rem;
                }
            `;
            document.head.appendChild(styles);
        }

        // Add modal to DOM
        document.body.insertAdjacentHTML('beforeend', modalHTML);

        // Store callback for later use
        window.projectSelectionCallback = callback;
    }

    // Select project from modal
    selectProject(projectId, callback) {
        const project = this.loadProjectById(projectId);
        if (project && callback) {
            callback(project);
        }
        document.getElementById('project-modal').remove();
    }

    // Delete project from modal
    deleteProjectFromModal(projectId) {
        if (confirm('이 프로젝트를 삭제하시겠습니까?')) {
            this.deleteProject(projectId);
            // Refresh modal
            document.getElementById('project-modal').remove();
            this.loadProject(window.projectSelectionCallback);
        }
    }

    // Auto-save functionality
    autoSave(project) {
        try {
            localStorage.setItem(this.autoSaveKey, JSON.stringify(project));
        } catch (error) {
            console.warn('자동 저장 실패:', error);
        }
    }

    // Load auto-saved project
    loadAutoSave() {
        try {
            const stored = localStorage.getItem(this.autoSaveKey);
            return stored ? JSON.parse(stored) : null;
        } catch (error) {
            console.error('자동 저장 데이터 로딩 실패:', error);
            return null;
        }
    }

    // Clear auto-save
    clearAutoSave() {
        localStorage.removeItem(this.autoSaveKey);
    }

    // Setup periodic auto-save
    setupAutoSave() {
        // This would be triggered by the main app
        // Implementation depends on app structure
    }

    // Generate unique project ID
    generateProjectId() {
        return `project_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }

    // Get project statistics
    getProjectTagCount(project) {
        if (!project.tags) return 0;
        return Object.values(project.tags).reduce((total, tags) => total + tags.length, 0);
    }

    getProjectRelationshipCount(project) {
        if (!project.relationships) return 0;
        return Object.values(project.relationships).reduce((total, rels) => total + rels.length, 0);
    }

    // Export project as JSON file
    exportProject(project) {
        try {
            const dataStr = JSON.stringify(project, null, 2);
            const dataBlob = new Blob([dataStr], { type: 'application/json' });
            
            const link = document.createElement('a');
            link.href = URL.createObjectURL(dataBlob);
            link.download = `${project.name}_${new Date().toISOString().split('T')[0]}.json`;
            link.click();
            
            URL.revokeObjectURL(link.href);
            
        } catch (error) {
            console.error('프로젝트 내보내기 실패:', error);
            alert('프로젝트 내보내기에 실패했습니다.');
        }
    }

    // Import project from JSON file
    importProject(file, callback) {
        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const project = JSON.parse(e.target.result);
                
                // Validate project structure
                if (this.validateProjectStructure(project)) {
                    // Generate new ID to avoid conflicts
                    project.id = this.generateProjectId();
                    project.imported = new Date().toISOString();
                    
                    // Save imported project
                    this.saveProject(project);
                    
                    if (callback) {
                        callback(project);
                    }
                    
                    alert('프로젝트를 성공적으로 가져왔습니다.');
                } else {
                    throw new Error('유효하지 않은 프로젝트 파일입니다.');
                }
                
            } catch (error) {
                console.error('프로젝트 가져오기 실패:', error);
                alert('프로젝트 파일을 읽을 수 없습니다. 파일 형식을 확인해주세요.');
            }
        };
        
        reader.readAsText(file);
    }

    // Validate project structure
    validateProjectStructure(project) {
        const required = ['name', 'tags', 'relationships'];
        const hasRequired = required.every(key => key in project);
        
        if (!hasRequired) return false;
        
        // Check tags structure
        const tagCategories = ['equipment', 'line', 'instrument'];
        const hasTagCategories = tagCategories.every(cat => 
            Array.isArray(project.tags[cat])
        );
        
        if (!hasTagCategories) return false;
        
        // Check relationships structure
        const relationshipTypes = ['connections', 'installations'];
        const hasRelationshipTypes = relationshipTypes.every(type =>
            Array.isArray(project.relationships[type])
        );
        
        return hasRelationshipTypes;
    }

    // Get storage usage information
    getStorageInfo() {
        try {
            const projects = this.getAllProjects();
            const projectsSize = new Blob([JSON.stringify(projects)]).size;
            const autoSaveSize = localStorage.getItem(this.autoSaveKey)?.length || 0;
            
            return {
                projectCount: projects.length,
                projectsSize: projectsSize,
                autoSaveSize: autoSaveSize,
                totalSize: projectsSize + autoSaveSize,
                maxProjects: this.maxProjects
            };
        } catch (error) {
            console.error('저장공간 정보 조회 실패:', error);
            return null;
        }
    }

    // Clear all stored data
    clearAllData() {
        try {
            localStorage.removeItem(this.storageKey);
            localStorage.removeItem(this.autoSaveKey);
            localStorage.removeItem(this.settingsKey);
            
            // Also clear pattern data if exists
            localStorage.removeItem('pid_tag_patterns');
            localStorage.removeItem('pid_custom_patterns');
            
            console.log('모든 저장 데이터 초기화 완료');
            return true;
        } catch (error) {
            console.error('데이터 초기화 실패:', error);
            return false;
        }
    }

    // Save user settings
    saveSettings(settings) {
        try {
            localStorage.setItem(this.settingsKey, JSON.stringify(settings));
        } catch (error) {
            console.error('설정 저장 실패:', error);
        }
    }

    // Load user settings
    loadSettings() {
        try {
            const stored = localStorage.getItem(this.settingsKey);
            return stored ? JSON.parse(stored) : this.getDefaultSettings();
        } catch (error) {
            console.error('설정 로딩 실패:', error);
            return this.getDefaultSettings();
        }
    }

    // Get default settings
    getDefaultSettings() {
        return {
            autoSave: true,
            autoSaveInterval: 30000,
            defaultZoom: 1.0,
            showRelationshipHints: true,
            exportFormat: 'xlsx'
        };
    }
}

// Make storage manager globally available for modal callbacks
window.storageManager = new StorageManager();