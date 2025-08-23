/**
 * 계기 매칭기 클래스 - 계기 번호와 기능 코드 간의 공간적 관계 매칭을 처리합니다
 * 
 * 이 클래스는 P&ID 도면에서 계기 태그의 특수한 레이아웃 특성을 활용합니다:
 * - 기능 코드 (PT, FT, TT 등)는 보통 번호 위쪽에 위치
 * - 수평적으로는 중앙 정렬되어 있음
 * - 일정한 거리 내에서 짝을 이룸
 * 
 * 주요 기능:
 * - 공간 분석을 통한 기능-번호 매칭
 * - PDF 특성에 따른 검색 파라미터 자동 조정
 * - 여러 후보 중 최적 매칭 선택
 * - 폴백 메커니즘으로 강인한 매칭 지원
 */
export class InstrumentMatcher {
    constructor(patternManager) {
        this.patternManager = patternManager;  // 정규표현식 패턴 관리자 참조
        this.defaultSearchHeight = 10.0;      // 기본 검색 높이 (PDF 포인트 단위)
    }

    /**
     * 계기 번호에 대한 기능 코드를 찾는 메인 메서드
     * PDF의 텍스트 배치 특성을 분석하여 최적화된 공간 검색을 수행합니다
     * 
     * @param {Array} textWithPositions - 위치 정보가 포함된 텍스트 요소 배열
     * @param {number} searchHeight - 선택적 검색 높이 (지정하지 않으면 자동 계산)
     * @returns {Array} 매칭된 계기 태그 객체 배열
     */
    findInstrumentFunctions(textWithPositions, searchHeight = null) {
        // 단계 1: PDF 특성에 맞게 검색 파라미터를 먼저 조정
        const adjustmentResults = this.adjustSearchParameters(textWithPositions);
        console.log('검색 파라미터 자동 조정 결과:', adjustmentResults);
        
        // 최종 검색 높이 결정 (사용자 지정 또는 자동 계산된 값)
        const height = searchHeight || this.defaultSearchHeight;
        const instrumentTags = [];  // 결과를 담을 배열
        
        // 단계 2: 활성 화된 패턴들을 가져오기
        const patterns = this.patternManager.getActivePatterns();
        const instrumentNumberPattern = patterns['Instrument_number'];   // 계기 번호 패턴 (1234, 2001 등)
        const instrumentFunctionPattern = patterns['Instrument_function']; // 계기 기능 패턴 (PT, FT, TT 등)
        
        // 패턴이 없으면 인식 불가
        if (!instrumentNumberPattern || !instrumentFunctionPattern) {
            console.warn('계기 태그 인식용 패턴을 찾을 수 없습니다');
            return [];
        }

        // 단계 3: 모든 계기 번호를 먼저 찾기
        const instrumentNumbers = this.findInstrumentNumbers(textWithPositions, instrumentNumberPattern);
        console.log(`발견된 계기 번호: ${instrumentNumbers.length}개`);
        
        // 단계 4: 각 계기 번호에 대해 대응하는 기능 코드 찾기
        instrumentNumbers.forEach(instrumentNum => {
            const functionText = this.findFunctionForInstrument(
                textWithPositions, 
                instrumentNum, 
                instrumentFunctionPattern, 
                height
            );
            
            // Create combined instrument tag
            console.log(`Instrument ${instrumentNum.text}의 함수: '${functionText}'`);
            const combinedName = functionText ? `${functionText}-${instrumentNum.text}` : instrumentNum.text;
            console.log(`Combined name: ${combinedName}`);
            const instrumentTag = {
                id: `instrument_${instrumentNum.text}_${Date.now()}`,
                name: combinedName,
                number: instrumentNum.text,
                function: functionText || '',
                type: this.getInstrumentType(functionText),
                category: 'instrument',
                recognized: true,
                numberPosition: instrumentNum,
                functionPosition: functionText ? this.findFunctionPosition(textWithPositions, functionText, instrumentNum) : null,
                patternName: 'Instrument_number',
                created: new Date().toISOString(),
                // PDF 하이라이트를 위한 위치 정보 추가
                position: {
                    x: instrumentNum.x,         // X 좌표
                    y: instrumentNum.y,         // Y 좌표
                    width: instrumentNum.width,   // 폭
                    height: instrumentNum.height, // 높이
                    page: instrumentNum.page,     // 페이지 번호
                    bbox: instrumentNum.bbox      // 경계 상자
                }
            };

            instrumentTags.push(instrumentTag);
        });

        return instrumentTags;
    }

