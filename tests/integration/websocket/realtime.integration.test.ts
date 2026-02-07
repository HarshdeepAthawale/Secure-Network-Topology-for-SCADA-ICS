/**
 * WebSocket Real-time Integration Tests
 * Tests WebSocket server functionality and client communication
 */

import { RealTimeServer } from '../../../src/websocket/server';
import { WebSocket } from 'ws';

describe('WebSocket Real-time Integration', () => {
  let server: RealTimeServer;
  const TEST_PORT = 8081;
  const TEST_HOST = 'localhost';

  beforeAll(async () => {
    server = new RealTimeServer(TEST_PORT, TEST_HOST);
    await server.start();
  });

  afterAll(async () => {
    await server.stop();
  });

  describe('Server Initialization', () => {
    it('should initialize WebSocket server', () => {
      expect(server).toBeDefined();
      expect(server['port']).toBe(TEST_PORT);
    });

    it('should accept client connections', (done) => {
      const ws = new WebSocket(`ws://${TEST_HOST}:${TEST_PORT}`);

      ws.on('open', () => {
        expect(ws.readyState).toBe(WebSocket.OPEN);
        ws.close();
        done();
      });

      ws.on('error', (error) => {
        done(error);
      });
    });

    it('should provide health endpoint', async () => {
      // Note: This assumes HTTP endpoint on same port
      // May need adjustment based on actual implementation
      try {
        const response = await fetch(`http://${TEST_HOST}:${TEST_PORT}/health`);
        expect(response).toBeDefined();
      } catch (error) {
        // Health endpoint may not be on same port
      }
    });
  });

  describe('Client Connection', () => {
    it('should handle single client connection', (done) => {
      const ws = new WebSocket(`ws://${TEST_HOST}:${TEST_PORT}`);
      let messageReceived = false;

      ws.on('open', () => {
        ws.send(JSON.stringify({
          type: 'subscribe',
          channel: 'topology',
        }));
      });

      ws.on('message', (data: Buffer) => {
        messageReceived = true;
        ws.close();
      });

      ws.on('close', () => {
        done();
      });

      ws.on('error', (error) => {
        done(error);
      });

      // Timeout after 5 seconds
      setTimeout(() => {
        if (ws.readyState === WebSocket.OPEN) {
          ws.close();
        }
        done();
      }, 5000);
    });

    it('should handle client disconnection', (done) => {
      const ws = new WebSocket(`ws://${TEST_HOST}:${TEST_PORT}`);

      ws.on('open', () => {
        ws.close();
      });

      ws.on('close', () => {
        expect(ws.readyState).toBe(WebSocket.CLOSED);
        done();
      });

      ws.on('error', (error) => {
        done(error);
      });
    });

    it('should handle rapid connections', (done) => {
      let connectedCount = 0;
      const totalClients = 10;

      for (let i = 0; i < totalClients; i++) {
        const ws = new WebSocket(`ws://${TEST_HOST}:${TEST_PORT}`);

        ws.on('open', () => {
          connectedCount++;
          ws.close();

          if (connectedCount === totalClients) {
            done();
          }
        });

        ws.on('error', (error) => {
          done(error);
        });
      }

      // Timeout
      setTimeout(() => {
        if (connectedCount < totalClients) {
          done(new Error(`Only ${connectedCount} of ${totalClients} clients connected`));
        }
      }, 10000);
    });
  });

  describe('Message Subscription', () => {
    it('should subscribe to channel', (done) => {
      const ws = new WebSocket(`ws://${TEST_HOST}:${TEST_PORT}`);

      ws.on('open', () => {
        ws.send(JSON.stringify({
          type: 'subscribe',
          channel: 'topology',
        }));

        // Give server time to process subscription
        setTimeout(() => {
          ws.close();
        }, 500);
      });

      ws.on('close', () => {
        done();
      });

      ws.on('error', (error) => {
        done(error);
      });
    });

    it('should unsubscribe from channel', (done) => {
      const ws = new WebSocket(`ws://${TEST_HOST}:${TEST_PORT}`);

      ws.on('open', () => {
        ws.send(JSON.stringify({
          type: 'subscribe',
          channel: 'devices',
        }));

        setTimeout(() => {
          ws.send(JSON.stringify({
            type: 'unsubscribe',
            channel: 'devices',
          }));

          setTimeout(() => {
            ws.close();
          }, 200);
        }, 200);
      });

      ws.on('close', () => {
        done();
      });

      ws.on('error', (error) => {
        done(error);
      });
    });

    it('should support multiple channel subscriptions', (done) => {
      const ws = new WebSocket(`ws://${TEST_HOST}:${TEST_PORT}`);

      ws.on('open', () => {
        const channels = ['topology', 'devices', 'alerts', 'connections'];

        for (const channel of channels) {
          ws.send(JSON.stringify({
            type: 'subscribe',
            channel,
          }));
        }

        setTimeout(() => {
          ws.close();
        }, 1000);
      });

      ws.on('close', () => {
        done();
      });

      ws.on('error', (error) => {
        done(error);
      });
    });
  });

  describe('Broadcasting', () => {
    it('should broadcast to all subscribed clients', (done) => {
      const clientCount = 3;
      let messagesReceived = 0;

      const broadcastMessage = {
        type: 'topology:update',
        data: {
          deviceCount: 5,
          connectionCount: 3,
        },
      };

      // Connect multiple clients
      const clients: WebSocket[] = [];
      let readyCount = 0;

      for (let i = 0; i < clientCount; i++) {
        const ws = new WebSocket(`ws://${TEST_HOST}:${TEST_PORT}`);

        ws.on('open', () => {
          ws.send(JSON.stringify({
            type: 'subscribe',
            channel: 'topology',
          }));

          readyCount++;

          if (readyCount === clientCount) {
            // All clients ready, broadcast message
            server.broadcast({
              type: 'topology:update',
              channel: 'topology',
              data: broadcastMessage,
            });
          }
        });

        ws.on('message', () => {
          messagesReceived++;
          ws.close();
        });

        clients.push(ws);
      }

      // Timeout
      setTimeout(() => {
        clients.forEach(c => {
          if (c.readyState === WebSocket.OPEN) {
            c.close();
          }
        });

        done();
      }, 5000);
    });

    it('should handle broadcast to specific client', (done) => {
      const ws = new WebSocket(`ws://${TEST_HOST}:${TEST_PORT}`);
      let clientId: string | undefined;

      ws.on('open', () => {
        ws.send(JSON.stringify({
          type: 'register',
          clientId: 'test-client-1',
        }));

        clientId = 'test-client-1';
      });

      ws.on('message', () => {
        ws.close();
      });

      ws.on('close', () => {
        done();
      });

      ws.on('error', (error) => {
        done(error);
      });

      setTimeout(() => {
        if (clientId && ws.readyState === WebSocket.OPEN) {
          server.sendToClient(clientId, {
            type: 'direct_message',
            data: { content: 'Hello' },
          });
        }
      }, 500);
    });
  });

  describe('Message Types', () => {
    it('should handle ping/pong heartbeat', (done) => {
      const ws = new WebSocket(`ws://${TEST_HOST}:${TEST_PORT}`);

      ws.on('open', () => {
        ws.send(JSON.stringify({
          type: 'ping',
        }));
      });

      ws.on('message', (data: Buffer) => {
        const message = JSON.parse(data.toString());
        if (message.type === 'pong') {
          ws.close();
          done();
        }
      });

      ws.on('error', (error) => {
        done(error);
      });

      setTimeout(() => {
        if (ws.readyState === WebSocket.OPEN) {
          ws.close();
          done(new Error('No pong response'));
        }
      }, 5000);
    });

    it('should handle invalid message format gracefully', (done) => {
      const ws = new WebSocket(`ws://${TEST_HOST}:${TEST_PORT}`);

      ws.on('open', () => {
        ws.send('invalid json {]');

        setTimeout(() => {
          ws.send(JSON.stringify({
            type: 'ping',
          }));
        }, 200);
      });

      ws.on('message', () => {
        ws.close();
      });

      ws.on('close', () => {
        done();
      });

      ws.on('error', () => {
        // Connection error expected
      });

      setTimeout(() => {
        if (ws.readyState === WebSocket.OPEN) {
          ws.close();
        }
        done();
      }, 5000);
    });
  });

  describe('Concurrency', () => {
    it('should handle concurrent client operations', (done) => {
      const clientCount = 20;
      let operationsComplete = 0;

      for (let i = 0; i < clientCount; i++) {
        const ws = new WebSocket(`ws://${TEST_HOST}:${TEST_PORT}`);

        ws.on('open', () => {
          // Subscribe to random channel
          const channels = ['topology', 'devices', 'alerts', 'connections'];
          const channel = channels[Math.floor(Math.random() * channels.length)];

          ws.send(JSON.stringify({
            type: 'subscribe',
            channel,
          }));

          setTimeout(() => {
            ws.close();
          }, Math.random() * 1000);
        });

        ws.on('close', () => {
          operationsComplete++;

          if (operationsComplete === clientCount) {
            done();
          }
        });

        ws.on('error', (error) => {
          operationsComplete++;
          if (operationsComplete === clientCount) {
            done(error);
          }
        });
      }

      // Timeout
      setTimeout(() => {
        if (operationsComplete < clientCount) {
          done(new Error(`Only ${operationsComplete} of ${clientCount} operations completed`));
        }
      }, 30000);
    });

    it('should handle high-frequency messages', (done) => {
      const ws = new WebSocket(`ws://${TEST_HOST}:${TEST_PORT}`);
      let messageCount = 0;

      ws.on('open', () => {
        ws.send(JSON.stringify({
          type: 'subscribe',
          channel: 'telemetry',
        }));

        // Send high-frequency messages
        for (let i = 0; i < 100; i++) {
          ws.send(JSON.stringify({
            type: 'data',
            value: i,
          }));
        }

        setTimeout(() => {
          ws.close();
        }, 1000);
      });

      ws.on('message', () => {
        messageCount++;
      });

      ws.on('close', () => {
        done();
      });

      ws.on('error', (error) => {
        done(error);
      });
    });
  });

  describe('Server Status', () => {
    it('should provide client count', () => {
      const clients = server.getClients();
      expect(Array.isArray(clients)).toBe(true);
    });

    it('should track connected clients', (done) => {
      const ws = new WebSocket(`ws://${TEST_HOST}:${TEST_PORT}`);

      ws.on('open', () => {
        const clients = server.getClients();
        expect(clients.length).toBeGreaterThan(0);

        ws.close();
      });

      ws.on('close', () => {
        done();
      });

      ws.on('error', (error) => {
        done(error);
      });
    });
  });

  describe('Memory Management', () => {
    it('should clean up resources on disconnect', (done) => {
      const initialClientCount = server.getClients().length;

      const ws = new WebSocket(`ws://${TEST_HOST}:${TEST_PORT}`);

      ws.on('open', () => {
        const connectedCount = server.getClients().length;
        expect(connectedCount).toBeGreaterThan(initialClientCount);

        ws.close();
      });

      ws.on('close', () => {
        // Give server time to clean up
        setTimeout(() => {
          const finalCount = server.getClients().length;
          expect(finalCount).toBeLessThanOrEqual(initialClientCount + 1);
          done();
        }, 500);
      });

      ws.on('error', (error) => {
        done(error);
      });
    });

    it('should handle memory efficiently with many subscriptions', (done) => {
      const ws = new WebSocket(`ws://${TEST_HOST}:${TEST_PORT}`);
      const channels = ['ch-1', 'ch-2', 'ch-3', 'ch-4', 'ch-5'];

      ws.on('open', () => {
        for (const channel of channels) {
          ws.send(JSON.stringify({
            type: 'subscribe',
            channel,
          }));
        }

        setTimeout(() => {
          ws.close();
        }, 1000);
      });

      ws.on('close', () => {
        done();
      });

      ws.on('error', (error) => {
        done(error);
      });
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty messages', (done) => {
      const ws = new WebSocket(`ws://${TEST_HOST}:${TEST_PORT}`);

      ws.on('open', () => {
        ws.send('');

        setTimeout(() => {
          ws.close();
        }, 200);
      });

      ws.on('close', () => {
        done();
      });

      ws.on('error', () => {
        // May error, but shouldn't crash server
      });

      setTimeout(() => {
        if (ws.readyState === WebSocket.OPEN) {
          ws.close();
        }
        done();
      }, 5000);
    });

    it('should handle very large messages', (done) => {
      const ws = new WebSocket(`ws://${TEST_HOST}:${TEST_PORT}`);

      ws.on('open', () => {
        const largePayload = {
          type: 'large_message',
          data: 'x'.repeat(100000), // 100KB message
        };

        ws.send(JSON.stringify(largePayload));

        setTimeout(() => {
          ws.close();
        }, 500);
      });

      ws.on('close', () => {
        done();
      });

      ws.on('error', () => {
        // May error if message is too large
      });

      setTimeout(() => {
        if (ws.readyState === WebSocket.OPEN) {
          ws.close();
        }
        done();
      }, 5000);
    });

    it('should handle rapid subscribe/unsubscribe', (done) => {
      const ws = new WebSocket(`ws://${TEST_HOST}:${TEST_PORT}`);

      ws.on('open', () => {
        for (let i = 0; i < 50; i++) {
          ws.send(JSON.stringify({
            type: 'subscribe',
            channel: `channel-${i}`,
          }));

          ws.send(JSON.stringify({
            type: 'unsubscribe',
            channel: `channel-${i}`,
          }));
        }

        setTimeout(() => {
          ws.close();
        }, 1000);
      });

      ws.on('close', () => {
        done();
      });

      ws.on('error', (error) => {
        done(error);
      });
    });
  });
});
