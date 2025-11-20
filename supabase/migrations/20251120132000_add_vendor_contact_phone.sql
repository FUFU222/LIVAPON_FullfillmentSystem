ALTER TABLE vendors
  ADD COLUMN IF NOT EXISTS contact_phone VARCHAR(100);

ALTER TABLE vendor_applications
  ADD COLUMN IF NOT EXISTS contact_phone VARCHAR(100);
