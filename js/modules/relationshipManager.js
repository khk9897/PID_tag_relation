// Relationship Manager - Handles tag relationships and mapping logic
export class RelationshipManager {
    constructor() {
        this.relationshipTypes = {
            connection: {
                name: '연결관계',
                description: 'A에서 B로 연결 (파이프라인, 흐름)',
                symbol: '→',
                color: '#28a745'
            },
            installation: {
                name: '설치관계',
                description: 'A가 B에 설치됨 (계기가 장비/파이프에 설치)',
                symbol: '⚙',
                color: '#ffc107'
            }
        };

        this.validRelationships = {
            // Equipment can connect to equipment or lines
            equipment: {
                connection: ['equipment', 'line'],
                installation: ['equipment'] // Equipment can be installed on other equipment
            },
            // Lines connect equipment to equipment or other lines
            line: {
                connection: ['equipment', 'line'],
                installation: [] // Lines are not typically "installed" on something
            },
            // Instruments are usually installed on equipment or lines
            instrument: {
                connection: ['instrument'], // Instruments can connect to other instruments (signals)
                installation: ['equipment', 'line'] // Instruments installed on equipment/lines
            }
        };
    }

    // Validate if a relationship is allowed between two tag types
    isValidRelationship(fromType, toType, relationshipType) {
        const validTargets = this.validRelationships[fromType]?.[relationshipType];
        return validTargets && validTargets.includes(toType);
    }

    // Create a new relationship
    createRelationship(fromTag, toTag, relationshipType, additionalData = {}) {
        // Validate relationship
        if (!this.isValidRelationship(fromTag.category, toTag.category, relationshipType)) {
            throw new Error(`${fromTag.category}에서 ${toTag.category}로의 ${relationshipType} 관계는 허용되지 않습니다.`);
        }

        const relationship = {
            id: this.generateRelationshipId(),
            type: relationshipType,
            from: {
                id: fromTag.id,
                name: fromTag.name,
                category: fromTag.category,
                type: fromTag.type
            },
            to: {
                id: toTag.id,
                name: toTag.name,
                category: toTag.category,
                type: toTag.type
            },
            created: new Date().toISOString(),
            description: this.generateRelationshipDescription(fromTag, toTag, relationshipType),
            ...additionalData
        };

        return relationship;
    }

