import { Test, TestingModule } from '@nestjs/testing';
import * as fc from 'fast-check';
import { ConfigService } from './config.service';
import { ConfigKeyRepository } from '../repositories/config-key.repository';
import { ConfigVersionRepository } from '../repositories/config-version.repository';
import { AuditLogRepository } from '../repositories/audit-log.repository';
import { RuleRepository } from '../repositories/rule.repository';
import { ConfigKey, ConfigVersion } from '../entities';
import { ValidationService } from './validation.service';

/**
 * Property-Based Tests for Bulk Version Synchronization
 * 
 * **Validates: Requirements 16.4**
 * 
 * Property 52: Bulk updates create synchronized versions
 * For any successful bulk update of N configs, all N resulting config_version records
 * should have the same created_at timestamp (within 1 second).
 */
describe('Property Test: Bulk Version Synchronization', () => {
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
   * Property 52: Bulk updates create synchronized versions
   * 
   * This property tests that all config versions created in a bulk update
   * have the same timestamp, ensuring synchronized version history.
   */
  it('should create all versions with synchronized timestamps', async () => {
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
          const createdVersions: ConfigVersion[] = [];

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

          // Mock transaction to capture created versions
          (mockConfigKeyRepository.repository.manager.transaction as jest.Mock).mockImplementation(
            async (callback: any) => {
              // Create a mock transaction manager
              const mockManager = {
                update: jest.fn().mockResolvedValue(undefined),
                create: jest.fn().mockImplementation((entity: any, data: any) => {
                  return data;
                }),
                save: jest.fn().mockImplementation((entity: any, data: any) => {
                  if (entity.name === 'ConfigVersion') {
                    // Capture the version with its timestamp
                    createdVersions.push(data);
                  }
                  return Promise.resolve(data);
                }),
              };

              // Execute the transaction callback
              await callback(mockManager);
            },
          );

          // Act: Execute bulk update
          const result = await configService.bulkUpdate({
            updates: updates,
            updatedBy: userId,
          });

          // Property: ALL versions should have been created
          expect(createdVersions.length).toBe(numConfigs);
          expect(result.length).toBe(numConfigs);

          // Property 52: All versions should have the SAME timestamp (within 1 second)
          if (createdVersions.length > 1) {
            const firstTimestamp = createdVersions[0].created_at;
            
            for (let i = 1; i < createdVersions.length; i++) {
              const currentTimestamp = createdVersions[i].created_at;
              
              // Calculate time difference in milliseconds
              const timeDiff = Math.abs(
                currentTimestamp.getTime() - firstTimestamp.getTime()
              );
              
              // All timestamps should be within 1 second (1000ms) of each other
              // In practice, they should be identical since they're created in the same transaction
              expect(timeDiff).toBeLessThanOrEqual(1000);
              
              // For stricter validation: they should actually be identical
              expect(currentTimestamp.getTime()).toBe(firstTimestamp.getTime());
            }
          }

          // Additional verification: All versions should have the same created_by
          const firstCreatedBy = createdVersions[0].created_by;
          for (const version of createdVersions) {
            expect(version.created_by).toBe(firstCreatedBy);
            expect(version.created_by).toBe(userId);
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
   * Property 52: Bulk updates create synchronized versions - varying config types
   * 
   * This property tests timestamp synchronization with different value types
   * to ensure the synchronization works regardless of config type.
   */
  it('should synchronize timestamps across different config value types', async () => {
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
          // Reset mocks
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

          const createdVersions: ConfigVersion[] = [];

          // Mock repository
          (mockConfigKeyRepository.findById as jest.Mock).mockImplementation(
            (id: string) => {
              const config = mockConfigKeys.find((ck) => ck.id === id);
              return Promise.resolve(config);
            },
          );

          // Mock transaction
          (mockConfigKeyRepository.repository.manager.transaction as jest.Mock).mockImplementation(
            async (callback: any) => {
              const mockManager = {
                update: jest.fn().mockResolvedValue(undefined),
                create: jest.fn().mockImplementation((entity: any, data: any) => data),
                save: jest.fn().mockImplementation((entity: any, data: any) => {
                  if (entity.name === 'ConfigVersion') {
                    createdVersions.push(data);
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

          // Property: All 4 versions should be created
          expect(createdVersions.length).toBe(4);

          // Property 52: All timestamps should be identical
          const timestamps = createdVersions.map(v => v.created_at.getTime());
          const uniqueTimestamps = new Set(timestamps);
          
          // All timestamps should be the same (only 1 unique timestamp)
          expect(uniqueTimestamps.size).toBe(1);
        },
      ),
      {
        numRuns: 30,
        verbose: true,
      },
    );
  });

  /**
   * Property 52: Bulk updates create synchronized versions - large batch
   * 
   * This property tests that timestamp synchronization works even with
   * larger batches of configs (stress test).
   */
  it('should maintain timestamp synchronization for large batches', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.uuid(), // organizationId
        fc.uuid(), // projectId
        fc.uuid(), // environmentId
        fc.integer({ min: 10, max: 50 }), // larger batch size
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
          const createdVersions: ConfigVersion[] = [];

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
                  if (entity.name === 'ConfigVersion') {
                    createdVersions.push(data);
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

          // Property: All versions created
          expect(createdVersions.length).toBe(numConfigs);

          // Property 52: All timestamps must be identical
          const firstTimestamp = createdVersions[0].created_at.getTime();
          
          for (const version of createdVersions) {
            expect(version.created_at.getTime()).toBe(firstTimestamp);
          }

          // Verify no timestamp drift even in large batches
          const allTimestamps = createdVersions.map(v => v.created_at.getTime());
          const minTimestamp = Math.min(...allTimestamps);
          const maxTimestamp = Math.max(...allTimestamps);
          
          // No drift: min and max should be identical
          expect(maxTimestamp - minTimestamp).toBe(0);
        },
      ),
      {
        numRuns: 20,
        verbose: true,
      },
    );
  });
});