    /**
     * 텍스트에서 모든 계기 번호를 찾는 메서드
     * 주어진 패턴에 매칭되는 모든 텍스트 요소를 찾아 반환합니다
     * 
     * @param {Array} textWithPositions - 위치 정보가 포함된 텍스트 요소 배열
     * @param {Object} pattern - 계기 번호 인식용 정규표현식 패턴
     * @returns {Array} 발견된 계기 번호 요소들의 배열
     */
    findInstrumentNumbers(textWithPositions, pattern) {
        const instrumentNumbers = [];  // 결과를 담을 배열
        
        // 모든 텍스트 요소를 검사하여 계기 번호 패턴에 매칭되는 것들을 찾기
        textWithPositions.forEach(item => {
            if (this.patternManager.testPattern(pattern.pattern, item.text)) {
                instrumentNumbers.push(item);  // 패턴에 매칭되면 결과 배열에 추가
            }
        });

        return instrumentNumbers;
    }

    // Find function text above an instrument number
    findFunctionForInstrument(textWithPositions, instrumentNumber, functionPattern, searchHeight) {
        const { x, y, width, height, page } = instrumentNumber;
        const instrumentCenterX = x + width / 2;
        const instrumentCenterY = y + height / 2;
        
        console.log(`\n=== Searching for function for instrument ${instrumentNumber.text} ===`);
        console.log(`Instrument position:`, { x, y, width, height, centerX: instrumentCenterX, centerY: instrumentCenterY, page });
        
        // Enhanced search area - look above and around the instrument number
        // In PDF coordinate system, smaller Y values are typically higher on the page
        const searchY1 = y - searchHeight; // Top of search area (above instrument)
        const searchY2 = y + height + 3; // Bottom of search area (slightly below instrument)
        
        // Wider horizontal tolerance for better matching
        const horizontalTolerance = Math.max(width * 2.0, 20); // At least 2x width or 20 points
        const searchX1 = instrumentCenterX - horizontalTolerance;
        const searchX2 = instrumentCenterX + horizontalTolerance;

        console.log(`Search area:`, {
            horizontal: { x1: searchX1, x2: searchX2, tolerance: horizontalTolerance },
            vertical: { y1: searchY1, y2: searchY2, height: searchHeight },
            functionPattern: functionPattern.pattern
        });

        // Debug: Show all text items on the same page for comparison
        const pageTexts = textWithPositions.filter(item => item.page === page);
        console.log(`Total texts on page ${page}:`, pageTexts.length);
        
        // Find all potential function texts first (before position filtering)
        const functionTexts = pageTexts.filter(item => 
            this.patternManager.testPattern(functionPattern.pattern, item.text)
        );
        console.log(`Function pattern matches on page:`, functionTexts.map(f => ({ text: f.text, x: f.x, y: f.y })));

        // Find all function texts in the search area
        const candidateFunctions = textWithPositions.filter(item => {
            // Must be on the same page
            if (item.page !== page) return false;
            
            // Must match function pattern
            const matches = this.patternManager.testPattern(functionPattern.pattern, item.text);
            if (!matches) return false;
            
            // Check if it's in the vertical search range
            const inVerticalRange = item.y >= searchY1 && item.y <= searchY2;
            
            // Check horizontal alignment with tolerance
            const functionCenterX = item.x + item.width / 2;
            const horizontalDistance = Math.abs(functionCenterX - instrumentCenterX);
            const isHorizontallyAligned = functionCenterX >= searchX1 && functionCenterX <= searchX2;
            
            // Calculate relative position to instrument
            const relativeY = item.y - y; // Negative means above instrument
            const relativeX = functionCenterX - instrumentCenterX; // Distance from center
            
            console.log(`  Function candidate '${item.text}':`, {
                position: { x: item.x, y: item.y, width: item.width },
                functionCenter: functionCenterX,
                horizontalDistance: horizontalDistance.toFixed(1),
                relativePosition: { x: relativeX.toFixed(1), y: relativeY.toFixed(1) },
                isAbove: relativeY < 0,
                isHorizontallyAligned,
                inVerticalRange,
                passes: inVerticalRange && isHorizontallyAligned
            });
            
            return inVerticalRange && isHorizontallyAligned;
        });
        
        console.log(`Found ${candidateFunctions.length} candidate functions:`, candidateFunctions.map(f => f.text));

        // Return the closest function using improved selection logic
        if (candidateFunctions.length > 0) {
            // Prioritize functions that are above the instrument (negative relativeY)
            const functionsAbove = candidateFunctions.filter(f => f.y < y);
            const functionsToConsider = functionsAbove.length > 0 ? functionsAbove : candidateFunctions;
            
            console.log(`  Functions above instrument: ${functionsAbove.length}, considering: ${functionsToConsider.length}`);
            
            const closestFunction = functionsToConsider.reduce((closest, current) => {
                // Calculate weighted distances
                const closestCenterX = closest.x + closest.width / 2;
                const currentCenterX = current.x + current.width / 2;
                
                const closestHorizontalDist = Math.abs(closestCenterX - instrumentCenterX);
                const currentHorizontalDist = Math.abs(currentCenterX - instrumentCenterX);
                
                // For vertical distance, prefer functions above (negative relativeY)
                const closestVerticalDist = Math.abs(closest.y - instrumentCenterY);
                const currentVerticalDist = Math.abs(current.y - instrumentCenterY);
                
                // Strong preference for functions directly above (smaller vertical distance)
                // and reasonable horizontal alignment
                const closestScore = closestHorizontalDist * 0.5 + closestVerticalDist * 2.0;
                const currentScore = currentHorizontalDist * 0.5 + currentVerticalDist * 2.0;
                
                console.log(`    Scoring '${closest.text}': h=${closestHorizontalDist.toFixed(1)}, v=${closestVerticalDist.toFixed(1)}, score=${closestScore.toFixed(1)}`);
                console.log(`    Scoring '${current.text}': h=${currentHorizontalDist.toFixed(1)}, v=${currentVerticalDist.toFixed(1)}, score=${currentScore.toFixed(1)}`);
                
                return currentScore < closestScore ? current : closest;
            });
            
            const finalHorizontalDistance = Math.abs((closestFunction.x + closestFunction.width / 2) - instrumentCenterX);
            const finalVerticalDistance = Math.abs(closestFunction.y - instrumentCenterY);
            const isAbove = closestFunction.y < y;
            
            console.log(`  -> Selected function: '${closestFunction.text}'`, {
                horizontalDistance: finalHorizontalDistance.toFixed(1),
                verticalDistance: finalVerticalDistance.toFixed(1),
                isAbove,
                position: { x: closestFunction.x, y: closestFunction.y }
            });
            
            return closestFunction.text;
        }

        console.log(`No function found for instrument ${instrumentNumber.text}`);
        
        // Fallback: Look for the nearest function on the same page (relaxed criteria)
        const allFunctionTexts = textWithPositions.filter(item => 
            item.page === page && 
            this.patternManager.testPattern(functionPattern.pattern, item.text)
        );
        
        if (allFunctionTexts.length > 0) {
            console.log(`  Fallback search: ${allFunctionTexts.length} functions on page`);
            
            // Find the closest function by straight-line distance
            const nearestFunction = allFunctionTexts.reduce((nearest, current) => {
                const nearestCenterX = nearest.x + nearest.width / 2;
                const nearestCenterY = nearest.y + nearest.height / 2;
                const nearestDistance = Math.sqrt(
                    Math.pow(nearestCenterX - instrumentCenterX, 2) + 
                    Math.pow(nearestCenterY - instrumentCenterY, 2)
                );
                
                const currentCenterX = current.x + current.width / 2;
                const currentCenterY = current.y + current.height / 2;
                const currentDistance = Math.sqrt(
                    Math.pow(currentCenterX - instrumentCenterX, 2) + 
                    Math.pow(currentCenterY - instrumentCenterY, 2)
                );
                
                return currentDistance < nearestDistance ? current : nearest;
            });
            
            const distance = Math.sqrt(
                Math.pow((nearestFunction.x + nearestFunction.width / 2) - instrumentCenterX, 2) + 
                Math.pow((nearestFunction.y + nearestFunction.height / 2) - instrumentCenterY, 2)
            );
            
            // Only use fallback if it's reasonably close (within 100 points)
            if (distance < 100) {
                console.log(`  -> Fallback function: '${nearestFunction.text}' (distance: ${distance.toFixed(1)})`);
                return nearestFunction.text;
            }
        }
        
        return null;
    }

