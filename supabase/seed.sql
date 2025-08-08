-- Seed data for development and testing
-- This file contains sample data to help with development and testing

-- Insert sample plan limits for reference (these will be used in the application logic)
-- Note: These are stored as comments for reference, actual limits are in environment variables

/*
Plan Limits Reference:
- Free: 50MB storage, 500 conversions/month, 5000 API calls/month, 25MB max file size
- Pro: 2GB storage, 5000 conversions/month, 50000 API calls/month, 100MB max file size  
- Agency: 20GB storage, 50000 conversions/month, 500000 API calls/month, 250MB max file size
*/

-- Create storage buckets for file uploads
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES 
  ('user-files', 'user-files', false, 262144000, ARRAY[
    'image/jpeg',
    'image/png', 
    'image/webp',
    'image/gif',
    'image/bmp',
    'image/tiff',
    'image/avif',
    'image/heic',
    'image/heif',
    'image/x-icon',
    'application/pdf',
    'text/plain',
    'application/json',
    'text/csv'
  ]);

-- Create RLS policy for storage bucket
CREATE POLICY "Users can upload own files" ON storage.objects
  FOR INSERT WITH CHECK (bucket_id = 'user-files' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can view own files" ON storage.objects
  FOR SELECT USING (bucket_id = 'user-files' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can update own files" ON storage.objects
  FOR UPDATE USING (bucket_id = 'user-files' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can delete own files" ON storage.objects
  FOR DELETE USING (bucket_id = 'user-files' AND auth.uid()::text = (storage.foldername(name))[1]);

-- Sample tool types for reference
-- These will be used in the application to categorize different tools
/*
Tool Types:
- image-converter
- background-remover
- pdf-merger
- pdf-ocr
- qr-generator
- color-palette
- json-formatter
- text-case-converter
- timestamp-converter
- uuid-generator
- meta-tag-generator
- robots-txt
- utm-builder
- bulk-match-editor
- campaign-structure
- google-ads-rsa-preview
- request-tool
*/