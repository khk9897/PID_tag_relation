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
- **PDF Processing**: PDF.js for rendering, text extraction with positional data
- **Visual System**: Canvas-based overlay for tag highlighting and selection feedback
- **Tag Recognition**: User-defined regex patterns + spatial analysis for instruments
- **Pattern Management**: UI for creating, editing, and testing custom regex patterns
- **Real-time Synchronization**: Tag panel ↔ PDF highlighting integration
- **Page Management**: Current page filtering and automatic navigation
- **Relationship Mapping**: Hotkey-driven UI (`R` for connections, `I` for installations)  
- **Data Export**: SheetJS/ExcelJS for Excel generation
- **Storage**: Browser LocalStorage + IndexedDB for project persistence

### Core Components Structure
```
├── PDF Viewer (left panel)
│   ├── PDF rendering with zoom/pan/page navigation
│   ├── Real-time tag highlighting overlay system
│   ├── Color-coded tag categories (Equipment/Line/Instrument)
│   ├── Selected tag visual feedback with animations
│   └── Function+Number labels for instruments
└── Tag Panel (right panel)
    ├── Equipment/Line/Instrument tabs with counters
    ├── Current page tag filtering
    ├── Auto-recognized tag list with position data
    ├── Tag selection synchronization with PDF
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

1. **PDF Upload** → Automatic tag recognition via pattern matching + spatial analysis
2. **Visual Review** → Tags highlighted on PDF with color coding and labels
3. **Page Navigation** → Current page tag filtering, automatic tag-to-page navigation
4. **Tag Selection** → Click tag in panel → visual feedback in PDF with animations
5. **Tag Review** → Manual addition/correction of missed tags
6. **Relationship Mapping** → Hotkey mode entry + tag clicking sequence
7. **Export** → Generate Excel with 3 separate sheets

## Current Implementation Features

### PDF Highlighting System
- Real-time tag overlay on PDF canvas
- Color-coded categories: Equipment (green), Line (yellow), Instrument (blue)
- Enhanced visibility: padding, borders, shadows, animations
- Selected tag feedback: scaling, glowing, pulse animation
- Function+Number labels for instruments (e.g., "FT: 101")

### Page-based Tag Management
- Current page tag filtering in right panel
- Page counter display (current/total tags)
- Automatic page navigation when selecting tags from other pages
- Visual indicators for current page tags

## Performance Requirements

- Process 5,000-10,000 tags per day (100 sheets × 50-100 tags)
- Tag recognition: < 5 seconds per sheet
- Relationship mapping: Real-time response
- Support PDF files up to 50MB

## Development Phases

**✅ MVP (Phase 1 - COMPLETED)**: 
- PDF viewer with highlighting system
- User-defined regex pattern recognition
- Spatial analysis for instrument matching
- Real-time tag visualization and selection
- Page-based tag filtering and navigation
- Hotkey relationship mapping
- Excel export with multiple sheets
- Local storage and auto-save

**🔄 Enhancement (Phase 2)**: 
- Advanced recognition patterns and templates
- Batch processing capabilities
- Pattern sharing and import/export
- Performance optimizations

**📋 Team Features (Phase 3)**: 
- Multi-user support and collaboration
- Cloud storage integration
- Project sharing and version control

## Technical Constraints

- Browser-only application (Chrome, Edge, Firefox)
- Vector-based PDFs only (no scanned images)
- No standard P&ID format - must handle various tag naming conventions
- Local storage only (no server/cloud in MVP)