    // Find the position of a function text near an instrument number
    findFunctionPosition(textWithPositions, functionText, instrumentNumber) {
        const { x, y, width, page } = instrumentNumber;
        const instrumentCenterX = x + width / 2;
        
        // Use the same search parameters as findFunctionForInstrument
        const searchY1 = y - this.defaultSearchHeight;
        const searchY2 = y + 2;
        const horizontalTolerance = width * 1.5;
        const searchX1 = instrumentCenterX - horizontalTolerance;
        const searchX2 = instrumentCenterX + horizontalTolerance;

        const functionItem = textWithPositions.find(item => 
            item.page === page &&
            item.text === functionText &&
            item.y >= searchY1 &&
            item.y <= searchY2 &&
            item.x + item.width / 2 >= searchX1 &&
            item.x + item.width / 2 <= searchX2
        );

        return functionItem || null;
    }

    // Get instrument type based on function
    getInstrumentType(functionText) {
        if (!functionText) return 'Instrument';

        const functionTypes = {
            'FT': 'Flow Transmitter',
            'FI': 'Flow Indicator', 
            'FIC': 'Flow Indicator Controller',
            'FIR': 'Flow Indicator Recorder',
            'FV': 'Flow Valve',
            'FCV': 'Flow Control Valve',
            'TT': 'Temperature Transmitter',
            'TI': 'Temperature Indicator',
            'TIC': 'Temperature Indicator Controller',
            'TIR': 'Temperature Indicator Recorder',
            'TV': 'Temperature Valve',
            'TCV': 'Temperature Control Valve',
            'PT': 'Pressure Transmitter',
            'PI': 'Pressure Indicator',
            'PIC': 'Pressure Indicator Controller',
            'PIR': 'Pressure Indicator Recorder',
            'PV': 'Pressure Valve',
            'PCV': 'Pressure Control Valve',
            'PSV': 'Pressure Safety Valve',
            'LT': 'Level Transmitter',
            'LI': 'Level Indicator',
            'LIC': 'Level Indicator Controller',
            'LIR': 'Level Indicator Recorder',
            'LV': 'Level Valve',
            'LCV': 'Level Control Valve',
            'AT': 'Analytical Transmitter',
            'AI': 'Analytical Indicator',
            'AIC': 'Analytical Indicator Controller',
            'AIR': 'Analytical Indicator Recorder',
            'AV': 'Analytical Valve',
            'ACV': 'Analytical Control Valve'
        };

        return functionTypes[functionText] || `${functionText} Instrument`;
    }

