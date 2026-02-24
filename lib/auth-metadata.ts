import type { User } from '@supabase/supabase-js';

type MetadataUser = Pick<User, 'app_metadata' | 'user_metadata' | 'email'>;

function toMetadataRecord(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object') {
    return {};
  }
  return value as Record<string, unknown>;
}

function parseVendorId(value: unknown): number | null {
  if (typeof value === 'number' && Number.isInteger(value) && value > 0) {
    return value;
  }

  if (typeof value === 'string') {
    const parsed = Number(value.trim());
    if (Number.isInteger(parsed) && parsed > 0) {
      return parsed;
    }
  }

  return null;
}

function parseRole(value: unknown): string | null {
  if (typeof value !== 'string') {
    return null;
  }

  const normalized = value.trim().toLowerCase();
  if (normalized.length === 0) {
    return null;
  }

  if (normalized === 'administrator' || normalized === 'admin_user' || normalized === 'super_admin' || normalized === 'superadmin') {
    return 'admin';
  }

  if (normalized === 'pending' || normalized === 'pending-vendor') {
    return 'pending_vendor';
  }

  if (normalized === 'vendor_user' || normalized === 'merchant') {
    return 'vendor';
  }

  return normalized;
}

export function resolveVendorIdFromAuthUser(user: MetadataUser | null): number | null {
  if (!user) {
    return null;
  }

  const appMetadata = toMetadataRecord(user.app_metadata);
  const candidate = appMetadata.vendor_id ?? appMetadata.vendorId;
  return parseVendorId(candidate);
}

export function resolveRoleFromAuthUser(user: MetadataUser | null): string | null {
  if (!user) {
    return null;
  }

  const appMetadata = toMetadataRecord(user.app_metadata);
  const roleFromAppMetadata = parseRole(
    appMetadata.role ?? appMetadata.user_role ?? appMetadata.app_role
  );

  if (roleFromAppMetadata === 'admin') {
    return roleFromAppMetadata;
  }

  if (roleFromAppMetadata) {
    return roleFromAppMetadata;
  }

  // Transitional fallback:
  // Allow only pending_vendor from user_metadata to avoid breaking existing
  // accounts created before app_metadata-based role assignment.
  const userMetadata = toMetadataRecord(user.user_metadata);
  const roleFromUserMetadata = parseRole(
    userMetadata.role ?? userMetadata.user_role ?? userMetadata.app_role
  );

  return roleFromUserMetadata === 'pending_vendor' ? roleFromUserMetadata : null;
}
