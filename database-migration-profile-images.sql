-- Add profile_image_url column to users table
-- Run this in your Supabase SQL editor

ALTER TABLE users 
ADD COLUMN IF NOT EXISTS profile_image_url TEXT;

-- Update the existing users table to include profile_image_url
-- This will allow users to have profile pictures

-- You can also run this to see the updated table structure:
-- SELECT column_name, data_type, is_nullable 
-- FROM information_schema.columns 
-- WHERE table_name = 'users' 
-- ORDER BY ordinal_position;
