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
 * Property 49: Schema validation is enforced on updates
 * 
 * For any config key with a defined JSON schema, attempting to update the value
 * with data that does not validate against the schema should fail with 400 Bad Request.
 * 
 * **Validates: Requirements 15.2, 15.3**
 */
describe('Property 49: Schema validation is enforced on updates', () => {
  let configService: ConfigService;
  let configKeyRepository: ConfigKeyRepository;
  let configVersionRepository: ConfigVersionRepository;
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
    configVersionRepository = module.get<ConfigVersionRepository>(ConfigVersionRepository);
    auditLogRepository = module.get<AuditLogRepository>(AuditLogRepository);
    cacheService = module.get<CacheService>('CacheService');
  });

  it('should reject updates that violate the schema', async () => {
    await fc.assert(
      fc.asyncProperty(
        // Generate a config key with a schema
        fc.record({
          id: fc.uuid(),
          organization_id: fc.uuid(),
          project_id: fc.uuid(),
          environment_id: fc.uuid(),
          key_name: fc.string({ minLength: 1, maxLength: 50 }),
          value_type: fc.constant('number' as const),
          current_value: fc.integer({ min: 0, max: 100 }),
          schema: fc.constant({
            type: 'number',
            minimum: 0,
            maximum: 100,
          }),
          deleted_at: fc.constant(null),
          created_at: fc.date(),
          updated_at: fc.date(),
        }),
        // Generate an invalid value (outside the schema constraints)
        fc.oneof(
          fc.integer({ min: 101, max: 1000 }), // Above maximum
          fc.integer({ min: -1000, max: -1 }), // Below minimum
          fc.string(), // Wrong type
          fc.boolean(), // Wrong type
        ),
        fc.uuid(), // updatedBy

        async (configKey, invalidValue, updatedBy) => {
          // Setup mock to return the config key with schema
          jest.spyOn(configKeyRepository, 'findById').mockResolvedValue(configKey as any);

          // Attempt to update with invalid value
          // Should throw BadRequestException (Requirement 15.3)
          await expect(
            configService.update(configKey.id, {
              value: invalidValue,
              updatedBy,
            }),
          ).rejects.toThrow(BadRequestException);

          // Verify that the update was NOT persisted
          expect(configKeyRepository.update).not.toHaveBeenCalled();
          expect(configVersionRepository.create).not.toHaveBeenCalled();
        },
      ),
      { numRuns: 100 },
    );
  });

  it('should accept updates that satisfy the schema', async () => {
    await fc.assert(
      fc.asyncProperty(
        // Generate a config key with a schema
        fc.record({
          id: fc.uuid(),
          organization_id: fc.uuid(),
          project_id: fc.uuid(),
          environment_id: fc.uuid(),
          key_name: fc.string({ minLength: 1, maxLength: 50 }),
          value_type: fc.constant('number' as const),
          current_value: fc.integer({ min: 0, max: 100 }),
          schema: fc.constant({
            type: 'number',
            minimum: 0,
            maximum: 100,
          }),
          deleted_at: fc.constant(null),
          created_at: fc.date(),
          updated_at: fc.date(),
        }),
        // Generate a valid value (within schema constraints)
        fc.integer({ min: 0, max: 100 }),
        fc.uuid(), // updatedBy

        async (configKey, validValue, updatedBy) => {
          // Setup mocks
          jest.spyOn(configKeyRepository, 'findById').mockResolvedValue(configKey as any);
          jest.spyOn(configKeyRepository, 'update').mockResolvedValue(undefined as any);
          jest.spyOn(configVersionRepository, 'create').mockResolvedValue({
            id: 'version-id',
            config_key_id: configKey.id,
            value: validValue,
            created_by: updatedBy,
            created_at: new Date(),
          } as any);
          jest.spyOn(auditLogRepository, 'create').mockResolvedValue(undefined as any);

          // Attempt to update with valid value
          // Should succeed (Requirement 15.2)
          await expect(
            configService.update(configKey.id, {
              value: validValue,
              updatedBy,
            }),
          ).resolves.toBeDefined();

          // Verify that the update was persisted
          expect(configKeyRepository.update).toHaveBeenCalled();
          expect(configVersionRepository.create).toHaveBeenCalled();
        },
      ),
      { numRuns: 100 },
    );
  });

  it('should provide detailed error messages on validation failure', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          id: fc.uuid(),
          organization_id: fc.uuid(),
          project_id: fc.uuid(),
          environment_id: fc.uuid(),
          key_name: fc.string({ minLength: 1, maxLength: 50 }),
          value_type: fc.constant('json' as const),
          current_value: fc.constant({ name: 'test', age: 25 }),
          schema: fc.constant({
            type: 'object',
            required: ['name', 'age'],
            properties: {
              name: { type: 'string' },
              age: { type: 'number', minimum: 0 },
            },
          }),
          deleted_at: fc.constant(null),
          created_at: fc.date(),
          updated_at: fc.date(),
        }),
        fc.uuid(),

        async (configKey, updatedBy) => {
          jest.spyOn(configKeyRepository, 'findById').mockResolvedValue(configKey as any);

          // Try to update with invalid data (missing required field)
          try {
            await configService.update(configKey.id, {
              value: { name: 'test' }, // Missing 'age'
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
          }
        },
      ),
      { numRuns: 50 },
    );
  });

  it('should handle complex schema validations', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          id: fc.uuid(),
          organization_id: fc.uuid(),
          project_id: fc.uuid(),
          environment_id: fc.uuid(),
          key_name: fc.string({ minLength: 1, maxLength: 50 }),
          value_type: fc.constant('json' as const),
          current_value: fc.constant({
            feature: 'new-ui',
            enabled: true,
            rollout: 50,
          }),
          schema: fc.constant({
            type: 'object',
            required: ['feature', 'enabled', 'rollout'],
            properties: {
              feature: { type: 'string', minLength: 1 },
              enabled: { type: 'boolean' },
              rollout: { type: 'number', minimum: 0, maximum: 100 },
            },
            additionalProperties: false,
          }),
          deleted_at: fc.constant(null),
          created_at: fc.date(),
          updated_at: fc.date(),
        }),
        fc.uuid(),

        async (configKey, updatedBy) => {
          jest.spyOn(configKeyRepository, 'findById').mockResolvedValue(configKey as any);

          // Test various invalid scenarios
          const invalidValues = [
            { feature: '', enabled: true, rollout: 50 }, // Empty string
            { feature: 'test', enabled: 'yes', rollout: 50 }, // Wrong type
            { feature: 'test', enabled: true, rollout: 150 }, // Out of range
            { feature: 'test', enabled: true, rollout: 50, extra: 'field' }, // Additional property
          ];

          for (const invalidValue of invalidValues) {
            await expect(
              configService.update(configKey.id, {
                value: invalidValue,
                updatedBy,
              }),
            ).rejects.toThrow(BadRequestException);
          }
        },
      ),
      { numRuns: 50 },
    );
  });
});
