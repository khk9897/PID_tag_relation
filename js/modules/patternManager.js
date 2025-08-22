// Pattern Manager - Handles user-defined regex patterns for tag recognition
export class PatternManager {
    constructor() {
        this.defaultPatterns = {
            "Line_number": {
                pattern: "^.+-[A-Z\\d]{1,4}-\\s?\\d{3,5}-[A-Z\\d]{3,7}$",
                color: "#FFFF00", // Yellow
                description: "Line number format (e.g., 100-PS-1234-A1B2)",
                category: "line",
                enabled: true
            },
            "Equipment_number": {
                pattern: "^[A-Z\\d]+-[A-Z]{1,2}-\\d{4}$",
                color: "#008000", // Green
                description: "Equipment number format (e.g., V28-E-0003)",
                category: "equipment",
                enabled: true
            },
            "Instrument_number": {
                pattern: "^\\d{4}\\s?[A-Za-z0-9-]{0,3}$",
                color: "#FF0000", // Red
                description: "Instrument number format (e.g., 1234)",
                category: "instrument",
                enabled: true
            },
            "Instrument_function": {
                pattern: "^[A-Z]{2,4}$",
                color: "#0000FF", // Blue
                description: "Instrument function code (e.g., PT, TT, FT)",
                category: "instrument",
                enabled: true
            }
        };

        this.userPatterns = this.loadUserPatterns();
    }

    // Get all active patterns (default + user patterns)
    getActivePatterns() {
        const allPatterns = { ...this.defaultPatterns, ...this.userPatterns };
        const activePatterns = {};
        
        Object.keys(allPatterns).forEach(key => {
            if (allPatterns[key].enabled) {
                activePatterns[key] = allPatterns[key];
            }
        });
        
        return activePatterns;
    }

    // Get patterns by category
    getPatternsByCategory(category) {
        const activePatterns = this.getActivePatterns();
        const categoryPatterns = {};
        
        Object.keys(activePatterns).forEach(key => {
            if (activePatterns[key].category === category) {
                categoryPatterns[key] = activePatterns[key];
            }
        });
        
        return categoryPatterns;
    }

    // Test a pattern against text
    testPattern(pattern, text) {
        try {
            const regex = new RegExp(pattern);
            return regex.test(text);
        } catch (error) {
            console.error('Invalid regex pattern:', error);
            return false;
        }
    }

    // Validate regex pattern
    validatePattern(pattern) {
        try {
            new RegExp(pattern);
            return { valid: true, error: null };
        } catch (error) {
            return { valid: false, error: error.message };
        }
    }

    // Find matching pattern for text
    findMatchingPattern(text) {
        const activePatterns = this.getActivePatterns();
        
        // Priority order for pattern matching
        const priorityOrder = [
            "Line_number",
            "Equipment_number", 
            "Instrument_number",
            "Instrument_function"
        ];
        
        // Check priority patterns first
        for (const patternName of priorityOrder) {
            if (activePatterns[patternName] && this.testPattern(activePatterns[patternName].pattern, text)) {
                return {
                    name: patternName,
                    pattern: activePatterns[patternName],
                    match: true
                };
            }
        }
        
        // Check remaining user patterns
        for (const [patternName, patternInfo] of Object.entries(activePatterns)) {
            if (!priorityOrder.includes(patternName) && this.testPattern(patternInfo.pattern, text)) {
                return {
                    name: patternName,
                    pattern: patternInfo,
                    match: true
                };
            }
        }
        
        return { match: false };
    }

    // Add or update user pattern
    saveUserPattern(name, patternData) {
        // Validate pattern
        const validation = this.validatePattern(patternData.pattern);
        if (!validation.valid) {
            throw new Error(`Invalid regex pattern: ${validation.error}`);
        }

        // Ensure required fields
        const pattern = {
            pattern: patternData.pattern,
            color: patternData.color || "#808080",
            description: patternData.description || "",
            category: patternData.category || "custom",
            enabled: patternData.enabled !== undefined ? patternData.enabled : true,
            userDefined: true,
            created: new Date().toISOString()
        };

        this.userPatterns[name] = pattern;
        this.saveUserPatternsToStorage();
        
        return pattern;
    }

