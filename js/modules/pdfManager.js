/**
 * PDF 관리자 클래스 - PDF 파일의 로딩, 렌더링, 텍스트 추출을 담당합니다
 * 
 * 이 클래스는 PDF.js 라이브러리를 사용하여 PDF 파일을 브라우저에서 처리하고,
 * 사용자가 PDF를 보고 상호작용할 수 있도록 지원합니다.
 * 
 * 주요 기능:
 * - PDF 파일 로딩 및 렌더링
 * - 페이지 네비게이션 (이전/다음 페이지)
 * - 확대/축소 및 화면 맞춤 기능
 * - 텍스트 추출 (위치 정보 포함)
 * - 태그 하이라이트 오버레이 기능
 * - 다중 선택 인터랙션 (드래그 및 Ctrl+클릭)
 */
export class PDFManager {
    constructor() {
        // PDF 문서 및 렌더링 관련 속성들
        this.currentPDF = null;          // 현재 로드된 PDF 문서 객체
        this.currentPage = 1;            // 현재 보여지는 페이지 번호
        this.scale = 1.0;                // 현재 확대/축소 비율
        this.canvas = document.getElementById('pdf-canvas');    // PDF를 그릴 Canvas 요소
        this.ctx = this.canvas.getContext('2d');               // Canvas 2D 렌더링 컨텍스트
        this.maxScale = 3.0;             // 최대 확대 비율 (300%)
        this.minScale = 0.3;             // 최소 축소 비율 (30%)
        
        // 다중 선택 기능 관련 속성들
        this.selectedTags = new Set();   // 선택된 태그 ID들을 저장하는 Set 객체
        this.isSelecting = false;        // 현재 드래그 선택 중인지 여부
        this.selectionStart = null;      // 드래그 선택 시작 좌표
        this.selectionRect = null;       // 드래그 선택 영역 사각형 정보
        
        // PDF.js 웹 워커 설정 - PDF 처리를 별도 스레드에서 수행하여 메인 스레드 블록을 방지
        pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.0.379/pdf.worker.min.mjs';
        
        // 다중 선택 이벤트 핸들러 설정 - 마우스 드래그 및 키보드 조합 이벤트 처리
        this.setupMultiSelectionHandlers();
    }

    /**
     * PDF 파일 로딩 메서드
     * 업로드된 PDF 파일을 브라우저에서 읽고 파싱합니다
     * 
     * @param {File} file - 업로드된 PDF 파일 객체
     */
    async loadPDF(file) {
        try {
            // 파일을 ArrayBuffer로 변환 - PDF.js가 요구하는 데이터 형식
            const arrayBuffer = await file.arrayBuffer();
            
            // PDF.js를 사용하여 PDF 문서 객체 생성
            this.currentPDF = await pdfjsLib.getDocument(arrayBuffer).promise;
            
            // 초기 설정으로 리셋
            this.currentPage = 1;        // 첫 번째 페이지부터 시작
            this.scale = 1.0;            // 100% 크기로 시작
            
            // 첫 번째 페이지 렌더링
            await this.renderPage();
            
            // 페이지 정보 및 UI 컨트롤 업데이트
            this.updatePageInfo();
            this.updateControls();
            
            console.log('PDF 로딩 완료:', {
                pages: this.currentPDF.numPages,    // 전체 페이지 수
                title: file.name                    // 파일명
            });
            
        } catch (error) {
            console.error('PDF 로딩 실패:', error);
            throw error;    // 에러를 호출자에게 전파
        }
    }

