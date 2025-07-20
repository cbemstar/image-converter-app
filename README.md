# Image Converter App

A browser-based image conversion tool that allows you to convert images between various formats including WebP, JPEG, PNG, AVIF, BMP, TIFF, GIF, and ICO. The app also supports special formats like HEIC/HEIF and RAW camera formats.

## Features

- Convert images to WebP, JPEG, PNG, AVIF, BMP, TIFF, GIF, and ICO formats
- Special support for HEIC/HEIF and RAW camera formats (CR2, NEF, ARW, etc.)
- Resize images by setting maximum width/height
- Adjust image quality
- Bulk image conversion with ZIP download
- Individual file conversion and download
- Bulk rename functionality
- Image preview with lightbox gallery
- Responsive design for mobile and desktop

## Usage

1. Drag and drop images or click "Select Images"
2. Set desired output format, max width/height, and quality
3. Click "Convert" to process images
4. Download individual images or all as ZIP

## Technologies

- Vanilla JavaScript (ES Modules)
- HTML5 Canvas API for image processing
- WebAssembly libraries for special formats
- Modern CSS with responsive design

## Libraries Used

- JSZip for creating ZIP archives
- AVIF encoder/decoder (@jsquash/avif)
- HEIC conversion (heic-to, libheif-js)
- RAW image processing (raw-wasm)
- Supabase for authentication (email/password and Google OAuth)

## Live Demo

Access the tool at: [https://cbemstar.github.io/image-converter-app/](https://cbemstar.github.io/image-converter-app/)

## Authentication Setup

To enable email/password and Google sign in you need a Supabase project. Update
`SUPABASE_URL` and `SUPABASE_ANON_KEY` in `core.js` with your project values.

Ensure Google OAuth is configured in your Supabase dashboard and that your
`users` table includes a `full_name` column (stored in the `auth.users` metadata)
so the sign up form can save the user's name.
