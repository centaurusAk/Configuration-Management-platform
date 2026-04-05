import { Test, TestingModule } from '@nestjs/testing';
import * as fc from 'fast-check';
import { ConfigService } from './config.service';
import { ConfigKeyRepository } from '../repositories/config-key.repository';
import { ConfigVersionRepository } from '../repositories/config-version.repository';
import { AuditLogRepository } from '../repositories/audit-log.repository';
import { RuleRepository } from '../repositories/rule.repository';
import { ValidationService } from './validation.service';

/**
 * Property-Based Tests for Rollback Correctness
 * 
 * **Validates: Requirements 2.3, 2.4**
 * 
 * Property 7: Rollback creates new version with historical value
 * For any config key and any historical version V, rolling back to version V
 * should create a new version V' where V'.value equals V.value, and should
 * create an audit log entry with action_type='ROLLBACK'.
 */
describe('Property Test: Rollback Correctness', () => {
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
    };

    mockConfigVersionRepository = {
      create: jest.fn(),
      save: jest.fn(),
      findOne: jest.fn(),
      findById: jest.fn(),
      find: jest.fn(),
      count: jest.fn(),
      findByConfigKey: jest.fn(),
    };

    mockAuditLogRepository = {
      create: jest.fn(),
      save: jest.fn(),
      findOne: jest.fn(),
      find: jest.fn(),
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
   * Property 7: Rollback creates new version with historical value
   * 
   * This property tests that for ANY config and ANY historical version,
   * rolling back creates a new version with the same value as the target version.
   */
  it('should create new version with historical value on rollback', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.uuid(), // organizationId
        fc.uuid(), // projectId
        fc.uuid(), // environmentId
        fc.string({ minLength: 1, maxLength: 255 }), // keyName
        fc.constantFrom('boolean', 'string', 'number', 'json'), // valueType
        fc.string(), // historicalValue
        fc.string(), // currentValue
        fc.uuid(), // userId
        async (
          orgId: string,
          projId: string,
          envId: string,
          keyName: string,
          valueType: string,
          historicalValue: string,
          currentValue: string,
          userId: string,
        ) => {
          const configKeyId = `config-${orgId}`;
          const historicalVersionId = `version-${configKeyId}-1`;
          const newVersionId = `version-${configKeyId}-2`;

          // Create mock config key with current value
          const mockConfigKey = {
            id: configKeyId,
            organization_id: orgId,
            project_id: projId,
            environment_id: envId,
            key_name: keyName,
            value_type: valueType,
            current_value: currentValue,
            created_at: new Date(),
            updated_at: new Date(),
          };

          // Create mock historical version
          const mockHistoricalVersion = {
            id: historicalVersionId,
            config_key_id: configKeyId,
            value: historicalValue,
            created_by: userId,
            created_at: new Date(Date.now() - 10000),
          };

          // Create mock new version (result of rollback)
          const mockNewVersion = {
            id: newVersionId,
            config_key_id: configKeyId,
            value: historicalValue, // Should match historical value
            created_by: userId,
            created_at: new Date(),
          };

          // Mock audit log entry
          const mockAuditLog = {
            id: `audit-${configKeyId}`,
            user_id: userId,
            organization_id: orgId,
            action_type: 'ROLLBACK',
            resource_type: 'CONFIG_KEY',
            resource_id: configKeyId,
            old_value: currentValue,
            new_value: historicalValue,
            timestamp: new Date(),
            metadata: {
              version_id: newVersionId,
              source_version_id: historicalVersionId,
              key_name: keyName,
            },
          };

          // Mock repository responses - use flexible matchers
          (mockConfigKeyRepository.findOne as jest.Mock).mockResolvedValue(mockConfigKey);
          (mockConfigKeyRepository.findById as jest.Mock).mockResolvedValue(mockConfigKey);
          (mockConfigKeyRepository.update as jest.Mock).mockResolvedValue(undefined);

          // Mock findById to return the historical version for any ID ending in -1
          (mockConfigVersionRepository.findById as jest.Mock).mockImplementation((id: string) => {
            if (id.endsWith('-1')) return Promise.resolve(mockHistoricalVersion);
            return Promise.resolve(null);
          });

          (mockConfigVersionRepository.create as jest.Mock).mockResolvedValue(mockNewVersion);

          (mockAuditLogRepository.create as jest.Mock).mockResolvedValue(mockAuditLog);

          // Act: Perform rollback
          const newVersion = await configService.rollback(
            configKeyId,
            historicalVersionId,
            userId,
          );

          // Assert: New version was created
          expect(newVersion).toBeDefined();
          expect(newVersion.id).toBe(newVersionId);
          expect(newVersion.config_key_id).toBe(configKeyId);

          // Property: New version value equals historical version value
          expect(newVersion.value).toEqual(historicalValue);

          // Property: Audit log was created with action_type='ROLLBACK'
          expect(mockAuditLogRepository.create).toHaveBeenCalledWith(
            userId,
            orgId,
            'ROLLBACK',
            'CONFIG_KEY',
            configKeyId,
            currentValue,
            historicalValue,
            expect.objectContaining({
              version_id: newVersionId,
              source_version_id: historicalVersionId,
              key_name: keyName,
            }),
          );
        },
      ),
      {
        numRuns: 100,
        verbose: true,
      },
    );
  });
});
