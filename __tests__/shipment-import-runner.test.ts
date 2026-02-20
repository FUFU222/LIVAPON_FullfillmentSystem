jest.mock('@/lib/data/orders', () => ({
  upsertShipment: jest.fn(),
  prepareShipmentBatch: jest.fn()
}));

jest.mock('@/lib/data/shipment-import-jobs', () => ({
  claimShipmentImportJobs: jest.fn(),
  listReclaimableShipmentImportJobIds: jest.fn(),
  claimShipmentImportJobById: jest.fn(),
  loadPendingJobItems: jest.fn(),
  incrementJobItemAttempts: jest.fn(),
  markJobItemsResult: jest.fn(),
  updateShipmentJobProgress: jest.fn(),
  countPendingJobItems: jest.fn(),
  getShipmentImportJob: jest.fn()
}));

import { processShipmentImportJobs } from '@/lib/jobs/shipment-import-runner';

const jobsData = jest.requireMock<{
  claimShipmentImportJobs: jest.Mock;
  listReclaimableShipmentImportJobIds: jest.Mock;
  claimShipmentImportJobById: jest.Mock;
  loadPendingJobItems: jest.Mock;
  incrementJobItemAttempts: jest.Mock;
  markJobItemsResult: jest.Mock;
  updateShipmentJobProgress: jest.Mock;
  countPendingJobItems: jest.Mock;
  getShipmentImportJob: jest.Mock;
}>('@/lib/data/shipment-import-jobs');

function createJob(id: number, status: 'pending' | 'running' = 'running') {
  return {
    id,
    vendor_id: 25,
    tracking_number: '0000000000',
    carrier: 'yamato',
    status,
    total_count: 1,
    processed_count: 0,
    error_count: 0,
    last_error: null,
    attempts: 1,
    locked_at: '2026-02-20T00:56:59.156Z',
    last_attempt_at: '2026-02-20T00:56:59.156Z',
    created_at: '2026-02-20T00:56:58.652Z',
    updated_at: '2026-02-20T00:56:59.156Z'
  };
}

describe('processShipmentImportJobs', () => {
  beforeEach(() => {
    jest.resetAllMocks();
    jobsData.claimShipmentImportJobs.mockResolvedValue([]);
    jobsData.listReclaimableShipmentImportJobIds.mockResolvedValue([]);
    jobsData.claimShipmentImportJobById.mockResolvedValue(null);
    jobsData.loadPendingJobItems.mockResolvedValue([]);
    jobsData.countPendingJobItems.mockResolvedValue(0);
    jobsData.updateShipmentJobProgress.mockImplementation(async (job: any, update: any) => ({
      ...job,
      status: update.status ?? job.status
    }));
  });

  it('reclaims stale running jobs when no pending job is claimed', async () => {
    jobsData.listReclaimableShipmentImportJobIds.mockResolvedValue([10]);
    jobsData.claimShipmentImportJobById.mockResolvedValue(createJob(10, 'running'));

    const summary = await processShipmentImportJobs({ jobLimit: 1, itemLimit: 10 });

    expect(jobsData.claimShipmentImportJobs).toHaveBeenCalledWith(1);
    expect(jobsData.listReclaimableShipmentImportJobIds).toHaveBeenCalledWith(1);
    expect(jobsData.claimShipmentImportJobById).toHaveBeenCalledWith(10);
    expect(summary.claimed).toBe(1);
    expect(summary.succeeded).toBe(1);
    expect(summary.failed).toBe(0);
  });

  it('does not attempt stale reclaim when pending jobs already fill the limit', async () => {
    jobsData.claimShipmentImportJobs.mockResolvedValue([createJob(11, 'running')]);

    const summary = await processShipmentImportJobs({ jobLimit: 1, itemLimit: 10 });

    expect(jobsData.listReclaimableShipmentImportJobIds).not.toHaveBeenCalled();
    expect(jobsData.claimShipmentImportJobById).not.toHaveBeenCalled();
    expect(summary.claimed).toBe(1);
  });
});
