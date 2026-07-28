// Starts a real Redis server (via redis-memory-server, which downloads and
// runs an actual Redis binary) and keeps it alive for the duration of this
// process. Used for local dev/verification in this sandbox, which has no
// system-installed Redis. See docs/architecture/redis.md.
const { RedisMemoryServer } = require('redis-memory-server');

(async () => {
  const server = new RedisMemoryServer({ instance: { port: 16379 } });
  const host = await server.getHost();
  const port = await server.getPort();
  console.log(`REDIS_URL=redis://${host}:${port}`);
  console.log('Real Redis server running. Press Ctrl+C or kill this process to stop.');

  process.on('SIGINT', async () => {
    await server.stop();
    process.exit(0);
  });
})().catch((err) => {
  console.error('Failed to start dev Redis:', err);
  process.exit(1);
});
