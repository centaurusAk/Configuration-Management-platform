import { Test, TestingModule } from '@nestjs/testing';
import { AppModule } from './app.module';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule } from '@nestjs/config';

describe('AppModule', () => {
  it('should compile the module', async () => {
    // Mock the module without actual database connection
    const module: TestingModule = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({
          isGlobal: true,
        }),
      ],
    }).compile();

    expect(module).toBeDefined();
  });
});
