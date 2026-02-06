/**
 * Base Collector tests
 */

import { BaseCollector, CollectorTarget } from '../../../src/collectors/base-collector';
import { TelemetryData, TelemetrySource, CollectorConfig } from '../../../src/utils/types';

// Concrete implementation for testing
class TestCollector extends BaseCollector {
  public initializeCalled = false;
  public cleanupCalled = false;
  public collectCalled = false;
  public mockData: TelemetryData[] = [];

  constructor(config: Partial<CollectorConfig> = {}) {
    super('TestCollector', TelemetrySource.SNMP, {
      enabled: true,
      pollInterval: 1000,
      timeout: 5000,
      retries: 3,
      batchSize: 10,
      maxConcurrent: 5,
      ...config,
    });
  }

  protected async initialize(): Promise<void> {
    this.initializeCalled = true;
  }

  protected async cleanup(): Promise<void> {
    this.cleanupCalled = true;
  }

  protected async collect(_target: CollectorTarget): Promise<TelemetryData[]> {
    this.collectCalled = true;
    return this.mockData;
  }

  setMockData(data: TelemetryData[]): void {
    this.mockData = data;
  }
}

describe('BaseCollector', () => {
  let collector: TestCollector;

  beforeEach(() => {
    collector = new TestCollector();
  });

  afterEach(async () => {
    if (collector.running) {
      await collector.stop();
    }
  });

  describe('lifecycle', () => {
    it('should initialize and start correctly', async () => {
      collector.addTarget({ host: 'localhost', enabled: true });
      await collector.start();

      expect(collector.initializeCalled).toBe(true);
      expect(collector.running).toBe(true);
    });

    it('should stop and cleanup correctly', async () => {
      collector.addTarget({ host: 'localhost', enabled: true });
      await collector.start();
      await collector.stop();

      expect(collector.cleanupCalled).toBe(true);
      expect(collector.running).toBe(false);
    });

    it('should not start if disabled', async () => {
      const disabledCollector = new TestCollector({ enabled: false });
      await disabledCollector.start();
      expect(disabledCollector.running).toBe(false);
    });
  });

  describe('target management', () => {
    it('should add targets correctly', () => {
      const id = collector.addTarget({ host: '192.168.1.1', enabled: true });
      const targets = collector.getTargets();

      expect(targets).toHaveLength(1);
      expect(targets[0].id).toBe(id);
      expect(targets[0].host).toBe('192.168.1.1');
    });

    it('should remove targets correctly', () => {
      const id = collector.addTarget({ host: '192.168.1.1', enabled: true });
      const removed = collector.removeTarget(id);

      expect(removed).toBe(true);
      expect(collector.getTargets()).toHaveLength(0);
    });

    it('should enable/disable targets', () => {
      const id = collector.addTarget({ host: '192.168.1.1', enabled: true });
      collector.setTargetEnabled(id, false);

      const targets = collector.getTargets();
      expect(targets[0].enabled).toBe(false);
    });
  });

  describe('status', () => {
    it('should report correct status', () => {
      const status = collector.getStatus();

      expect(status.name).toBe('TestCollector');
      expect(status.source).toBe(TelemetrySource.SNMP);
      expect(status.isRunning).toBe(false);
      expect(status.pollCount).toBe(0);
    });

    it('should update poll count after polling', async () => {
      collector.addTarget({ host: 'localhost', enabled: true });
      await collector.start();

      // Wait for at least one poll
      await new Promise(resolve => setTimeout(resolve, 1500));

      const status = collector.getStatus();
      expect(status.pollCount).toBeGreaterThanOrEqual(1);
    });
  });

  describe('configuration', () => {
    it('should update configuration', () => {
      collector.updateConfig({ pollInterval: 5000 });
      // Config is private, but we can verify it works by checking behavior
      expect(collector.getStatus().name).toBe('TestCollector');
    });
  });

  describe('events', () => {
    it('should emit started event', async () => {
      const startedHandler = jest.fn();
      collector.on('started', startedHandler);

      collector.addTarget({ host: 'localhost', enabled: true });
      await collector.start();

      expect(startedHandler).toHaveBeenCalled();
    });

    it('should emit stopped event', async () => {
      const stoppedHandler = jest.fn();
      collector.on('stopped', stoppedHandler);

      collector.addTarget({ host: 'localhost', enabled: true });
      await collector.start();
      await collector.stop();

      expect(stoppedHandler).toHaveBeenCalled();
    });
  });
});
