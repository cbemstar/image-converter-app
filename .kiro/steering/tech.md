# Technology Stack

## Core Technologies

- **Frontend**: Vanilla JavaScript (ES Modules), HTML5, CSS3
- **Styling**: Tailwind CSS with custom CSS variables for theming
- **Build System**: No build process - direct browser execution
- **Package Manager**: npm (for development dependencies only)

## Key Libraries & Dependencies

### Image Processing
- **JSZip**: Creating ZIP archives for bulk downloads
- **@jsquash/avif**: AVIF format encoding/decoding
- **heic-to, libheif-js**: HEIC/HEIF conversion
- **raw-wasm**: RAW camera format processing
- **MediaPipe**: Background removal (Selfie Segmentation)

### Document Processing
- **pdf-lib**: PDF manipulation and merging
- **Tesseract.js**: OCR functionality for PDF text extraction

### Authentication & Storage
- **Supabase**: Optional authentication and user management
- **LocalStorage**: Client-side data persistence

### Testing
- **Jest**: Unit testing framework

## Browser APIs Used

- **HTML5 Canvas API**: Image processing and manipulation
- **WebAssembly (WASM)**: High-performance image format processing
- **File API**: File handling and drag-and-drop
- **Blob API**: File creation and downloads
- **Web Workers**: Background processing (where applicable)

## Development Commands

```bash
# Install development dependencies
npm install

# Run tests
npm test

# No build step required - serve files directly
# Use any static file server, e.g.:
python -m http.server 8000
# or
npx serve .
```

## Architecture Patterns

- **ES Modules**: Modern JavaScript module system
- **Utility-first CSS**: Tailwind CSS with custom component classes
- **Client-side only**: No server-side processing or API calls
- **Progressive Enhancement**: Works without JavaScript for basic functionality
- **Mobile-first Responsive**: CSS-first approach to responsive design

## Browser Compatibility

- **Modern browsers**: Chrome 80+, Firefox 75+, Safari 13+, Edge 80+
- **WebAssembly support required** for advanced image formats
- **File API support required** for file operations
- **Canvas API support required** for image processing