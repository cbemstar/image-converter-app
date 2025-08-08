# reformately

A comprehensive collection of browser-based utility tools designed for marketing professionals, developers, and content creators. All tools run entirely in the browser without requiring server-side processing, ensuring privacy and offline functionality.

## 🚀 Available Tools

### Image Processing
- **Image Converter**: Convert between WebP, JPEG, PNG, AVIF, BMP, TIFF, GIF, ICO, HEIC/HEIF, and RAW camera formats
- **Background Remover**: Remove backgrounds from images using MediaPipe Selfie Segmentation
- **Color Palette Extractor**: Extract dominant colors from images for design inspiration
- **Layout Generator**: Create multi-size marketing layouts from a single master design

### Marketing Tools
- **Google Ads RSA Preview**: Visualize responsive search ads before publishing
- **Campaign Structure Visualizer**: Create and export campaign hierarchy diagrams (PNG/PDF)
- **Bulk Match Type Editor**: Convert keyword lists to phrase and exact match formats
- **UTM Builder**: Generate tracking URLs for campaign analytics
- **Meta Tag Generator**: Create SEO-optimized meta tags for websites
- **Robots.txt Tool**: Generate and validate robots.txt directives

### Document Processing
- **PDF Merger**: Combine multiple PDF files into one document
- **PDF OCR**: Extract text from PDFs using optical character recognition
- **JSON Formatter**: Format, validate, and minify JSON data

### Utilities
- **QR Code Generator**: Create customizable QR codes for various purposes
- **UUID Generator**: Generate v1, v3, v4, or v5 unique identifiers
- **Timestamp Converter**: Convert between Unix timestamps and human-readable dates
- **Text Case Converter**: Transform text between different case formats

## ✨ Key Features

- **Client-side Processing**: All operations run in your browser - no data sent to servers
- **Privacy-Focused**: Your files never leave your device
- **Mobile Responsive**: Optimized for both desktop and mobile usage
- **Dark/Light Theme**: Consistent theming across all tools
- **Offline Capable**: Most tools work without an internet connection
- **High Performance**: Uses WebAssembly for advanced image processing
- **Bulk Operations**: Process multiple files simultaneously where applicable

## 🛠️ Technologies

### Core Technologies
- **Frontend**: Vanilla JavaScript (ES Modules), HTML5, CSS3
- **Styling**: Tailwind CSS with custom CSS variables for theming
- **Build System**: No build process - direct browser execution
- **Package Manager**: npm (for development dependencies only)

### Key Libraries & Dependencies
- **JSZip**: Creating ZIP archives for bulk downloads
- **@jsquash/avif**: AVIF format encoding/decoding
- **heic-to, libheif-js**: HEIC/HEIF conversion
- **raw-wasm**: RAW camera format processing
- **MediaPipe**: Background removal (Selfie Segmentation)
- **pdf-lib**: PDF manipulation and merging
- **Tesseract.js**: OCR functionality for PDF text extraction
- **Supabase**: Optional authentication and user management

### Browser APIs Used
- **HTML5 Canvas API**: Image processing and manipulation
- **WebAssembly (WASM)**: High-performance image format processing
- **File API**: File handling and drag-and-drop
- **Blob API**: File creation and downloads
- **Web Workers**: Background processing (where applicable)

## 🚀 Getting Started

### Quick Start
1. Clone or download the repository
2. Serve the files using any static file server:
   ```bash
   # Using Python
   python -m http.server 8000
   
   # Using Node.js
   npx serve .
   
   # Using PHP
   php -S localhost:8000
   ```
3. Open your browser and navigate to the local server
4. Browse and use any of the available tools

### Development Setup
```bash
# Install development dependencies
npm install

# Run tests
npm test
```

## 🔧 Configuration

### Authentication (Optional)
To enable enhanced features with user accounts:

1. Create a Supabase project
2. Set `SUPABASE_URL` and `SUPABASE_ANON_KEY` as environment variables (e.g., in a `.env.local` file) and run `npm run build:config` to generate the runtime configuration
3. Configure Google OAuth in your Supabase dashboard
4. Ensure your `users` table includes a `full_name` column

### Analytics (Optional)
The site includes Google Tag Manager integration (container `GTM-NFJTSQ3N`) for centralized analytics configuration.

