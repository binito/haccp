import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';
import { join } from 'path';
import { NestExpressApplication } from '@nestjs/platform-express';
import * as cookieParser from 'cookie-parser';
import helmet from 'helmet';
import { WINSTON_MODULE_NEST_PROVIDER } from 'nest-winston';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';

const KNOWN_WEAK_SECRETS = ['change_this_secret', 'patakus_jwt_secret_change_in_production', 'secret'];
const REQUIRED_ENV_VARS = ['JWT_SECRET', 'DATABASE_URL', 'FRONTEND_URL', 'ALLOWED_ORIGINS'];
const IS_PRODUCTION = process.env.NODE_ENV === 'production';

async function bootstrap() {
  const missing = REQUIRED_ENV_VARS.filter((v) => !process.env[v]);
  if (missing.length) {
    throw new Error(`Variáveis de ambiente obrigatórias não definidas: ${missing.join(', ')}`);
  }

  const jwtSecret = process.env.JWT_SECRET;
  if (!jwtSecret || KNOWN_WEAK_SECRETS.includes(jwtSecret)) {
    throw new Error('JWT_SECRET não está definido ou usa um valor inseguro conhecido. Define um segredo forte no .env.');
  }

  const app = await NestFactory.create<NestExpressApplication>(AppModule, { bufferLogs: true });
  app.useLogger(app.get(WINSTON_MODULE_NEST_PROVIDER));
  app.useGlobalFilters(new AllExceptionsFilter());

  app.use(helmet({ crossOriginResourcePolicy: { policy: 'same-site' } }));
  app.use(cookieParser());
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true, forbidNonWhitelisted: false }));

  const allowedOrigins = process.env.ALLOWED_ORIGINS
    ? process.env.ALLOWED_ORIGINS.split(',').map((o) => o.trim())
    : ['http://localhost:3000'];

  app.enableCors({
    origin: allowedOrigins,
    credentials: true,
    methods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
  });

  // Swagger — apenas fora de produção (ou se SWAGGER_ENABLED=true)
  if (!IS_PRODUCTION || process.env.SWAGGER_ENABLED === 'true') {
    const config = new DocumentBuilder()
      .setTitle("HACCP API")
      .setDescription('API de gestão HACCP, checklists, anomalias e consumíveis')
      .setVersion('1.0')
      .addBearerAuth()
      .build();
    const document = SwaggerModule.createDocument(app, config);
    SwaggerModule.setup('docs', app, document, {
      swaggerOptions: { persistAuthorization: true },
    });
    console.log(`Swagger disponível em http://localhost:${process.env.PORT ?? 3003}/docs`);
  }

  app.useStaticAssets(join(__dirname, '..', 'uploads'), { prefix: '/uploads' });

  const port = process.env.PORT ?? 3003;
  await app.listen(port);
  console.log(`API HACCP a correr em http://localhost:${port}`);
}
bootstrap();
