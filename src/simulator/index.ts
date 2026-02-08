/**
 * SCADA Simulator - Combined entry point
 * Runs both the data generator and MQTT ingest processor
 */

import { DataGenerator } from './data-generator';
import { MQTTIngestProcessor } from './mqtt-ingest';
import { logger } from '../utils/logger';

async function main(): Promise<void> {
  logger.info('=== SCADA Topology Simulator ===');
  logger.info('Starting data generator + ingest processor...');

  const brokerUrl = process.env.MQTT_BROKER_URL || 'mqtt://localhost:1883';
  const topic = process.env.MQTT_TOPIC || 'scada/telemetry';

  const generator = new DataGenerator(brokerUrl, topic);
  const processor = new MQTTIngestProcessor(brokerUrl, topic);

  // Start ingest first so it's ready when data arrives
  await processor.start();
  logger.info('Ingest processor ready');

  // Small delay to ensure subscription is active
  await new Promise(resolve => setTimeout(resolve, 1000));

  // Start data generation
  await generator.start();
  logger.info('Data generator running');

  logger.info('Simulator is running. Press Ctrl+C to stop.');

  // Graceful shutdown
  const shutdown = async () => {
    logger.info('Shutting down simulator...');
    await generator.stop();
    await processor.stop();
    logger.info('Simulator stopped');
    process.exit(0);
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

main().catch(err => {
  logger.error('Simulator failed', { error: (err as Error).message });
  process.exit(1);
});
