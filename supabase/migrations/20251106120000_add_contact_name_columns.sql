-- Ensure vendors have contact_name column
ALTER TABLE IF EXISTS vendors
  ADD COLUMN IF NOT EXISTS contact_name VARCHAR(255);

-- Ensure vendor_applications have contact_name column
ALTER TABLE IF EXISTS vendor_applications
  ADD COLUMN IF NOT EXISTS contact_name VARCHAR(255);
