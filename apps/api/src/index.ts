import Fastify from 'fastify';
import cors from '@fastify/cors';
import dotenv from 'dotenv';
import { registerProjectRoutes } from './routes/projects';
import { registerAssetRoutes } from './routes/assets';

dotenv.config();

const PORT = Number(process.env.API_PORT ?? 4000);

async function buildServer() {
  const server = Fastify({ logger: true });
  await server.register(cors, { origin: process.env.CORS_ORIGIN ?? true });

  server.get('/health', async () => ({ status: 'ok' }));

  registerProjectRoutes(server);
  registerAssetRoutes(server);

  return server;
}

void (async () => {
  try {
    const server = await buildServer();
    await server.listen({ port: PORT, host: '0.0.0.0' });
    console.log(`API running on http://localhost:${PORT}`);
  } catch (error) {
    console.error('Failed to start API', error);
    process.exit(1);
  }
})();
