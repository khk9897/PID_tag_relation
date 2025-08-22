// Instrument Matcher - Handles spatial relationship matching between instrument numbers and functions
export class InstrumentMatcher {
    constructor(patternManager) {
        this.patternManager = patternManager;
        this.defaultSearchHeight = 10.0; // Default search height in points
    }

    // Main function to find instrument functions for instrument numbers
    findInstrumentFunctions(textWithPositions, searchHeight = null) {
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
        const centerX = x + width / 2;
        const searchY1 = y - searchHeight;
        const searchY2 = y;

        console.log(`Instrument ${instrumentNumber.text}의 함수 검색:`, {
            position: { x, y, width, page },
            searchArea: { searchY1, searchY2 },
            functionPattern: functionPattern.pattern
        });

        // Find all function texts in the search area
        const candidateFunctions = textWithPositions.filter(item => {
            // Must be on the same page
            if (item.page !== page) return false;
            
            // Must match function pattern
            const matches = this.patternManager.testPattern(functionPattern.pattern, item.text);
            if (!matches) return false;
            
            // Must be above the instrument number (smaller y value in top-down coordinates)
            if (item.y >= searchY2 || item.y <= searchY1) return false;
            
            // Accept all functions in the vertical range - we'll find the closest one later
            const functionCenterX = item.x + item.width / 2;
            const instrumentCenterX = x + width / 2;
            const distance = Math.abs(functionCenterX - instrumentCenterX);
            const isAligned = true; // Accept all, filter by distance later
            
            console.log(`후보 함수 '${item.text}':`, {
                position: { x: item.x, y: item.y, width: item.width },
                matches, isAligned,
                functionCenterX, instrumentCenterX,
                distance
            });
            
            return isAligned;
        });
        
        console.log(`찾은 후보 함수들:`, candidateFunctions.map(f => f.text));

        // Return the closest function by horizontal distance
        if (candidateFunctions.length > 0) {
            const instrumentCenterX = x + width / 2;
            const closestFunction = candidateFunctions.reduce((closest, current) => {
                const closestDistance = Math.abs((closest.x + closest.width / 2) - instrumentCenterX);
                const currentDistance = Math.abs((current.x + current.width / 2) - instrumentCenterX);
                return currentDistance < closestDistance ? current : closest;
            });
            console.log(`선택된 함수: ${closestFunction.text} (거리: ${Math.abs((closestFunction.x + closestFunction.width / 2) - instrumentCenterX)})`);
            return closestFunction.text;
        }

        return null;
    }

    // Find the position of a function text near an instrument number
    findFunctionPosition(textWithPositions, functionText, instrumentNumber) {
        const { x, y, width, page } = instrumentNumber;
        const searchY = y - this.defaultSearchHeight;

        const functionItem = textWithPositions.find(item => 
            item.page === page &&
            item.text === functionText &&
            item.y >= searchY &&
            item.y <= y &&
            item.x + item.width / 2 >= x &&
            item.x + item.width / 2 <= x + width
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
            this.defaultSearchHeight = Math.max(avgHeight * 2, 6.0);
        }

        return {
            searchHeight: this.defaultSearchHeight,
            avgTextHeight: textHeights.length > 0 ? 
                textHeights.reduce((sum, h) => sum + h, 0) / textHeights.length : 0
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