    /**
     * 현재 페이지 렌더링 메서드
     * 선택된 페이지를 Canvas에 그립니다
     */
    async renderPage() {
        if (!this.currentPDF) return;    // PDF가 로드되지 않았다면 종료

        try {
            // 현재 페이지의 PDF 페이지 객체 가져오기
            const page = await this.currentPDF.getPage(this.currentPage);
            
            // 현재 scale에 맞는 viewport(보이는 영역) 계산
            const viewport = page.getViewport({ scale: this.scale });
            
            // Canvas 크기를 viewport 크기에 맞게 설정
            this.canvas.width = viewport.width;
            this.canvas.height = viewport.height;
            
            // 태그 하이라이트용 오버레이 크기도 Canvas와 동일하게 설정
            const overlay = document.getElementById('pdf-overlay');
            overlay.style.width = viewport.width + 'px';
            overlay.style.height = viewport.height + 'px';
            
            // 이전 내용을 지우고 깨끗한 상태로 만듦기
            this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
            
            // PDF 페이지 렌더링 컨텍스트 설정
            const renderContext = {
                canvasContext: this.ctx,    // Canvas 2D 컨텍스트
                viewport: viewport          // 보이는 영역 정보
            };
            
            // 실제 PDF 페이지를 Canvas에 그리기 (비동기 처리)
            await page.render(renderContext).promise;
            
            // 현재 확대/축소 비율을 UI에 표시
            document.getElementById('zoom-level').textContent = `${Math.round(this.scale * 100)}%`;
            
            // 페이지 렌더링 완료를 다른 모듈에 알림 (태그 하이라이트 업데이트용)
            if (this.onPageRendered) {
                this.onPageRendered();
            }
            
        } catch (error) {
            console.error('페이지 렌더링 실패:', error);
            throw error;
        }
    }

    /**
     * PDF에서 모든 텍스트를 추출하는 메서드
     * 위치 정보 없이 순수한 텍스트만 추출합니다 (단순 텍스트 검색용)
     * 
     * @returns {string} 모든 페이지의 텍스트를 결합한 문자열
     */
    async extractText() {
        if (!this.currentPDF) {
            throw new Error('PDF가 로드되지 않았습니다.');
        }

        let allText = '';  // 전체 텍스트를 담을 변수
        
        try {
            // 모든 페이지를 순회하면서 텍스트 추출
            for (let pageNum = 1; pageNum <= this.currentPDF.numPages; pageNum++) {
                const page = await this.currentPDF.getPage(pageNum);
                const textContent = await page.getTextContent();
                
                // 페이지의 모든 텍스트 아이템들을 문자열로 변환하고 공백으로 연결
                const pageText = textContent.items
                    .map(item => item.str)    // 각 텍스트 아이템의 문자열 부분만 추출
                    .join(' ');               // 공백으로 연결
                
                allText += pageText + '\n';   // 페이지별로 줄바꿈 추가
            }
            
            return allText;
            
        } catch (error) {
            console.error('텍스트 추출 실패:', error);
            throw error;
        }
    }

    /**
     * PDF에서 위치 정보가 포함된 텍스트를 추출하는 메서드
     * 태그 인식과 공간 분석에 필요한 정확한 위치 정보를 제공합니다
     * 
     * @returns {Array} 각 텍스트 항목의 내용과 위치 정보를 포함한 객체 배열
     */
    async extractTextWithPositions() {
        if (!this.currentPDF) {
            throw new Error('PDF가 로드되지 않았습니다.');
        }

        const textWithPositions = [];  // 위치 정보가 포함된 텍스트 배열
        
        try {
            // 모든 페이지를 순회하면서 텍스트와 위치 정보를 함께 추출
            for (let pageNum = 1; pageNum <= this.currentPDF.numPages; pageNum++) {
                const page = await this.currentPDF.getPage(pageNum);
                const textContent = await page.getTextContent();        // 텍스트 내용 추출
                const viewport = page.getViewport({ scale: 1.0 });      // 기본 스케일로 뷰포트 계산
                
                // 각 텍스트 아이템을 처리
                textContent.items.forEach(item => {
                    if (item.str && item.str.trim()) {  // 빈 문자열이 아닌 경우만 처리
                        // PDF 좌표계에서 텍스트의 정확한 위치와 크기를 계산
                        // PDF.js는 PDF 좌표계를 사용하며, 이를 화면 좌표계로 변환해야 함
                        const transform = item.transform;                      // PDF 변환 행렬
                        const x = transform[4];                               // X 좌표
                        const y = viewport.height - transform[5];             // Y 좌표 (상하 반전)
                        const width = item.width;                             // 텍스트 폭
                        const height = item.height;                           // 텍스트 높이
                        
                        textWithPositions.push({
                            text: item.str.trim(),
                            x: x,
                            y: y,
                            width: width,
                            height: height,
                            page: pageNum,
                            bbox: [x, y, x + width, y + height] // [x1, y1, x2, y2]
                        });
                    }
                });
            }
            
            return textWithPositions;
            
        } catch (error) {
            console.error('위치 정보 포함 텍스트 추출 실패:', error);
            throw error;
        }
    }


