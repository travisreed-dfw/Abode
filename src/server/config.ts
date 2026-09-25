import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

export type Config = {
  host: string;
  port: number;
  dbPath: string;
  publicDir: string;
  /** Docker socket to read container labels from; discovery is off when it doesn't exist. */
  dockerSocket: string;
};

const PROJECT_ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');

/**
 * Reads settings from the environment. Defaults live inside the project
 * folder (not the working directory), so the server finds the same files
 * however it is started.
 */
export function loadConfig(env: NodeJS.ProcessEnv = process.env): Config {
  const port = Number(env.PORT ?? 80);
  if (!Number.isInteger(port) || port < 0 || port > 65535) {
    throw new Error(`PORT must be a whole number between 0 and 65535, got "${env.PORT}".`);
  }
  return {
    host: env.HOST ?? '0.0.0.0',
    port,
    dbPath: env.DB_PATH ?? join(PROJECT_ROOT, 'data', 'db.json'),
    publicDir: join(PROJECT_ROOT, 'public'),
    dockerSocket: env.DOCKER_SOCKET ?? '/var/run/docker.sock',
  };
}
