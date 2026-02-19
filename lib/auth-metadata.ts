import type { User } from '@supabase/supabase-js';

type MetadataUser = Pick<User, 'app_metadata' | 'user_metadata' | 'email'>;

const DEFAULT_ADMIN_EMAIL_ALLOWLIST = ['a.tanaka@chairman.jp'];

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

function normalizeEmail(value: unknown): string | null {
  if (typeof value !== 'string') {
    return null;
  }
  const normalized = value.trim().toLowerCase();
  return normalized.length > 0 ? normalized : null;
}

function parseAdminEmailAllowlist(value: string | undefined): string[] {
  if (!value) {
    return [];
  }

  return value
    .split(',')
    .map((entry) => normalizeEmail(entry))
    .filter((entry): entry is string => Boolean(entry));
}

function resolveAdminEmailAllowlist(): Set<string> {
  const allowlist = new Set<string>(
    DEFAULT_ADMIN_EMAIL_ALLOWLIST
      .map((entry) => normalizeEmail(entry))
      .filter((entry): entry is string => Boolean(entry))
  );

  parseAdminEmailAllowlist(process.env.ADMIN_EMAIL_ALLOWLIST).forEach((entry) => allowlist.add(entry));
  parseAdminEmailAllowlist(process.env.NEXT_PUBLIC_ADMIN_EMAIL_ALLOWLIST).forEach((entry) =>
    allowlist.add(entry)
  );

  return allowlist;
}

const ADMIN_EMAIL_ALLOWLIST = resolveAdminEmailAllowlist();

function isAllowlistedAdminEmail(email: unknown): boolean {
  const normalized = normalizeEmail(email);
  return normalized !== null && ADMIN_EMAIL_ALLOWLIST.has(normalized);
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

  // Emergency guard: allowlisted admin accounts should never be treated as pending.
  // This prevents lockouts when legacy metadata is partially migrated.
  if (
    isAllowlistedAdminEmail(user.email) &&
    (roleFromAppMetadata === null || roleFromAppMetadata === 'pending_vendor')
  ) {
    return 'admin';
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

  if (roleFromUserMetadata === 'admin' && isAllowlistedAdminEmail(user.email)) {
    return 'admin';
  }

  return roleFromUserMetadata === 'pending_vendor' ? roleFromUserMetadata : null;
}