    // Delete user pattern
    deleteUserPattern(name) {
        if (this.userPatterns[name]) {
            delete this.userPatterns[name];
            this.saveUserPatternsToStorage();
            return true;
        }
        return false;
    }

    // Enable/disable pattern
    togglePattern(name, enabled) {
        if (this.defaultPatterns[name]) {
            this.defaultPatterns[name].enabled = enabled;
        } else if (this.userPatterns[name]) {
            this.userPatterns[name].enabled = enabled;
        }
        this.saveUserPatternsToStorage();
    }

    // Update existing pattern
    updatePattern(name, updates) {
        let targetPattern = null;
        
        if (this.userPatterns[name]) {
            targetPattern = this.userPatterns[name];
        } else if (this.defaultPatterns[name] && updates.pattern) {
            // If updating default pattern's regex, create user override
            this.userPatterns[name] = { ...this.defaultPatterns[name] };
            targetPattern = this.userPatterns[name];
        } else if (this.defaultPatterns[name]) {
            targetPattern = this.defaultPatterns[name];
        }
        
        if (!targetPattern) {
            throw new Error(`Pattern '${name}' not found`);
        }

        // Validate new pattern if provided
        if (updates.pattern) {
            const validation = this.validatePattern(updates.pattern);
            if (!validation.valid) {
                throw new Error(`Invalid regex pattern: ${validation.error}`);
            }
        }

        // Apply updates
        Object.assign(targetPattern, updates);
        targetPattern.modified = new Date().toISOString();
        
        this.saveUserPatternsToStorage();
        return targetPattern;
    }

    // Get pattern statistics
    getPatternStatistics(recognizedTags) {
        const stats = {
            totalPatterns: Object.keys(this.getActivePatterns()).length,
            enabledPatterns: Object.values(this.getActivePatterns()).filter(p => p.enabled).length,
            userDefinedPatterns: Object.keys(this.userPatterns).length,
            patternUsage: {}
        };

        // Count usage of each pattern
        Object.values(recognizedTags).flat().forEach(tag => {
            if (tag.patternName) {
                stats.patternUsage[tag.patternName] = (stats.patternUsage[tag.patternName] || 0) + 1;
            }
        });

        return stats;
    }

    // Export patterns for sharing
    exportPatterns() {
        return {
            userPatterns: this.userPatterns,
            defaultOverrides: this.getDefaultOverrides(),
            exportDate: new Date().toISOString()
        };
    }

    // Import patterns from export
    importPatterns(importData) {
        try {
            if (importData.userPatterns) {
                // Validate all patterns before importing
                for (const [name, pattern] of Object.entries(importData.userPatterns)) {
                    const validation = this.validatePattern(pattern.pattern);
                    if (!validation.valid) {
                        throw new Error(`Invalid pattern '${name}': ${validation.error}`);
                    }
                }
                
                // Import patterns
                Object.assign(this.userPatterns, importData.userPatterns);
            }
            
            // Apply default overrides
            if (importData.defaultOverrides) {
                Object.keys(importData.defaultOverrides).forEach(name => {
                    if (this.defaultPatterns[name]) {
                        Object.assign(this.defaultPatterns[name], importData.defaultOverrides[name]);
                    }
                });
            }
            
            this.saveUserPatternsToStorage();
            return true;
        } catch (error) {
            console.error('Error importing patterns:', error);
            throw error;
        }
    }

    // Get modified default patterns for export
    getDefaultOverrides() {
        const overrides = {};
        Object.keys(this.defaultPatterns).forEach(name => {
            const pattern = this.defaultPatterns[name];
            if (pattern.modified || !pattern.enabled) {
                overrides[name] = {
                    enabled: pattern.enabled,
                    modified: pattern.modified
                };
            }
        });
        return overrides;
    }

    // Reset patterns to defaults
    resetToDefaults() {
        this.userPatterns = {};
        
        // Reset default patterns
        Object.keys(this.defaultPatterns).forEach(name => {
            this.defaultPatterns[name] = { ...this.getOriginalDefaultPattern(name) };
        });
        
        this.saveUserPatternsToStorage();
    }