    zoomIn() {
        if (this.scale < this.maxScale) {
            this.scale += 0.2;
            this.renderPage();
            // 하이라이트 위치 업데이트
            if (this.onPageRendered) {
                this.onPageRendered();
            }
        }
    }

    zoomOut() {
        if (this.scale > this.minScale) {
            this.scale -= 0.2;
            this.renderPage();
            // 하이라이트 위치 업데이트
            if (this.onPageRendered) {
                this.onPageRendered();
            }
        }
    }

    fitToScreen() {
        if (!this.currentPDF) return;
        
        const container = document.querySelector('.pdf-viewer-container');
        const containerWidth = container.clientWidth - 40; // padding
        const containerHeight = container.clientHeight - 40;
        
        this.currentPDF.getPage(this.currentPage).then(page => {
            const viewport = page.getViewport({ scale: 1.0 });
            
            const scaleX = containerWidth / viewport.width;
            const scaleY = containerHeight / viewport.height;
            
            this.scale = Math.min(scaleX, scaleY);
            this.renderPage();
            // 하이라이트 위치 업데이트
            if (this.onPageRendered) {
                this.onPageRendered();
            }
        });
    }

    nextPage() {
        if (!this.currentPDF) return;
        
        if (this.currentPage < this.currentPDF.numPages) {
            this.currentPage++;
            this.renderPage();
            this.updatePageInfo();
        }
    }

    previousPage() {
        if (!this.currentPDF) return;
        
        if (this.currentPage > 1) {
            this.currentPage--;
            this.renderPage();
            this.updatePageInfo();
        }
    }

    goToPage(pageNum) {
        if (!this.currentPDF) return;
        
        if (pageNum >= 1 && pageNum <= this.currentPDF.numPages) {
            this.currentPage = pageNum;
            this.renderPage();
            this.updatePageInfo();
        }
    }

    updatePageInfo() {
        if (this.currentPDF) {
            document.getElementById('page-info').textContent = 
                `${this.currentPage} / ${this.currentPDF.numPages}`;
        }
    }

    updateControls() {
        const prevBtn = document.getElementById('prev-page');
        const nextBtn = document.getElementById('next-page');
        
        if (this.currentPDF) {
            prevBtn.disabled = this.currentPage <= 1;
            nextBtn.disabled = this.currentPage >= this.currentPDF.numPages;
        } else {
            prevBtn.disabled = true;
            nextBtn.disabled = true;
        }
    }

    // Convert canvas coordinates to PDF coordinates
    canvasToPDF(canvasX, canvasY) {
        if (!this.currentPDF) return null;
        
        return {
            x: canvasX / this.scale,
            y: (this.canvas.height - canvasY) / this.scale
        };
    }

    // Convert PDF coordinates to canvas coordinates
    pdfToCanvas(pdfX, pdfY) {
        if (!this.currentPDF) return null;
        
        return {
            x: pdfX * this.scale,
            y: this.canvas.height - (pdfY * this.scale)
        };
    }

    // Highlight text area on canvas
    highlightArea(x, y, width, height, color = 'rgba(255, 255, 0, 0.3)') {
        const canvasCoords = this.pdfToCanvas(x, y);
        if (!canvasCoords) return;
        
        this.ctx.save();
        this.ctx.fillStyle = color;
        this.ctx.fillRect(
            canvasCoords.x,
            canvasCoords.y - height * this.scale,
            width * this.scale,
            height * this.scale
        );
        this.ctx.restore();
    }

    // Clear all highlights and re-render
    clearHighlights() {
        this.clearOverlay();
        this.renderPage();
    }

    // Add overlay management methods
    clearOverlay() {
        const overlay = document.getElementById('pdf-overlay');
        overlay.innerHTML = '';
    }

