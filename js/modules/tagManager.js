/**
 * 태그 관리자 클래스 - 사용자 정의 패턴을 사용하여 태그 인식 및 관리를 담당
 * 
 * 이 클래스는 P&ID PDF에서 추출된 텍스트를 분석하여 세 가지 주요 카테고리의 태그를 인식합니다:
 * - Equipment 태그: P-101, T-201 등의 장비 태그
 * - Line 태그: 1"-P-101-A 등의 배관 라인 태그  
 * - Instrument 태그: PT-1001, FT-2001 등의 계기 태그
 * 
 * 주요 기능:
 * - 정규표현식 패턴을 사용한 태그 자동 인식
 * - 공간 분석을 통한 고도화된 계기 태그 매칭
 * - 태그 유형 분류 및 메타데이터 생성
 * - 수동 태그 추가 및 관리
 */
import { PatternManager } from './patternManager.js';   // 정규표현식 패턴 관리 모듈
import { InstrumentMatcher } from './instrumentMatcher.js'; // 계기 태그 공간 분석 모듈

export class TagManager {
    constructor() {
        // 패턴 관리자 인스턴스 생성 및 초기화
        this.patternManager = new PatternManager();
        this.patternManager.init();
        
        // 계기 태그 매칭을 위한 공간 분석기 인스턴스 생성
        this.instrumentMatcher = new InstrumentMatcher(this.patternManager);

        // 장비(Equipment) 태그 유형 사전 - 태그 접두어와 장비 유형을 매핑
        // P&ID에서 일반적으로 사용되는 장비 태그 명명 규칙을 기반으로 함
        this.equipmentTypes = {
            'P-': 'Pump',              // 폐프 (P-101, P-102 등)
            'T-': 'Tank',              // 탱크 (T-201, T-202 등)
            'TK-': 'Tank',             // 탱크 대체 표기법
            'E-': 'Heat Exchanger',    // 열교환기 (E-301, E-302 등)
            'HX-': 'Heat Exchanger',   // 열교환기 대체 표기법
            'V-': 'Vessel',            // 용기 (V-401, V-402 등)
            'VE-': 'Vessel',           // 용기 대체 표기법
            'C-': 'Compressor',        // 압축기 (C-501, C-502 등)
            'K-': 'Compressor',        // 압축기 대체 표기법
            'R-': 'Reactor',           // 반응기 (R-601, R-602 등)
            'RX-': 'Reactor',          // 반응기 대체 표기법
            'F-': 'Filter',            // 필터 (F-701, F-702 등)
            'FL-': 'Filter',           // 필터 대체 표기법
            'S-': 'Separator',         // 분리기 (S-801, S-802 등)
            'SEP-': 'Separator'        // 분리기 대체 표기법
        };

        // 계기(Instrument) 태그 유형 사전 - ISA(Instrumentation, Systems and Automation Society) 표준에 기반
        // 각 계기 코드는 기능과 조작 방식에 따라 분류됨
        this.instrumentTypes = {
            // 유량 계기 (Flow)
            'FT': 'Flow Transmitter',              // 유량 전송기
            'FI': 'Flow Indicator',                // 유량 지시기
            'FIC': 'Flow Indicator Controller',    // 유량 지시 제어기
            'FIR': 'Flow Indicator Recorder',      // 유량 지시 기록기
            'FV': 'Flow Valve',                    // 유량 밸브
            'FCV': 'Flow Control Valve',           // 유량 제어 밸브
            
            // 온도 계기 (Temperature)
            'TT': 'Temperature Transmitter',       // 온도 전송기
            'TI': 'Temperature Indicator',         // 온도 지시기
            'TIC': 'Temperature Indicator Controller',  // 온도 지시 제어기
            'TIR': 'Temperature Indicator Recorder',    // 온도 지시 기록기
            'TV': 'Temperature Valve',             // 온도 밸브
            'TCV': 'Temperature Control Valve',    // 온도 제어 밸브
            
            // 압력 계기 (Pressure)
            'PT': 'Pressure Transmitter',          // 압력 전송기
            'PI': 'Pressure Indicator',            // 압력 지시기
            'PIC': 'Pressure Indicator Controller', // 압력 지시 제어기
            'PIR': 'Pressure Indicator Recorder',   // 압력 지시 기록기
            'PV': 'Pressure Valve',                // 압력 밸브
            'PCV': 'Pressure Control Valve',       // 압력 제어 밸브
            'PSV': 'Pressure Safety Valve',        // 압력 안전 밸브
            
            // 액위 계기 (Level)
            'LT': 'Level Transmitter',             // 액위 전송기
            'LI': 'Level Indicator',               // 액위 지시기
            'LIC': 'Level Indicator Controller',   // 액위 지시 제어기
            'LIR': 'Level Indicator Recorder',     // 액위 지시 기록기
            'LV': 'Level Valve',                   // 액위 밸브
            'LCV': 'Level Control Valve',          // 액위 제어 밸브
            
            // 분석 계기 (Analytical)
            'AT': 'Analytical Transmitter',        // 분석 전송기
            'AI': 'Analytical Indicator',          // 분석 지시기
            'AIC': 'Analytical Indicator Controller', // 분석 지시 제어기
            'AIR': 'Analytical Indicator Recorder',   // 분석 지시 기록기
            'AV': 'Analytical Valve',              // 분석 밸브
            'ACV': 'Analytical Control Valve',     // 분석 제어 밸브
            // 기타 계기 유형
            'MS': 'Motor Starter',     // 모터 스타터
            'MC': 'Motor Controller',  // 모터 제어기
            'HV': 'Hand Valve',        // 수동 밸브
            'CV': 'Check Valve'        // 체크 밸브
        };
    }

