import {
  DAFTRA_PRODUCT_SYNC_INTERVAL_MS,
  DAFTRA_PRODUCT_SYNC_LOCK_TTL_SEC,
  WorkerCronService,
} from './worker-cron.service';

describe('WorkerCronService Daftra product poll', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  function setup(
    overrides: {
      connectedIds?: string[];
      redisEnabled?: boolean;
      lockAcquired?: boolean | ((key: string) => boolean);
      syncImpl?: (actor: string | null, butcherId: string) => Promise<unknown>;
    } = {},
  ) {
    const connectedIds = overrides.connectedIds ?? ['butcher-a', 'butcher-b'];
    const redisEnabled = overrides.redisEnabled ?? true;
    const setMock = jest.fn(
      async (
        key: string,
        _value: string,
        _ex: string,
        _ttl: number,
        _nx: string,
      ) => {
        if (typeof overrides.lockAcquired === 'function') {
          return overrides.lockAcquired(key) ? 'OK' : null;
        }
        return overrides.lockAcquired === false ? null : 'OK';
      },
    );

    const daftra = {
      listConnectedButcherIds: jest.fn().mockResolvedValue(connectedIds),
      syncProductsFromDaftra: jest.fn().mockImplementation(
        overrides.syncImpl ??
          (async () => ({
            fetched: 1,
            created: 1,
            updated: 0,
            skipped: 0,
            pages: 1,
            errors: [],
          })),
      ),
    };
    const cache = {
      isEnabled: jest.fn().mockReturnValue(redisEnabled),
      getClient: jest.fn().mockReturnValue({ set: setMock }),
    };
    const logger = {
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      debug: jest.fn(),
    };

    const service = new WorkerCronService(
      {} as never,
      cache as never,
      {} as never,
      {} as never,
      {} as never,
      daftra as never,
      logger as never,
    );

    return { service, daftra, cache, logger, setMock };
  }

  it('uses a 10-minute poll interval constant', () => {
    expect(DAFTRA_PRODUCT_SYNC_INTERVAL_MS).toBe(10 * 60 * 1000);
    expect(DAFTRA_PRODUCT_SYNC_LOCK_TTL_SEC).toBe(9 * 60);
  });

  it('syncs every CONNECTED butcher via existing syncProductsFromDaftra', async () => {
    const { service, daftra, setMock } = setup();

    const summary = await service.runDaftraProductSyncCron();

    expect(daftra.listConnectedButcherIds).toHaveBeenCalledTimes(1);
    expect(daftra.syncProductsFromDaftra).toHaveBeenCalledTimes(2);
    expect(daftra.syncProductsFromDaftra).toHaveBeenNthCalledWith(
      1,
      null,
      'butcher-a',
    );
    expect(daftra.syncProductsFromDaftra).toHaveBeenNthCalledWith(
      2,
      null,
      'butcher-b',
    );
    expect(setMock).toHaveBeenCalledWith(
      'cron:daftra_products:butcher-a',
      '1',
      'EX',
      DAFTRA_PRODUCT_SYNC_LOCK_TTL_SEC,
      'NX',
    );
    expect(setMock).toHaveBeenCalledWith(
      'cron:daftra_products:butcher-b',
      '1',
      'EX',
      DAFTRA_PRODUCT_SYNC_LOCK_TTL_SEC,
      'NX',
    );
    expect(summary).toEqual({
      attempted: 2,
      synced: 2,
      skippedLocked: 0,
      failed: 0,
    });
    service.onModuleDestroy();
  });

  it('skips a butcher when its Redis lock is held and continues others', async () => {
    const { service, daftra } = setup({
      lockAcquired: (key) => key !== 'cron:daftra_products:butcher-a',
    });

    const summary = await service.runDaftraProductSyncCron();

    expect(daftra.syncProductsFromDaftra).toHaveBeenCalledTimes(1);
    expect(daftra.syncProductsFromDaftra).toHaveBeenCalledWith(
      null,
      'butcher-b',
    );
    expect(summary).toEqual({
      attempted: 2,
      synced: 1,
      skippedLocked: 1,
      failed: 0,
    });
    service.onModuleDestroy();
  });

  it('continues polling other butchers when one sync throws', async () => {
    const { service, daftra, logger } = setup({
      syncImpl: async (_actor, butcherId) => {
        if (butcherId === 'butcher-a') {
          throw new Error('upstream_timeout');
        }
        return {
          fetched: 1,
          created: 0,
          updated: 1,
          skipped: 0,
          pages: 1,
          errors: [],
        };
      },
    });

    const summary = await service.runDaftraProductSyncCron();

    expect(daftra.syncProductsFromDaftra).toHaveBeenCalledTimes(2);
    expect(summary).toEqual({
      attempted: 2,
      synced: 1,
      skippedLocked: 0,
      failed: 1,
    });
    expect(logger.warn).toHaveBeenCalledWith(
      expect.objectContaining({
        butcherId: 'butcher-a',
        err: 'upstream_timeout',
      }),
      expect.stringContaining('continuing'),
    );
    const logged = JSON.stringify(logger.warn.mock.calls);
    expect(logged).not.toMatch(/api[_-]?key|secret|token|APIKEY/i);
    service.onModuleDestroy();
  });

  it('still syncs when Redis is disabled (no lock)', async () => {
    const { service, daftra, setMock } = setup({ redisEnabled: false });

    const summary = await service.runDaftraProductSyncCron();

    expect(setMock).not.toHaveBeenCalled();
    expect(daftra.syncProductsFromDaftra).toHaveBeenCalledTimes(2);
    expect(summary.synced).toBe(2);
    service.onModuleDestroy();
  });

  it('does not log secrets when listing connected butchers fails', async () => {
    const { service, daftra, logger } = setup();
    daftra.listConnectedButcherIds.mockRejectedValue(
      new Error('db_unavailable'),
    );

    const summary = await service.runDaftraProductSyncCron();

    expect(summary.attempted).toBe(0);
    expect(daftra.syncProductsFromDaftra).not.toHaveBeenCalled();
    expect(logger.error).toHaveBeenCalledWith(
      expect.objectContaining({ err: 'db_unavailable' }),
      expect.any(String),
    );
    expect(JSON.stringify(logger.error.mock.calls)).not.toMatch(
      /api[_-]?key|client_secret|access_token/i,
    );
    service.onModuleDestroy();
  });
});
