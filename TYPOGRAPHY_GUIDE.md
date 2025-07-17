# Typography Guide - Hanken Grotesk Implementation

## Overview

Your app now uses **Hanken Grotesk**, a modern grotesque sans-serif typeface that provides excellent readability and a clean, professional appearance. This font system creates a clear visual hierarchy while maintaining consistency across your interface.

## Why Hanken Grotesk?

- **Modern Grotesque Design**: Inspired by classic grotesques like Akzidenz Grotesk and Univers
- **Excellent Readability**: Specifically designed for both display and text applications
- **Complete Weight Range**: 9 weights from Thin (100) to Black (900) with matching italics
- **Open Source**: Free to use via Google Fonts with SIL Open Font License
- **Web Optimized**: Optimized for digital screens and interfaces

## Typography Hierarchy

### Headings

```css
/* Large Headings - Hero text, main titles */
h1, .text-4xl, .text-5xl, .text-6xl
Font: Hanken Grotesk Bold (700)
Line Height: 1.2
Letter Spacing: -0.02em
```

```css
/* Section Headings */
h2, .text-3xl
Font: Hanken Grotesk SemiBold (600)
Line Height: 1.3
Letter Spacing: -0.01em
```

```css
/* Subsection Headings */
h3, .text-2xl
Font: Hanken Grotesk SemiBold (600)
Line Height: 1.4
```

```css
/* Component Headings */
h4, .text-xl
Font: Hanken Grotesk Medium (500)
Line Height: 1.4
```

```css
/* Small Headings */
h5, .text-lg
Font: Hanken Grotesk Medium (500)
Line Height: 1.5
```

### Body Text

```css
/* Primary Body Text */
p, .text-base, body
Font: Hanken Grotesk Regular (400)
Line Height: 1.6
```

```css
/* Secondary Text */
.text-sm
Font: Hanken Grotesk Regular (400)
Line Height: 1.5
```

```css
/* Caption Text */
.text-xs
Font: Hanken Grotesk Regular (400)
Line Height: 1.4
```

### UI Elements

```css
/* Buttons */
button, .btn
Font: Hanken Grotesk Medium (500)
Letter Spacing: 0.01em
```

```css
/* Navigation */
nav, .nav
Font: Hanken Grotesk Medium (500)
```

```css
/* Form Elements */
label, input, select, textarea
Font: Hanken Grotesk Regular (400)
```

## Font Weights Available

- **Thin (100)**: Ultra-light decorative use
- **ExtraLight (200)**: Light decorative use
- **Light (300)**: Subtle text, secondary information
- **Regular (400)**: Body text, descriptions
- **Medium (500)**: UI elements, navigation, buttons
- **SemiBold (600)**: Subheadings, emphasized text
- **Bold (700)**: Main headings, important text
- **ExtraBold (800)**: Display headings
- **Black (900)**: Heavy display use

## Usage Guidelines

### Do's
- ✅ Use Regular (400) for body text and descriptions
- ✅ Use Medium (500) for buttons and navigation
- ✅ Use SemiBold (600) for section headings
- ✅ Use Bold (700) for main page titles
- ✅ Maintain consistent line heights for readability
- ✅ Use negative letter spacing for large headings

### Don'ts
- ❌ Don't mix too many font weights on one page
- ❌ Don't use ExtraBold or Black for body text
- ❌ Don't use Thin or ExtraLight for important information
- ❌ Don't forget to maintain proper contrast with your color scheme

## Implementation Details

The font is loaded via Google Fonts with preconnect for optimal performance:

```html
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Hanken+Grotesk:ital,wght@0,100;0,200;0,300;0,400;0,500;0,600;0,700;0,800;0,900;1,100;1,200;1,300;1,400;1,500;1,600;1,700;1,800;1,900&display=swap" rel="stylesheet">
```

### CSS Custom Properties

```css
:root {
  --font-primary: 'Hanken Grotesk', -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif;
}
```

## Performance Considerations

- Font is loaded with `display=swap` for better perceived performance
- Uses preconnect to optimize connection to Google Fonts
- Fallbacks to system fonts ensure text remains visible during font load

## Accessibility

- All text maintains proper contrast ratios with your dark theme
- Line heights are optimized for readability
- Font weights provide clear hierarchy for screen readers
- Proper letter spacing improves legibility at all sizes

## Alternative Options

If you want to explore other modern grotesque fonts in the future:

1. **Host Grotesk** - Uniwidth grotesque (requires purchase)
2. **Space Grotesk** - Free alternative with geometric influence
3. **Plus Jakarta Sans** - Modern sans with excellent language support
4. **DM Sans** - Clean geometric sans-serif

## Examples

Your existing app elements will now display with:

- **Navigation items**: Hanken Grotesk Medium (500)
- **Button text**: Hanken Grotesk Medium (500) with improved letter spacing
- **Form labels**: Hanken Grotesk Regular (400)
- **Body content**: Hanken Grotesk Regular (400) with improved line height
- **Headings**: Hanken Grotesk SemiBold/Bold with optimized spacing

The implementation maintains your existing dark color scheme (#172f37 background, #cde5da text) while providing a much more professional and readable typography foundation.