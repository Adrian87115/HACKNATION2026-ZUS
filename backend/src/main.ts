import { NestFactory } from '@nestjs/core';
import { AppModule, ObserveInstrument } from './app.module.js';

// Load backend/.env when present (ADMIN_TOKEN, ENGINE_PARAMS_FILE, PORT). Real environment variables win.
try {
  process.loadEnvFile();
} catch {
  // no .env file – rely on the environment
}

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    instrument: ObserveInstrument,
  });
  await app.listen(process.env.PORT ?? 3000);
}
await bootstrap();