    // Add highlight overlay on PDF
    addTagHighlight(tag, color = null) {
        if (!tag.position || !this.currentPDF) {
            console.log('라이트 실패 - 위치 정보 없음:', tag.name, tag.category, !!tag.position);
            return;
        }

        const { x, y, width, height, page } = tag.position;
        
        // Only show highlights for current page
        if (page !== this.currentPage) {
            console.log('하이라이트 스킵 - 다른 페이지:', tag.name, tag.category, 'tag page:', page, 'current page:', this.currentPage);
            return;
        }

        console.log('하이라이트 추가 시도:', tag.name, tag.category, tag.position);

        const overlay = document.getElementById('pdf-overlay');
        const canvas = document.getElementById('pdf-canvas');
        
        // Calculate scaled position with expanded area for better visibility
        // Line tags get more padding for better visibility
        const padding = tag.category === 'line' ? 4 : 2;
        const scaledX = (x - padding) * this.scale;
        const scaledY = (y - padding) * this.scale;
        const scaledWidth = (width + padding * 2) * this.scale;
        const scaledHeight = (height + padding * 2) * this.scale;
        
        // Minimum height for line tags to ensure visibility
        const minHeight = tag.category === 'line' ? 20 : 0;
        const finalHeight = Math.max(scaledHeight, minHeight);
        
        // Create highlight element
        const highlight = document.createElement('div');
        highlight.className = 'tag-highlight';
        highlight.dataset.tagId = tag.id;
        highlight.dataset.tagCategory = tag.category;
        
        // Determine highlight color and style based on tag category
        const highlightColor = color || tag.patternColor || this.getCategoryColor(tag.category);
        
        // Special styling for line tags - make them MUCH more visible
        const isLine = tag.category === 'line';
        
        // Standard styling for all tags
        highlight.style.cssText = `
            position: absolute;
            left: ${scaledX}px;
            top: ${scaledY}px;
            width: ${scaledWidth}px;
            height: ${finalHeight}px;
            background-color: ${highlightColor};
            opacity: 0.4;
            border: 3px solid ${highlightColor};
            border-radius: 6px;
            pointer-events: auto;
            cursor: pointer;
            z-index: 10;
            transition: all 0.2s ease;
            box-shadow: 0 0 8px rgba(0,0,0,0.3);
        `;
        
        // Click events are now handled by the multi-selection system
        // in setupMultiSelectionHandlers() method
        
        // Create label text - use name directly (already includes function for instruments)
        let labelText = tag.name;
        
        // Add tag name label with improved visibility
        const label = document.createElement('div');
        label.className = 'tag-label';
        label.textContent = labelText;
        label.style.cssText = `
            position: absolute;
            top: -28px;
            left: 50%;
            transform: translateX(-50%);
            background: ${highlightColor};
            color: white;
            padding: 4px 8px;
            border-radius: 4px;
            font-size: 11px;
            font-weight: bold;
            white-space: nowrap;
            box-shadow: 0 3px 8px rgba(0,0,0,0.4);
            border: 1px solid rgba(255,255,255,0.3);
            z-index: 12;
        `;
        
        // Add arrow pointing to the tag
        const arrow = document.createElement('div');
        arrow.className = 'tag-arrow';
        arrow.style.cssText = `
            position: absolute;
            top: -6px;
            left: 50%;
            transform: translateX(-50%);
            width: 0;
            height: 0;
            border-left: 6px solid transparent;
            border-right: 6px solid transparent;
            border-top: 6px solid ${highlightColor};
            z-index: 11;
        `;
        
        label.appendChild(arrow);
        highlight.appendChild(label);
        overlay.appendChild(highlight);
    }

    // Highlight selected tag (legacy single selection support)
    highlightSelectedTag(tagId) {
        // Clear multi-selections and use single selection mode
        this.clearAllSelections();
        this.selectedTags.clear();
        
        // Remove previous single selection highlights
        document.querySelectorAll('.tag-highlight.selected').forEach(el => {
            el.classList.remove('selected');
            this.restoreDefaultTagStyle(el);
        });
        
        // If tagId is null, just clear highlights
        if (!tagId) return;
        
        // Highlight selected tag with enhanced visibility
        const highlights = document.querySelectorAll('.tag-highlight');
        let highlight = null;
        for (const el of highlights) {
            if (el.dataset.tagId === tagId) {
                highlight = el;
                break;
            }
        }
        if (highlight) {
            highlight.classList.add('selected');
            this.applySingleSelectionStyle(highlight);
            
            // Also add to multi-selection set for consistency
            this.selectedTags.add(tagId);
        }
    }