    // Validate instrument matching results
    validateInstrumentMatches(instrumentTags) {
        const issues = [];

        instrumentTags.forEach(tag => {
            // Check if instrument number has a function
            if (!tag.function) {
                issues.push({
                    type: 'missing_function',
                    tag: tag,
                    message: `Instrument number '${tag.name}' has no function`
                });
            }

            // Check if function is valid
            if (tag.function && !this.isValidFunction(tag.function)) {
                issues.push({
                    type: 'invalid_function',
                    tag: tag,
                    message: `Function '${tag.function}' may not be valid for instrument '${tag.name}'`
                });
            }
        });

        return issues;
    }

    // Check if a function text is valid
    isValidFunction(functionText) {
        const validPrefixes = ['F', 'T', 'P', 'L', 'A'];
        const validSuffixes = ['T', 'I', 'IC', 'IR', 'V', 'CV', 'SV'];
        
        // Check if starts with valid prefix
        const hasValidPrefix = validPrefixes.some(prefix => functionText.startsWith(prefix));
        if (!hasValidPrefix) return false;

        // Check if ends with valid suffix
        const hasValidSuffix = validSuffixes.some(suffix => functionText.endsWith(suffix));
        return hasValidSuffix;
    }

    // Get statistics about instrument matching
    getMatchingStatistics(instrumentTags) {
        const stats = {
            totalInstruments: instrumentTags.length,
            withFunction: instrumentTags.filter(tag => tag.function).length,
            withoutFunction: instrumentTags.filter(tag => !tag.function).length,
            functionTypes: {}
        };

        // Count function types
        instrumentTags.forEach(tag => {
            if (tag.function) {
                const prefix = tag.function.substring(0, 1);
                stats.functionTypes[prefix] = (stats.functionTypes[prefix] || 0) + 1;
            }
        });

        stats.matchingRate = stats.totalInstruments > 0 ? 
            (stats.withFunction / stats.totalInstruments * 100).toFixed(1) + '%' : '0%';

        return stats;
    }