    // Generate unique relationship ID
    generateRelationshipId() {
        return `rel_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }

    // Generate human-readable relationship description
    generateRelationshipDescription(fromTag, toTag, relationshipType) {
        const typeInfo = this.relationshipTypes[relationshipType];
        
        if (relationshipType === 'connection') {
            return `${fromTag.name}에서 ${toTag.name}으로 연결`;
        } else if (relationshipType === 'installation') {
            return `${fromTag.name}이(가) ${toTag.name}에 설치됨`;
        }
        
        return `${fromTag.name} ${typeInfo.symbol} ${toTag.name}`;
    }

    // Find all relationships involving a specific tag
    findRelationshipsForTag(relationships, tagId) {
        const found = {
            asSource: [],
            asTarget: [],
            all: []
        };

        Object.values(relationships).flat().forEach(rel => {
            if (rel.from.id === tagId) {
                found.asSource.push(rel);
                found.all.push(rel);
            }
            if (rel.to.id === tagId) {
                found.asTarget.push(rel);
                found.all.push(rel);
            }
        });

        return found;
    }

    // Get relationship statistics
    getRelationshipStatistics(relationships) {
        const stats = {
            total: 0,
            byType: {},
            byTagCategory: {
                equipment: { asSource: 0, asTarget: 0 },
                line: { asSource: 0, asTarget: 0 },
                instrument: { asSource: 0, asTarget: 0 }
            }
        };

        Object.keys(relationships).forEach(type => {
            const rels = relationships[type];
            stats.byType[type] = rels.length;
            stats.total += rels.length;

            rels.forEach(rel => {
                stats.byTagCategory[rel.from.category].asSource++;
                stats.byTagCategory[rel.to.category].asTarget++;
            });
        });

        return stats;
    }

    // Validate relationship consistency
    validateRelationships(relationships, tags) {
        const issues = [];

        Object.values(relationships).flat().forEach(rel => {
            // Check if referenced tags exist
            const fromTagExists = this.tagExists(tags, rel.from.id);
            const toTagExists = this.tagExists(tags, rel.to.id);

            if (!fromTagExists) {
                issues.push({
                    type: 'missing_source_tag',
                    relationship: rel,
                    message: `소스 태그 '${rel.from.name}' (${rel.from.id})가 존재하지 않습니다.`
                });
            }

            if (!toTagExists) {
                issues.push({
                    type: 'missing_target_tag',
                    relationship: rel,
                    message: `대상 태그 '${rel.to.name}' (${rel.to.id})가 존재하지 않습니다.`
                });
            }

            // Check for circular references
            if (rel.from.id === rel.to.id) {
                issues.push({
                    type: 'circular_reference',
                    relationship: rel,
                    message: `태그가 자기 자신과 관계를 가질 수 없습니다: ${rel.from.name}`
                });
            }
        });

        return issues;
    }

    // Helper function to check if tag exists
    tagExists(tags, tagId) {
        return Object.values(tags).flat().some(tag => tag.id === tagId);
    }

    // Find duplicate relationships
    findDuplicateRelationships(relationships) {
        const duplicates = [];
        const seen = new Set();

        Object.values(relationships).flat().forEach(rel => {
            const key = `${rel.from.id}_${rel.to.id}_${rel.type}`;
            
            if (seen.has(key)) {
                duplicates.push(rel);
            } else {
                seen.add(key);
            }
        });

        return duplicates;
    }

    // Export relationships for Excel
    exportForExcel(relationships, tags) {
        const exported = {
            connections: [],
            installations: []
        };

        Object.keys(relationships).forEach(type => {
            relationships[type].forEach(rel => {
                const exportItem = {
                    'From Tag': rel.from.name,
                    'From Type': rel.from.type,
                    'From Category': rel.from.category,
                    'To Tag': rel.to.name,
                    'To Type': rel.to.type,
                    'To Category': rel.to.category,
                    'Relationship': this.relationshipTypes[rel.type].name,
                    'Description': rel.description,
                    'Created': new Date(rel.created).toLocaleDateString('ko-KR')
                };

                exported[type].push(exportItem);
            });
        });

        return exported;
    }

    // Generate relationship matrix for visualization
    generateRelationshipMatrix(relationships, tags) {
        const allTags = Object.values(tags).flat();
        const matrix = {};

        // Initialize matrix
        allTags.forEach(tag => {
            matrix[tag.id] = {};
            allTags.forEach(otherTag => {
                matrix[tag.id][otherTag.id] = null;
            });
        });

        // Fill matrix with relationships
        Object.values(relationships).flat().forEach(rel => {
            if (matrix[rel.from.id] && matrix[rel.from.id][rel.to.id] !== undefined) {
                matrix[rel.from.id][rel.to.id] = {
                    type: rel.type,
                    relationship: rel
                };
            }
        });

        return matrix;
    }

    // Suggest potential relationships based on naming patterns
    suggestRelationships(tags) {
        const suggestions = [];
        const allTags = Object.values(tags).flat();

        // Suggest equipment to line connections based on naming
        tags.equipment.forEach(equipment => {
            tags.line.forEach(line => {
                if (this.isLikelyConnection(equipment, line)) {
                    suggestions.push({
                        from: equipment,
                        to: line,
                        type: 'connection',
                        confidence: this.calculateConnectionConfidence(equipment, line),
                        reason: '태그명 패턴 기반 연결 가능성'
                    });
                }
            });
        });

        // Suggest instrument installations
        tags.instrument.forEach(instrument => {
            [...tags.equipment, ...tags.line].forEach(target => {
                if (this.isLikelyInstallation(instrument, target)) {
                    suggestions.push({
                        from: instrument,
                        to: target,
                        type: 'installation',
                        confidence: this.calculateInstallationConfidence(instrument, target),
                        reason: '계기 유형과 대상 호환성'
                    });
                }
            });
        });

        return suggestions.sort((a, b) => b.confidence - a.confidence);
    }

    // Helper functions for relationship suggestions
    isLikelyConnection(equipment, line) {
        // Check if equipment tag number appears in line tag
        const equipNum = equipment.name.match(/\d{3}/);
        const lineNum = line.name.match(/\d{3}/);
        
        return equipNum && lineNum && equipNum[0] === lineNum[0];
    }

    isLikelyInstallation(instrument, target) {
        // Flow instruments typically installed on lines
        if (instrument.name.startsWith('F') && target.category === 'line') {
            return true;
        }
        
        // Temperature/Pressure instruments on equipment
        if ((instrument.name.startsWith('T') || instrument.name.startsWith('P')) && 
            target.category === 'equipment') {
            return true;
        }
        
        return false;
    }

    calculateConnectionConfidence(equipment, line) {
        let confidence = 0;
        
        // Same number sequence
        const equipNum = equipment.name.match(/\d{3}/);
        const lineNum = line.name.match(/\d{3}/);
        if (equipNum && lineNum && equipNum[0] === lineNum[0]) {
            confidence += 0.7;
        }
        
        // Compatible types
        if (equipment.type === 'Pump' && line.service === 'P') {
            confidence += 0.2;
        }
        
        return Math.min(confidence, 1.0);
    }

    calculateInstallationConfidence(instrument, target) {
        let confidence = 0;
        
        // Type compatibility
        if (instrument.type.includes('Flow') && target.category === 'line') {
            confidence += 0.6;
        }
        
        if ((instrument.type.includes('Temperature') || instrument.type.includes('Pressure')) && 
            target.category === 'equipment') {
            confidence += 0.6;
        }
        
        // Number matching
        const instNum = instrument.name.match(/\d{3}/);
        const targetNum = target.name.match(/\d{3}/);
        if (instNum && targetNum && instNum[0] === targetNum[0]) {
            confidence += 0.3;
        }
        
        return Math.min(confidence, 1.0);
    }
}