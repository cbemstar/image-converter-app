-- Storage Buckets and Policies Setup
-- Requirements: 14.1, 14.2, 14.7, 14.8
-- 
-- This file contains the SQL commands to set up storage buckets and RLS policies
-- Run this after enabling write operations in the Supabase MCP configuration

-- Create private bucket for user uploads (temporary files)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'user-uploads',
  'user-uploads',
  false, -- Private bucket
  52428800, -- 50MB limit
  ARRAY[
    'image/jpeg',
    'image/png', 
    'image/webp',
    'image/gif',
    'image/bmp',
    'image/tiff',
    'image/avif',
    'image/heic',
    'image/heif',
    -- RAW formats
    'image/x-canon-cr2',
    'image/x-canon-crw',
    'image/x-nikon-nef',
    'image/x-sony-arw',
    'image/x-adobe-dng',
    'image/x-fuji-raf',
    'image/x-olympus-orf',
    'image/x-panasonic-rw2',
    'image/x-pentax-pef',
    'image/x-samsung-srw'
  ]
) ON CONFLICT (id) DO UPDATE SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

-- Create private bucket for converted files (results)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'converted-files',
  'converted-files', 
  false, -- Private bucket
  52428800, -- 50MB limit
  ARRAY[
    'image/jpeg',
    'image/png',
    'image/webp',
    'image/gif',
    'image/bmp',
    'image/tiff',
    'image/avif',
    'application/zip' -- For batch downloads
  ]
) ON CONFLICT (id) DO UPDATE SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

-- Create private bucket for temporary processing files
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'temp-processing',
  'temp-processing',
  false, -- Private bucket  
  104857600, -- 100MB limit for processing
  ARRAY[
    'image/jpeg',
    'image/png',
    'image/webp', 
    'image/gif',
    'image/bmp',
    'image/tiff',
    'image/avif',
    'image/heic',
    'image/heif',
    'application/zip',
    'application/octet-stream' -- For intermediate processing files
  ]
) ON CONFLICT (id) DO UPDATE SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