    // Adjust search parameters based on PDF characteristics
    adjustSearchParameters(textWithPositions) {
        console.log('\n=== Adjusting search parameters ===');
        
        // Calculate average text height to adjust search parameters
        const textHeights = textWithPositions
            .filter(item => item.height > 0)
            .map(item => item.height);
        
        let avgHeight = 0;
        if (textHeights.length > 0) {
            avgHeight = textHeights.reduce((sum, h) => sum + h, 0) / textHeights.length;
            // More conservative search height: 4-6x average height
            this.defaultSearchHeight = Math.max(avgHeight * 5, 15.0);
        } else {
            this.defaultSearchHeight = 25.0; // Fallback default
        }

        // Get patterns with better error handling
        const patterns = this.patternManager.getActivePatterns();
        const instrumentNumberPattern = patterns['Instrument_number']?.pattern || /^\d{4}\s?[A-Za-z0-9-]{0,3}$/;
        const instrumentFunctionPattern = patterns['Instrument_function']?.pattern || /^[A-Z]{2,4}$/;

        // Analyze text patterns to detect common function-number spacing
        const instrumentNumbers = textWithPositions.filter(item => 
            this.patternManager.testPattern(instrumentNumberPattern, item.text)
        );

        const functionTexts = textWithPositions.filter(item =>
            this.patternManager.testPattern(instrumentFunctionPattern, item.text)
        );

        console.log(`Found ${instrumentNumbers.length} instrument numbers and ${functionTexts.length} function texts`);

        // Calculate common vertical distances between functions and numbers
        const verticalDistances = [];
        const spatialPairs = [];
        
        instrumentNumbers.forEach(number => {
            functionTexts.forEach(func => {
                if (func.page === number.page) {
                    const verticalDistance = Math.abs(number.y - func.y);
                    const horizontalDistance = Math.abs((number.x + number.width/2) - (func.x + func.width/2));
                    
                    // Only consider reasonable proximity (both vertical and horizontal)
                    if (verticalDistance > 0 && verticalDistance < 80 && horizontalDistance < 100) {
                        verticalDistances.push(verticalDistance);
                        spatialPairs.push({
                            number: number.text,
                            function: func.text,
                            vDist: verticalDistance,
                            hDist: horizontalDistance,
                            isAbove: func.y < number.y
                        });
                    }
                }
            });
        });

        // Use more robust statistical analysis
        if (verticalDistances.length > 0) {
            verticalDistances.sort((a, b) => a - b);
            const q1 = verticalDistances[Math.floor(verticalDistances.length * 0.25)];
            const median = verticalDistances[Math.floor(verticalDistances.length * 0.5)];
            const q3 = verticalDistances[Math.floor(verticalDistances.length * 0.75)];
            
            // Use the 75th percentile to capture most cases while avoiding outliers
            this.defaultSearchHeight = Math.max(q3 * 1.3, this.defaultSearchHeight, 20.0);
            
            console.log(`Distance statistics:`, { q1: q1.toFixed(1), median: median.toFixed(1), q3: q3.toFixed(1) });
        }

        const result = {
            searchHeight: this.defaultSearchHeight,
            avgTextHeight: avgHeight,
            instrumentNumbers: instrumentNumbers.length,
            functionTexts: functionTexts.length,
            spatialPairs: spatialPairs.length,
            samplePairs: spatialPairs.slice(0, 3) // Show first 3 for debugging
        };
        
        console.log('Search parameter adjustment result:', result);
        return result;
    }

    // Debug function to visualize search areas
    getDebugInfo(instrumentNumber, textWithPositions, searchHeight) {
        const { x, y, width, page } = instrumentNumber;
        const searchY1 = y - searchHeight;
        const searchY2 = y;

        const searchArea = {
            x1: x,
            y1: searchY1,
            x2: x + width,
            y2: searchY2,
            page: page
        };

        const textsInArea = textWithPositions.filter(item =>
            item.page === page &&
            item.x >= searchArea.x1 && item.x <= searchArea.x2 &&
            item.y >= searchArea.y1 && item.y <= searchArea.y2
        );

        return {
            instrumentNumber: instrumentNumber,
            searchArea: searchArea,
            textsInSearchArea: textsInArea,
            searchHeight: searchHeight
        };
    }
}