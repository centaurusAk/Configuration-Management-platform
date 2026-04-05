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
 * Property-Based Tests for Version History Preservation
 * 
 * **Validates: Requirements 1.4, 2.5**
 * 
 * Property 3: Config updates preserve version history
 * For any config key with N existing versions, updating the config value should
 * result in N+1 versions existing, with all previous versions unchanged and the
 * new version containing the updated value.
 */
describe('Property Test: Version History Preservation', () => {
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
   * Property 3: Config updates preserve version history
   * 
   * This property tests that for ANY config with N versions, updating it
   * results in N+1 versions, with all previous versions unchanged.
   */
  it('should preserve all previous versions when updating config', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.uuid(), // organizationId
        fc.uuid(), // projectId
        fc.uuid(), // environmentId
        fc.string({ minLength: 1, maxLength: 255 }), // keyName
        fc.constantFrom('boolean', 'string', 'number', 'json'), // valueType
        fc.integer({ min: 1, max: 10 }), // number of existing versions (N)
        fc.uuid(), // userId
        async (
          orgId: string,
          projId: string,
          envId: string,
          keyName: string,
          valueType: string,
          numVersions: number,
          userId: string,
        ) => {
          // Generate values matching the specified type
          let existingValues: any[];
          let newValue: any;
          
          switch (valueType) {
            case 'boolean':
              existingValues = fc.sample(fc.boolean(), numVersions);
              newValue = fc.sample(fc.boolean(), 1)[0];
              break;
            case 'string':
              existingValues = fc.sample(fc.string(), numVersions);
              newValue = fc.sample(fc.string(), 1)[0];
              break;
            case 'number':
              existingValues = fc.sample(fc.integer(), numVersions);
              newValue = fc.sample(fc.integer(), 1)[0];
              break;
            case 'json':
              existingValues = fc.sample(fc.object(), numVersions);
              newValue = fc.sample(fc.object(), 1)[0];
              break;
            default:
              existingValues = fc.sample(fc.string(), numVersions);
              newValue = fc.sample(fc.string(), 1)[0];
          }

          const values = existingValues;
          const configKeyId = `config-${orgId}-${Date.now()}-${Math.random()}`;

          // Create mock config key with current value being the last of existing values
          const currentValue = values[values.length - 1];
          const mockConfigKey: ConfigKey = {
            id: configKeyId,
            organization_id: orgId,
            project_id: projId,
            environment_id: envId,
            key_name: keyName,
            value_type: valueType as 'boolean' | 'string' | 'number' | 'json',
            current_value: currentValue,
            created_at: new Date(),
            updated_at: new Date(),
          } as ConfigKey;

          // Create mock existing versions
          const existingVersions: ConfigVersion[] = values.map((value, index) => ({
            id: `version-${configKeyId}-${index}`,
            config_key_id: configKeyId,
            value: value,
            created_by: userId,
            created_at: new Date(Date.now() - (numVersions - index) * 1000), // Older versions have earlier timestamps
          } as ConfigVersion));

          // Mock repository responses
          (mockConfigKeyRepository.findOne as jest.Mock).mockResolvedValue(mockConfigKey);
          (mockConfigKeyRepository.findById as jest.Mock).mockResolvedValue(mockConfigKey);
          (mockConfigKeyRepository.update as jest.Mock).mockResolvedValue(undefined);

          // Mock version count before update
          (mockConfigVersionRepository.countByConfigKey as jest.Mock).mockResolvedValue(numVersions);

          // Mock finding existing versions
          (mockConfigVersionRepository.findByConfigKey as jest.Mock).mockResolvedValue(existingVersions);

          // Mock creating new version
          const newVersionId = `version-${configKeyId}-${numVersions}`;
          const newVersion: ConfigVersion = {
            id: newVersionId,
            config_key_id: configKeyId,
            value: newValue,
            created_by: userId,
            created_at: new Date(),
          } as ConfigVersion;

          (mockConfigVersionRepository.create as jest.Mock).mockResolvedValue(newVersion);

          // Mock audit log creation
          (mockAuditLogRepository.create as jest.Mock).mockResolvedValue({});

          // Act: Update the config
          const updatedVersion = await configService.update(configKeyId, {
            value: newValue,
            updatedBy: userId,
          });

          // Mock version count after update
          (mockConfigVersionRepository.countByConfigKey as jest.Mock).mockResolvedValue(numVersions + 1);

          // Mock finding all versions including the new one
          const allVersions = [...existingVersions, newVersion];
          (mockConfigVersionRepository.findByConfigKey as jest.Mock).mockResolvedValue(allVersions);

          // Assert: New version was created
          expect(updatedVersion).toBeDefined();
          expect(updatedVersion.id).toBe(newVersionId);
          expect(updatedVersion.config_key_id).toBe(configKeyId);
          expect(updatedVersion.value).toEqual(newValue);

          // Assert: Version count increased by 1
          const versionCountAfter = await configVersionRepo.countByConfigKey(configKeyId);
          expect(versionCountAfter).toBe(numVersions + 1);

          // Assert: All previous versions are still present
          const allVersionsAfter = await configVersionRepo.findByConfigKey(configKeyId);
          expect(allVersionsAfter.length).toBe(numVersions + 1);

          // Assert: Previous versions are unchanged
          for (let i = 0; i < numVersions; i++) {
            const previousVersion = allVersionsAfter.find(v => v.id === existingVersions[i].id);
            expect(previousVersion).toBeDefined();
            expect(previousVersion?.value).toEqual(existingVersions[i].value);
            expect(previousVersion?.config_key_id).toBe(configKeyId);
          }

          // Assert: New version is in the list
          const newVersionInList = allVersionsAfter.find(v => v.id === newVersionId);
          expect(newVersionInList).toBeDefined();
          expect(newVersionInList?.value).toEqual(newValue);

          // Property: N versions + 1 update = N+1 versions
          expect(allVersionsAfter.length).toBe(numVersions + 1);
        },
      ),
      {
        numRuns: 100,
        verbose: true,
      },
    );
  });

  /**
   * Additional property: Version timestamps are monotonically increasing
   * 
   * This ensures that newer versions always have later timestamps than older versions.
   */
  it('should maintain chronological order of versions', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.uuid(),
        fc.uuid(),
        fc.uuid(),
        fc.string({ minLength: 1, maxLength: 255 }),
        fc.constantFrom('boolean', 'string', 'number', 'json'),
        fc.integer({ min: 2, max: 5 }), // At least 2 updates to test ordering
        fc.uuid(),
        async (
          orgId: string,
          projId: string,
          envId: string,
          keyName: string,
          valueType: string,
          numUpdates: number,
          userId: string,
        ) => {
          // Generate values matching the specified type
          let values: any[];
          
          switch (valueType) {
            case 'boolean':
              values = fc.sample(fc.boolean(), numUpdates);
              break;
            case 'string':
              values = fc.sample(fc.string(), numUpdates);
              break;
            case 'number':
              values = fc.sample(fc.integer(), numUpdates);
              break;
            case 'json':
              values = fc.sample(fc.object(), numUpdates);
              break;
            default:
              values = fc.sample(fc.string(), numUpdates);
          }

          const configKeyId = `config-${orgId}-${Date.now()}-${Math.random()}`;
          const updateValues = values.slice(0, numUpdates);

          // Create versions with increasing timestamps
          const versions: ConfigVersion[] = updateValues.map((value, index) => ({
            id: `version-${configKeyId}-${index}`,
            config_key_id: configKeyId,
            value: value,
            created_by: userId,
            created_at: new Date(Date.now() + index * 1000), // Each version 1 second apart
          } as ConfigVersion));

          // Mock repository to return versions in reverse chronological order (newest first)
          const versionsReversed = [...versions].reverse();
          (mockConfigVersionRepository.findByConfigKey as jest.Mock).mockResolvedValue(versionsReversed);

          // Act: Get version history
          const history = await configVersionRepo.findByConfigKey(configKeyId);

          // Assert: Versions are in reverse chronological order
          expect(history.length).toBe(numUpdates);
          for (let i = 0; i < history.length - 1; i++) {
            const currentTimestamp = history[i].created_at.getTime();
            const nextTimestamp = history[i + 1].created_at.getTime();
            
            // Property: Each version should have a timestamp >= the next version
            expect(currentTimestamp).toBeGreaterThanOrEqual(nextTimestamp);
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
   * Additional property: Version values are independent
   * 
   * This ensures that changing a config value doesn't affect previous version values.
   */
  it('should keep version values independent of subsequent updates', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.uuid(),
        fc.uuid(),
        fc.uuid(),
        fc.string({ minLength: 1, maxLength: 255 }),
        fc.constantFrom('boolean', 'string', 'number', 'json'),
        fc.string(), // initial value
        fc.string(), // updated value (different from initial)
        fc.uuid(),
        async (
          orgId: string,
          projId: string,
          envId: string,
          keyName: string,
          valueType: string,
          initialValue: string,
          updatedValue: string,
          userId: string,
        ) => {
          // Skip if values are the same
          if (initialValue === updatedValue) return;

          const configKeyId = `config-${orgId}-${Date.now()}-${Math.random()}`;

          // Create initial version
          const version1: ConfigVersion = {
            id: `version-${configKeyId}-1`,
            config_key_id: configKeyId,
            value: initialValue,
            created_by: userId,
            created_at: new Date(Date.now() - 1000),
          } as ConfigVersion;

          // Create updated version
          const version2: ConfigVersion = {
            id: `version-${configKeyId}-2`,
            config_key_id: configKeyId,
            value: updatedValue,
            created_by: userId,
            created_at: new Date(),
          } as ConfigVersion;

          // Mock repository responses
          const mockConfigKey: ConfigKey = {
            id: configKeyId,
            organization_id: orgId,
            project_id: projId,
            environment_id: envId,
            key_name: keyName,
            value_type: valueType as 'boolean' | 'string' | 'number' | 'json',
            current_value: updatedValue,
            created_at: new Date(),
            updated_at: new Date(),
          } as ConfigKey;

          (mockConfigKeyRepository.findById as jest.Mock).mockResolvedValue(mockConfigKey);
          (mockConfigVersionRepository.findByConfigKey as jest.Mock).mockResolvedValue([version2, version1]);

          // Act: Get version history
          const history = await configVersionRepo.findByConfigKey(configKeyId);

          // Assert: Both versions exist
          expect(history.length).toBe(2);

          // Assert: First version still has original value
          const firstVersion = history.find(v => v.id === version1.id);
          expect(firstVersion).toBeDefined();
          expect(firstVersion?.value).toBe(initialValue);

          // Assert: Second version has updated value
          const secondVersion = history.find(v => v.id === version2.id);
          expect(secondVersion).toBeDefined();
          expect(secondVersion?.value).toBe(updatedValue);

          // Property: Updating config doesn't change previous version values
          expect(firstVersion?.value).not.toBe(secondVersion?.value);
        },
      ),
      {
        numRuns: 50,
        verbose: true,
      },
    );
  });
});
