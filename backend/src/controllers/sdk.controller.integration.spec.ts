/**
 * Integration tests for SdkController
 * Validates Requirements: 5.1, 5.3, 5.7, 7.6, 7.7
 * 
 * Tests SDK endpoint with API key authentication and context-aware evaluation
 */

import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SdkController } from './sdk.controller';
import { RuleEngineModule } from '../services/rule-engine.module';
import { ConfigModule as ConfigServiceModule } from '../services/config.module';
import { AuthModule } from '../auth/auth.module';
import { AuthService } from '../auth/auth.service';
import {
  Organization,
  Project,
  Environment,
  User,
  ConfigKey,
  ConfigVersion,
  Rule,
  ApiKey,
  AuditLog,
} from '../entities';
import {
  OrganizationRepository,
  ProjectRepository,
  EnvironmentRepository,
  UserRepository,
  ConfigKeyRepository,
  RuleRepository,
} from '../repositories';

describe('SdkController Integration Tests', () => {
  let app: INestApplication;
  let authService: AuthService;
  let organizationRepo: OrganizationRepository;
  let projectRepo: ProjectRepository;
  let environmentRepo: EnvironmentRepository;
  let userRepo: UserRepository;
  let configKeyRepo: ConfigKeyRepository;
  let ruleRepo: RuleRepository;

  let testOrg: Organization;
  let testProject: Project;
  let testEnv: Environment;
  let testUser: User;
  let apiKey: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [
        TypeOrmModule.forRoot({
          type: 'postgres',
          host: process.env.DB_HOST || 'localhost',
          port: parseInt(process.env.DB_PORT || '5432'),
          username: process.env.DB_USER || 'postgres',
          password: process.env.DB_PASSWORD || 'postgres',
          database: process.env.DB_NAME || 'config_management_test',
          entities: [
            Organization,
            Project,
            Environment,
            User,
            ConfigKey,
            ConfigVersion,
            Rule,
            ApiKey,
            AuditLog,
          ],
          synchronize: true,
          dropSchema: true,
        }),
        TypeOrmModule.forFeature([
          Organization,
          Project,
          Environment,
          User,
          ConfigKey,
          ConfigVersion,
          Rule,
          ApiKey,
          AuditLog,
        ]),
        RuleEngineModule,
        ConfigServiceModule,
        AuthModule,
      ],
      controllers: [SdkController],
      providers: [
        OrganizationRepository,
        ProjectRepository,
        EnvironmentRepository,
        UserRepository,
        ConfigKeyRepository,
        RuleRepository,
      ],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();

    authService = moduleFixture.get<AuthService>(AuthService);
    organizationRepo = moduleFixture.get<OrganizationRepository>(
      OrganizationRepository,
    );
    projectRepo = moduleFixture.get<ProjectRepository>(ProjectRepository);
    environmentRepo = moduleFixture.get<EnvironmentRepository>(
      EnvironmentRepository,
    );
    userRepo = moduleFixture.get<UserRepository>(UserRepository);
    configKeyRepo = moduleFixture.get<ConfigKeyRepository>(ConfigKeyRepository);
    ruleRepo = moduleFixture.get<RuleRepository>(RuleRepository);
  });

  beforeEach(async () => {
    // Create test data
    testOrg = await organizationRepo.create('Test Org');
    testProject = await projectRepo.create(testOrg.id, 'Test Project');
    testEnv = await environmentRepo.create(testProject.id, 'development');

    const hashedPassword = await authService.hashPassword('password123');
    testUser = await userRepo.create(
      testOrg.id,
      'test@example.com',
      hashedPassword,
      'Admin',
    );

    // Generate API key
    apiKey = await authService.generateApiKey(
      testProject.id,
      testEnv.id,
      testUser.id,
    );
  });

  afterEach(async () => {
    // Clean up test data
    const connection = app.get('Connection');
    await connection.query('DELETE FROM rules');
    await connection.query('DELETE FROM config_versions');
    await connection.query('DELETE FROM config_keys');
    await connection.query('DELETE FROM api_keys');
    await connection.query('DELETE FROM users');
    await connection.query('DELETE FROM environments');
    await connection.query('DELETE FROM projects');
    await connection.query('DELETE FROM organizations');
  });

  afterAll(async () => {
    await app.close();
  });

  describe('GET /api/v1/sdk/config/:key', () => {
    it('should fetch config value with API key authentication', async () => {
      // Create a config
      const config = await configKeyRepo.create(
        testOrg.id,
        testProject.id,
        testEnv.id,
        'feature_flag',
        'boolean',
        true,
      );

      const response = await request(app.getHttpServer())
        .get('/api/v1/sdk/config/feature_flag')
        .set('Authorization', `Bearer ${apiKey}`)
        .expect(200);

      expect(response.body.key).toBe('feature_flag');
      expect(response.body.value).toBe(true);
      expect(response.body.value_type).toBe('boolean');
    });

    it('should return 401 without API key', async () => {
      await request(app.getHttpServer())
        .get('/api/v1/sdk/config/feature_flag')
        .expect(401);
    });

    it('should return 404 for non-existent config', async () => {
      await request(app.getHttpServer())
        .get('/api/v1/sdk/config/non_existent')
        .set('Authorization', `Bearer ${apiKey}`)
        .expect(404);
    });

    it('should evaluate rules with context', async () => {
      // Create a config with a rule
      const config = await configKeyRepo.create(
        testOrg.id,
        testProject.id,
        testEnv.id,
        'feature_flag',
        'boolean',
        false, // default value
      );

      // Create a rule that enables the feature for premium tier
      await ruleRepo.create(
        config.id,
        100,
        [{ attribute: 'tier', operator: 'equals', value: 'premium' }],
        true, // rule value
        true,
      );

      // Request with premium tier context
      const response = await request(app.getHttpServer())
        .get('/api/v1/sdk/config/feature_flag')
        .query({ tier: 'premium' })
        .set('Authorization', `Bearer ${apiKey}`)
        .expect(200);

      expect(response.body.value).toBe(true); // Rule matched

      // Request with free tier context
      const response2 = await request(app.getHttpServer())
        .get('/api/v1/sdk/config/feature_flag')
        .query({ tier: 'free' })
        .set('Authorization', `Bearer ${apiKey}`)
        .expect(200);

      expect(response2.body.value).toBe(false); // Default value
    });

    it('should include custom context attributes', async () => {
      // Create a config with a rule using custom attribute
      const config = await configKeyRepo.create(
        testOrg.id,
        testProject.id,
        testEnv.id,
        'max_connections',
        'number',
        10, // default value
      );

      // Create a rule for custom attribute
      await ruleRepo.create(
        config.id,
        100,
        [{ attribute: 'plan_type', operator: 'equals', value: 'enterprise' }],
        100, // rule value
        true,
      );

      // Request with custom context
      const response = await request(app.getHttpServer())
        .get('/api/v1/sdk/config/max_connections')
        .query({ plan_type: 'enterprise' })
        .set('Authorization', `Bearer ${apiKey}`)
        .expect(200);

      expect(response.body.value).toBe(100); // Rule matched
    });
  });
});
