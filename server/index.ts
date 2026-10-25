import express from 'express';
import path from 'node:path';
import fs from 'node:fs';
import { api } from './routes';
import { seedIfEmpty } from './seed';
import { startScheduler } from './services/scheduler';

const requestedPort = Number(process.env.PORT);
const PORT = Number.isInteger(requestedPort) && requestedPort > 0 ? requestedPort : 4321;
const HOST = process.env.HOST ?? '127.0.0.1';
const isProd = process.env.NODE_ENV === 'production' || process.argv.includes('--prod');

async function main() {
  const app = express();
  app.disable('x-powered-by');
  app.use(express.json({ limit: '3mb' }));
  app.use('/api', api);

  if (isProd) {
    const dist = path.resolve(process.cwd(), 'dist/public');
    const indexHtml = path.join(dist, 'index.html');
    if (!fs.existsSync(indexHtml)) {
      console.error('[server] dist/public/index.html missing. Run `npm run build` first.');
      process.exit(1);
    }
    app.use(express.static(dist, { maxAge: '1h', index: false }));
    app.get('*', (_req, res) => res.sendFile(indexHtml));
  } else {
    const { createServer } = await import('vite');
    const vite = await createServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  }

  await seedIfEmpty();
  startScheduler();

  const server = app.listen(PORT, HOST, () => {
    console.info(`\n  CompetePulse running at http://${HOST}:${PORT}\n  Mode: ${isProd ? 'production' : 'development'}\n`);
  });
  server.on('error', (error: NodeJS.ErrnoException) => {
    if (error.code === 'EADDRINUSE') {
      console.error(`[server] Port ${PORT} is already in use. Set PORT to a free port and retry.`);
    } else console.error('[server]', error);
    process.exit(1);
  });

  const shutdown = () => {
    console.info('\n[server] shutting down');
    server.close(() => process.exit(0));
  };
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

main().catch((error) => {
  console.error('[server] failed to start:', error);
  process.exit(1);
});
