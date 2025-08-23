/**
 * Excel 내보내기 관리자 클래스 - Excel 파일 내보내기 기능을 처리합니다
 * 
 * 이 클래스는 P&ID 태그 매핑 프로젝트의 데이터를 EPC 엔지니어링 업계에서 일반적으로 사용하는
 * Excel 형식으로 변환하여 내보냅니다. XLSX.js 라이브러리를 사용하여 클라이언트 측에서 직접 Excel 파일을 생성합니다.
 * 
 * 생성되는 Excel 파일 구성:
 * - Equipment Sheet: 장비 목록 (P&ID Number, Equipment Tag, Type, Specification)
 * - Line Sheet: 배관 라인 목록 (P&ID Number, Line Tag, Size, From Equipment, To Equipment)
 * - Instrument Sheet: 계기 목록 (P&ID Number, Instrument Tag, Type, Installed On)
 * - Summary Sheet: 전체 통계 및 요약 정보
 * 
 * 주요 기능:
 * - 다중 시트를 포함한 Excel 파일 생성
 * - 산업 표준에 맞는 데이터 형식 및 컴럼 구성
 * - 자동 파일명 생성 (프로젝트명 + 타임스탬프)
 * - 오류 처리 및 사용자 피드백
 */
export class ExportManager {
    constructor() {
        this.workbook = null;                           // XLSX 워크북 객체 (임시 저장용)
        this.defaultWorkbookName = 'PID_Tag_Mapping';   // 기본 워크북 파일명
    }

    /**
     * Excel 파일 내보내기 메인 메서드
     * 프로젝트 데이터를 EPC 업계 표준 Excel 형식으로 변환하여 다운로드합니다.
     * 
     * @param {Object} project - 내보낼 프로젝트 데이터 (tags, relationships, metadata 포함)
     */
    exportToExcel(project) {
        try {
            // 1단계: 새로운 Excel 워크북 생성
            this.workbook = XLSX.utils.book_new();

            // 2단계: 각 카테고리별로 별도의 시트 생성
            this.createEquipmentSheet(project);   // 장비 목록 시트
            this.createLineSheet(project);        // 배관 라인 목록 시트
            this.createInstrumentSheet(project);  // 계기 목록 시트
            this.createSummarySheet(project);     // 전체 요약 및 통계 시트

            // 3단계: 파일명 생성 (프로젝트명 + 날짜)
            const filename = this.generateFilename(project);

            // 4단계: Excel 파일로 다운로드 실행
            XLSX.writeFile(this.workbook, filename);

            console.log('Excel 내보내기 성공적으로 완료:', filename);
            
        } catch (error) {
            console.error('Excel 내보내기 오류 발생:', error);
            alert('Excel 파일 생성에 실패했습니다. 브라우저 콘솔을 확인해주세요.');
        }
    }

    /**
     * 장비 목록 시트 생성 메서드
     * EPC 프로젝트에서 일반적으로 사용되는 Equipment List 형식으로 데이터를 구성합니다.
     * 
     * @param {Object} project - 프로젝트 데이터 객체
     */
    createEquipmentSheet(project) {
        const equipmentData = [];  // Excel 시트에 들어갈 2차원 배열 데이터

        // Excel 시트의 컴럼 헤더 정의 (EPC 업계 표준에 따른 컴럼명)
        equipmentData.push([
            'P&ID Number',      // P&ID 도면 번호
            'Equipment Tag',
            'Equipment Type',
            'Short Specification'
        ]);

        // Data rows
        project.tags.equipment.forEach(equipment => {
            equipmentData.push([
                this.getPIDNumber(project),
                equipment.name,
                equipment.type || '',
                equipment.spec || ''
            ]);
        });

        // Create worksheet
        const worksheet = XLSX.utils.aoa_to_sheet(equipmentData);

        // Set column widths
        worksheet['!cols'] = [
            { width: 15 }, // P&ID Number
            { width: 20 }, // Equipment Tag
            { width: 25 }, // Equipment Type
            { width: 30 }  // Short Specification
        ];

        // Apply formatting
        this.formatWorksheet(worksheet, equipmentData.length);

        // Add worksheet to workbook
        XLSX.utils.book_append_sheet(this.workbook, worksheet, 'Equipment List');
    }

