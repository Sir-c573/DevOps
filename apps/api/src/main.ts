import { NestFactory } from "@nestjs/core";
import { AppModule } from "./app.module";

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.setGlobalPrefix("api");
  // The frontend reaches the API through the Nginx proxy (same origin), so CORS
  // is off unless explicitly enabled, e.g. CORS_ORIGIN=http://localhost:5173.
  if (process.env.CORS_ORIGIN) {
    app.enableCors({ origin: process.env.CORS_ORIGIN.split(",") });
  }
  app.enableShutdownHooks();
  await app.listen(process.env.PORT ?? 3000, "0.0.0.0");
}

void bootstrap();