## 🎯 Usage

Each tool is designed for specific use cases:

- **Content Creators**: Use Image Converter, Background Remover, and Layout Generator for visual content
- **Marketing Professionals**: Leverage Google Ads RSA Preview, Campaign Structure, UTM Builder, and Meta Tag Generator
- **Developers**: Utilize JSON Formatter, UUID Generator, Timestamp Converter, and Text Case Converter
- **General Users**: Access PDF tools, QR Generator, and other utilities for everyday tasks

The homepage features a searchable tool grid with category filtering and usage-based sorting.

## 📁 Project Structure

```
/ (repo root)
├── index.html              # Main landing page with tool grid
├── home.js                 # Homepage functionality (search, filtering)
├── layout.js               # Shared layout components (sidebar, navigation)
├── utils.js                # Shared utility functions
├── pdf-utils.js            # PDF-specific utility functions
├── components.json         # Component registry
├── package.json            # Dependencies and scripts
├── styles/                 # Global styling
│   ├── styles.css         # Main stylesheet with Tailwind + custom CSS
│   └── theme.js           # Theme switching functionality
├── tools/                  # Individual tool implementations
│   ├── layout-tool/       # Layout Generator tool
│   │   ├── index.html     # Tool interface
│   │   ├── app.js         # Main application logic
│   │   ├── style.css      # Tool-specific styles
│   │   ├── modules/       # Modular components
│   │   │   ├── canvas-engine.js    # Canvas rendering engine
│   │   │   ├── layout-editor.js    # Full-screen layout editor
│   │   │   ├── preset-manager.js   # Preset loading and management
│   │   │   ├── ui-sidebar.js       # Sidebar interface
│   │   │   ├── ui-topbar.js        # Top controls
│   │   │   ├── export-raster.js    # Image export functionality
│   │   │   ├── export-pdf.js       # PDF export functionality
│   │   │   ├── smart-crop.js       # Image cropping algorithms
│   │   │   └── colour-manager.js   # Color management
│   │   └── presets/       # Layout presets
│   │       ├── all-presets.json    # Combined preset definitions
│   │       └── *.json     # Individual preset files
│   └── <other-tools>/     # Other tool directories
└── __tests__/             # Test files
    └── *.test.js          # Jest test files
```

### Tool Architecture

Each tool follows a consistent modular structure:
- **Self-contained**: All tool assets in dedicated directories
- **ES Modules**: Modern JavaScript module system
- **Shared utilities**: Common functions imported from root-level files
- **Responsive design**: Mobile-first CSS approach
- **Theme integration**: Consistent theming using CSS custom properties

## 🎨 Layout Generator Deep Dive

The Layout Generator is one of the most sophisticated tools in the collection, featuring:

### Core Features
- **Master Canvas**: Design once on an 800x600 master canvas
- **Multi-format Export**: Generate layouts for 40+ preset formats
- **Advanced Editor**: Full-screen editing with precise controls and enhanced text properties
- **Hero Image Management**: Advanced cropping, positioning, and scaling with interactive controls
- **Smart Cropping**: Intelligent image positioning and cropping with visual handles
- **Enhanced Text Editing**: Font family, weight, style, alignment, shadows, outlines, and background colors
- **Batch Processing**: Generate multiple sizes simultaneously

### Advanced Editor Features
- **Interactive Hero Image Controls**: 
  - Drag-and-drop positioning with mouse interaction and visual feedback
  - Scale adjustment with slider controls and mouse wheel support
  - Crop mode with visual overlay and interactive resize handles
  - **Aspect Ratio Controls**: Apply specific aspect ratios (1:1, 3:2, 4:3, 16:9, 5:4, 7:5, 16:10) with intelligent cropping
  - **Advanced Image Fit Modes**: Six comprehensive fit modes for precise image positioning with full aspect ratio integration:
    - **Cover**: Scales image to fill canvas completely, intelligently crops excess while maintaining aspect ratio
    - **Contain**: Scales image to fit entirely within canvas, may show gaps but preserves full image
    - **Fill**: Stretches image to fill canvas exactly, may distort but fills every pixel
    - **Scale Down**: Like contain but never upscales - only shrinks oversized images
    - **None**: Shows image at original size, centered on canvas without scaling
    - **Crop**: Crops image from center to fit canvas dimensions exactly
  - **Smart Ratio Integration**: All fit modes work seamlessly with aspect ratio controls for precise image composition
  - Real-time mode indicators showing current ratio and fit settings with detailed explanations
  - Interactive button controls with visual feedback and instant preview updates
