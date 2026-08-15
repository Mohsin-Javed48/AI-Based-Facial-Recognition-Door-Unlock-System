// Must run before anything else is imported: several modules (auth,
// websocket) read process.env directly in their static @Module()/
// @WebSocketGateway() decorators, which Node evaluates while resolving
// AppModule's imports - i.e. before ConfigModule.forRoot() ever runs. That
// makes ConfigModule too late to be the only source of truth for those
// reads, so .env is loaded explicitly here, first.
import 'dotenv/config';

import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
    }),
  );

  app.enableCors({
    origin: process.env.CORS_ORIGIN ?? 'http://localhost:3000',
    credentials: true,
  });

  // `?? 3001` alone isn't enough here: some environments already export a
  // PORT variable for unrelated reasons (observed "0" on a dev machine,
  // meaning "let the OS pick" to a different tool) - that's a defined,
  // truthy string, so `??` would keep it. dotenv also never overwrites an
  // already-set env var. Validate the parsed value instead of trusting it.
  const parsedPort = Number(process.env.PORT);
  const port =
    Number.isInteger(parsedPort) && parsedPort > 0 ? parsedPort : 3001;
  await app.listen(port);
}

bootstrap().catch((error: unknown) => {
  console.error('Failed to start application', error);
  process.exitCode = 1;
});
