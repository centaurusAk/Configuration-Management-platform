import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from './config.service';
import { ConfigKeyRepository } from '../repositories/config-key.repository';
import { ConfigVersionRepository } from '../repositories/config-version.repository';
import { AuditLogRepository } from '../repositories/audit-log.repository';
import { RuleRepository } from '../repositories/rule.repository';
import { CacheService } from './cache.service';
import { ValidationService } from './validation.service';
import { BadRequestException } from '@nestjs/common';
import * as fc from 'fast-check';

/**
 * Property 50: Schema addition validates current value
 * 
 * For any config key with current value V, adding a JSON schema S should fail
 * with 400 Bad Request if V does not validate against S.
 * 
 * **Validates: Requirements 15.5**
 */
describe('Property 50: Schema addition validates current value', () => {
  let configService: ConfigService;
  let configKeyRepository: ConfigKeyRepository;
  let auditLogRepository: AuditLogRepository;
  let cacheService: CacheService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ConfigService,
        ValidationService,
        {
          provide: ConfigKeyRepository,
          useValue: {
            findById: jest.fn(),
            update: jest.fn(),
          },
        },
        {
          provide: ConfigVersionRepository,
          useValue: {
            create: jest.fn(),
          },
        },
        {
          provide: AuditLogRepository,
          useValue: {
            create: jest.fn(),
          },
        },
        {
          provide: 'CacheService',
          useValue: {
            get: jest.fn().mockResolvedValue(null),
            set: jest.fn().mockResolvedValue(undefined),
            invalidate: jest.fn().mockResolvedValue(undefined),
            invalidateConfig: jest.fn().mockResolvedValue(undefined),
          },
        },
        {
          provide: RuleRepository,
          useValue: {
            find: jest.fn().mockResolvedValue([]),
            findByConfigKey: jest.fn().mockResolvedValue([]),
          },
        },
      ],
    }).compile();

    configService = module.get<ConfigService>(ConfigService);
    configKeyRepository = module.get<ConfigKeyRepository>(ConfigKeyRepository);
    auditLogRepository = module.get<AuditLogRepository>(AuditLogRepository);
    cacheService = module.get<CacheService>('CacheService');
  });

  it('should reject schema addition when current value violates the schema', async () => {
    await fc.assert(
      fc.asyncProperty(
        // Generate a config key with a current value
        fc.record({
          id: fc.uuid(),
          organization_id: fc.uuid(),
          project_id: fc.uuid(),
          environment_id: fc.uuid(),
          key_name: fc.string({ minLength: 1, maxLength: 50 }),
          value_type: fc.constant('number' as const),
          current_value: fc.integer({ min: 101, max: 200 }), // Value outside schema range
          schema: fc.constant(null), // No schema initially
          deleted_at: fc.constant(null),
          created_at: fc.date(),
          updated_at: fc.date(),
        }),
        fc.uuid(), // updatedBy

        async (configKey, updatedBy) => {
          // Setup mock to return the config key without schema
          jest.spyOn(configKeyRepository, 'findById').mockResolvedValue(configKey as any);

          // Define a schema that the current value violates
          const newSchema = {
            type: 'number',
            minimum: 0,
            maximum: 100,
          };

          // Attempt to add schema
          // Should throw BadRequestException because current value (101-200) violates schema (0-100)
          await expect(
            configService.updateSchema(configKey.id, {
              schema: newSchema,
              updatedBy,
            }),
          ).rejects.toThrow(BadRequestException);

          // Verify that the schema was NOT added
          expect(configKeyRepository.update).not.toHaveBeenCalled();
        },
      ),
      { numRuns: 100 },
    );
  });

  it('should accept schema addition when current value satisfies the schema', async () => {
    await fc.assert(
      fc.asyncProperty(
        // Generate a config key with a current value
        fc.record({
          id: fc.uuid(),
          organization_id: fc.uuid(),
          project_id: fc.uuid(),
          environment_id: fc.uuid(),
          key_name: fc.string({ minLength: 1, maxLength: 50 }),
          value_type: fc.constant('number' as const),
          current_value: fc.integer({ min: 0, max: 100 }), // Value within schema range
          schema: fc.constant(null), // No schema initially
          deleted_at: fc.constant(null),
          created_at: fc.date(),
          updated_at: fc.date(),
        }),
        fc.uuid(), // updatedBy

        async (configKey, updatedBy) => {
          // Setup mocks
          const updatedConfigKey = { ...configKey, schema: { type: 'number', minimum: 0, maximum: 100 } };
          jest.spyOn(configKeyRepository, 'findById')
            .mockResolvedValueOnce(configKey as any) // First call for updateSchema
            .mockResolvedValueOnce(updatedConfigKey as any); // Second call for get
          jest.spyOn(configKeyRepository, 'update').mockResolvedValue(undefined as any);
          jest.spyOn(auditLogRepository, 'create').mockResolvedValue(undefined as any);

          // Define a schema that the current value satisfies
          const newSchema = {
            type: 'number',
            minimum: 0,
            maximum: 100,
          };

          // Attempt to add schema
          // Should succeed because current value (0-100) satisfies schema (0-100)
          await expect(
            configService.updateSchema(configKey.id, {
              schema: newSchema,
              updatedBy,
            }),
          ).resolves.toBeDefined();

          // Verify that the schema was added
          expect(configKeyRepository.update).toHaveBeenCalledWith(
            configKey.id,
            { schema: newSchema },
          );
        },
      ),
      { numRuns: 100 },
    );
  });

  it('should validate complex current values against complex schemas', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.uuid(), // configId
        fc.uuid(), // updatedBy

        async (configId, updatedBy) => {
          // Test case 1: Current value is valid object
          const validConfigKey = {
            id: configId,
            organization_id: 'org-1',
            project_id: 'proj-1',
            environment_id: 'env-1',
            key_name: 'feature-config',
            value_type: 'json' as const,
            current_value: {
              feature: 'new-ui',
              enabled: true,
              rollout: 50,
            },
            schema: null,
            deleted_at: null,
            created_at: new Date(),
            updated_at: new Date(),
          };

          const validSchema = {
            type: 'object',
            required: ['feature', 'enabled', 'rollout'],
            properties: {
              feature: { type: 'string' },
              enabled: { type: 'boolean' },
              rollout: { type: 'number', minimum: 0, maximum: 100 },
            },
          };

          jest.spyOn(configKeyRepository, 'findById').mockResolvedValue(validConfigKey as any);
          jest.spyOn(configKeyRepository, 'update').mockResolvedValue(undefined as any);
          jest.spyOn(auditLogRepository, 'create').mockResolvedValue(undefined as any);

          // Should succeed
          await expect(
            configService.updateSchema(configId, {
              schema: validSchema,
              updatedBy,
            }),
          ).resolves.toBeDefined();

          // Test case 2: Current value is invalid object (missing required field)
          const invalidConfigKey = {
            ...validConfigKey,
            current_value: {
              feature: 'new-ui',
              enabled: true,
              // Missing 'rollout'
            },
          };

          jest.spyOn(configKeyRepository, 'findById').mockResolvedValue(invalidConfigKey as any);

          // Should fail
          await expect(
            configService.updateSchema(configId, {
              schema: validSchema,
              updatedBy,
            }),
          ).rejects.toThrow(BadRequestException);
        },
      ),
      { numRuns: 50 },
    );
  });

  it('should handle type mismatches between current value and schema', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.uuid(),
        fc.uuid(),

        async (configId, updatedBy) => {
          // Current value is a string, but schema expects a number
          const configKey = {
            id: configId,
            organization_id: 'org-1',
            project_id: 'proj-1',
            environment_id: 'env-1',
            key_name: 'test-config',
            value_type: 'string' as const,
            current_value: 'not-a-number',
            schema: null,
            deleted_at: null,
            created_at: new Date(),
            updated_at: new Date(),
          };

          const numberSchema = {
            type: 'number',
            minimum: 0,
          };

          jest.spyOn(configKeyRepository, 'findById').mockResolvedValue(configKey as any);

          // Should fail due to type mismatch
          await expect(
            configService.updateSchema(configId, {
              schema: numberSchema,
              updatedBy,
            }),
          ).rejects.toThrow(BadRequestException);
        },
      ),
      { numRuns: 50 },
    );
  });

  it('should provide detailed error messages when schema addition fails', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.uuid(),
        fc.uuid(),

        async (configId, updatedBy) => {
          const configKey = {
            id: configId,
            organization_id: 'org-1',
            project_id: 'proj-1',
            environment_id: 'env-1',
            key_name: 'test-config',
            value_type: 'json' as const,
            current_value: { name: 'test' }, // Missing 'age'
            schema: null,
            deleted_at: null,
            created_at: new Date(),
            updated_at: new Date(),
          };

          const schema = {
            type: 'object',
            required: ['name', 'age'],
            properties: {
              name: { type: 'string' },
              age: { type: 'number' },
            },
          };

          jest.spyOn(configKeyRepository, 'findById').mockResolvedValue(configKey as any);

          try {
            await configService.updateSchema(configId, {
              schema,
              updatedBy,
            });
            // Should not reach here
            expect(true).toBe(false);
          } catch (error) {
            // Requirement 15.3: Should return 400 with detailed errors
            expect(error).toBeInstanceOf(BadRequestException);
            const response = (error as BadRequestException).getResponse();
            expect(response).toHaveProperty('message');
            expect(response).toHaveProperty('errors');
            expect(Array.isArray((response as any).errors)).toBe(true);
            expect((response as any).errors.length).toBeGreaterThan(0);
          }
        },
      ),
      { numRuns: 50 },
    );
  });
});
