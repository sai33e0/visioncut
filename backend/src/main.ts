import { NestFactory } from "@nestjs/core";
import { ValidationPipe, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { DocumentBuilder, SwaggerModule } from "@nestjs/swagger";
import * as Sentry from "@sentry/node";
import { AppModule } from "./app.module";
import { HttpExceptionFilter } from "./common/filters/http-exception.filter";
import { LoggingInterceptor } from "./common/interceptors/logging.interceptor";

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { bufferLogs: true });
  const config = app.get(ConfigService);

  // Sentry
  if (config.get("SENTRY_DSN")) {
    Sentry.init({
      dsn: config.get("SENTRY_DSN"),
      tracesSampleRate: 1.0,
      environment: config.get("NODE_ENV", "development"),
    });
  }

  // CORS
  app.enableCors({
    origin: [config.get("APP_URL", "http://localhost:3000")],
    credentials: true,
  });

  // Global validation
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
      transformOptions: { enableImplicitConversion: true },
    })
  );

  // Global filters + interceptors
  app.useGlobalFilters(new HttpExceptionFilter());
  app.useGlobalInterceptors(new LoggingInterceptor());

  // API prefix
  app.setGlobalPrefix("api");

  // Swagger
  const swaggerConfig = new DocumentBuilder()
    .setTitle("VisionCut AI API")
    .setDescription("Reference-driven AI video editing")
    .setVersion("1.0")
    .addBearerAuth()
    .build();
  const document = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup("api/docs", app, document);

  const port = config.get<number>("API_PORT", 3001);
  await app.listen(port, "0.0.0.0");
  Logger.log(`VisionCut API listening on http://localhost:${port}`, "Bootstrap");
  Logger.log(`Swagger UI:  http://localhost:${port}/api/docs`, "Bootstrap");
}

bootstrap();
