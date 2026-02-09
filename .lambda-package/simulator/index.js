"use strict";
/**
 * SCADA Simulator - Combined entry point
 * Runs both the data generator and MQTT ingest processor
 */
Object.defineProperty(exports, "__esModule", { value: true });
const data_generator_1 = require("./data-generator");
const mqtt_ingest_1 = require("./mqtt-ingest");
const logger_1 = require("../utils/logger");
async function main() {
    logger_1.logger.info('=== SCADA Topology Simulator ===');
    logger_1.logger.info('Starting data generator + ingest processor...');
    const brokerUrl = process.env.MQTT_BROKER_URL || 'mqtt://localhost:1883';
    const topic = process.env.MQTT_TOPIC || 'scada/telemetry';
    const generator = new data_generator_1.DataGenerator(brokerUrl, topic);
    const processor = new mqtt_ingest_1.MQTTIngestProcessor(brokerUrl, topic);
    // Start ingest first so it's ready when data arrives
    await processor.start();
    logger_1.logger.info('Ingest processor ready');
    // Small delay to ensure subscription is active
    await new Promise(resolve => setTimeout(resolve, 1000));
    // Start data generation
    await generator.start();
    logger_1.logger.info('Data generator running');
    logger_1.logger.info('Simulator is running. Press Ctrl+C to stop.');
    // Graceful shutdown
    const shutdown = async () => {
        logger_1.logger.info('Shutting down simulator...');
        await generator.stop();
        await processor.stop();
        logger_1.logger.info('Simulator stopped');
        process.exit(0);
    };
    process.on('SIGINT', shutdown);
    process.on('SIGTERM', shutdown);
}
main().catch(err => {
    logger_1.logger.error('Simulator failed', { error: err.message });
    process.exit(1);
});
//# sourceMappingURL=index.js.map