import { Test, TestingModule } from '@nestjs/testing';
import * as fc from 'fast-check';
import { ConfigService } from './config.service';
import { ConfigKeyRepository } from '../repositories/config-key.repository';
import { ConfigVersionRepository } from '../repositories/config-version.repository';
import { AuditLogRepository } from '../repositories/audit-log.repository';
import { RuleRepository } from '../repositories/rule.repository';
import { ConfigKey, AuditLog } from '../entities';
import { ValidationService } from './validation.service';

/**
 * Property-Based Tests for Bulk Audit Logging
 * 
 * **Validates: Requirements 16.5**
 * 
 * Property 53: Bulk updates create single audit entry
 * For any successful bulk update of N configs, exactly one audit log entry should be created
 * with metadata containing all N config IDs.
 */
describe('Property Test: Bulk Audit Logging', () => {
  let configService: ConfigService;
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
      query: jest.fn(),
      findByResource: jest.fn(),
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
  });

  /**
   * Property 53: Bulk updates create single audit entry
   * 
   * This property tests that a successful bulk update of N configs creates
   * exactly ONE audit log entry with metadata containing all N config IDs.
   */
  it('should create exactly one audit log entry for bulk update', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.uuid(), // organizationId
        fc.uuid(), // projectId
        fc.uuid(), // environmentId
        fc.integer({ min: 2, max: 10 }), // number of configs in bulk update
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
          const createdAuditLogs: AuditLog[] = [];

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
          }

          // Mock repository to return the appropriate config key for each update
          (mockConfigKeyRepository.findById as jest.Mock).mockImplementation(
            (id: string) => {
              const config = mockConfigKeys.find((ck) => ck.id === id);
              return Promise.resolve(config);
            },
          );

          // Mock transaction to capture audit log creation
          (mockConfigKeyRepository.repository.manager.transaction as jest.Mock).mockImplementation(
            async (callback: any) => {
              // Create a mock transaction manager
              const mockManager = {
                update: jest.fn().mockResolvedValue(undefined),
                create: jest.fn().mockImplementation((entity: any, data: any) => {
                  return data;
                }),
                save: jest.fn().mockImplementation((entity: any, data: any) => {
                  // Capture audit log entries
                  if (entity.name === 'AuditLog') {
                    createdAuditLogs.push(data);
                  }
                  return Promise.resolve(data);
                }),
              };

              // Execute the transaction callback
              await callback(mockManager);
            },
          );

          // Act: Execute bulk update
          await configService.bulkUpdate({
            updates: updates,
            updatedBy: userId,
          });

          // Property 53: Exactly ONE audit log entry should be created
          expect(createdAuditLogs.length).toBe(1);

          const auditLog = createdAuditLogs[0];

          // Property 53: Audit log should have resource_type 'CONFIG_KEY'
          expect(auditLog.resource_type).toBe('CONFIG_KEY');

          // Property 53: Audit log should have action_type 'UPDATE'
          expect(auditLog.action_type).toBe('UPDATE');

          // Property 53: Audit log should have resource_id matching first config
          expect(auditLog.resource_id).toBe(mockConfigKeys[0].id);

          // Property 53: Audit log should have user_id matching the updater
          expect(auditLog.user_id).toBe(userId);

          // Property 53: Audit log should have organization_id
          expect(auditLog.organization_id).toBe(orgId);

          // Property 53: Metadata should contain bulk_update flag
          expect(auditLog.metadata).toBeDefined();
          expect(auditLog.metadata?.bulk_update).toBe(true);

          // Property 53: Metadata should contain ALL N config IDs
          expect(auditLog.metadata?.config_ids).toBeDefined();
          expect(auditLog.metadata?.config_ids).toHaveLength(numConfigs);

          // Verify all config IDs are present in metadata
          const expectedConfigIds = mockConfigKeys.map(ck => ck.id);
          for (const expectedId of expectedConfigIds) {
            expect(auditLog.metadata?.config_ids).toContain(expectedId);
          }

          // Property 53: Metadata should contain count of configs
          expect(auditLog.metadata?.count).toBe(numConfigs);

          // Property 53: old_value should contain all old values
          expect(auditLog.old_value).toBeDefined();
          expect(Array.isArray(auditLog.old_value)).toBe(true);
          expect(auditLog.old_value).toHaveLength(numConfigs);

          // Property 53: new_value should contain all new values
          expect(auditLog.new_value).toBeDefined();
          expect(Array.isArray(auditLog.new_value)).toBe(true);
          expect(auditLog.new_value).toHaveLength(numConfigs);

          // Verify old values match the original config values
          for (let i = 0; i < numConfigs; i++) {
            const oldValueEntry = auditLog.old_value.find(
              (v: any) => v.id === mockConfigKeys[i].id
            );
            expect(oldValueEntry).toBeDefined();
            expect(oldValueEntry.value).toBe(mockConfigKeys[i].current_value);
          }

          // Verify new values match the update values
          for (let i = 0; i < numConfigs; i++) {
            const newValueEntry = auditLog.new_value.find(
              (v: any) => v.id === updates[i].configId
            );
            expect(newValueEntry).toBeDefined();
            expect(newValueEntry.value).toBe(updates[i].value);
          }
        },
      ),
      {
        numRuns: 50,
        verbose: true,
      },
    );
  });

  /**
   * Property 53: Bulk updates create single audit entry - varying batch sizes
   * 
   * This property tests that the single audit log entry property holds
   * for different batch sizes (2 to 50 configs).
   */
  it('should create single audit entry regardless of batch size', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.uuid(), // organizationId
        fc.uuid(), // projectId
        fc.uuid(), // environmentId
        fc.integer({ min: 2, max: 50 }), // varying batch size
        fc.uuid(), // userId
        async (
          orgId: string,
          projId: string,
          envId: string,
          numConfigs: number,
          userId: string,
        ) => {
          jest.clearAllMocks();

          const mockConfigKeys: ConfigKey[] = [];
          const updates: any[] = [];
          const createdAuditLogs: AuditLog[] = [];

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

          (mockConfigKeyRepository.findById as jest.Mock).mockImplementation(
            (id: string) => {
              const config = mockConfigKeys.find((ck) => ck.id === id);
              return Promise.resolve(config);
            },
          );

          (mockConfigKeyRepository.repository.manager.transaction as jest.Mock).mockImplementation(
            async (callback: any) => {
              const mockManager = {
                update: jest.fn().mockResolvedValue(undefined),
                create: jest.fn().mockImplementation((entity: any, data: any) => data),
                save: jest.fn().mockImplementation((entity: any, data: any) => {
                  if (entity.name === 'AuditLog') {
                    createdAuditLogs.push(data);
                  }
                  return Promise.resolve(data);
                }),
              };

              await callback(mockManager);
            },
          );

          // Act
          await configService.bulkUpdate({
            updates: updates,
            updatedBy: userId,
          });

          // Property 53: Always exactly ONE audit log, regardless of batch size
          expect(createdAuditLogs.length).toBe(1);

          // Property 53: Metadata should contain correct count
          expect(createdAuditLogs[0].metadata?.count).toBe(numConfigs);
          expect(createdAuditLogs[0].metadata?.config_ids).toHaveLength(numConfigs);
        },
      ),
      {
        numRuns: 30,
        verbose: true,
      },
    );
  });

  /**
   * Property 53: Bulk updates create single audit entry - different value types
   * 
   * This property tests that the single audit log entry property holds
   * when updating configs with different value types.
   */
  it('should create single audit entry with mixed value types', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.uuid(), // organizationId
        fc.uuid(), // projectId
        fc.uuid(), // environmentId
        fc.uuid(), // userId
        async (
          orgId: string,
          projId: string,
          envId: string,
          userId: string,
        ) => {
          jest.clearAllMocks();

          // Create configs with different value types
          const mockConfigKeys: ConfigKey[] = [
            {
              id: `config-${orgId}-boolean`,
              organization_id: orgId,
              project_id: projId,
              environment_id: envId,
              key_name: 'boolean-key',
              value_type: 'boolean',
              current_value: false,
              created_at: new Date(),
              updated_at: new Date(),
            } as ConfigKey,
            {
              id: `config-${orgId}-string`,
              organization_id: orgId,
              project_id: projId,
              environment_id: envId,
              key_name: 'string-key',
              value_type: 'string',
              current_value: 'old-value',
              created_at: new Date(),
              updated_at: new Date(),
            } as ConfigKey,
            {
              id: `config-${orgId}-number`,
              organization_id: orgId,
              project_id: projId,
              environment_id: envId,
              key_name: 'number-key',
              value_type: 'number',
              current_value: 42,
              created_at: new Date(),
              updated_at: new Date(),
            } as ConfigKey,
            {
              id: `config-${orgId}-json`,
              organization_id: orgId,
              project_id: projId,
              environment_id: envId,
              key_name: 'json-key',
              value_type: 'json',
              current_value: { old: 'data' },
              created_at: new Date(),
              updated_at: new Date(),
            } as ConfigKey,
          ];

          const updates = [
            { configId: mockConfigKeys[0].id, value: true },
            { configId: mockConfigKeys[1].id, value: 'new-value' },
            { configId: mockConfigKeys[2].id, value: 100 },
            { configId: mockConfigKeys[3].id, value: { new: 'data' } },
          ];

          const createdAuditLogs: AuditLog[] = [];

          (mockConfigKeyRepository.findById as jest.Mock).mockImplementation(
            (id: string) => {
              const config = mockConfigKeys.find((ck) => ck.id === id);
              return Promise.resolve(config);
            },
          );

          (mockConfigKeyRepository.repository.manager.transaction as jest.Mock).mockImplementation(
            async (callback: any) => {
              const mockManager = {
                update: jest.fn().mockResolvedValue(undefined),
                create: jest.fn().mockImplementation((entity: any, data: any) => data),
                save: jest.fn().mockImplementation((entity: any, data: any) => {
                  if (entity.name === 'AuditLog') {
                    createdAuditLogs.push(data);
                  }
                  return Promise.resolve(data);
                }),
              };

              await callback(mockManager);
            },
          );

          // Act
          await configService.bulkUpdate({
            updates: updates,
            updatedBy: userId,
          });

          // Property 53: Exactly ONE audit log for mixed types
          expect(createdAuditLogs.length).toBe(1);

          const auditLog = createdAuditLogs[0];

          // Property 53: All 4 config IDs should be in metadata
          expect(auditLog.metadata?.config_ids).toHaveLength(4);
          expect(auditLog.metadata?.count).toBe(4);

          // Property 53: old_value and new_value should contain all 4 entries
          expect(auditLog.old_value).toHaveLength(4);
          expect(auditLog.new_value).toHaveLength(4);

          // Verify each type is correctly captured
          const booleanOldValue = auditLog.old_value.find(
            (v: any) => v.id === mockConfigKeys[0].id
          );
          expect(booleanOldValue.value).toBe(false);

          const stringOldValue = auditLog.old_value.find(
            (v: any) => v.id === mockConfigKeys[1].id
          );
          expect(stringOldValue.value).toBe('old-value');

          const numberOldValue = auditLog.old_value.find(
            (v: any) => v.id === mockConfigKeys[2].id
          );
          expect(numberOldValue.value).toBe(42);

          const jsonOldValue = auditLog.old_value.find(
            (v: any) => v.id === mockConfigKeys[3].id
          );
          expect(jsonOldValue.value).toEqual({ old: 'data' });
        },
      ),
      {
        numRuns: 30,
        verbose: true,
      },
    );
  });

  /**
   * Property 53: No audit log created on validation failure
   * 
   * This property tests that when a bulk update fails validation,
   * NO audit log entry is created (since the operation is rejected).
   */
  it('should not create audit log when bulk update fails validation', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.uuid(), // organizationId
        fc.uuid(), // projectId
        fc.uuid(), // environmentId
        fc.integer({ min: 2, max: 5 }), // number of configs
        fc.integer({ min: 0, max: 4 }), // index of failing config
        fc.uuid(), // userId
        async (
          orgId: string,
          projId: string,
          envId: string,
          numConfigs: number,
          failIndex: number,
          userId: string,
        ) => {
          jest.clearAllMocks();

          const actualFailIndex = failIndex % numConfigs;
          const mockConfigKeys: ConfigKey[] = [];
          const updates: any[] = [];
          const createdAuditLogs: AuditLog[] = [];

          for (let i = 0; i < numConfigs; i++) {
            const configId = `config-${orgId}-${i}`;
            const isFailingConfig = i === actualFailIndex;

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
                    minLength: 10,
                  }
                : undefined,
              created_at: new Date(),
              updated_at: new Date(),
            } as ConfigKey;

            mockConfigKeys.push(mockConfigKey);
            updates.push({
              configId: configId,
              value: isFailingConfig ? 'short' : `new-value-${i}`,
            });
          }

          (mockConfigKeyRepository.findById as jest.Mock).mockImplementation(
            (id: string) => {
              const config = mockConfigKeys.find((ck) => ck.id === id);
              return Promise.resolve(config);
            },
          );

          (mockConfigKeyRepository.repository.manager.transaction as jest.Mock).mockImplementation(
            async (callback: any) => {
              const mockManager = {
                update: jest.fn().mockResolvedValue(undefined),
                create: jest.fn().mockImplementation((entity: any, data: any) => data),
                save: jest.fn().mockImplementation((entity: any, data: any) => {
                  if (entity.name === 'AuditLog') {
                    createdAuditLogs.push(data);
                  }
                  return Promise.resolve(data);
                }),
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

          // Property 53: NO audit log should be created on validation failure
          expect(createdAuditLogs.length).toBe(0);
        },
      ),
      {
        numRuns: 30,
        verbose: true,
      },
    );
  });
});