- **Enhanced Text Properties**: 
  - Font family selection (Arial, Helvetica, Times New Roman, Georgia, Verdana, Trebuchet MS, Impact, Comic Sans MS, Courier New, Lucida Console)
  - Font weight and style options (normal, bold, light, extra bold, italic, oblique)
  - Text alignment (left, center, right) with instant visual updates
  - Line height adjustment for precise typography control
  - Text and background color customization with color picker
  - Text shadow and outline effects for enhanced readability
  - Multi-line text support with proper line spacing and formatting
- **Visual Element Management**: 
  - Interactive selection and editing of text and logo elements with visual selection indicators
  - Drag-and-drop repositioning on canvas with real-time coordinate updates
  - Property panel with instant visual feedback for all changes
  - Element deletion with confirmation and undo capabilities
  - Comprehensive element list with quick selection and management

### Supported Formats
- **Social Media**: Instagram (1:1, 4:5, Stories), Facebook, LinkedIn, Twitter, Pinterest, YouTube, TikTok
- **Digital Advertising**: Google Ads (RDA, Display), Web banners, Email headers
- **Print Materials**: Business cards, Posters (A0-A5), Brochures, Flyers, Banners, Billboards

### Technical Implementation
- **Canvas Engine**: High-performance rendering with enhanced image processing
- **Modular Architecture**: Separate modules for editing, export, and UI components
- **Preset System**: JSON-based format definitions with automatic scaling
- **Export Options**: PNG, PDF, and ZIP batch downloads
- **Interactive Controls**: Mouse and touch support for intuitive drag-and-drop editing
- **State Management**: Persistent editor state with undo/redo capabilities

## 🔄 Recent Updates

### Layout Generator Code Optimization (Latest)
- **Enhanced Editor Integration**: Improved callback handling in the layout editor for better state management and cleaner code architecture
- **Streamlined Object Management**: Simplified the way custom objects are handled when editing individual artboards, improving performance and reliability
- **Code Quality Improvements**: Continued refinement of the codebase with better variable naming and cleaner function signatures

### Layout Generator Major Code Refactoring
- **Complete Code Restructure**: Comprehensive refactoring of the layout editor module with improved organization and readability
- **Enhanced Stability**: Eliminated duplicate code blocks, syntax errors, and corrupted sections that were causing instability
- **Streamlined Architecture**: Reorganized code into logical sections with clear separation of concerns and modular function design
- **Improved Performance**: Optimized rendering functions and reduced code complexity for better performance and responsiveness
- **Enhanced User Experience**: All advanced features preserved and improved including:
  - **Interactive Hero Image Controls**: Advanced cropping and positioning with visual drag-and-drop interface
  - **Enhanced Text Properties**: Complete typography control with font family, weight, style, alignment, line height, and visual effects
  - **Real-time Element Editing**: Instant visual feedback for all property changes and transformations
  - **Full-screen Layout Editor**: Comprehensive editing interface with sidebar controls and canvas interaction
  - **Advanced Canvas Interaction**: Mouse wheel scaling, drag-and-drop positioning, and interactive crop handles
- **Better Code Maintainability**: Cleaner function structure, consistent ES6+ syntax, and comprehensive JSDoc documentation
- **Robust Error Handling**: Enhanced error handling and user feedback throughout the editor interface with proper notifications
- **Code Quality Improvements**: 
  - Reduced file size by ~50% through elimination of duplicate code
  - Improved function organization with clear separation of DOM creation, event handling, and rendering logic
  - Enhanced readability with consistent formatting and logical code grouping
  - Streamlined state management with cleaner data structures

## 🚀 Future Development

### Planned Features
- **React Migration**: Transition to React/Next.js with ShadCN UI components
- **Enhanced Presets**: More format options and customizable templates
- **Cloud Integration**: Optional cloud storage for designs
- **Collaboration**: Share and collaborate on layouts
- **API Integration**: Connect with design platforms and social media APIs

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📄 License

This project is open source and available under the [MIT License](LICENSE).
