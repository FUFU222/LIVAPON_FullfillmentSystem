import type { Session, User } from '@supabase/supabase-js';
import { getServerComponentClient } from '@/lib/supabase/server';

export type AuthContext = {
  session: Session;
  user: User;
  vendorId: number | null;
  role: string | null;
};

export class UnauthenticatedError extends Error {
  constructor(message = 'Authentication required') {
    super(message);
    this.name = 'UnauthenticatedError';
  }
}

export class ForbiddenError extends Error {
  constructor(message = 'Access denied') {
    super(message);
    this.name = 'ForbiddenError';
  }
}

function resolveVendorId(user: User | null): number | null {
  if (!user) {
    return null;
  }

  const metadata = {
    ...(user.user_metadata ?? {}),
    ...(user.app_metadata ?? {})
  } as Record<string, unknown>;

  const candidate = metadata.vendor_id ?? metadata.vendorId;

  if (typeof candidate === 'number') {
    return candidate;
  }

  if (typeof candidate === 'string') {
    const parsed = Number(candidate);
    return Number.isFinite(parsed) ? parsed : null;
  }

  return null;
}

function resolveRole(user: User | null): string | null {
  if (!user) {
    return null;
  }

  const metadata = {
    ...(user.user_metadata ?? {}),
    ...(user.app_metadata ?? {})
  } as Record<string, unknown>;

  const candidate = metadata.role ?? metadata.user_role ?? metadata.app_role;

  if (typeof candidate === 'string' && candidate.trim().length > 0) {
    return candidate.trim().toLowerCase();
  }

  return null;
}

export async function getAuthContext(): Promise<AuthContext | null> {
  const supabase = getServerComponentClient();
  const [{ data: sessionData, error: sessionError }, { data: userData, error: userError }] =
    await Promise.all([supabase.auth.getSession(), supabase.auth.getUser()]);

  if (sessionError) {
    console.error('Failed to retrieve session', sessionError);
    throw sessionError;
  }

  if (userError) {
    console.error('Failed to retrieve user', userError);
    throw userError;
  }

  const session = sessionData.session;
  const user = userData.user;

  if (!session || !user) {
    return null;
  }

  return {
    session,
    user,
    vendorId: resolveVendorId(user),
    role: resolveRole(user)
  };
}

export async function requireAuthContext(): Promise<AuthContext> {
  const context = await getAuthContext();

  if (!context) {
    throw new UnauthenticatedError();
  }

  return context;
}

export function assertAuthorizedVendor(vendorId: number | null): asserts vendorId is number {
  if (!Number.isInteger(vendorId)) {
    throw new UnauthenticatedError('Vendor context is missing on the authenticated user');
  }
}

export function assertAdmin(context: AuthContext) {
  if (context.role !== 'admin') {
    throw new ForbiddenError('Administrator privileges required');
  }
}

export function isAdmin(context: AuthContext | null): boolean {
  return Boolean(context?.role === 'admin');
}