    // Restore default tag styling
    restoreDefaultTagStyle(element) {
        const category = element.dataset.tagCategory;
        
        // Reset all style properties
        element.style.opacity = '';
        element.style.boxShadow = '';
        element.style.borderWidth = '';
        element.style.transform = '';
        element.style.animation = '';
        element.style.zIndex = '';
        element.style.background = '';
        element.style.backgroundColor = '';
        element.style.backgroundSize = '';
        element.style.borderImage = '';
        element.style.borderStyle = '';
        element.style.borderColor = '';
        element.style.outline = '';
        element.style.outlineOffset = '';
        element.style.filter = '';
        
        // Apply default styling
        const originalColor = this.getCategoryColor(category);
        element.style.opacity = '0.4';
        element.style.backgroundColor = originalColor;
        element.style.border = `3px solid ${originalColor}`;
        element.style.borderRadius = '6px';
        element.style.boxShadow = '0 0 8px rgba(0,0,0,0.3)';
        element.style.zIndex = '10';
        
        // Reset label styling
        const label = element.querySelector('.tag-label');
        if (label) {
            label.style.backgroundColor = originalColor;
            label.style.fontSize = '11px';
            label.style.padding = '4px 8px';
            label.style.fontWeight = 'bold';
            label.style.textShadow = '1px 1px 2px rgba(0,0,0,0.5)';
            label.style.border = '1px solid rgba(255,255,255,0.3)';
            label.style.borderRadius = '4px';
            label.style.color = 'white';
            label.style.animation = 'none';
            label.style.zIndex = '12';
            label.style.boxShadow = '0 3px 8px rgba(0,0,0,0.4)';
            label.style.transform = 'translateX(-50%)';
        }
    }

    // Apply single selection styling
    applySingleSelectionStyle(element) {
        element.style.opacity = '0.8';
        element.style.boxShadow = '0 0 20px rgba(255, 255, 255, 1), 0 0 40px rgba(255, 255, 255, 0.5)';
        element.style.borderWidth = '4px';
        element.style.transform = 'scale(1.1)';
        
        // Make the label more prominent for selected tag
        const label = element.querySelector('.tag-label');
        if (label) {
            label.style.backgroundColor = '#ff4444';
            label.style.fontSize = '12px';
            label.style.padding = '6px 10px';
            label.style.fontWeight = '900';
            label.style.textShadow = '1px 1px 2px rgba(0,0,0,0.5)';
            label.style.border = '2px solid #fff';
        }
    }

    // Get default color for category
    getCategoryColor(category) {
        const colors = {
            equipment: '#28a745',  // Green
            line: '#ffc107',       // Yellow
            instrument: '#007bff'  // Blue
        };
        return colors[category] || '#6c757d';
    }

    // Update overlay when page changes
    updateTagHighlights(allTags) {
        this.clearOverlay();
        
        // Show highlights for current page only
        Object.values(allTags).flat().forEach(tag => {
            if (tag.position && tag.position.page === this.currentPage) {
                this.addTagHighlight(tag);
            }
        });
    }

    // Refresh highlights when scale changes
    refreshHighlights(allTags) {
        if (allTags) {
            this.updateTagHighlights(allTags);
        }
    }

    // Setup multi-selection event handlers
    setupMultiSelectionHandlers() {
        const overlay = document.getElementById('pdf-overlay');
        
        // Mouse down - start selection or handle click
        overlay.addEventListener('mousedown', (e) => {
            this.handleMouseDown(e);
        });
        
        // Mouse move - update selection rectangle
        overlay.addEventListener('mousemove', (e) => {
            this.handleMouseMove(e);
        });
        
        // Mouse up - complete selection
        overlay.addEventListener('mouseup', (e) => {
            this.handleMouseUp(e);
        });
        
        // Prevent context menu
        overlay.addEventListener('contextmenu', (e) => {
            e.preventDefault();
        });
    }

    // Handle mouse down event
    handleMouseDown(e) {
        e.preventDefault();
        
        // Check if clicking on a tag highlight
        const clickedTag = e.target.closest('.tag-highlight');
        
        if (clickedTag) {
            // Handle tag click
            this.handleTagClick(clickedTag, e.ctrlKey || e.metaKey);
        } else {
            // Start drag selection (only if not holding Ctrl)
            if (!e.ctrlKey && !e.metaKey) {
                this.startDragSelection(e);
            }
        }
    }

    // Handle mouse move event
    handleMouseMove(e) {
        if (this.isSelecting) {
            this.updateDragSelection(e);
        }
    }