    /**
     * 태그 인식 메인 메서드
     * 입력된 텍스트 데이터를 기반으로 세 가지 카테고리의 태그를 인식합니다.
     * 위치 정보 유무에 따라 적절한 인식 방법을 선택합니다.
     * 
     * @param {string} textContent - PDF에서 추출한 순수 텍스트 (위치 정보 없음)
     * @param {Array} textWithPositions - 위치 정보가 포함된 텍스트 배열 (고도화된 인식용)
     * @returns {Object} 인식된 태그들을 카테고리별로 분류한 객체
     */
    recognizeTags(textContent, textWithPositions = null) {
        // 결과를 담을 데이터 구조 초기화
        const recognizedTags = {
            equipment: [],      // 장비 태그 배열
            line: [],          // 라인 태그 배열
            instrument: []     // 계기 태그 배열
        };

        if (textWithPositions) {
            // 위치 정보가 있으면 고도화된 인식 방법 사용 (계기 태그 공간 분석 포함)
            return this.recognizeTagsWithPositions(textWithPositions);
        } else {
            // 위치 정보가 없으면 단순한 토큰 기반 인식 방법 사용
            return this.recognizeTagsSimple(textContent);
        }
    }

    /**
     * 단순한 토큰 기반 태그 인식 메서드
     * 위치 정보 없이 텍스트만을 사용하여 기본적인 태그 인식을 수행합니다.
     * 계기 태그는 제외되며 장비와 라인 태그만 처리합니다.
     * 
     * @param {string} textContent - PDF에서 추출한 순수 텍스트
     * @returns {Object} 인식된 태그들을 카테고리별로 분류한 객체
     */
    recognizeTagsSimple(textContent) {
        const recognizedTags = {
            equipment: [],      // 장비 태그 배열
            line: [],          // 라인 태그 배열
            instrument: []     // 계기 태그 배열 (단순 모드에서는 비어있음)
        };

        // 텍스트를 개별 단어/토큰으로 분할
        const tokens = this.extractTextTokens(textContent);
        
        // 각 토큰을 모든 패턴에 대해 검사
        tokens.forEach(token => {
            const matchResult = this.patternManager.findMatchingPattern(token);
            if (matchResult.match) {
                const category = matchResult.pattern.category;
                // 계기 태그는 제외 (공간 분석이 필요하므로)
                if (recognizedTags[category] && category !== 'instrument') {
                    const tagObject = this.createTagObject(token, category, matchResult);
                    // 중복 태그 방지 - 동일한 이름의 태그가 이미 있는지 확인
                    if (!recognizedTags[category].some(tag => tag.name === tagObject.name)) {
                        recognizedTags[category].push(tagObject);
                    }
                }
            }
        });

        console.log('인식된 태그 (단순 모드):', recognizedTags);
        return recognizedTags;
    }

    /**
     * 위치 정보가 포함된 고도화된 태그 인식 메서드
     * 각 텍스트 요소의 정확한 위치 정보를 활용하여 보다 정밀한 태그 인식을 수행합니다.
     * 특히 계기 태그의 경우 공간 분석을 통해 기능 코드와 번호를 매칭합니다.
     * 
     * @param {Array} textWithPositions - 위치 정보가 포함된 텍스트 요소 배열
     * @returns {Object} 인식된 태그들을 카테고리별로 분류한 객체
     */
    recognizeTagsWithPositions(textWithPositions) {
        const recognizedTags = {
            equipment: [],      // 장비 태그 배열
            line: [],          // 라인 태그 배열
            instrument: []     // 계기 태그 배열 (공간 분석 결과 포함)
        };

        // 장비와 라인 태그는 일반적인 방법으로 처리
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