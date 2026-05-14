jest.mock('@/lib/data/orders/clients', () => ({
  getOptionalServiceClient: jest.fn()
}));

import { getAdminOperationalStatus } from '@/lib/data/admin-operational-status';

const { getOptionalServiceClient } = jest.requireMock<{
  getOptionalServiceClient: jest.Mock;
}>('@/lib/data/orders/clients');

function createQueryBuilder(result: unknown) {
  const builder: any = {
    select: jest.fn(() => builder),
    in: jest.fn(() => builder),
    eq: jest.fn(() => builder),
    lte: jest.fn(() => builder),
    order: jest.fn(() => builder),
    limit: jest.fn(() => builder),
    maybeSingle: jest.fn().mockResolvedValue(result),
    then: (resolve: (value: unknown) => unknown, reject: (reason: unknown) => unknown) =>
      Promise.resolve(result).then(resolve, reject)
  };
  return builder;
}

describe('getAdminOperationalStatus', () => {
  beforeEach(() => {
    jest.resetAllMocks();
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-05-13T15:00:00.000Z'));
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('returns zero status when the service client is unavailable', async () => {
    getOptionalServiceClient.mockReturnValue(null);

    await expect(getAdminOperationalStatus()).resolves.toEqual({
      pendingDataCount: 0,
      failedSyncCount: 0,
      delayedShopifyUpdateCount: 0,
      oldestShopifyUpdateAgeMinutes: null,
      attentionCount: 0,
      checkedAt: '2026-05-13T15:00:00.000Z'
    });
  });

  it('summarizes pending, failed, and delayed integration work for admins', async () => {
    const builders = [
      createQueryBuilder({ count: 2, error: null }),
      createQueryBuilder({ count: 3, error: null }),
      createQueryBuilder({ count: 4, error: null }),
      createQueryBuilder({ count: 1, error: null }),
      createQueryBuilder({ count: 2, error: null }),
      createQueryBuilder({ count: 3, error: null }),
      createQueryBuilder({ count: 5, error: null }),
      createQueryBuilder({
        data: { created_at: '2026-05-13T14:15:00.000Z' },
        error: null
      })
    ];
    const from = jest.fn(() => builders.shift());
    getOptionalServiceClient.mockReturnValue({ from });

    await expect(getAdminOperationalStatus()).resolves.toEqual({
      pendingDataCount: 9,
      failedSyncCount: 6,
      delayedShopifyUpdateCount: 5,
      oldestShopifyUpdateAgeMinutes: 45,
      attentionCount: 11,
      checkedAt: '2026-05-13T15:00:00.000Z'
    });

    expect(from).toHaveBeenCalledWith('webhook_jobs');
    expect(from).toHaveBeenCalledWith('shipment_import_jobs');
    expect(from).toHaveBeenCalledWith('shipments');
  });
});
