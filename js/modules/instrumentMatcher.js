// Instrument Matcher - Handles spatial relationship matching between instrument numbers and functions
export class InstrumentMatcher {
    constructor(patternManager) {
        this.patternManager = patternManager;
        this.defaultSearchHeight = 10.0; // Default search height in points
    }

    // Main function to find instrument functions for instrument numbers
    findInstrumentFunctions(textWithPositions, searchHeight = null) {
        // Adjust search parameters based on PDF characteristics first
        const adjustmentResults = this.adjustSearchParameters(textWithPositions);
        console.log('검색 파라미터 조정 결과:', adjustmentResults);
        
        const height = searchHeight || this.defaultSearchHeight;
        const instrumentTags = [];
        
        // Get active patterns
        const patterns = this.patternManager.getActivePatterns();
        const instrumentNumberPattern = patterns['Instrument_number'];
        const instrumentFunctionPattern = patterns['Instrument_function'];
        
        if (!instrumentNumberPattern || !instrumentFunctionPattern) {
            console.warn('Instrument patterns not found');
            return [];
        }

        // Find all instrument numbers first
        const instrumentNumbers = this.findInstrumentNumbers(textWithPositions, instrumentNumberPattern);
        console.log(`찾은 instrument numbers: ${instrumentNumbers.length}개`);
        
        // For each instrument number, find its corresponding function
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
                // Add position information for PDF highlighting
                position: {
                    x: instrumentNum.x,
                    y: instrumentNum.y,
                    width: instrumentNum.width,
                    height: instrumentNum.height,
                    page: instrumentNum.page,
                    bbox: instrumentNum.bbox
                }
            };

            instrumentTags.push(instrumentTag);
        });

        return instrumentTags;
    }

    // Find all instrument numbers in the text
    findInstrumentNumbers(textWithPositions, pattern) {
        const instrumentNumbers = [];
        
        textWithPositions.forEach(item => {
            if (this.patternManager.testPattern(pattern.pattern, item.text)) {
                instrumentNumbers.push(item);
            }
        });

        return instrumentNumbers;
    }

    // Find function text above an instrument number
    findFunctionForInstrument(textWithPositions, instrumentNumber, functionPattern, searchHeight) {
        const { x, y, width, page } = instrumentNumber;
        const instrumentCenterX = x + width / 2;
        
        // Define search area above the instrument number
        // Function should be above (smaller y) and horizontally aligned
        const searchY1 = y - searchHeight; // Top of search area
        const searchY2 = y + 2; // Allow slight overlap below instrument
        
        // Horizontal tolerance for alignment (allow some offset)
        const horizontalTolerance = width * 1.5; // 1.5x instrument width
        const searchX1 = instrumentCenterX - horizontalTolerance;
        const searchX2 = instrumentCenterX + horizontalTolerance;

        console.log(`Instrument ${instrumentNumber.text}의 함수 검색:`, {
            instrumentPosition: { x, y, width, page },
            instrumentCenter: instrumentCenterX,
            searchArea: { 
                x1: searchX1, x2: searchX2, 
                y1: searchY1, y2: searchY2 
            },
            horizontalTolerance,
            functionPattern: functionPattern.pattern
        });

        // Find all function texts in the search area
        const candidateFunctions = textWithPositions.filter(item => {
            // Must be on the same page
            if (item.page !== page) return false;
            
            // Must match function pattern
            const matches = this.patternManager.testPattern(functionPattern.pattern, item.text);
            if (!matches) return false;
            
            // Must be in the vertical search range (above the instrument)
            if (item.y < searchY1 || item.y > searchY2) return false;
            
            // Check horizontal alignment with tolerance
            const functionCenterX = item.x + item.width / 2;
            const horizontalDistance = Math.abs(functionCenterX - instrumentCenterX);
            const isHorizontallyAligned = functionCenterX >= searchX1 && functionCenterX <= searchX2;
            
            console.log(`후보 함수 '${item.text}':`, {
                position: { x: item.x, y: item.y, width: item.width },
                functionCenter: functionCenterX,
                horizontalDistance,
                isHorizontallyAligned,
                matches,
                inVerticalRange: item.y >= searchY1 && item.y <= searchY2
            });
            
            return isHorizontallyAligned;
        });
        
        console.log(`찾은 후보 함수들:`, candidateFunctions.map(f => f.text));

        // Return the closest function by combined distance (prioritize vertical distance)
        if (candidateFunctions.length > 0) {
            const closestFunction = candidateFunctions.reduce((closest, current) => {
                // Calculate combined distance (prioritize vertical alignment)
                const closestHorizontalDist = Math.abs((closest.x + closest.width / 2) - instrumentCenterX);
                const closestVerticalDist = Math.abs(closest.y - y) * 2; // Weight vertical distance more
                const closestTotalDist = closestHorizontalDist + closestVerticalDist;
                
                const currentHorizontalDist = Math.abs((current.x + current.width / 2) - instrumentCenterX);
                const currentVerticalDist = Math.abs(current.y - y) * 2;
                const currentTotalDist = currentHorizontalDist + currentVerticalDist;
                
                return currentTotalDist < closestTotalDist ? current : closest;
            });
            
            const finalHorizontalDistance = Math.abs((closestFunction.x + closestFunction.width / 2) - instrumentCenterX);
            const finalVerticalDistance = Math.abs(closestFunction.y - y);
            console.log(`선택된 함수: ${closestFunction.text} (수평거리: ${finalHorizontalDistance.toFixed(1)}, 수직거리: ${finalVerticalDistance.toFixed(1)})`);
            return closestFunction.text;
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
        // Calculate average text height to adjust search parameters
        const textHeights = textWithPositions
            .filter(item => item.height > 0)
            .map(item => item.height);
        
        if (textHeights.length > 0) {
            const avgHeight = textHeights.reduce((sum, h) => sum + h, 0) / textHeights.length;
            // Adjust search height based on average text height
            // Use 3x average height to account for spacing between function and number
            this.defaultSearchHeight = Math.max(avgHeight * 3, 8.0);
        }

        // Analyze text patterns to detect common function-number spacing
        const instrumentNumbers = textWithPositions.filter(item => 
            this.patternManager.testPattern(
                this.patternManager.getActivePatterns()['Instrument_number']?.pattern || /^\d{4}\s?[A-Za-z0-9-]{0,3}$/,
                item.text
            )
        );

        const functionTexts = textWithPositions.filter(item =>
            this.patternManager.testPattern(
                this.patternManager.getActivePatterns()['Instrument_function']?.pattern || /^[A-Z]{2,4}$/,
                item.text
            )
        );

        // Calculate common vertical distances between functions and numbers
        const verticalDistances = [];
        instrumentNumbers.forEach(number => {
            functionTexts.forEach(func => {
                if (func.page === number.page && func.y < number.y) {
                    const distance = number.y - func.y;
                    if (distance > 0 && distance < 50) { // Reasonable range
                        verticalDistances.push(distance);
                    }
                }
            });
        });

        if (verticalDistances.length > 0) {
            // Use the median distance as a more robust estimate
            verticalDistances.sort((a, b) => a - b);
            const medianDistance = verticalDistances[Math.floor(verticalDistances.length / 2)];
            this.defaultSearchHeight = Math.max(medianDistance * 1.2, this.defaultSearchHeight);
        }

        return {
            searchHeight: this.defaultSearchHeight,
            avgTextHeight: textHeights.length > 0 ? 
                textHeights.reduce((sum, h) => sum + h, 0) / textHeights.length : 0,
            sampleVerticalDistances: verticalDistances.slice(0, 5) // Show first 5 for debugging
        };
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