    // Create Line List sheet
    createLineSheet(project) {
        const lineData = [];

        // Header row
        lineData.push([
            'P&ID Number',
            'Line Tag',
            'Line Size',
            'From Equipment',
            'To Equipment'
        ]);

        // Data rows
        project.tags.line.forEach(line => {
            const connections = this.getLineConnections(line, project.relationships.connections);
            
            lineData.push([
                this.getPIDNumber(project),
                line.name,
                line.size || '',
                connections.from || '',
                connections.to || ''
            ]);
        });

        // Create worksheet
        const worksheet = XLSX.utils.aoa_to_sheet(lineData);

        // Set column widths
        worksheet['!cols'] = [
            { width: 15 }, // P&ID Number
            { width: 20 }, // Line Tag
            { width: 12 }, // Line Size
            { width: 20 }, // From Equipment
            { width: 20 }  // To Equipment
        ];

        // Apply formatting
        this.formatWorksheet(worksheet, lineData.length);

        // Add worksheet to workbook
        XLSX.utils.book_append_sheet(this.workbook, worksheet, 'Line List');
    }

    // Create Instrument List sheet
    createInstrumentSheet(project) {
        const instrumentData = [];

        // Header row
        instrumentData.push([
            'P&ID Number',
            'Instrument Tag',
            'Instrument Type',
            'Installed On'
        ]);

        // Data rows
        project.tags.instrument.forEach(instrument => {
            const installation = this.getInstrumentInstallation(instrument, project.relationships.installations);
            
            instrumentData.push([
                this.getPIDNumber(project),
                instrument.name,
                instrument.type || '',
                installation || ''
            ]);
        });

        // Create worksheet
        const worksheet = XLSX.utils.aoa_to_sheet(instrumentData);

        // Set column widths
        worksheet['!cols'] = [
            { width: 15 }, // P&ID Number
            { width: 20 }, // Instrument Tag
            { width: 30 }, // Instrument Type
            { width: 25 }  // Installed On
        ];

        // Apply formatting
        this.formatWorksheet(worksheet, instrumentData.length);

        // Add worksheet to workbook
        XLSX.utils.book_append_sheet(this.workbook, worksheet, 'Instrument List');
    }

    // Create Summary sheet
    createSummarySheet(project) {
        const summaryData = [];

        // Project information
        summaryData.push(['Project Information', '']);
        summaryData.push(['Project Name', project.name]);
        summaryData.push(['P&ID Number', this.getPIDNumber(project)]);
        summaryData.push(['Created', new Date(project.created).toLocaleDateString('ko-KR')]);
        summaryData.push(['Modified', new Date(project.modified).toLocaleDateString('ko-KR')]);
        summaryData.push(['Exported', new Date().toLocaleDateString('ko-KR')]);
        summaryData.push(['', '']);

        // Tag statistics
        summaryData.push(['Tag Statistics', '']);
        summaryData.push(['Total Equipment', project.tags.equipment.length]);
        summaryData.push(['Total Lines', project.tags.line.length]);
        summaryData.push(['Total Instruments', project.tags.instrument.length]);
        summaryData.push(['Total Tags', this.getTotalTagCount(project)]);
        summaryData.push(['', '']);

        // Relationship statistics
        summaryData.push(['Relationship Statistics', '']);
        summaryData.push(['Connection Relationships', project.relationships.connections.length]);
        summaryData.push(['Installation Relationships', project.relationships.installations.length]);
        summaryData.push(['Total Relationships', this.getTotalRelationshipCount(project)]);
        summaryData.push(['', '']);

        // Tag breakdown by type
        summaryData.push(['Equipment Types', 'Count']);
        const equipmentTypes = this.getTagTypeBreakdown(project.tags.equipment);
        Object.entries(equipmentTypes).forEach(([type, count]) => {
            summaryData.push([type, count]);
        });
        summaryData.push(['', '']);

        summaryData.push(['Instrument Types', 'Count']);
        const instrumentTypes = this.getTagTypeBreakdown(project.tags.instrument);
        Object.entries(instrumentTypes).forEach(([type, count]) => {
            summaryData.push([type, count]);
        });

        // Create worksheet
        const worksheet = XLSX.utils.aoa_to_sheet(summaryData);

        // Set column widths
        worksheet['!cols'] = [
            { width: 25 }, // Label
            { width: 15 }  // Value
        ];

        // Apply formatting
        this.formatSummaryWorksheet(worksheet, summaryData.length);

        // Add worksheet to workbook
        XLSX.utils.book_append_sheet(this.workbook, worksheet, 'Summary');
    }