    // Handle mouse up event
    handleMouseUp(e) {
        if (this.isSelecting) {
            this.completeDragSelection(e);
        }
    }

    // Handle tag click with multi-selection support
    handleTagClick(tagElement, isCtrlClick) {
        const tagId = tagElement.dataset.tagId;
        const tagCategory = tagElement.dataset.tagCategory;
        
        if (isCtrlClick) {
            // Ctrl+click: toggle selection - use multi-selection system
            if (this.selectedTags.has(tagId)) {
                this.selectedTags.delete(tagId);
                this.removeTagSelection(tagElement);
            } else {
                this.selectedTags.add(tagId);
                this.addTagSelection(tagElement);
            }
            
            // Notify app of multi-selection change
            if (this.onMultipleTagsSelected) {
                this.onMultipleTagsSelected(Array.from(this.selectedTags), [tagCategory]);
            }
        } else {
            // Regular click: single selection - use legacy system
            this.clearAllSelections();
            this.selectedTags.clear();
            this.selectedTags.add(tagId);
            
            // Use legacy single selection callback for better compatibility
            if (this.onHighlightClick) {
                this.onHighlightClick(tagId, tagCategory);
            }
        }
    }

    // Start drag selection
    startDragSelection(e) {
        this.isSelecting = true;
        this.selectionStart = this.getMousePosition(e);
        
        // Clear existing selections if not holding Ctrl
        this.clearAllSelections();
        this.selectedTags.clear();
        
        // Create selection rectangle element
        this.createSelectionRectangle();
    }

    // Update drag selection
    updateDragSelection(e) {
        if (!this.isSelecting || !this.selectionStart) return;
        
        const currentPos = this.getMousePosition(e);
        const rect = {
            x: Math.min(this.selectionStart.x, currentPos.x),
            y: Math.min(this.selectionStart.y, currentPos.y),
            width: Math.abs(currentPos.x - this.selectionStart.x),
            height: Math.abs(currentPos.y - this.selectionStart.y)
        };
        
        this.updateSelectionRectangle(rect);
    }

    // Complete drag selection
    completeDragSelection(e) {
        if (!this.isSelecting) return;
        
        const currentPos = this.getMousePosition(e);
        const selectionRect = {
            x: Math.min(this.selectionStart.x, currentPos.x),
            y: Math.min(this.selectionStart.y, currentPos.y),
            width: Math.abs(currentPos.x - this.selectionStart.x),
            height: Math.abs(currentPos.y - this.selectionStart.y)
        };
        
        // Find tags within selection rectangle
        this.selectTagsInRectangle(selectionRect);
        
        // Clean up
        this.removeSelectionRectangle();
        this.isSelecting = false;
        this.selectionStart = null;
    }

    // Get mouse position relative to overlay
    getMousePosition(e) {
        const overlay = document.getElementById('pdf-overlay');
        const rect = overlay.getBoundingClientRect();
        return {
            x: e.clientX - rect.left,
            y: e.clientY - rect.top
        };
    }

    // Create selection rectangle element
    createSelectionRectangle() {
        this.selectionRect = document.createElement('div');
        this.selectionRect.className = 'selection-rectangle';
        this.selectionRect.style.cssText = `
            position: absolute;
            border: 2px dashed #007bff;
            background: rgba(0, 123, 255, 0.1);
            pointer-events: none;
            z-index: 1000;
            display: none;
        `;
        document.getElementById('pdf-overlay').appendChild(this.selectionRect);
    }

    // Update selection rectangle
    updateSelectionRectangle(rect) {
        if (!this.selectionRect) return;
        
        this.selectionRect.style.left = rect.x + 'px';
        this.selectionRect.style.top = rect.y + 'px';
        this.selectionRect.style.width = rect.width + 'px';
        this.selectionRect.style.height = rect.height + 'px';
        this.selectionRect.style.display = 'block';
    }

    // Remove selection rectangle
    removeSelectionRectangle() {
        if (this.selectionRect) {
            this.selectionRect.remove();
            this.selectionRect = null;
        }
    }

