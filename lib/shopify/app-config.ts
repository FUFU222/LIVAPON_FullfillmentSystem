export const SHOPIFY_ORDER_WEBHOOK_TOPICS = [
  'orders/create',
  'orders/updated',
  'orders/cancelled',
  'orders/fulfilled'
] as const;

export const SHOPIFY_FULFILLMENT_ORDER_WEBHOOK_TOPICS = [
  'fulfillment_orders/order_routing_complete',
  'fulfillment_orders/hold_released',
  'fulfillment_orders/cancellation_request_accepted'
] as const;

export const SHOPIFY_SUPPORTED_WEBHOOK_TOPICS = [
  ...SHOPIFY_ORDER_WEBHOOK_TOPICS,
  ...SHOPIFY_FULFILLMENT_ORDER_WEBHOOK_TOPICS
] as const;

export const SHOPIFY_REQUIRED_SCOPES = [
  'read_merchant_managed_fulfillment_orders',
  'read_orders',
  'write_merchant_managed_fulfillment_orders',
  'write_orders'
] as const;

type ScopeLike = string | readonly string[] | null | undefined;

export type ShopifyScopeAudit = {
  required: string[];
  requested: string[];
  granted: string[];
  missingRequired: string[];
  missingRequested: string[];
  requestedMissingRequired: string[];
  requestedButNotRequired: string[];
  grantedButNotRequested: string[];
  grantedKnown: boolean;
  grantedSupportsRuntime: boolean | null;
};

const loggedScopeAuditKeys = new Set<string>();

export function normalizeShopifyScopes(value: ScopeLike): string[] {
  const rawScopes = Array.isArray(value)
    ? value
    : typeof value === 'string'
      ? value.split(',')
      : [];

  return Array.from(
    new Set(
      rawScopes
        .map((scope) => scope.trim())
        .filter((scope) => scope.length > 0)
    )
  ).sort();
}

export function getRequiredShopifyScopes(): string[] {
  return [...SHOPIFY_REQUIRED_SCOPES];
}

export function getRequiredShopifyScopesString(): string {
  return getRequiredShopifyScopes().join(',');
}

export function getRequestedShopifyScopes(): string[] {
  return normalizeShopifyScopes(process.env.SHOPIFY_SCOPES ?? getRequiredShopifyScopesString());
}

export function getRequestedShopifyScopesString(): string {
  return getRequestedShopifyScopes().join(',');
}

export function auditShopifyScopes(grantedScopes: ScopeLike): ShopifyScopeAudit {
  const required = getRequiredShopifyScopes();
  const requested = getRequestedShopifyScopes();
  const grantedKnown = grantedScopes !== null && typeof grantedScopes !== 'undefined';
  const granted = grantedKnown ? normalizeShopifyScopes(grantedScopes) : [];

  const requestedMissingRequired = required.filter((scope) => !requested.includes(scope));
  const requestedButNotRequired = requested.filter((scope) => !required.includes(scope));
  const grantedButNotRequested = granted.filter((scope) => !requested.includes(scope));
  const missingRequested = grantedKnown
    ? requested.filter((scope) => !granted.includes(scope))
    : [];
  const missingRequired = grantedKnown
    ? required.filter((scope) => !granted.includes(scope))
    : [];

  return {
    required,
    requested,
    granted,
    missingRequired,
    missingRequested,
    requestedMissingRequired,
    requestedButNotRequired,
    grantedButNotRequested,
    grantedKnown,
    grantedSupportsRuntime: grantedKnown ? missingRequired.length === 0 : null
  };
}

export function assertRequestedShopifyScopesCoverRuntimeNeeds(): string[] {
  const audit = auditShopifyScopes(undefined);
  if (audit.requestedMissingRequired.length > 0) {
    throw new Error(
      `SHOPIFY_SCOPES is missing runtime-required scopes: ${audit.requestedMissingRequired.join(', ')}`
    );
  }
  return audit.requested;
}

export function logShopifyScopeAudit(options: {
  shop: string;
  grantedScopes: ScopeLike;
  source: string;
}) {
  const audit = auditShopifyScopes(options.grantedScopes);
  const payload = {
    shop: options.shop,
    source: options.source,
    required: audit.required,
    requested: audit.requested,
    granted: audit.grantedKnown ? audit.granted : null,
    requestedMissingRequired: audit.requestedMissingRequired,
    missingRequired: audit.missingRequired,
    missingRequested: audit.missingRequested,
    requestedButNotRequired: audit.requestedButNotRequired,
    grantedButNotRequested: audit.grantedButNotRequested
  };
  const cacheKey = JSON.stringify(payload);

  if (loggedScopeAuditKeys.has(cacheKey)) {
    return audit;
  }
  loggedScopeAuditKeys.add(cacheKey);

  if (audit.requestedMissingRequired.length > 0) {
    console.warn('Configured Shopify scopes are missing runtime-required scopes', payload);
  }

  if (!audit.grantedKnown) {
    console.info('Stored Shopify connection has no granted scope metadata', payload);
    return audit;
  }

  if (audit.missingRequired.length > 0) {
    console.warn('Granted Shopify scopes are missing runtime-required scopes', payload);
    return audit;
  }

  if (
    audit.missingRequested.length > 0
    || audit.requestedButNotRequired.length > 0
    || audit.grantedButNotRequested.length > 0
  ) {
    console.info('Granted Shopify scopes differ from requested scopes', payload);
  }

  return audit;
}
