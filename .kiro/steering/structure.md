# Project Structure

## Directory Organization

```
/ (repo root)
├── index.html              # Main landing page with tool grid
├── home.js                  # Homepage functionality (search, filtering)
├── layout.js                # Shared layout components (sidebar, navigation)
├── utils.js                 # Shared utility functions
├── pdf-utils.js             # PDF-specific utility functions
├── components.json          # Component registry
├── package.json             # Dependencies and scripts
├── styles/                  # Global styling
│   ├── styles.css          # Main stylesheet with Tailwind + custom CSS
│   └── theme.js            # Theme switching functionality
├── tools/                   # Individual tool implementations
│   └── <tool-name>/        # Each tool in its own directory
│       ├── index.html      # Tool-specific HTML
│       ├── <tool-name>.js  # Tool-specific JavaScript
│       └── *.js            # Additional tool modules if needed
└── __tests__/              # Test files
    └── *.test.js           # Jest test files
```

## Tool Structure Pattern

Each tool follows a consistent structure:

```
tools/<tool-name>/
├── index.html              # Complete HTML page for the tool
├── <tool-name>.js          # Main tool logic
├── core.js                 # Core functionality (if complex)
├── conversions.js          # Format conversion logic (if applicable)
└── special-formats.js      # Special format handling (if applicable)
```

## File Naming Conventions

- **HTML files**: `index.html` for main pages, descriptive names for others
- **JavaScript files**: kebab-case matching directory names
- **CSS files**: `styles.css` for main stylesheet, descriptive names for others
- **Test files**: `*.test.js` in `__tests__/` directory
- **Directories**: kebab-case for tool names

## Shared Resources

### Global Files
- `utils.js`: Shared utility functions (notifications, file handling, format detection)
- `layout.js`: Navigation, sidebar, and layout functionality
- `styles/styles.css`: Global styles, theme variables, responsive design
- `styles/theme.js`: Theme switching logic

### Common Patterns
- **ES Module imports**: All tools import from `../../utils.js`
- **Theme integration**: All tools use CSS custom properties for theming
- **Responsive design**: Mobile-first approach with consistent breakpoints
- **Error handling**: Standardized notification system via `showNotification()`

## Tool Integration

### Required Elements
Each tool should include:
- Navigation header with theme toggle and sidebar
- Consistent styling using global CSS classes
- Error handling using shared notification system
- Mobile-responsive design
- FAQ section for user guidance

### Optional Elements
- Authentication integration (via Supabase)
- File upload/download functionality
- Progress indicators for long operations
- Bulk processing capabilities

## Development Guidelines

### Adding New Tools
1. Create directory under `tools/`
2. Copy structure from existing tool
3. Update main `index.html` with new tool link
4. Add to sidebar navigation in `layout.js`
5. Follow naming conventions and import patterns

### Shared Functionality
- Import utilities from `../../utils.js`
- Use consistent CSS classes and theme variables
- Implement error handling with `showNotification()`
- Follow mobile-first responsive design patterns

### Testing
- Place tests in `__tests__/` directory
- Use Jest for unit testing
- Focus on core functionality and edge cases
- Mock external dependencies when needed