    // Select tags within rectangle
    selectTagsInRectangle(rect) {
        const highlights = document.querySelectorAll('.tag-highlight');
        const selectedCategories = new Set();
        
        highlights.forEach(highlight => {
            const highlightRect = highlight.getBoundingClientRect();
            const overlayRect = document.getElementById('pdf-overlay').getBoundingClientRect();
            
            // Convert to overlay coordinates
            const tagRect = {
                x: highlightRect.left - overlayRect.left,
                y: highlightRect.top - overlayRect.top,
                width: highlightRect.width,
                height: highlightRect.height
            };
            
            // Check if tag intersects with selection rectangle
            if (this.rectanglesIntersect(rect, tagRect)) {
                const tagId = highlight.dataset.tagId;
                const tagCategory = highlight.dataset.tagCategory;
                
                this.selectedTags.add(tagId);
                selectedCategories.add(tagCategory);
                this.addTagSelection(highlight);
            }
        });
        
        // Notify app of selection change
        if (this.onMultipleTagsSelected && this.selectedTags.size > 0) {
            this.onMultipleTagsSelected(Array.from(this.selectedTags), Array.from(selectedCategories));
        }
    }

    // Check if two rectangles intersect
    rectanglesIntersect(rect1, rect2) {
        return !(rect1.x + rect1.width < rect2.x || 
                rect2.x + rect2.width < rect1.x || 
                rect1.y + rect1.height < rect2.y || 
                rect2.y + rect2.height < rect1.y);
    }

    // Add visual selection to tag
    addTagSelection(tagElement) {
        console.log('다중 선택 시각적 효과 적용 시작:', tagElement.dataset.tagId, tagElement);
        
        tagElement.classList.add('multi-selected');
        
        // Force apply strong visual feedback with !important equivalent inline styles
        tagElement.style.setProperty('opacity', '0.9', 'important');
        tagElement.style.setProperty('box-shadow', '0 0 30px rgba(255, 0, 0, 1), 0 0 60px rgba(255, 0, 0, 0.8), 0 0 15px rgba(255, 255, 255, 1)', 'important');
        tagElement.style.setProperty('border-color', '#ff0000', 'important');
        tagElement.style.setProperty('border-width', '5px', 'important');
        tagElement.style.setProperty('border-style', 'solid', 'important');
        tagElement.style.setProperty('transform', 'scale(1.15)', 'important');
        tagElement.style.setProperty('z-index', '20', 'important');
        tagElement.style.setProperty('animation', 'multiSelectPulse 1.2s ease-in-out infinite', 'important');
        
        // Force background color for extra visibility
        const category = tagElement.dataset.tagCategory;
        if (category === 'line') {
            tagElement.style.setProperty('background', 'linear-gradient(45deg, #ff0000, #ff4444, #ff6666)', 'important');
        } else {
            tagElement.style.setProperty('background-color', 'rgba(255, 0, 0, 0.3)', 'important');
        }
        
        // Also enhance the label for multi-selected tags
        const label = tagElement.querySelector('.tag-label');
        if (label) {
            label.style.setProperty('background-color', '#ff0000', 'important');
            label.style.setProperty('font-size', '13px', 'important');
            label.style.setProperty('padding', '8px 12px', 'important');
            label.style.setProperty('font-weight', '900', 'important');
            label.style.setProperty('border', '3px solid #fff', 'important');
            label.style.setProperty('box-shadow', '0 6px 15px rgba(255, 0, 0, 0.8)', 'important');
            label.style.setProperty('animation', 'labelBlink 1.2s ease-in-out infinite', 'important');
        }
        
        console.log('다중 선택 시각적 효과 적용 완료. 현재 스타일:', {
            opacity: tagElement.style.opacity,
            borderColor: tagElement.style.borderColor,
            borderWidth: tagElement.style.borderWidth,
            transform: tagElement.style.transform,
            boxShadow: tagElement.style.boxShadow
        });
    }

    // Remove visual selection from tag
    removeTagSelection(tagElement) {
        tagElement.classList.remove('multi-selected');
        // Restore default tag styling completely
        this.restoreDefaultTagStyle(tagElement);
        
        console.log('다중 선택 시각적 효과 제거:', tagElement.dataset.tagId);
    }

    // Clear all selections
    clearAllSelections() {
        document.querySelectorAll('.tag-highlight.multi-selected').forEach(element => {
            this.removeTagSelection(element);
        });
    }

    // Get selected tags
    getSelectedTags() {
        return Array.from(this.selectedTags);
    }

    // Clear selections
    clearSelections() {
        this.clearAllSelections();
        this.selectedTags.clear();
    }
}