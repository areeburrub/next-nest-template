import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { HttpException, Logger, ValidationPipe } from '@nestjs/common';

async function bootstrap() {
    const port = process.env.PORT ?? 3001;
    const app = await NestFactory.create(AppModule);
    app.enableCors({
        origin: process.env.WEBSITE_URL ?? 'http://localhost:3000',
        credentials: true,
    });
    app.useGlobalPipes(
        new ValidationPipe({
            transform: true,
            whitelist: true,
            forbidNonWhitelisted: true,
            exceptionFactory: (errors) => {
                console.log('Validation errors:', JSON.stringify(errors));
                const result = errors.map((error) => ({
                    property: error.property,
                    message: error.constraints
                        ? Object.values(error.constraints)[0]
                        : 'Validation error',
                    value: error.value,
                }));
                throw new HttpException(
                    {
                        statusCode: 400,
                        error_code: 'VALIDATION_FAILED',
                        message: result
                            .map((error) => `${error.property}: ${error.message}`)
                            .join(', '),
                    },
                    400,
                );
            },
        }),
    );
    await app.listen(port);
    Logger.log(`Server started on port ${port}`);
}
bootstrap();
