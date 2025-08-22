# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a web application for processing P&ID (Piping & Instrumentation Diagram) PDF files to automatically identify and manually map relationships between equipment, line, and instrument tags, then export the data to Excel format.

**Target Users**: EPC engineers processing ~100 P&ID sheets per day
**Input**: Vector-based CAD PDF files (50-100 tags per page)
**Output**: Excel files with Equipment List, Line List, and Instrument List

## Architecture

The system follows a client-heavy web architecture with local data persistence:

### Frontend (Web Application)
- **PDF Processing**: PDF.js for rendering and text extraction
- **Tag Recognition**: User-defined regex patterns with real-time testing capability
- **Pattern Management**: UI for creating, editing, and testing custom regex patterns
- **Relationship Mapping**: Hotkey-driven UI (`R` for connections, `I` for installations)  
- **Data Export**: SheetJS/ExcelJS for Excel generation
- **Storage**: Browser LocalStorage + IndexedDB for project persistence

### Core Components Structure
```
├── PDF Viewer (left panel)
│   ├── PDF rendering with zoom/pan
│   ├── Tag highlighting overlay
│   └── Relationship visualization
└── Tag Panel (right panel)
    ├── Equipment/Line/Instrument tabs
    ├── Auto-recognized tag list
    └── Search/filter functionality
```

### Data Models

**Equipment**: P&ID Number, Equipment Tag, Equipment Type, Short Specification
**Line**: P&ID Number, Line Tag, Line Size, From Equipment, To Equipment  
**Instrument**: P&ID Number, Instrument Tag, Instrument Type, Installed On

**Relationships**: 
- Connection (A → B for flow/piping)
- Installation (A installed on B for instruments)

## Key User Workflows

1. **PDF Upload** → Automatic tag recognition via text pattern matching
2. **Tag Review** → Manual addition/correction of missed tags
3. **Relationship Mapping** → Hotkey mode entry + tag clicking sequence
4. **Export** → Generate Excel with 3 separate sheets

## Performance Requirements

- Process 5,000-10,000 tags per day (100 sheets × 50-100 tags)
- Tag recognition: < 5 seconds per sheet
- Relationship mapping: Real-time response
- Support PDF files up to 50MB

## Development Phases

**MVP (Phase 1)**: PDF viewer, basic tag recognition, hotkey mapping, Excel export, local storage
**Enhancement (Phase 2)**: Advanced recognition patterns, batch processing, templates
**Team Features (Phase 3)**: Multi-user support, cloud storage, collaboration

## Technical Constraints

- Browser-only application (Chrome, Edge, Firefox)
- Vector-based PDFs only (no scanned images)
- No standard P&ID format - must handle various tag naming conventions
- Local storage only (no server/cloud in MVP)