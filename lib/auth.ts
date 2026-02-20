import type { Session, User } from '@supabase/supabase-js';
import { getServerComponentClient } from '@/lib/supabase/server';
import {
  resolveRoleFromAuthUser,
  resolveVendorIdFromAuthUser
} from '@/lib/auth-metadata';

export type AuthContext = {
  session: Session;
  user: User;
  vendorId: number | null;
  role: string | null;
};

export class UnauthenticatedError extends Error {
  constructor(message = '認証が必要です') {
    super(message);
    this.name = 'UnauthenticatedError';
  }
}

export class ForbiddenError extends Error {
  constructor(message = 'アクセス権限がありません') {
    super(message);
    this.name = 'ForbiddenError';
  }
}

export async function getAuthContext(): Promise<AuthContext | null> {
  const supabase = await getServerComponentClient();
  const { data: sessionData, error: sessionError } = await supabase.auth.getSession();

  if (sessionError) {
    console.error('Failed to retrieve session', sessionError);
    throw sessionError;
  }

  const session = sessionData.session;

  if (!session) {
    return null;
  }

  const { data: userData, error: userError } = await supabase.auth.getUser();

  if (userError) {
    if (userError instanceof Error && 'status' in userError && userError.status === 400) {
      return null;
    }
    console.error('Failed to retrieve user', userError);
    throw userError;
  }

  const user = userData.user;

  if (!user) {
    return null;
  }

  return {
    session,
    user,
    vendorId: resolveVendorIdFromAuthUser(user),
    role: resolveRoleFromAuthUser(user)
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
    throw new UnauthenticatedError('セラー情報が紐づいていないため操作できません。');
  }
}

export function assertAdmin(context: AuthContext) {
  if (context.role !== 'admin') {
    throw new ForbiddenError('管理者権限が必要です');
  }
}

export function isAdmin(context: AuthContext | null): boolean {
  return Boolean(context?.role === 'admin');
}
