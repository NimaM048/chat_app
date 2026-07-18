import EmbeddedPostgres from 'embedded-postgres';
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const dataDir = path.join(__dirname, '..', '.embedded-pg');
const port = 54329;
const databaseUrl = `postgresql://postgres:postgres@127.0.0.1:${port}/chat_app?schema=public`;

function run(command: string, args: string[], env: NodeJS.ProcessEnv) {
  return new Promise<void>((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: path.join(__dirname, '..'),
      env,
      stdio: 'inherit',
      shell: true,
    });

    child.on('exit', (code) => {
      if (code === 0) resolve();
      else reject(new Error(`${command} ${args.join(' ')} exited with ${code}`));
    });
  });
}

async function main() {
  const postgres = new EmbeddedPostgres({
    databaseDir: dataDir,
    user: 'postgres',
    password: 'postgres',
    port,
    persistent: true,
    // Windows default locale is WIN1252 and breaks Persian/emoji UTF-8 text.
    initdbFlags: ['--encoding=UTF8', '--locale=C'],
  });

  console.log('Starting embedded PostgreSQL (UTF-8)...');

  const alreadyInitialized = fs.existsSync(path.join(dataDir, 'PG_VERSION'));
  if (!alreadyInitialized) {
    await postgres.initialise();
  }

  await postgres.start();
  await postgres.createDatabase('chat_app').catch(() => undefined);

  const env: NodeJS.ProcessEnv = {
    ...process.env,
    DATABASE_URL: databaseUrl,
    PORT: process.env.PORT ?? '3000',
    JWT_ACCESS_SECRET:
      process.env.JWT_ACCESS_SECRET ??
      'dev-access-secret-change-in-production-32chars',
    JWT_REFRESH_SECRET:
      process.env.JWT_REFRESH_SECRET ??
      'dev-refresh-secret-change-in-production-32chars',
    JWT_ACCESS_EXPIRES_IN: process.env.JWT_ACCESS_EXPIRES_IN ?? '15m',
    JWT_REFRESH_EXPIRES_IN: process.env.JWT_REFRESH_EXPIRES_IN ?? '7d',
    CORS_ORIGIN: process.env.CORS_ORIGIN ?? 'http://localhost:5173',
  };
  delete env.REDIS_URL;

  console.log(`DATABASE_URL=${databaseUrl}`);

  await run('npx', ['prisma', 'migrate', 'deploy'], env);
  try {
    await run('npx', ['prisma', 'generate'], env);
  } catch (error) {
    console.warn(
      'prisma generate skipped (file lock). Using existing client.',
      error instanceof Error ? error.message : error,
    );
  }

  const api = spawn('npx', ['nest', 'start', '--watch'], {
    cwd: path.join(__dirname, '..'),
    env,
    stdio: 'inherit',
    shell: true,
  });

  const shutdown = async () => {
    api.kill();
    await postgres.stop();
    process.exit(0);
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);

  api.on('exit', async () => {
    await postgres.stop();
    process.exit(0);
  });
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
