-- Migration: Add missing columns to orders table
-- Run this in your Supabase SQL editor

-- Add contact information columns
ALTER TABLE orders 
ADD COLUMN IF NOT EXISTS contact_phone VARCHAR(20),
ADD COLUMN IF NOT EXISTS contact_email VARCHAR(255),
ADD COLUMN IF NOT EXISTS delivery_time VARCHAR(100),
ADD COLUMN IF NOT EXISTS payment_method VARCHAR(50),
ADD COLUMN IF NOT EXISTS subtotal DECIMAL(10,2),
ADD COLUMN IF NOT EXISTS delivery_fee DECIMAL(10,2),
ADD COLUMN IF NOT EXISTS tax DECIMAL(10,2),
ADD COLUMN IF NOT EXISTS tracking_status VARCHAR(50),
ADD COLUMN IF NOT EXISTS tracking_note TEXT,
ADD COLUMN IF NOT EXISTS confirmed_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS delivered_at TIMESTAMP WITH TIME ZONE;

-- Add index for contact_email for faster lookups
CREATE INDEX IF NOT EXISTS idx_orders_contact_email ON orders(contact_email);

-- Add comment for documentation
COMMENT ON COLUMN orders.contact_phone IS 'Customer contact phone number for order delivery';
COMMENT ON COLUMN orders.contact_email IS 'Customer contact email for order notifications';
COMMENT ON COLUMN orders.delivery_time IS 'Preferred delivery time slot';
COMMENT ON COLUMN orders.payment_method IS 'Payment method used (card, cash, etc.)';
COMMENT ON COLUMN orders.subtotal IS 'Order subtotal before fees and tax';
COMMENT ON COLUMN orders.delivery_fee IS 'Delivery fee amount';
COMMENT ON COLUMN orders.tax IS 'Tax amount';

-- Tracking and status metadata
COMMENT ON COLUMN orders.tracking_status IS 'Human-friendly tracking status for the order';
COMMENT ON COLUMN orders.tracking_note IS 'Optional note with tracking or delivery info';
COMMENT ON COLUMN orders.confirmed_at IS 'Timestamp when admin confirmed the order';
COMMENT ON COLUMN orders.delivered_at IS 'Timestamp when order marked delivered by admin';