    // Helper function to get P&ID number
    getPIDNumber(project) {
        return project.pidNumber || project.name || 'PID-001';
    }

    // Helper function to get line connections
    getLineConnections(line, connections) {
        const result = { from: '', to: '' };
        
        connections.forEach(conn => {
            if (conn.to.id === line.id) {
                result.from = conn.from.name;
            }
            if (conn.from.id === line.id) {
                result.to = conn.to.name;
            }
        });

        return result;
    }

    // Helper function to get instrument installation
    getInstrumentInstallation(instrument, installations) {
        const installation = installations.find(inst => inst.from.id === instrument.id);
        return installation ? installation.to.name : '';
    }

    // Helper function to get total tag count
    getTotalTagCount(project) {
        return Object.values(project.tags).reduce((total, tags) => total + tags.length, 0);
    }

    // Helper function to get total relationship count
    getTotalRelationshipCount(project) {
        return Object.values(project.relationships).reduce((total, rels) => total + rels.length, 0);
    }

    // Helper function to get tag type breakdown
    getTagTypeBreakdown(tags) {
        const breakdown = {};
        tags.forEach(tag => {
            const type = tag.type || 'Unknown';
            breakdown[type] = (breakdown[type] || 0) + 1;
        });
        return breakdown;
    }

    // Format worksheet with basic styling
    formatWorksheet(worksheet, rowCount) {
        // Header row formatting
        const headerRange = XLSX.utils.encode_range({ s: { c: 0, r: 0 }, e: { c: 10, r: 0 } });
        
        // Apply bold formatting to header (this is a basic implementation)
        // For more advanced formatting, you might need xlsx-style or similar
        if (worksheet['A1']) {
            worksheet['A1'].s = {
                font: { bold: true },
                fill: { fgColor: { rgb: "EEEEEE" } }
            };
        }

        // Freeze header row
        worksheet['!freeze'] = { xSplit: 0, ySplit: 1 };
    }

    // Format summary worksheet
    formatSummaryWorksheet(worksheet, rowCount) {
        // Apply formatting to section headers
        ['A1', 'A8', 'A14', 'A19'].forEach(cell => {
            if (worksheet[cell]) {
                worksheet[cell].s = {
                    font: { bold: true, size: 12 },
                    fill: { fgColor: { rgb: "DDDDDD" } }
                };
            }
        });
    }

    // Generate filename
    generateFilename(project) {
        const date = new Date().toISOString().split('T')[0];
        const projectName = project.name.replace(/[^a-zA-Z0-9]/g, '_');
        return `${projectName}_${date}.xlsx`;
    }

    // Export individual sheets
    exportEquipmentOnly(project) {
        this.workbook = XLSX.utils.book_new();
        this.createEquipmentSheet(project);
        const filename = `Equipment_List_${this.generateFilename(project)}`;
        XLSX.writeFile(this.workbook, filename);
    }

    exportLineOnly(project) {
        this.workbook = XLSX.utils.book_new();
        this.createLineSheet(project);
        const filename = `Line_List_${this.generateFilename(project)}`;
        XLSX.writeFile(this.workbook, filename);
    }

    exportInstrumentOnly(project) {
        this.workbook = XLSX.utils.book_new();
        this.createInstrumentSheet(project);
        const filename = `Instrument_List_${this.generateFilename(project)}`;
        XLSX.writeFile(this.workbook, filename);
    }

