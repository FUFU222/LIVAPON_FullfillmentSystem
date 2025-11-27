import { fetchFulfillmentOrderSnapshots } from '@/lib/shopify/fulfillment';

const originalFetch = global.fetch;

function buildResponse({
  ok = true,
  status = 200,
  body
}: {
  ok?: boolean;
  status?: number;
  body?: unknown;
}) {
  if (ok) {
    return {
      ok,
      status,
      json: async () => body ?? {},
      text: async () => JSON.stringify(body ?? {})
    } as Response;
  }
  return {
    ok,
    status,
    text: async () => (typeof body === 'string' ? body : JSON.stringify(body ?? {}))
  } as Response;
}

describe('fetchFulfillmentOrderSnapshots', () => {
  beforeEach(() => {
    global.fetch = jest.fn() as unknown as typeof fetch;
  });

  afterEach(() => {
    jest.useRealTimers();
    if (originalFetch) {
      global.fetch = originalFetch;
    } else {
      Reflect.deleteProperty(globalThis as typeof globalThis & { fetch?: typeof fetch }, 'fetch');
    }
  });

  it('returns normalized fulfillment order snapshots from Shopify', async () => {
    const fetchMock = global.fetch as jest.Mock;
    fetchMock.mockResolvedValue(
      buildResponse({
        body: {
          fulfillment_orders: [
            {
              id: 44,
              line_items: [
                { id: 701, line_item_id: 9001, remaining_quantity: 2 },
                { id: 702, line_item_id: 9002, remaining_quantity: 1 }
              ]
            }
          ]
        }
      })
    );

    const snapshots = await fetchFulfillmentOrderSnapshots('example.myshopify.com', 'shpat-test', 123456);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const calledUrl = fetchMock.mock.calls[0][0] as URL;
    expect(calledUrl.toString()).toBe(
      'https://example.myshopify.com/admin/api/2025-10/orders/123456/fulfillment_orders.json'
    );
    const options = fetchMock.mock.calls[0][1];
    expect(options).toMatchObject({
      method: 'GET',
      headers: expect.objectContaining({ 'X-Shopify-Access-Token': 'shpat-test' })
    });
    expect(snapshots).toEqual([
      {
        id: 44,
        status: null,
        line_items: [
          { id: 701, line_item_id: 9001, remaining_quantity: 2 },
          { id: 702, line_item_id: 9002, remaining_quantity: 1 }
        ]
      }
    ]);
  });

  it('retries when Shopify returns a retriable error status', async () => {
    jest.useFakeTimers();
    const fetchMock = global.fetch as jest.Mock;
    fetchMock
      .mockResolvedValueOnce(buildResponse({ ok: false, status: 500, body: 'server exploded' }))
      .mockResolvedValueOnce(buildResponse({ body: { fulfillment_orders: [] } }));

    const promise = fetchFulfillmentOrderSnapshots('retry.myshopify.com', 'token-x', 99);

    await jest.advanceTimersByTimeAsync(1000);
    const snapshots = await promise;

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(snapshots).toEqual([]);
  });
});
