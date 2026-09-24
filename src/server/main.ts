import { App } from './app.ts';
import { loadConfig } from './config.ts';

const app = await App.create(loadConfig());
await app.listen();

function shutdown(signal: string): void {
  console.log(`${signal} received, shutting down`);
  void app.close().then(() => process.exit(0));
  setTimeout(() => process.exit(0), 2000).unref();
}
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
