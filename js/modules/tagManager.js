// Tag Manager - Handles tag recognition and management using user-defined patterns
import { PatternManager } from './patternManager.js';
import { InstrumentMatcher } from './instrumentMatcher.js';

export class TagManager {
    constructor() {
        this.patternManager = new PatternManager();
        this.patternManager.init();
        this.instrumentMatcher = new InstrumentMatcher(this.patternManager);

        this.equipmentTypes = {
            'P-': 'Pump',
            'T-': 'Tank',
            'TK-': 'Tank',
            'E-': 'Heat Exchanger',
            'HX-': 'Heat Exchanger',
            'V-': 'Vessel',
            'VE-': 'Vessel',
            'C-': 'Compressor',
            'K-': 'Compressor',
            'R-': 'Reactor',
            'RX-': 'Reactor',
            'F-': 'Filter',
            'FL-': 'Filter',
            'S-': 'Separator',
            'SEP-': 'Separator'
        };

        this.instrumentTypes = {
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
            'ACV': 'Analytical Control Valve',
            'MS': 'Motor Starter',
            'MC': 'Motor Controller',
            'HV': 'Hand Valve',
            'CV': 'Check Valve'
        };
    }

    recognizeTags(textContent, textWithPositions = null) {
        const recognizedTags = {
            equipment: [],
            line: [],
            instrument: []
        };

        if (textWithPositions) {
            // Use positional recognition for instruments
            return this.recognizeTagsWithPositions(textWithPositions);
        } else {
            // Fallback to simple token-based recognition
            return this.recognizeTagsSimple(textContent);
        }
    }

    recognizeTagsSimple(textContent) {
        const recognizedTags = {
            equipment: [],
            line: [],
            instrument: []
        };

        // Split text into individual words/tokens
        const tokens = this.extractTextTokens(textContent);
        
        // Process each token against all patterns
        tokens.forEach(token => {
            const matchResult = this.patternManager.findMatchingPattern(token);
            if (matchResult.match) {
                const category = matchResult.pattern.category;
                if (recognizedTags[category] && category !== 'instrument') {
                    const tagObject = this.createTagObject(token, category, matchResult);
                    // Avoid duplicates
                    if (!recognizedTags[category].some(tag => tag.name === tagObject.name)) {
                        recognizedTags[category].push(tagObject);
                    }
                }
            }
        });

        console.log('인식된 태그 (단순):', recognizedTags);
        return recognizedTags;
    }

    recognizeTagsWithPositions(textWithPositions) {
        const recognizedTags = {
            equipment: [],
            line: [],
            instrument: []
        };

        // Process equipment and line tags normally
        textWithPositions.forEach(item => {
            const matchResult = this.patternManager.findMatchingPattern(item.text);
            if (matchResult.match) {
                const category = matchResult.pattern.category;
                if (category === 'equipment' || category === 'line') {
                    const tagObject = this.createTagObjectWithPosition(item.text, category, matchResult, item);
                    // Avoid duplicates
                    if (!recognizedTags[category].some(tag => tag.name === tagObject.name)) {
                        recognizedTags[category].push(tagObject);
                    }
                }
            }
        });

        // Use instrument matcher for instrument tags
        const instrumentTags = this.instrumentMatcher.findInstrumentFunctions(textWithPositions);
        recognizedTags.instrument = instrumentTags;

        console.log('인식된 태그 (위치 기반):', recognizedTags);
        return recognizedTags;
    }

    extractTextTokens(text) {
        // Split text by common delimiters and filter out empty strings
        const tokens = text.split(/[\s\n\r\t,;.()[\]{}]+/)
                          .map(token => token.trim())
                          .filter(token => token.length > 0);
        
        // Remove duplicates
        return [...new Set(tokens)];
    }

    createTagObject(tagName, category, matchResult = null) {
        const tag = {
            id: `${category}_${tagName}_${Date.now()}`,
            name: tagName,
            type: this.getTagType(tagName, category),
            category: category,
            recognized: true,
            created: new Date().toISOString()
        };

        // Add pattern information if available
        if (matchResult) {
            tag.patternName = matchResult.name;
            tag.patternColor = matchResult.pattern.color;
            tag.patternDescription = matchResult.pattern.description;
        }

        // Add equipment specific properties
        if (category === 'equipment') {
            tag.spec = this.extractEquipmentSpec(tagName);
        }

        // Add line specific properties
        if (category === 'line') {
            const lineInfo = this.parseLineTag(tagName);
            tag.size = lineInfo.size;
            tag.service = lineInfo.service;
        }

        return tag;
    }

