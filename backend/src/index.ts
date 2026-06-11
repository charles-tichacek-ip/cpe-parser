import Fastify from 'fastify';
import cors from '@fastify/cors';
import multipart from '@fastify/multipart';
import { uploadRoutes } from './routes/upload.js';
import { stagingRoutes } from './routes/staging.js';
import { recordsRoutes } from './routes/records.js';
import { downloadRoutes } from './routes/download.js';

const app = Fastify({ logger: true });

await app.register(cors, {
  origin: process.env.FRONTEND_URL ?? 'http://localhost:5173',
  credentials: true,
});

await app.register(multipart, {
  limits: { fileSize: 50 * 1024 * 1024 }, // 50MB — generous for a ZIP
});

await app.register(uploadRoutes, { prefix: '/api' });
await app.register(stagingRoutes, { prefix: '/api' });
await app.register(recordsRoutes, { prefix: '/api' });
await app.register(downloadRoutes, { prefix: '/api' });

app.get('/health', async () => ({ ok: true }));

const port = Number(process.env.PORT ?? 3001);
await app.listen({ port, host: '0.0.0.0' });
console.log(`CPE Parser backend running on port ${port}`);
