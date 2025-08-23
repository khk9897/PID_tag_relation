# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Development Commands

### Starting the Application
```bash
# Install dependencies (first time only)
npm install

# Start development server (with live reload)
npm run dev

# Start production server
npm start

# Manual server start (Python alternative)
python -m http.server 8000
```

### Development Workflow
- **No build process required** - This is a vanilla JavaScript application that runs directly in the browser
- **Live development** - Changes to JS/CSS/HTML are immediately reflected on browser refresh
- **Local development** - Application runs entirely client-side with no backend dependencies
- **Testing** - Manual testing through browser interface with PDF file uploads

## Project Overview

This is a web application for processing P&ID (Piping & Instrumentation Diagram) PDF files to automatically identify and manually map relationships between equipment, line, and instrument tags, then export the data to Excel format.

**Target Users**: EPC engineers processing ~100 P&ID sheets per day
**Input**: Vector-based CAD PDF files (50-100 tags per page)
**Output**: Excel files with Equipment List, Line List, and Instrument List

## Code Architecture

### Application Structure
This is a modular ES6+ JavaScript application with the following key architectural patterns:

**Main Application Class**: `PIDApp` in `js/app.js` serves as the central controller that:
- Instantiates and coordinates all manager modules
- Handles UI event delegation and state management
- Manages PDF-to-tag panel synchronization through callback systems
- Controls application modes (normal, connection mapping, installation mapping)

**Module Architecture**: Each major functionality is encapsulated in ES6 classes:
- `PDFManager`: PDF.js integration, canvas overlay system, multi-selection with drag/Ctrl+click
- `TagManager`: Regex pattern matching, spatial analysis for instrument function-number pairing
- `PatternManager`: User-defined regex patterns with validation and testing
- `RelationshipManager`: Tag relationship creation and management
- `StorageManager`: LocalStorage/IndexedDB persistence layer
- `ExportManager`: Excel file generation with multiple sheets

**Key Architectural Decisions**:
- **No build system** - Direct ES6 module imports for simplicity
- **Event-driven communication** - Managers communicate via callbacks, not tight coupling  
- **Canvas-based visualization** - PDF overlay system using HTML5 Canvas for zoom-responsive highlighting
- **Client-side only** - No server dependencies, all processing in browser
- **Modular CSS** - Component-based styling with BEM-like naming conventions

### Multi-Selection System Architecture
The application implements a sophisticated dual-selection system:
- **PDF Selection**: Drag rectangles and Ctrl+click on PDF highlights managed by `PDFManager`
- **Panel Selection**: Tag list selections in right panel managed by `selectedTagsManager`
- **Bidirectional Sync**: Changes in either system update both PDF highlights and panel selections
- **Visual Feedback**: Different highlight styles for single vs multi-selection with CSS animations

## System Architecture

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
4. **Tag Selection** → Bidirectional selection between tag panel and PDF highlights
5. **Tag Review** → Manual addition/correction of missed tags with reset functionality
6. **Relationship Mapping** → Hotkey mode entry + tag clicking sequence
7. **Export** → Generate Excel with 3 separate sheets

## Current Implementation Features

### PDF Highlighting System
- Real-time tag overlay on PDF canvas with zoom-responsive positioning
- Color-coded categories: Equipment (green), Line (yellow), Instrument (blue)
- Enhanced visibility: padding, borders, shadows, animations
- Selected tag feedback: scaling, glowing, pulse animation with proper color restoration
- Bidirectional selection: Click PDF highlights → select corresponding tag in panel
- Function+Number labels for instruments (e.g., "PT-1234")
- Smart positioning that adapts to zoom level changes

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
- PDF viewer with zoom-responsive highlighting system
- User-defined regex pattern recognition with pattern settings UI
- Spatial analysis for instrument function matching (in progress)
- Real-time bidirectional tag visualization and selection
- Page-based tag filtering and navigation
- Hotkey relationship mapping with visual feedback
- Excel export with multiple sheets
- Local storage with project reset functionality

**🔄 Enhancement (Phase 2)**: 
- Advanced recognition patterns and templates
- Batch processing capabilities
- Pattern sharing and import/export
- Performance optimizations

**📋 Team Features (Phase 3)**: 
- Multi-user support and collaboration
- Cloud storage integration
- Project sharing and version control

## Recent Development Notes

### Recent Updates (2025-08-23)
- **PDF Multi-Selection System**: Complete drag and Ctrl+click multi-selection implementation
  - Drag rectangle selection for area-based tag selection
  - Ctrl+click for individual tag toggle selection
  - Visual selection indicators with red borders and animations
  - Bidirectional sync between PDF highlights and tag panel
- **Tag Board Redesign**: Unified compact interface with selected tags management
  - Redesigned tag board with consistent styling across all categories
  - Selected tags section with visual tag chips and individual removal
  - Relationship creation directly from selected tags (connection/installation)
  - Collapsible relationships panel for better space utilization
- **Enhanced Instrument Function Matching**: Significantly improved spatial analysis algorithm in `instrumentMatcher.js`
  - Added adaptive search height calculation based on PDF text characteristics
  - Improved horizontal alignment detection with configurable tolerance (1.5x instrument width)
  - Implemented weighted distance calculation prioritizing vertical alignment
  - Added automatic parameter adjustment using median spacing analysis

### Known Issues & Improvements Needed
- **Complex Layout Edge Cases**: In very dense P&ID layouts with overlapping text, some instrument functions may require manual verification

### Development Considerations

**Common Issues & Solutions**:
- **CSS Selector Errors**: Use `CSS.escape()` or dataset comparison for tag IDs with special characters
- **PDF Highlight Positioning**: Ensure zoom-responsive callbacks are properly set up in `onPageRendered`
- **Multi-Selection Conflicts**: Clear single selections before applying multi-selection styles
- **Event Target Issues**: Use `closest()` method for complex UI elements with child components

**Performance Considerations**:
- **Large PDF Files**: 50MB+ files may cause memory issues in older browsers
- **Tag Volume**: 10,000+ tags may require virtualization of tag lists
- **Real-time Highlighting**: Debounce zoom/pan operations to prevent excessive redraws

**Cross-Browser Compatibility**:
- Chrome/Edge: Full feature support
- Firefox: Some CSS animation limitations
- Safari: Limited testing, may have Canvas API differences

## Technical Constraints

- Browser-only application (Chrome, Edge, Firefox)
- Vector-based PDFs only (no scanned images)
- No standard P&ID format - must handle various tag naming conventions
- Local storage only (no server/cloud in MVP)
- Instrument function matching relies on spatial proximity algorithms