-- Create RLS policies for user-uploads bucket
-- Users can only access their own files
CREATE POLICY "Users can upload their own files" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'user-uploads' 
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "Users can view their own uploads" ON storage.objects
  FOR SELECT USING (
    bucket_id = 'user-uploads'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "Users can update their own uploads" ON storage.objects
  FOR UPDATE USING (
    bucket_id = 'user-uploads'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "Users can delete their own uploads" ON storage.objects
  FOR DELETE USING (
    bucket_id = 'user-uploads'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

-- Create RLS policies for converted-files bucket
-- Users can only access their own converted files
CREATE POLICY "Users can view their own converted files" ON storage.objects
  FOR SELECT USING (
    bucket_id = 'converted-files'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "Service role can manage converted files" ON storage.objects
  FOR ALL USING (
    bucket_id = 'converted-files'
    AND auth.jwt() ->> 'role' = 'service_role'
  );

-- Create RLS policies for temp-processing bucket
-- Only service role can access (for Edge Functions)
CREATE POLICY "Service role can manage temp processing files" ON storage.objects
  FOR ALL USING (
    bucket_id = 'temp-processing'
    AND auth.jwt() ->> 'role' = 'service_role'
  );

-- Create function to generate secure signed URLs with expiration
CREATE OR REPLACE FUNCTION generate_signed_url(
  bucket_name text,
  file_path text,
  expires_in_seconds integer DEFAULT 3600
)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  signed_url text;
BEGIN
  -- Verify user has access to the file
  IF bucket_name IN ('user-uploads', 'converted-files') THEN
    -- Check if user owns the file
    IF NOT EXISTS (
      SELECT 1 FROM storage.objects 
      WHERE bucket_id = bucket_name 
      AND name = file_path
      AND auth.uid()::text = (storage.foldername(name))[1]
    ) THEN
      RAISE EXCEPTION 'Access denied to file: %', file_path;
    END IF;
  ELSE
    RAISE EXCEPTION 'Invalid bucket: %', bucket_name;
  END IF;
  
  -- Generate signed URL (this would typically call Supabase's internal function)
  -- For now, return a placeholder that would be replaced by actual implementation
  signed_url := format('https://your-project.supabase.co/storage/v1/object/sign/%s/%s?token=placeholder&expires=%s',
    bucket_name, file_path, extract(epoch from now() + interval '1 second' * expires_in_seconds));
  
  RETURN signed_url;
END;
$$;

-- Create function to generate signed upload URLs
CREATE OR REPLACE FUNCTION generate_signed_upload_url(
  bucket_name text,
  file_path text,
  expires_in_seconds integer DEFAULT 3600
)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  signed_url text;
  user_folder text;
BEGIN
  -- Ensure user is authenticated
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;
  
  -- Validate bucket
  IF bucket_name NOT IN ('user-uploads') THEN
    RAISE EXCEPTION 'Invalid bucket for upload: %', bucket_name;
  END IF;
  
  -- Ensure file path starts with user's folder
  user_folder := auth.uid()::text || '/';
  IF NOT starts_with(file_path, user_folder) THEN
    RAISE EXCEPTION 'File path must start with user folder: %', user_folder;
  END IF;
  
  -- Generate signed upload URL (placeholder implementation)
  signed_url := format('https://your-project.supabase.co/storage/v1/object/upload/sign/%s/%s?token=placeholder&expires=%s',
    bucket_name, file_path, extract(epoch from now() + interval '1 second' * expires_in_seconds));
  
  RETURN signed_url;
END;
$$;

-- Create table to track file metadata and cleanup
CREATE TABLE IF NOT EXISTS file_metadata (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  bucket_id text NOT NULL,
  file_path text NOT NULL,
  original_name text NOT NULL,
  file_size bigint NOT NULL,
  mime_type text NOT NULL,
  file_hash text, -- For deduplication
  upload_completed_at timestamptz,
  expires_at timestamptz, -- For automatic cleanup
  conversion_job_id uuid, -- Link to conversion jobs
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  
  UNIQUE(bucket_id, file_path)
);

-- Create RLS policies for file_metadata
ALTER TABLE file_metadata ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own file metadata" ON file_metadata
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "Users can insert their own file metadata" ON file_metadata
  FOR INSERT WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update their own file metadata" ON file_metadata
  FOR UPDATE USING (user_id = auth.uid());

CREATE POLICY "Users can delete their own file metadata" ON file_metadata
  FOR DELETE USING (user_id = auth.uid());

CREATE POLICY "Service role can manage all file metadata" ON file_metadata
  FOR ALL USING (auth.jwt() ->> 'role' = 'service_role');

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_file_metadata_user_id ON file_metadata(user_id);
CREATE INDEX IF NOT EXISTS idx_file_metadata_expires_at ON file_metadata(expires_at) WHERE expires_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_file_metadata_bucket_path ON file_metadata(bucket_id, file_path);
CREATE INDEX IF NOT EXISTS idx_file_metadata_hash ON file_metadata(file_hash) WHERE file_hash IS NOT NULL;

-- Create function to clean up expired files
CREATE OR REPLACE FUNCTION cleanup_expired_files()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  expired_count integer := 0;
  expired_file record;
BEGIN
  -- Find expired files
  FOR expired_file IN 
    SELECT bucket_id, file_path, id
    FROM file_metadata 
    WHERE expires_at IS NOT NULL 
    AND expires_at < now()
  LOOP
    -- Delete from storage (this would need to be implemented via Edge Function)
    -- For now, just mark as deleted in metadata
    DELETE FROM file_metadata WHERE id = expired_file.id;
    expired_count := expired_count + 1;
  END LOOP;
  
  RETURN expired_count;
END;
$$;

-- Create function to set file retention policies
CREATE OR REPLACE FUNCTION set_file_retention(
  bucket_name text,
  retention_hours integer DEFAULT 24
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Update expiration for files in the specified bucket
  UPDATE file_metadata 
  SET expires_at = now() + interval '1 hour' * retention_hours,
      updated_at = now()
  WHERE bucket_id = bucket_name 
  AND expires_at IS NULL;
END;
$$;

-- Set default retention policies
-- User uploads expire after 24 hours if not processed
SELECT set_file_retention('user-uploads', 24);

-- Converted files expire after 7 days
SELECT set_file_retention('converted-files', 168);

-- Temp processing files expire after 1 hour
SELECT set_file_retention('temp-processing', 1);

-- Create trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_file_metadata_updated_at 
  BEFORE UPDATE ON file_metadata 
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();