import { timingSafeEqual } from 'node:crypto';

export function isAuthorizedInternalRequest(request: Request, expectedToken: string | null | undefined): boolean {
  if (!expectedToken) {
    return false;
  }

  const authorization = request.headers.get('authorization') ?? '';
  const token = authorization.startsWith('Bearer ')
    ? authorization.slice('Bearer '.length).trim()
    : null;

  if (!token) {
    return false;
  }

  const expected = Buffer.from(expectedToken);
  const actual = Buffer.from(token);

  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

export function isExplicitInternalAuthBypassAllowed(): boolean {
  return process.env.NODE_ENV !== 'production' && process.env.ALLOW_INSECURE_INTERNAL_ROUTES === 'true';
}
