import { Test, TestingModule } from '@nestjs/testing';
import * as fc from 'fast-check';
import { ConfigService } from './config.service';
import { ConfigKeyRepository } from '../repositories/config-key.repository';
import { ConfigVersionRepository } from '../repositories/config-version.repository';
import { AuditLogRepository } from '../repositories/audit-log.repository';
import { RuleRepository } from '../repositories/rule.repository';
import { ConfigKey, ConfigVersion } from '../entities';
import { ValidationService } from './validation.service';
import { BadRequestException } from '@nestjs/common';

/**
 * Property-Based Tests for Bulk Update Atomicity
 * 
 * **Validates: Requirements 16.2, 16.3**
 * 
 * Property 51: Bulk updates are atomic
 * For any bulk update request containing N config updates where at least one fails validation,
 * zero configs should be updated (all-or-nothing).
 */
describe('Property Test: Bulk Update Atomicity', () => {
  let configService: ConfigService;
  let configKeyRepo: ConfigKeyRepository;
  let configVersionRepo: ConfigVersionRepository;
  let auditLogRepo: AuditLogRepository;
  let mockConfigKeyRepository: any;
  let mockConfigVersionRepository: any;
  let mockAuditLogRepository: any;
  let mockCacheService: any;

  beforeEach(async () => {
    // Mock repositories
    mockConfigKeyRepository = {
      create: jest.fn(),
      save: jest.fn(),
      findOne: jest.fn(),
      update: jest.fn(),
      findById: jest.fn(),
      repository: {
        manager: {
          transaction: jest.fn(),
        },
      },
    };

    mockConfigVersionRepository = {
      create: jest.fn(),
      save: jest.fn(),
      findOne: jest.fn(),
      find: jest.fn(),
      count: jest.fn(),
      findByConfigKey: jest.fn(),
      countByConfigKey: jest.fn(),
    };

    mockAuditLogRepository = {
      create: jest.fn(),
      save: jest.fn(),
    };

    mockCacheService = {
      get: jest.fn().mockResolvedValue(null),
      set: jest.fn().mockResolvedValue(undefined),
      invalidate: jest.fn().mockResolvedValue(undefined),
      invalidateConfig: jest.fn().mockResolvedValue(undefined),
      close: jest.fn().mockResolvedValue(undefined),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ConfigService,
        ValidationService,
        {
          provide: ConfigKeyRepository,
          useValue: mockConfigKeyRepository,
        },
        {
          provide: ConfigVersionRepository,
          useValue: mockConfigVersionRepository,
        },
        {
          provide: AuditLogRepository,
          useValue: mockAuditLogRepository,
        },
        {
          provide: 'CacheService',
          useValue: mockCacheService,
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
    configKeyRepo = module.get<ConfigKeyRepository>(ConfigKeyRepository);
    configVersionRepo = module.get<ConfigVersionRepository>(ConfigVersionRepository);
    auditLogRepo = module.get<AuditLogRepository>(AuditLogRepository);
  });

  /**
   * Property 51: Bulk updates are atomic - validation failure case
   * 
   * This property tests that when ANY config in a bulk update fails validation,
   * ZERO configs are updated (all-or-nothing atomicity).
   */
  it('should reject entire bulk update when any validation fails', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.uuid(), // organizationId
        fc.uuid(), // projectId
        fc.uuid(), // environmentId
        fc.integer({ min: 2, max: 5 }), // number of configs in bulk update
        fc.integer({ min: 0, max: 4 }), // index of config that will fail validation
        fc.uuid(), // userId
        async (
          orgId: string,
          projId: string,
          envId: string,
          numConfigs: number,
          failIndex: number,
          userId: string,
        ) => {
          // Ensure failIndex is within bounds
          const actualFailIndex = failIndex % numConfigs;

          // Create mock config keys
          const mockConfigKeys: ConfigKey[] = [];
          const updates: any[] = [];

          for (let i = 0; i < numConfigs; i++) {
            const configId = `config-${orgId}-${i}`;
            const isFailingConfig = i === actualFailIndex;

            // Create config key with schema for the failing config
            const mockConfigKey: ConfigKey = {
              id: configId,
              organization_id: orgId,
              project_id: projId,
              environment_id: envId,
              key_name: `test-key-${i}`,
              value_type: 'string',
              current_value: `value-${i}`,
              schema: isFailingConfig
                ? {
                    type: 'string',
                    minLength: 10, // This will cause validation to fail
                  }
                : undefined,
              created_at: new Date(),
              updated_at: new Date(),
            } as ConfigKey;

            mockConfigKeys.push(mockConfigKey);

            // Create update with value that will fail validation for the failing config
            updates.push({
              configId: configId,
              value: isFailingConfig ? 'short' : `new-value-${i}`, // 'short' is < 10 chars
            });
          }

          // Mock repository to return the appropriate config key for each update
          (mockConfigKeyRepository.findById as jest.Mock).mockImplementation(
            (id: string) => {
              const config = mockConfigKeys.find((ck) => ck.id === id);
              return Promise.resolve(config);
            },
          );

          // Track initial state - no versions should be created
          const initialVersionCount = 0;
          (mockConfigVersionRepository.countByConfigKey as jest.Mock).mockResolvedValue(
            initialVersionCount,
          );

          // Track if transaction was called
          let transactionCalled = false;
          (mockConfigKeyRepository.repository.manager.transaction as jest.Mock).mockImplementation(
            async (callback: any) => {
              transactionCalled = true;
              // Transaction should not be executed if validation fails
              throw new Error('Transaction should not be called when validation fails');
            },
          );

          // Act & Assert: Bulk update should fail
          await expect(
            configService.bulkUpdate({
              updates: updates,
              updatedBy: userId,
            }),
          ).rejects.toThrow(BadRequestException);

          // Property: Transaction should NOT have been called (validation fails before transaction)
          expect(transactionCalled).toBe(false);

          // Property: No versions should have been created
          for (const configKey of mockConfigKeys) {
            const versionCount = await configVersionRepo.countByConfigKey(configKey.id);
            expect(versionCount).toBe(initialVersionCount);
          }

          // Property: Cache invalidation should NOT have been called
          expect(mockCacheService.invalidateConfig).not.toHaveBeenCalled();
        },
      ),
      {
        numRuns: 50,
        verbose: true,
      },
    );
  });

  /**
   * Property 51: Bulk updates are atomic - type mismatch case
   * 
   * This property tests that when ANY config in a bulk update has a type mismatch,
   * ZERO configs are updated (all-or-nothing atomicity).
   */
  it('should reject entire bulk update when any value type mismatches', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.uuid(), // organizationId
        fc.uuid(), // projectId
        fc.uuid(), // environmentId
        fc.integer({ min: 2, max: 5 }), // number of configs in bulk update
        fc.integer({ min: 0, max: 4 }), // index of config that will have type mismatch
        fc.uuid(), // userId
        async (
          orgId: string,
          projId: string,
          envId: string,
          numConfigs: number,
          failIndex: number,
          userId: string,
        ) => {
          // Ensure failIndex is within bounds
          const actualFailIndex = failIndex % numConfigs;

          // Create mock config keys
          const mockConfigKeys: ConfigKey[] = [];
          const updates: any[] = [];

          for (let i = 0; i < numConfigs; i++) {
            const configId = `config-${orgId}-${i}`;
            const isFailingConfig = i === actualFailIndex;

            // Create config key - failing config expects boolean
            const mockConfigKey: ConfigKey = {
              id: configId,
              organization_id: orgId,
              project_id: projId,
              environment_id: envId,
              key_name: `test-key-${i}`,
              value_type: isFailingConfig ? 'boolean' : 'string',
              current_value: isFailingConfig ? true : `value-${i}`,
              created_at: new Date(),
              updated_at: new Date(),
            } as ConfigKey;

            mockConfigKeys.push(mockConfigKey);

            // Create update with wrong type for the failing config
            updates.push({
              configId: configId,
              value: isFailingConfig ? 'not-a-boolean' : `new-value-${i}`,
            });
          }

          // Mock repository to return the appropriate config key for each update
          (mockConfigKeyRepository.findById as jest.Mock).mockImplementation(
            (id: string) => {
              const config = mockConfigKeys.find((ck) => ck.id === id);
              return Promise.resolve(config);
            },
          );

          // Track if transaction was called
          let transactionCalled = false;
          (mockConfigKeyRepository.repository.manager.transaction as jest.Mock).mockImplementation(
            async (callback: any) => {
              transactionCalled = true;
              throw new Error('Transaction should not be called when validation fails');
            },
          );

          // Act & Assert: Bulk update should fail
          await expect(
            configService.bulkUpdate({
              updates: updates,
              updatedBy: userId,
            }),
          ).rejects.toThrow(BadRequestException);

          // Property: Transaction should NOT have been called
          expect(transactionCalled).toBe(false);

          // Property: Cache invalidation should NOT have been called
          expect(mockCacheService.invalidateConfig).not.toHaveBeenCalled();
        },
      ),
      {
        numRuns: 50,
        verbose: true,
      },
    );
  });

  /**
   * Property 51: Bulk updates are atomic - success case
   * 
   * This property tests that when ALL configs in a bulk update pass validation,
   * ALL configs are updated atomically within a transaction.
   */
  it('should update all configs atomically when all validations pass', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.uuid(), // organizationId
        fc.uuid(), // projectId
        fc.uuid(), // environmentId
        fc.integer({ min: 2, max: 5 }), // number of configs in bulk update
        fc.uuid(), // userId
        async (
          orgId: string,
          projId: string,
          envId: string,
          numConfigs: number,
          userId: string,
        ) => {
          // Reset mocks for each property test run
          jest.clearAllMocks();

          // Create mock config keys
          const mockConfigKeys: ConfigKey[] = [];
          const updates: any[] = [];
          const newVersions: ConfigVersion[] = [];

          for (let i = 0; i < numConfigs; i++) {
            const configId = `config-${orgId}-${i}`;

            // Create config key without schema (no validation issues)
            const mockConfigKey: ConfigKey = {
              id: configId,
              organization_id: orgId,
              project_id: projId,
              environment_id: envId,
              key_name: `test-key-${i}`,
              value_type: 'string',
              current_value: `value-${i}`,
              created_at: new Date(),
              updated_at: new Date(),
            } as ConfigKey;

            mockConfigKeys.push(mockConfigKey);

            // Create valid update
            updates.push({
              configId: configId,
              value: `new-value-${i}`,
            });

            // Create expected new version
            const newVersion: ConfigVersion = {
              id: `version-${configId}-new`,
              config_key_id: configId,
              value: `new-value-${i}`,
              created_by: userId,
              created_at: new Date(),
            } as ConfigVersion;

            newVersions.push(newVersion);
          }

          // Mock repository to return the appropriate config key for each update
          (mockConfigKeyRepository.findById as jest.Mock).mockImplementation(
            (id: string) => {
              const config = mockConfigKeys.find((ck) => ck.id === id);
              return Promise.resolve(config);
            },
          );

          // Track if transaction was called and execute it
          let transactionCalled = false;
          let updatedConfigIds: string[] = [];
          let createdVersions: ConfigVersion[] = [];

          (mockConfigKeyRepository.repository.manager.transaction as jest.Mock).mockImplementation(
            async (callback: any) => {
              transactionCalled = true;

              // Create a mock transaction manager
              const mockManager = {
                update: jest.fn().mockImplementation((entity: any, id: string, data: any) => {
                  updatedConfigIds.push(id);
                  return Promise.resolve();
                }),
                create: jest.fn().mockImplementation((entity: any, data: any) => {
                  return data;
                }),
                save: jest.fn().mockImplementation((entity: any, data: any) => {
                  if (entity.name === 'ConfigVersion') {
                    createdVersions.push(data);
                  }
                  return Promise.resolve(data);
                }),
              };

              // Execute the transaction callback
              await callback(mockManager);
            },
          );

          // Act: Bulk update should succeed
          const result = await configService.bulkUpdate({
            updates: updates,
            updatedBy: userId,
          });

          // Property: Transaction should have been called
          expect(transactionCalled).toBe(true);

          // Property: ALL configs should have been updated
          expect(updatedConfigIds.length).toBe(numConfigs);
          for (const configKey of mockConfigKeys) {
            expect(updatedConfigIds).toContain(configKey.id);
          }

          // Property: ALL versions should have been created
          expect(createdVersions.length).toBe(numConfigs);

          // Property: Cache invalidation should have been called for ALL configs
          expect(mockCacheService.invalidateConfig).toHaveBeenCalledTimes(numConfigs);
        },
      ),
      {
        numRuns: 50,
        verbose: true,
      },
    );
  });

  /**
   * Property 51: Bulk updates are atomic - transaction rollback case
   * 
   * This property tests that when a transaction fails mid-execution,
   * ALL changes are rolled back (no partial updates).
   */
  it('should rollback all changes when transaction fails', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.uuid(), // organizationId
        fc.uuid(), // projectId
        fc.uuid(), // environmentId
        fc.integer({ min: 3, max: 5 }), // number of configs (at least 3 to test mid-transaction failure)
        fc.uuid(), // userId
        async (
          orgId: string,
          projId: string,
          envId: string,
          numConfigs: number,
          userId: string,
        ) => {
          // Create mock config keys
          const mockConfigKeys: ConfigKey[] = [];
          const updates: any[] = [];

          for (let i = 0; i < numConfigs; i++) {
            const configId = `config-${orgId}-${i}`;

            const mockConfigKey: ConfigKey = {
              id: configId,
              organization_id: orgId,
              project_id: projId,
              environment_id: envId,
              key_name: `test-key-${i}`,
              value_type: 'string',
              current_value: `value-${i}`,
              created_at: new Date(),
              updated_at: new Date(),
            } as ConfigKey;

            mockConfigKeys.push(mockConfigKey);

            updates.push({
              configId: configId,
              value: `new-value-${i}`,
            });
          }

          // Mock repository to return the appropriate config key for each update
          (mockConfigKeyRepository.findById as jest.Mock).mockImplementation(
            (id: string) => {
              const config = mockConfigKeys.find((ck) => ck.id === id);
              return Promise.resolve(config);
            },
          );

          // Track updates before transaction fails
          let updatedConfigIds: string[] = [];

          // Mock transaction to fail mid-execution
          (mockConfigKeyRepository.repository.manager.transaction as jest.Mock).mockImplementation(
            async (callback: any) => {
              const mockManager = {
                update: jest.fn().mockImplementation((entity: any, id: string, data: any) => {
                  updatedConfigIds.push(id);
                  // Fail after processing half the configs
                  if (updatedConfigIds.length >= Math.ceil(numConfigs / 2)) {
                    throw new Error('Database error during transaction');
                  }
                  return Promise.resolve();
                }),
                create: jest.fn().mockReturnValue({}),
                save: jest.fn().mockResolvedValue({}),
              };

              await callback(mockManager);
            },
          );

          // Act & Assert: Bulk update should fail
          await expect(
            configService.bulkUpdate({
              updates: updates,
              updatedBy: userId,
            }),
          ).rejects.toThrow();

          // Property: Some updates were attempted before failure
          expect(updatedConfigIds.length).toBeGreaterThan(0);
          expect(updatedConfigIds.length).toBeLessThan(numConfigs);

          // Property: Cache invalidation should NOT have been called (transaction failed)
          expect(mockCacheService.invalidateConfig).not.toHaveBeenCalled();

          // In a real database, the transaction would rollback all changes
          // Here we verify that the service doesn't proceed with cache invalidation
          // when the transaction fails
        },
      ),
      {
        numRuns: 30,
        verbose: true,
      },
    );
  });
});
