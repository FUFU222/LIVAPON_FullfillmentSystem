export const ACTIVE_SHIPMENT_ADJUSTMENT_STATUSES = [
  'pending',
  'in_review',
  'needs_info'
] as const;

export const RESOLVED_SHIPMENT_ADJUSTMENT_STATUSES = ['resolved'] as const;

export const SHIPMENT_ADJUSTMENT_NAV_SYNC_EVENT = 'shipment-adjustment:updated';