    // Export relationships as separate sheets
    exportRelationships(project) {
        this.workbook = XLSX.utils.book_new();
        
        // Connections sheet
        const connectionsData = [['From Tag', 'From Type', 'To Tag', 'To Type', 'Created']];
        project.relationships.connections.forEach(conn => {
            connectionsData.push([
                conn.from.name,
                conn.from.type,
                conn.to.name,
                conn.to.type,
                new Date(conn.created).toLocaleDateString('ko-KR')
            ]);
        });
        
        const connectionsSheet = XLSX.utils.aoa_to_sheet(connectionsData);
        connectionsSheet['!cols'] = [
            { width: 20 }, { width: 20 }, { width: 20 }, { width: 20 }, { width: 15 }
        ];
        XLSX.utils.book_append_sheet(this.workbook, connectionsSheet, 'Connections');

        // Installations sheet
        const installationsData = [['Instrument', 'Instrument Type', 'Installed On', 'Target Type', 'Created']];
        project.relationships.installations.forEach(inst => {
            installationsData.push([
                inst.from.name,
                inst.from.type,
                inst.to.name,
                inst.to.type,
                new Date(inst.created).toLocaleDateString('ko-KR')
            ]);
        });
        
        const installationsSheet = XLSX.utils.aoa_to_sheet(installationsData);
        installationsSheet['!cols'] = [
            { width: 20 }, { width: 25 }, { width: 20 }, { width: 20 }, { width: 15 }
        ];
        XLSX.utils.book_append_sheet(this.workbook, installationsSheet, 'Installations');

        const filename = `Relationships_${this.generateFilename(project)}`;
        XLSX.writeFile(this.workbook, filename);
    }

    // Create custom template
    createTemplate() {
        this.workbook = XLSX.utils.book_new();

        // Equipment template
        const equipmentTemplate = [
            ['P&ID Number', 'Equipment Tag', 'Equipment Type', 'Short Specification'],
            ['PID-001', 'P-101', 'Centrifugal Pump', '100 GPM @ 100 ft'],
            ['PID-001', 'T-201', 'Storage Tank', '1000 gal capacity'],
            ['PID-001', 'E-301', 'Shell & Tube HX', '1.0 MMBtu/hr']
        ];

        const equipmentSheet = XLSX.utils.aoa_to_sheet(equipmentTemplate);
        equipmentSheet['!cols'] = [{ width: 15 }, { width: 20 }, { width: 25 }, { width: 30 }];
        XLSX.utils.book_append_sheet(this.workbook, equipmentSheet, 'Equipment Template');

        // Line template
        const lineTemplate = [
            ['P&ID Number', 'Line Tag', 'Line Size', 'From Equipment', 'To Equipment'],
            ['PID-001', '2"-P-101-A', '2"', 'T-201', 'P-101'],
            ['PID-001', '2"-P-101-B', '2"', 'P-101', 'E-301']
        ];

        const lineSheet = XLSX.utils.aoa_to_sheet(lineTemplate);
        lineSheet['!cols'] = [{ width: 15 }, { width: 20 }, { width: 12 }, { width: 20 }, { width: 20 }];
        XLSX.utils.book_append_sheet(this.workbook, lineSheet, 'Line Template');

        // Instrument template
        const instrumentTemplate = [
            ['P&ID Number', 'Instrument Tag', 'Instrument Type', 'Installed On'],
            ['PID-001', 'FT-101', 'Flow Transmitter', '2"-P-101-A'],
            ['PID-001', 'PT-201', 'Pressure Transmitter', 'T-201'],
            ['PID-001', 'TIC-301', 'Temperature Indicator Controller', 'E-301']
        ];

        const instrumentSheet = XLSX.utils.aoa_to_sheet(instrumentTemplate);
        instrumentSheet['!cols'] = [{ width: 15 }, { width: 20 }, { width: 30 }, { width: 25 }];
        XLSX.utils.book_append_sheet(this.workbook, instrumentSheet, 'Instrument Template');

        const filename = 'PID_Tag_Mapping_Template.xlsx';
        XLSX.writeFile(this.workbook, filename);
    }
}