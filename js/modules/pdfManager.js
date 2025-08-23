// PDF Manager - Handles PDF loading, rendering, and text extraction
export class PDFManager {
    constructor() {
        this.currentPDF = null;
        this.currentPage = 1;
        this.scale = 1.0;
        this.canvas = document.getElementById('pdf-canvas');
        this.ctx = this.canvas.getContext('2d');
        this.maxScale = 3.0;
        this.minScale = 0.3;
        
        // Multi-selection properties
        this.selectedTags = new Set(); // Store multiple selected tag IDs
        this.isSelecting = false;
        this.selectionStart = null;
        this.selectionRect = null;
        
        // Configure PDF.js worker
        pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.0.379/pdf.worker.min.mjs';
        
        // Setup multi-selection event handlers
        this.setupMultiSelectionHandlers();
    }

    async loadPDF(file) {
        try {
            const arrayBuffer = await file.arrayBuffer();
            this.currentPDF = await pdfjsLib.getDocument(arrayBuffer).promise;
            this.currentPage = 1;
            this.scale = 1.0;
            
            await this.renderPage();
            this.updatePageInfo();
            this.updateControls();
            
            console.log('PDF 로딩 완료:', {
                pages: this.currentPDF.numPages,
                title: file.name
            });
            
        } catch (error) {
            console.error('PDF 로딩 실패:', error);
            throw error;
        }
    }

    async renderPage() {
        if (!this.currentPDF) return;

        try {
            const page = await this.currentPDF.getPage(this.currentPage);
            const viewport = page.getViewport({ scale: this.scale });
            
            // Set canvas dimensions
            this.canvas.width = viewport.width;
            this.canvas.height = viewport.height;
            
            // Update overlay size to match canvas
            const overlay = document.getElementById('pdf-overlay');
            overlay.style.width = viewport.width + 'px';
            overlay.style.height = viewport.height + 'px';
            
            // Clear canvas
            this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
            
            // Render page
            const renderContext = {
                canvasContext: this.ctx,
                viewport: viewport
            };
            
            await page.render(renderContext).promise;
            
            // Update zoom level display
            document.getElementById('zoom-level').textContent = `${Math.round(this.scale * 100)}%`;
            
            // Notify that page has been rendered (for tag highlights)
            if (this.onPageRendered) {
                this.onPageRendered();
            }
            
        } catch (error) {
            console.error('페이지 렌더링 실패:', error);
            throw error;
        }
    }

    async extractText() {
        if (!this.currentPDF) {
            throw new Error('PDF가 로드되지 않았습니다.');
        }

        let allText = '';
        
        try {
            for (let pageNum = 1; pageNum <= this.currentPDF.numPages; pageNum++) {
                const page = await this.currentPDF.getPage(pageNum);
                const textContent = await page.getTextContent();
                
                // Extract text items
                const pageText = textContent.items
                    .map(item => item.str)
                    .join(' ');
                
                allText += pageText + '\n';
            }
            
            return allText;
            
        } catch (error) {
            console.error('텍스트 추출 실패:', error);
            throw error;
        }
    }

    async extractTextWithPositions() {
        if (!this.currentPDF) {
            throw new Error('PDF가 로드되지 않았습니다.');
        }

        const textWithPositions = [];
        
        try {
            for (let pageNum = 1; pageNum <= this.currentPDF.numPages; pageNum++) {
                const page = await this.currentPDF.getPage(pageNum);
                const textContent = await page.getTextContent();
                const viewport = page.getViewport({ scale: 1.0 });
                
                textContent.items.forEach(item => {
                    if (item.str && item.str.trim()) {
                        // Get text position and dimensions
                        const transform = item.transform;
                        const x = transform[4];
                        const y = viewport.height - transform[5]; // Convert to top-down coordinates
                        const width = item.width;
                        const height = item.height;
                        
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
        tagElement.classList.add('multi-selected');
        // Apply strong visual feedback for multi-selection
        tagElement.style.opacity = '0.85';
        tagElement.style.boxShadow = '0 0 25px rgba(255, 0, 0, 1), 0 0 50px rgba(255, 0, 0, 0.7), 0 0 10px rgba(255, 255, 255, 0.8)';
        tagElement.style.borderColor = '#ff0000';
        tagElement.style.borderWidth = '4px';
        tagElement.style.borderStyle = 'solid';
        tagElement.style.transform = 'scale(1.1)';
        tagElement.style.zIndex = '15';
        
        // Also enhance the label for multi-selected tags
        const label = tagElement.querySelector('.tag-label');
        if (label) {
            label.style.backgroundColor = '#ff0000';
            label.style.fontSize = '12px';
            label.style.padding = '6px 10px';
            label.style.fontWeight = '900';
            label.style.border = '2px solid #fff';
            label.style.boxShadow = '0 4px 12px rgba(255, 0, 0, 0.6)';
            label.style.animation = 'labelBlink 1.5s ease-in-out infinite';
        }
        
        console.log('다중 선택 시각적 효과 적용:', tagElement.dataset.tagId);
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