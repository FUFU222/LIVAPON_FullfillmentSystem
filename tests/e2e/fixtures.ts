import { expect, test as base, type Page } from '@playwright/test';

export { expect };
export const test = base;

export type E2ERole = 'admin' | 'pendingVendor' | 'vendorA' | 'vendorB';

type Credentials = {
  email: string;
  password: string;
};

const ROLE_ENV_KEYS: Record<E2ERole, { email: string; password: string }> = {
  admin: {
    email: 'E2E_ADMIN_EMAIL',
    password: 'E2E_ADMIN_PASSWORD'
  },
  pendingVendor: {
    email: 'E2E_PENDING_VENDOR_EMAIL',
    password: 'E2E_PENDING_VENDOR_PASSWORD'
  },
  vendorA: {
    email: 'E2E_VENDOR_A_EMAIL',
    password: 'E2E_VENDOR_A_PASSWORD'
  },
  vendorB: {
    email: 'E2E_VENDOR_B_EMAIL',
    password: 'E2E_VENDOR_B_PASSWORD'
  }
};

export const ORDER_ENV_KEYS = {
  vendorAOrderNumber: 'E2E_VENDOR_A_ORDER_NUMBER',
  vendorBOrderNumber: 'E2E_VENDOR_B_ORDER_NUMBER',
  mixedOrderNumber: 'E2E_MIXED_ORDER_NUMBER'
} as const;

function readEnv(name: string): string | null {
  const value = process.env[name]?.trim();
  return value && value.length > 0 ? value : null;
}

export function missingEnv(...names: string[]): string[] {
  return names.filter((name) => !readEnv(name));
}

export function missingCredentialEnv(...roles: E2ERole[]): string[] {
  const keys = roles.flatMap((role) => [ROLE_ENV_KEYS[role].email, ROLE_ENV_KEYS[role].password]);
  return missingEnv(...keys);
}

export function getCredentials(role: E2ERole): Credentials | null {
  const keys = ROLE_ENV_KEYS[role];
  const email = readEnv(keys.email);
  const password = readEnv(keys.password);
  if (!email || !password) {
    return null;
  }
  return { email, password };
}

export function getOrderReference(key: keyof typeof ORDER_ENV_KEYS): string | null {
  return readEnv(ORDER_ENV_KEYS[key]);
}

export async function resetAuthState(page: Page) {
  await page.goto('/sign-in');
  await page.context().clearCookies();
  await page.evaluate(() => {
    window.localStorage.clear();
    window.sessionStorage.clear();
  });
}

export async function signInAs(page: Page, role: E2ERole, redirectTo = '/orders') {
  const credentials = getCredentials(role);
  if (!credentials) {
    const missing = missingCredentialEnv(role);
    throw new Error(`Missing E2E credentials: ${missing.join(', ')}`);
  }

  await signInWithCredentials(page, credentials, redirectTo);
}

export async function signInWithCredentials(page: Page, credentials: Credentials, redirectTo = '/orders') {

  await resetAuthState(page);
  await page.goto(`/sign-in?redirectTo=${encodeURIComponent(redirectTo)}`);
  await page.getByLabel('メールアドレス').fill(credentials.email);
  await page.getByLabel('パスワード').fill(credentials.password);
  await page.getByRole('button', { name: 'サインイン' }).click();
  await page.waitForLoadState('networkidle');
}

export async function expectPathname(page: Page, pathname: string) {
  await expect
    .poll(() => {
      const current = new URL(page.url());
      return current.pathname;
    })
    .toBe(pathname);
}

export async function expectRedirectToSignIn(page: Page, redirectTo: string) {
  await expectPathname(page, '/sign-in');
  await expect
    .poll(() => {
      const current = new URL(page.url());
      return current.searchParams.get('redirectTo');
    })
    .toBe(redirectTo);
}
