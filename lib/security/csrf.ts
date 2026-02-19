function resolveOriginFromReferer(referer: string | null): string | null {
  if (!referer) {
    return null;
  }

  try {
    return new URL(referer).origin;
  } catch {
    return null;
  }
}

export function isSameOriginRequest(request: Request): boolean {
  let expectedOrigin: string;

  try {
    expectedOrigin = new URL(request.url).origin;
  } catch {
    return false;
  }

  const originHeader = request.headers.get('origin');
  if (originHeader) {
    return originHeader === expectedOrigin;
  }

  return resolveOriginFromReferer(request.headers.get('referer')) === expectedOrigin;
}
