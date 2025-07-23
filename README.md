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

The login modal hides the **Full Name** field until you select **Sign Up**. If a
user tries to sign up with an existing email address they'll see an error with a
prompt to use the **Forgot your password** link which triggers the Supabase
password reset flow.

## Google Tag Manager

This site loads Google Tag Manager (container `GTM-NFJTSQ3N`) on every page so visitor analytics can be configured centrally.

## Additional Tools

Alongside the image converter, the site offers several marketing utilities like a Google Ads RSA previewer, a campaign structure visualizer, a parts-of-speech helper, and a **Bulk Match Type Editor** for quickly converting keyword lists to broad, phrase or exact match types.

## React redevelopment

The current implementation uses vanilla HTML and JavaScript. To adopt ShadCN UI components, create a React or Next.js project and migrate these tools into React components. Package installation was attempted in this environment but was blocked by network restrictions, so only the plan is documented here.
