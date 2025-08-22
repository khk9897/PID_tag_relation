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
        this.renderPage();
    }
}