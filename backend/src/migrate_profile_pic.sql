-- Migration: Change profile_pic from VARCHAR(255) to TEXT to support base64 images
-- Run this in your PostgreSQL database:
-- psql workout_social < src/migrate_profile_pic.sql

ALTER TABLE users ALTER COLUMN profile_pic TYPE TEXT;

