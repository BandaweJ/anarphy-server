/* eslint-disable prettier/prettier */
import 'reflect-metadata';
import { ValidationPipe } from '@nestjs/common/pipes';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';
import { Logger } from '@nestjs/common';

async function bootstrap() {
  const logger = new Logger('Bootstrap');
  logger.log('Starting application bootstrap...');
  
  try {
    logger.log('Creating NestFactory...');
    const app = await NestFactory.create(AppModule);
    logger.log('NestFactory created successfully');
    
    logger.log('Setting up global filters...');
    app.useGlobalFilters(new AllExceptionsFilter());
    logger.log('Global filters configured');
  app.useGlobalPipes(
    new ValidationPipe({
      transform: true, // Enable automatic transformation using class-transformer
      whitelist: true, // Strip properties that don't have decorators
      forbidNonWhitelisted: false, // Don't throw error for non-whitelisted properties
    }),
  );
  // console.log(process.env.DB_PASSWORD);

  // Define your allowed origins dynamically or explicitly
  const allowedOrigins = [
    'http://localhost:4200', // Local development frontend
    'https://anarphy-portal.vercel.app', // Production frontend on Vercel
    // Add more origins here if needed (e.g., staging environments)
  ];

  app.enableCors({
    origin: allowedOrigins, // or a list of allowed origins
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE',
    credentials: true,
    exposedHeaders: ['Content-Disposition'],
  });
  const config = new DocumentBuilder()
    .setTitle('Reports System')
    .setDescription('Documentation for the Reports API')
    .setVersion('1.0')
    .addTag('Reports API')
    .build();

    logger.log('Setting up Swagger...');
    const document = SwaggerModule.createDocument(app, config);
    SwaggerModule.setup('api', app, document);
    logger.log('Swagger configured');

    const port = process.env.PORT || 3000;
    logger.log(`Starting server on port ${port}...`);
    await app.listen(port);
    logger.log(`✅ Server successfully started on port ${port}`);
    logger.log(`📡 Server is ready to accept requests`);
    logger.log(`🔗 API available at http://localhost:${port}`);
    logger.log(`📚 Swagger docs available at http://localhost:${port}/api`);
  } catch (error) {
    logger.error('❌ Failed to start server:', error);
    logger.error('Error stack:', error.stack);
    process.exit(1);
  }
}
bootstrap();
