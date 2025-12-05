import { createSign } from 'crypto';

const GMAIL_TOKEN_URL = 'https://oauth2.googleapis.com/token';
const GMAIL_SCOPE = 'https://www.googleapis.com/auth/gmail.send';

export type SendEmailPayload = {
  to: string | string[];
  subject: string;
  text: string;
  fromName?: string;
};

export class GmailConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'GmailConfigError';
  }
}

export class GmailApiError extends Error {
  status: number;
  responseBody?: string;

  constructor(message: string, status: number, responseBody?: string) {
    super(message);
    this.name = 'GmailApiError';
    this.status = status;
    this.responseBody = responseBody;
  }
}

export function isRetryableEmailError(error: unknown): boolean {
  return (
    error instanceof GmailApiError &&
    (error.status === 429 || (error.status >= 500 && error.status < 600))
  );
}

type GmailConfig = {
  clientEmail: string;
  privateKey: string;
  sender: string;
  impersonatedUser: string;
};

const tokenCache = new Map<string, { accessToken: string; expiresAt: number }>();
let cachedConfig: GmailConfig | null = null;

function base64UrlEncode(input: Buffer | string): string {
  const buffer = Buffer.isBuffer(input) ? input : Buffer.from(input, 'utf8');
  return buffer
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '');
}

function encodeMimeHeader(value: string): string {
  return /[^\x20-\x7E]/.test(value)
    ? `=?UTF-8?B?${Buffer.from(value, 'utf8').toString('base64')}?=`
    : value;
}

function normalizePrivateKey(key: string): string {
  return key.replace(/\\n/g, '\n');
}

function getGmailConfig(): GmailConfig {
  if (cachedConfig) {
    return cachedConfig;
  }

  const clientEmail = process.env.GMAIL_SERVICE_ACCOUNT_CLIENT_EMAIL;
  const rawPrivateKey = process.env.GMAIL_SERVICE_ACCOUNT_PRIVATE_KEY;
  const sender = process.env.GMAIL_SENDER ?? 'information@chairman.jp';
  const impersonatedUser = process.env.GMAIL_IMPERSONATED_USER ?? sender;

  if (!clientEmail || !rawPrivateKey) {
    throw new GmailConfigError(
      'Gmail service account credentials are not configured. Set GMAIL_SERVICE_ACCOUNT_CLIENT_EMAIL and GMAIL_SERVICE_ACCOUNT_PRIVATE_KEY.'
    );
  }

  cachedConfig = {
    clientEmail,
    privateKey: normalizePrivateKey(rawPrivateKey),
    sender,
    impersonatedUser
  };

  return cachedConfig;
}

function createServiceAccountJwt(config: GmailConfig): string {
  const nowSeconds = Math.floor(Date.now() / 1000);
  const header = {
    alg: 'RS256',
    typ: 'JWT'
  };
  const claims = {
    iss: config.clientEmail,
    scope: GMAIL_SCOPE,
    aud: GMAIL_TOKEN_URL,
    iat: nowSeconds,
    exp: nowSeconds + 3600,
    sub: config.impersonatedUser
  };

  const encodedHeader = base64UrlEncode(JSON.stringify(header));
  const encodedClaims = base64UrlEncode(JSON.stringify(claims));
  const unsigned = `${encodedHeader}.${encodedClaims}`;
  const signer = createSign('RSA-SHA256');
  signer.update(unsigned);
  const signature = signer.sign(config.privateKey);
  return `${unsigned}.${base64UrlEncode(signature)}`;
}

async function fetchAccessToken(config: GmailConfig): Promise<string> {
  const cacheKey = `${config.clientEmail}:${config.impersonatedUser}`;
  const cached = tokenCache.get(cacheKey);
  const now = Date.now();
  if (cached && cached.expiresAt - 60_000 > now) {
    return cached.accessToken;
  }

  const assertion = createServiceAccountJwt(config);
  const body = new URLSearchParams({
    grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
    assertion
  });

  const response = await fetch(GMAIL_TOKEN_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded'
    },
    body
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new GmailApiError('Failed to obtain Gmail access token', response.status, errorBody);
  }

  const json = (await response.json()) as { access_token: string; expires_in?: number };
  const expiresInMs = (json.expires_in ?? 3600) * 1000;
  const entry = {
    accessToken: json.access_token,
    expiresAt: Date.now() + expiresInMs
  };
  tokenCache.set(cacheKey, entry);
  return entry.accessToken;
}

function formatRecipients(to: string | string[]): string {
  return Array.isArray(to) ? to.join(', ') : to;
}

function buildMimeMessage(payload: SendEmailPayload, sender: string, fromName: string): string {
  const headers = [
    `From: ${encodeMimeHeader(payload.fromName ?? fromName)} <${sender}>`,
    `To: ${formatRecipients(payload.to)}`,
    `Subject: ${encodeMimeHeader(payload.subject)}`,
    'MIME-Version: 1.0',
    'Content-Type: text/plain; charset="UTF-8"',
    'Content-Transfer-Encoding: 8bit',
    `Date: ${new Date().toUTCString()}`
  ];
  return `${headers.join('\r\n')}\r\n\r\n${payload.text.replace(/\r?\n/g, '\r\n')}`;
}

export async function sendEmail(payload: SendEmailPayload): Promise<void> {
  const config = getGmailConfig();
  const accessToken = await fetchAccessToken(config);
  const defaultFromName = process.env.GMAIL_FROM_NAME ?? 'LIVAPON 事務局';
  const mime = buildMimeMessage(payload, config.sender, defaultFromName);
  const raw = base64UrlEncode(Buffer.from(mime, 'utf8'));

  const response = await fetch(
    `https://gmail.googleapis.com/gmail/v1/users/${encodeURIComponent(config.impersonatedUser)}/messages/send`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ raw })
    }
  );

  if (!response.ok) {
    const errorBody = await response.text();
    throw new GmailApiError('Gmail API rejected send request', response.status, errorBody);
  }
}