    // Get original default pattern (without modifications)
    getOriginalDefaultPattern(name) {
        const originalDefaults = {
            "Line_number": {
                pattern: "^.+-[A-Z\\d]{1,4}-\\s?\\d{3,5}-[A-Z\\d]{3,7}$",
                color: "#FFFF00",
                description: "Line number format (e.g., 100-PS-1234-A1B2)",
                category: "line",
                enabled: true
            },
            "Equipment_number": {
                pattern: "^[A-Z\\d]+-[A-Z]{1,2}-\\d{4}$",
                color: "#008000",
                description: "Equipment number format (e.g., V28-E-0003)",
                category: "equipment",
                enabled: true
            },
            "Instrument_number": {
                pattern: "^\\d{4}\\s?[A-Za-z0-9-]{0,3}$",
                color: "#FF0000",
                description: "Instrument number format (e.g., 1234)",
                category: "instrument",
                enabled: true
            },
            "Instrument_function": {
                pattern: "^[A-Z]{2,4}$",
                color: "#0000FF",
                description: "Instrument function code (e.g., PT, TT, FT)",
                category: "instrument",
                enabled: true
            }
        };
        return originalDefaults[name];
    }

    // Load user patterns from localStorage
    loadUserPatterns() {
        try {
            const stored = localStorage.getItem('pid_tag_mapping_user_patterns');
            return stored ? JSON.parse(stored) : {};
        } catch (error) {
            console.error('Error loading user patterns:', error);
            return {};
        }
    }

    // Save user patterns to localStorage
    saveUserPatternsToStorage() {
        try {
            localStorage.setItem('pid_tag_mapping_user_patterns', JSON.stringify(this.userPatterns));
            
            // Also save default pattern modifications
            const defaultMods = {};
            Object.keys(this.defaultPatterns).forEach(name => {
                if (this.defaultPatterns[name].modified || !this.defaultPatterns[name].enabled) {
                    defaultMods[name] = {
                        enabled: this.defaultPatterns[name].enabled,
                        modified: this.defaultPatterns[name].modified
                    };
                }
            });
            localStorage.setItem('pid_tag_mapping_default_modifications', JSON.stringify(defaultMods));
            
        } catch (error) {
            console.error('Error saving patterns:', error);
        }
    }

    // Load default pattern modifications
    loadDefaultModifications() {
        try {
            const stored = localStorage.getItem('pid_tag_mapping_default_modifications');
            if (stored) {
                const modifications = JSON.parse(stored);
                Object.keys(modifications).forEach(name => {
                    if (this.defaultPatterns[name]) {
                        Object.assign(this.defaultPatterns[name], modifications[name]);
                    }
                });
            }
        } catch (error) {
            console.error('Error loading default modifications:', error);
        }
    }

    // Get common regex patterns as suggestions
    getPatternSuggestions() {
        return {
            "Equipment Patterns": [
                "^[A-Z]+-\\d{3}[A-Z]?$", // P-101, T-201A
                "^[A-Z]{2}-\\d{4}$", // HX-1001
                "^\\d{2}-[A-Z]-\\d{3}$" // 10-P-101
            ],
            "Line Patterns": [
                "^\\d+\"-[A-Z]+-\\d{3}-[A-Z]$", // 2"-P-101-A
                "^\\d{3}-[A-Z]{2}-\\d{2}-[A-Z]$", // 101-PS-01-A
                "^L-\\d{3}[A-Z]?$" // L-101, L-201A
            ],
            "Instrument Patterns": [
                "^[A-Z]{2,3}-\\d{3}[A-Z]?$", // PT-101, FIC-201A
                "^\\d{4}[A-Z]?$", // 1234, 5678A
                "^[A-Z]{2}\\d{4}$" // PT1234
            ],
            "Common Elements": [
                "\\d{3,4}", // 3-4 digits
                "[A-Z]{1,3}", // 1-3 uppercase letters
                "[A-Z]+-\\d+", // Letters-Numbers
                "^[A-Z]+$", // All uppercase
                "\\b[A-Z]{2,}\\b" // Word boundary uppercase
            ]
        };
    }

    // Initialize pattern manager
    init() {
        this.loadDefaultModifications();
        console.log('PatternManager initialized with', Object.keys(this.getActivePatterns()).length, 'active patterns');
    }
}