    createTagObjectWithPosition(tagName, category, matchResult, positionData) {
        const tag = this.createTagObject(tagName, category, matchResult);
        
        // Add position information
        tag.position = {
            x: positionData.x,
            y: positionData.y,
            width: positionData.width,
            height: positionData.height,
            page: positionData.page,
            bbox: positionData.bbox
        };

        return tag;
    }

    getTagType(tagName, category) {
        if (category === 'equipment') {
            // Find matching equipment type
            for (const [prefix, type] of Object.entries(this.equipmentTypes)) {
                if (tagName.startsWith(prefix)) {
                    return type;
                }
            }
            return 'Equipment';
        }

        if (category === 'instrument') {
            // Extract instrument prefix (first 2-3 characters)
            const prefixMatch = tagName.match(/^([A-Z]{2,3})-/);
            if (prefixMatch) {
                const prefix = prefixMatch[1];
                return this.instrumentTypes[prefix] || 'Instrument';
            }
            return 'Instrument';
        }

        if (category === 'line') {
            return 'Process Line';
        }

        return 'Unknown';
    }

    extractEquipmentSpec(tagName) {
        // This is a placeholder - in real implementation,
        // you would extract specs from surrounding text or known patterns
        return '';
    }

    parseLineTag(tagName) {
        const result = {
            size: '',
            service: ''
        };

        // Extract size from patterns like 1"-P-101-A
        const sizeMatch = tagName.match(/^(\d+)"?-/);
        if (sizeMatch) {
            result.size = sizeMatch[1] + '"';
        }

        // Extract service code
        const serviceMatch = tagName.match(/-([A-Z]{1,3})-\d{3}/);
        if (serviceMatch) {
            result.service = serviceMatch[1];
        }

        return result;
    }

    // Add manual tag
    addManualTag(name, category, additionalData = {}) {
        const tag = {
            id: `${category}_${name}_${Date.now()}`,
            name: name.toUpperCase(),
            type: this.getTagType(name, category),
            category: category,
            recognized: false,
            manual: true,
            created: new Date().toISOString(),
            ...additionalData
        };

        return tag;
    }

    // Validate tag name against active patterns
    validateTagName(name, category = null) {
        const matchResult = this.patternManager.findMatchingPattern(name);
        
        if (category) {
            // Check if matches patterns for specific category
            const categoryPatterns = this.patternManager.getPatternsByCategory(category);
            return Object.keys(categoryPatterns).some(patternName => 
                this.patternManager.testPattern(categoryPatterns[patternName].pattern, name)
            );
        }
        
        return matchResult.match;
    }

    // Test tag name against pattern
    testTagPattern(name, patternName) {
        const patterns = this.patternManager.getActivePatterns();
        if (patterns[patternName]) {
            return this.patternManager.testPattern(patterns[patternName].pattern, name);
        }
        return false;
    }

    // Get pattern manager for external access
    getPatternManager() {
        return this.patternManager;
    }

    // Search tags by name or type
    searchTags(tags, searchTerm) {
        const term = searchTerm.toLowerCase();
        return tags.filter(tag => 
            tag.name.toLowerCase().includes(term) ||
            tag.type.toLowerCase().includes(term)
        );
    }

    // Group tags by type for better organization
    groupTagsByType(tags) {
        const grouped = {};
        
        tags.forEach(tag => {
            if (!grouped[tag.type]) {
                grouped[tag.type] = [];
            }
            grouped[tag.type].push(tag);
        });

        return grouped;
    }

    // Get tag statistics
    getTagStatistics(allTags) {
        const stats = {
            total: 0,
            equipment: { total: 0, types: {} },
            line: { total: 0, types: {} },
            instrument: { total: 0, types: {} },
            recognized: 0,
            manual: 0
        };

        Object.keys(allTags).forEach(category => {
            const tags = allTags[category];
            stats[category].total = tags.length;
            stats.total += tags.length;

            tags.forEach(tag => {
                // Count by type
                if (!stats[category].types[tag.type]) {
                    stats[category].types[tag.type] = 0;
                }
                stats[category].types[tag.type]++;

                // Count recognition method
                if (tag.recognized) {
                    stats.recognized++;
                } else if (tag.manual) {
                    stats.manual++;
                }
            });
        });

        return stats;
    }

    // Export tags for different formats
    exportTags(allTags, format = 'array') {
        switch (format) {
            case 'flat':
                // Flatten all tags into single array
                return Object.values(allTags).flat();
            
            case 'grouped':
                // Group by type across categories
                const grouped = {};
                Object.keys(allTags).forEach(category => {
                    allTags[category].forEach(tag => {
                        if (!grouped[tag.type]) {
                            grouped[tag.type] = [];
                        }
                        grouped[tag.type].push(tag);
                    });
                });
                return grouped;
            
            default:
                return allTags;
        }
    }
}