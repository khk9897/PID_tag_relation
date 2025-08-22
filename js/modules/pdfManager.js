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
        
        // Configure PDF.js worker
        pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.0.379/pdf.worker.min.mjs';
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
        }
    }

    zoomOut() {
        if (this.scale > this.minScale) {
            this.scale -= 0.2;
            this.renderPage();
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
        
        // Add click event to highlight
        highlight.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            
            // Trigger tag selection in the tag panel
            if (this.onHighlightClick) {
                this.onHighlightClick(tag.id, tag.category);
            }
            
            console.log('PDF 하이라이트 클릭:', tag.name, tag.category);
        });
        
        // Create label text - include function for instruments
        let labelText = tag.name;
        if (tag.category === 'instrument' && tag.function) {
            labelText = `${tag.function}: ${tag.name}`;
        }
        
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

    // Highlight selected tag
    highlightSelectedTag(tagId) {
        // Remove previous selection highlights
        document.querySelectorAll('.tag-highlight.selected').forEach(el => {
            el.classList.remove('selected');
            const category = el.dataset.tagCategory;
            const isLine = category === 'line';
            
            // Restore default styling for all categories
            el.style.opacity = '0.4';
            el.style.boxShadow = '0 0 8px rgba(0,0,0,0.3)';
            el.style.borderWidth = '3px';
            el.style.transform = 'scale(1)';
            el.style.animation = 'none';
            el.style.zIndex = '10';
            el.style.background = '';
            el.style.backgroundSize = 'auto';
            el.style.borderImage = 'none';
            el.style.borderStyle = 'solid';
            el.style.outline = 'none';
            el.style.outlineOffset = '0px';
            el.style.filter = 'none';
            
            // Reset label styling for all categories
            const label = el.querySelector('.tag-label');
            if (label) {
                // Reset to default label styling
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
        });
        
        // If tagId is null, just clear highlights
        if (!tagId) return;
        
        // Highlight selected tag with enhanced visibility - use querySelectorAll to avoid selector issues
        const highlights = document.querySelectorAll('.tag-highlight');
        let highlight = null;
        for (const el of highlights) {
            if (el.dataset.tagId === tagId) {
                highlight = el;
                break;
            }
        }
        if (highlight) {
            const category = highlight.dataset.tagCategory;
            const isLine = category === 'line';
            
            highlight.classList.add('selected');
            
            // Standard enhancement for all selected tags
            highlight.style.opacity = '0.8';
            highlight.style.boxShadow = '0 0 20px rgba(255, 255, 255, 1), 0 0 40px rgba(255, 255, 255, 0.5)';
            highlight.style.borderWidth = '4px';
            highlight.style.transform = 'scale(1.1)';
            
            // Make the label more prominent for selected tag
            const label = highlight.querySelector('.tag-label');
            if (label) {
                label.style.backgroundColor = '#ff4444';
                label.style.fontSize = '12px';
                label.style.padding = '6px 10px';
                label.style.fontWeight = '900';
                label.style.textShadow = '1px 1px 2px rgba(0,0,0,0.5)';
                label.style.border = '2px solid #fff';
            }
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
}