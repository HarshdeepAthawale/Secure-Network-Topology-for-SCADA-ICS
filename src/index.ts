/**
 * SCADA Topology Discovery - Main Entry Point
 */

// Export all modules
export * from './utils';
export * from './collectors';
export * from './processors';

// Re-export Lambda handlers
export {
  ingestHandler,
  processHandler,
  queryHandler,
  exportHandler,
} from './lambda';

// Application entry point
import { getCollectorManager } from './collectors';
import { logger, setupGlobalErrorHandlers } from './utils';

async function main(): Promise<void> {
  setupGlobalErrorHandlers();

  logger.info('Starting SCADA Topology Discovery');

  const manager = getCollectorManager();

  // Handle shutdown
  const shutdown = async () => {
    logger.info('Shutting down...');
    await manager.stop();
    process.exit(0);
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);

  // Start collectors
  await manager.start();

  logger.info('SCADA Topology Discovery is running');
}

// Run if executed directly
if (require.main === module) {
  main().catch(error => {
    logger.error('Fatal error', { error: error.message });
    process.exit(1);
  });
}
