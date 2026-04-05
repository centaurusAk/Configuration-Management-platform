/**
 * Integration tests for ConfigController
 * Validates Requirements: 1.1, 1.4, 1.5, 1.6, 2.2, 2.3, 16.1, 16.2, 16.3
 * 
 * Tests complete request/response flow for config management endpoints
 * including authentication and authorization
 */

import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import { TypeOrmModule } from '@nestjs/typeorm';
import { JwtModule } from '@nestjs/jwt';
import { ConfigController } from './config.controller';
import { ConfigService } from '../services/config.service';
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
} from '../repositories';

describe('ConfigController Integration Tests', () => {
  let app: INestApplication;
  let authService: AuthService;
  let organizationRepo: OrganizationRepository;
  let projectRepo: ProjectRepository;
  let environmentRepo: EnvironmentRepository;
  let userRepo: UserRepository;

  let testOrg: Organization;
  let testProject: Project;
  let testEnv: Environment;
  let testUser: User;
  let authToken: string;

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
        JwtModule.register({
          secret: 'test-secret',
          signOptions: { expiresIn: '1h' },
        }),
        ConfigServiceModule,
        AuthModule,
      ],
      controllers: [ConfigController],
      providers: [
        OrganizationRepository,
        ProjectRepository,
        EnvironmentRepository,
        UserRepository,
      ],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe());
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

    // Generate auth token
    authToken = await authService.generateToken(testUser);
  });

  afterEach(async () => {
    // Clean up test data
    const connection = app.get('Connection');
    await connection.query('DELETE FROM config_versions');
    await connection.query('DELETE FROM config_keys');
    await connection.query('DELETE FROM users');
    await connection.query('DELETE FROM environments');
    await connection.query('DELETE FROM projects');
    await connection.query('DELETE FROM organizations');
  });

  afterAll(async () => {
    await app.close();
  });

  describe('POST /api/v1/configs', () => {
    it('should create a new config key', async () => {
      const dto = {
        organizationId: testOrg.id,
        projectId: testProject.id,
        environmentId: testEnv.id,
        keyName: 'feature_flag',
        valueType: 'boolean',
        defaultValue: false,
        createdBy: testUser.id,
      };

      const response = await request(app.getHttpServer())
        .post('/api/v1/configs')
        .set('Authorization', `Bearer ${authToken}`)
        .send(dto)
        .expect(201);

      expect(response.body.id).toBeDefined();
      expect(response.body.key_name).toBe('feature_flag');
      expect(response.body.value_type).toBe('boolean');
      expect(response.body.current_value).toBe(false);
    });

    it('should return 401 without authentication', async () => {
      const dto = {
        organizationId: testOrg.id,
        projectId: testProject.id,
        environmentId: testEnv.id,
        keyName: 'feature_flag',
        valueType: 'boolean',
        defaultValue: false,
        createdBy: testUser.id,
      };

      await request(app.getHttpServer())
        .post('/api/v1/configs')
        .send(dto)
        .expect(401);
    });
  });

  describe('GET /api/v1/configs/:id', () => {
    it('should retrieve a config key by ID', async () => {
      // Create a config first
      const configService = app.get<ConfigService>(ConfigService);
      const config = await configService.create({
        organizationId: testOrg.id,
        projectId: testProject.id,
        environmentId: testEnv.id,
        keyName: 'test_key',
        valueType: 'string',
        defaultValue: 'test_value',
        createdBy: testUser.id,
      });

      const response = await request(app.getHttpServer())
        .get(`/api/v1/configs/${config.id}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.id).toBe(config.id);
      expect(response.body.key_name).toBe('test_key');
      expect(response.body.current_value).toBe('test_value');
    });
  });

  describe('PUT /api/v1/configs/:id', () => {
    it('should update a config value', async () => {
      // Create a config first
      const configService = app.get<ConfigService>(ConfigService);
      const config = await configService.create({
        organizationId: testOrg.id,
        projectId: testProject.id,
        environmentId: testEnv.id,
        keyName: 'test_key',
        valueType: 'string',
        defaultValue: 'old_value',
        createdBy: testUser.id,
      });

      const response = await request(app.getHttpServer())
        .put(`/api/v1/configs/${config.id}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          value: 'new_value',
          updatedBy: testUser.id,
        })
        .expect(200);

      expect(response.body.value).toBe('new_value');
    });
  });

  describe('DELETE /api/v1/configs/:id', () => {
    it('should soft delete a config key', async () => {
      // Create a config first
      const configService = app.get<ConfigService>(ConfigService);
      const config = await configService.create({
        organizationId: testOrg.id,
        projectId: testProject.id,
        environmentId: testEnv.id,
        keyName: 'test_key',
        valueType: 'string',
        defaultValue: 'test_value',
        createdBy: testUser.id,
      });

      await request(app.getHttpServer())
        .delete(`/api/v1/configs/${config.id}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ deletedBy: testUser.id })
        .expect(204);

      // Verify it's soft deleted
      const deletedConfig = await configService.get(config.id);
      expect(deletedConfig).toBeNull();
    });
  });

  describe('GET /api/v1/configs/:id/versions', () => {
    it('should retrieve version history', async () => {
      // Create a config and update it
      const configService = app.get<ConfigService>(ConfigService);
      const config = await configService.create({
        organizationId: testOrg.id,
        projectId: testProject.id,
        environmentId: testEnv.id,
        keyName: 'test_key',
        valueType: 'string',
        defaultValue: 'v1',
        createdBy: testUser.id,
      });

      await configService.update(config.id, {
        value: 'v2',
        updatedBy: testUser.id,
      });

      const response = await request(app.getHttpServer())
        .get(`/api/v1/configs/${config.id}/versions`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).toHaveLength(2);
      expect(response.body[0].value).toBe('v2'); // Most recent first
      expect(response.body[1].value).toBe('v1');
    });
  });

  describe('POST /api/v1/configs/:id/rollback', () => {
    it('should rollback to a previous version', async () => {
      // Create a config and update it
      const configService = app.get<ConfigService>(ConfigService);
      const config = await configService.create({
        organizationId: testOrg.id,
        projectId: testProject.id,
        environmentId: testEnv.id,
        keyName: 'test_key',
        valueType: 'string',
        defaultValue: 'v1',
        createdBy: testUser.id,
      });

      await configService.update(config.id, {
        value: 'v2',
        updatedBy: testUser.id,
      });

      const versions = await configService.getVersionHistory(config.id);
      const v1Version = versions.find(v => v.value === 'v1');

      const response = await request(app.getHttpServer())
        .post(`/api/v1/configs/${config.id}/rollback`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          versionId: v1Version!.id,
          rolledBackBy: testUser.id,
        })
        .expect(200);

      expect(response.body.value).toBe('v1');
    });
  });

  describe('POST /api/v1/configs/bulk', () => {
    it('should update multiple configs atomically', async () => {
      // Create multiple configs
      const configService = app.get<ConfigService>(ConfigService);
      const config1 = await configService.create({
        organizationId: testOrg.id,
        projectId: testProject.id,
        environmentId: testEnv.id,
        keyName: 'config1',
        valueType: 'string',
        defaultValue: 'value1',
        createdBy: testUser.id,
      });

      const config2 = await configService.create({
        organizationId: testOrg.id,
        projectId: testProject.id,
        environmentId: testEnv.id,
        keyName: 'config2',
        valueType: 'number',
        defaultValue: 100,
        createdBy: testUser.id,
      });

      const config3 = await configService.create({
        organizationId: testOrg.id,
        projectId: testProject.id,
        environmentId: testEnv.id,
        keyName: 'config3',
        valueType: 'boolean',
        defaultValue: false,
        createdBy: testUser.id,
      });

      // Bulk update all three configs
      const response = await request(app.getHttpServer())
        .post('/api/v1/configs/bulk')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          updates: [
            { configId: config1.id, value: 'updated1' },
            { configId: config2.id, value: 200 },
            { configId: config3.id, value: true },
          ],
          updatedBy: testUser.id,
        })
        .expect(200);

      // Verify all configs were updated
      expect(response.body).toHaveLength(3);
      
      const updatedConfig1 = await configService.get(config1.id);
      const updatedConfig2 = await configService.get(config2.id);
      const updatedConfig3 = await configService.get(config3.id);

      expect(updatedConfig1.current_value).toBe('updated1');
      expect(updatedConfig2.current_value).toBe(200);
      expect(updatedConfig3.current_value).toBe(true);
    });

    it('should reject entire operation if any validation fails', async () => {
      // Create multiple configs
      const configService = app.get<ConfigService>(ConfigService);
      const config1 = await configService.create({
        organizationId: testOrg.id,
        projectId: testProject.id,
        environmentId: testEnv.id,
        keyName: 'config1',
        valueType: 'string',
        defaultValue: 'value1',
        createdBy: testUser.id,
      });

      const config2 = await configService.create({
        organizationId: testOrg.id,
        projectId: testProject.id,
        environmentId: testEnv.id,
        keyName: 'config2',
        valueType: 'number',
        defaultValue: 100,
        createdBy: testUser.id,
      });

      // Try to bulk update with one invalid value (wrong type)
      await request(app.getHttpServer())
        .post('/api/v1/configs/bulk')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          updates: [
            { configId: config1.id, value: 'updated1' },
            { configId: config2.id, value: 'not_a_number' }, // Invalid type
          ],
          updatedBy: testUser.id,
        })
        .expect(400);

      // Verify neither config was updated
      const unchangedConfig1 = await configService.get(config1.id);
      const unchangedConfig2 = await configService.get(config2.id);

      expect(unchangedConfig1.current_value).toBe('value1');
      expect(unchangedConfig2.current_value).toBe(100);
    });

    it('should return 401 without authentication', async () => {
      await request(app.getHttpServer())
        .post('/api/v1/configs/bulk')
        .send({
          updates: [
            { configId: 'some-id', value: 'value' },
          ],
          updatedBy: 'user-id',
        })
        .expect(401);
    });
  });

  describe('GET /api/v1/configs/export', () => {
    /**
     * Requirement 17.1: Export JSON with all configs, values, and rules
     * Requirement 17.5: Support filtering by project and environment
     */
    it('should export all configs with their rules', async () => {
      const configService = app.get<ConfigService>(ConfigService);
      
      // Create test configs
      const config1 = await configService.create({
        organizationId: testOrg.id,
        projectId: testProject.id,
        environmentId: testEnv.id,
        keyName: 'feature.enabled',
        valueType: 'boolean',
        defaultValue: true,
        createdBy: testUser.id,
      });

      const config2 = await configService.create({
        organizationId: testOrg.id,
        projectId: testProject.id,
        environmentId: testEnv.id,
        keyName: 'api.timeout',
        valueType: 'number',
        defaultValue: 5000,
        schema: { type: 'number', minimum: 0 },
        createdBy: testUser.id,
      });

      // Export configs
      const response = await request(app.getHttpServer())
        .get('/api/v1/configs/export')
        .query({
          organizationId: testOrg.id,
          projectId: testProject.id,
          environmentId: testEnv.id,
        })
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      // Verify export structure
      expect(response.body).toMatchObject({
        version: '1.0',
        organizationId: testOrg.id,
        projectId: testProject.id,
        environmentId: testEnv.id,
      });
      expect(response.body.exportedAt).toBeDefined();
      expect(response.body.configs).toHaveLength(2);

      // Verify configs are included
      const exportedConfig1 = response.body.configs.find(
        (c: any) => c.keyName === 'feature.enabled'
      );
      const exportedConfig2 = response.body.configs.find(
        (c: any) => c.keyName === 'api.timeout'
      );

      expect(exportedConfig1).toMatchObject({
        keyName: 'feature.enabled',
        valueType: 'boolean',
        currentValue: true,
        rules: [],
      });

      expect(exportedConfig2).toMatchObject({
        keyName: 'api.timeout',
        valueType: 'number',
        currentValue: 5000,
        schema: { type: 'number', minimum: 0 },
        rules: [],
      });
    });

    it('should return empty configs array when no configs exist', async () => {
      // Create a new environment with no configs
      const environmentRepo = app.get<EnvironmentRepository>(EnvironmentRepository);
      const emptyEnv = await environmentRepo.create(testProject.id, 'empty-env');

      const response = await request(app.getHttpServer())
        .get('/api/v1/configs/export')
        .query({
          organizationId: testOrg.id,
          projectId: testProject.id,
          environmentId: emptyEnv.id,
        })
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.configs).toEqual([]);
    });

    it('should return 401 without authentication', async () => {
      await request(app.getHttpServer())
        .get('/api/v1/configs/export')
        .query({
          organizationId: testOrg.id,
          projectId: testProject.id,
          environmentId: testEnv.id,
        })
        .expect(401);
    });
  });
});
