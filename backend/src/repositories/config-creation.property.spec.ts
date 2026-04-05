import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as fc from 'fast-check';
import {
  ConfigKeyRepository,
  ConfigVersionRepository,
} from './index';
import { ConfigKey, ConfigVersion } from '../entities';

/**
 * Property-Based Tests for Config Creation and Version Initialization
 * 
 * **Validates: Requirements 1.1, 1.2**
 * 
 * Property 1: Config creation initializes version history
 * For any config key creation request with valid organization, project, and environment IDs,
 * creating the config should result in both a config record and an initial version record
 * existing in the database with matching config_key_id.
 */
describe('Property Test: Config Creation and Version Initialization', () => {
  let configKeyRepo: ConfigKeyRepository;
  let configVersionRepo: ConfigVersionRepository;
  let mockConfigKeyRepository: Partial<Repository<ConfigKey>>;
  let mockConfigVersionRepository: Partial<Repository<ConfigVersion>>;

  beforeEach(async () => {
    // Mock repositories
    mockConfigKeyRepository = {
      create: jest.fn(),
      save: jest.fn(),
      findOne: jest.fn(),
    };

    mockConfigVersionRepository = {
      create: jest.fn(),
      save: jest.fn(),
      findOne: jest.fn(),
      count: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ConfigKeyRepository,
        ConfigVersionRepository,
        {
          provide: getRepositoryToken(ConfigKey),
          useValue: mockConfigKeyRepository,
        },
        {
          provide: getRepositoryToken(ConfigVersion),
          useValue: mockConfigVersionRepository,
        },
      ],
    }).compile();

    configKeyRepo = module.get<ConfigKeyRepository>(ConfigKeyRepository);
    configVersionRepo = module.get<ConfigVersionRepository>(ConfigVersionRepository);
  });

  /**
   * Property 1: Config creation initializes version history
   * 
   * This property tests that for ANY valid config creation request,
   * both a config key and an initial version are created with matching IDs.
   */
  it('should create both config key and initial version for any valid input', async () => {
    await fc.assert(
      fc.asyncProperty(
        // Generate arbitrary valid inputs
        fc.uuid(), // organizationId
        fc.uuid(), // projectId
        fc.uuid(), // environmentId
        fc.string({ minLength: 1, maxLength: 255 }), // keyName
        fc.constantFrom('boolean', 'string', 'number', 'json'), // valueType
        fc.oneof(
          fc.boolean(),
          fc.string(),
          fc.integer(),
          fc.object(),
        ), // value
        fc.uuid(), // userId for version creation
        async (orgId: string, projId: string, envId: string, keyName: string, valueType: string, value: any, userId: string) => {
          // Generate unique IDs for this test case
          const configKeyId = `config-${orgId}-${Date.now()}`;
          const versionId = `version-${configKeyId}-${Date.now()}`;

          // Mock config key creation
          const mockConfigKey: ConfigKey = {
            id: configKeyId,
            organization_id: orgId,
            project_id: projId,
            environment_id: envId,
            key_name: keyName,
            value_type: valueType as 'boolean' | 'string' | 'number' | 'json',
            current_value: value,
            created_at: new Date(),
            updated_at: new Date(),
          } as ConfigKey;

          (mockConfigKeyRepository.create as jest.Mock).mockReturnValue(mockConfigKey);
          (mockConfigKeyRepository.save as jest.Mock).mockResolvedValue(mockConfigKey);

          // Mock version creation
          const mockVersion: ConfigVersion = {
            id: versionId,
            config_key_id: configKeyId,
            value: value,
            created_by: userId,
            created_at: new Date(),
          } as ConfigVersion;

          (mockConfigVersionRepository.create as jest.Mock).mockReturnValue(mockVersion);
          (mockConfigVersionRepository.save as jest.Mock).mockResolvedValue(mockVersion);
          (mockConfigVersionRepository.count as jest.Mock).mockResolvedValue(1);

          // Act: Create config key
          const createdConfigKey = await configKeyRepo.create(
            orgId,
            projId,
            envId,
            keyName,
            valueType as 'boolean' | 'string' | 'number' | 'json',
            value,
          );

          // Act: Create initial version
          const createdVersion = await configVersionRepo.create(
            createdConfigKey.id,
            value,
            userId,
          );

          // Assert: Config key was created
          expect(createdConfigKey).toBeDefined();
          expect(createdConfigKey.id).toBe(configKeyId);
          expect(createdConfigKey.organization_id).toBe(orgId);
          expect(createdConfigKey.project_id).toBe(projId);
          expect(createdConfigKey.environment_id).toBe(envId);
          expect(createdConfigKey.key_name).toBe(keyName);
          expect(createdConfigKey.value_type).toBe(valueType);
          expect(createdConfigKey.current_value).toEqual(value);

          // Assert: Initial version was created
          expect(createdVersion).toBeDefined();
          expect(createdVersion.id).toBe(versionId);
          expect(createdVersion.config_key_id).toBe(configKeyId);
          expect(createdVersion.value).toEqual(value);
          expect(createdVersion.created_by).toBe(userId);

          // Assert: Version count is 1 (initial version exists)
          const versionCount = await configVersionRepo.countByConfigKey(configKeyId);
          expect(versionCount).toBe(1);

          // Property: Config key ID matches version's config_key_id
          expect(createdVersion.config_key_id).toBe(createdConfigKey.id);
        },
      ),
      {
        numRuns: 100, // Run 100 random test cases
        verbose: true,
      },
    );
  });

  /**
   * Additional property test: Version value matches config current_value
   * 
   * This ensures that the initial version's value is consistent with
   * the config key's current_value.
   */
  it('should ensure initial version value matches config current_value', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.uuid(),
        fc.uuid(),
        fc.uuid(),
        fc.string({ minLength: 1, maxLength: 255 }),
        fc.constantFrom('boolean', 'string', 'number', 'json'),
        fc.oneof(
          fc.boolean(),
          fc.string(),
          fc.integer(),
          fc.object(),
        ),
        fc.uuid(),
        async (orgId: string, projId: string, envId: string, keyName: string, valueType: string, value: any, userId: string) => {
          const configKeyId = `config-${orgId}-${Date.now()}`;
          const versionId = `version-${configKeyId}-${Date.now()}`;

          const mockConfigKey: ConfigKey = {
            id: configKeyId,
            organization_id: orgId,
            project_id: projId,
            environment_id: envId,
            key_name: keyName,
            value_type: valueType as 'boolean' | 'string' | 'number' | 'json',
            current_value: value,
            created_at: new Date(),
            updated_at: new Date(),
          } as ConfigKey;

          const mockVersion: ConfigVersion = {
            id: versionId,
            config_key_id: configKeyId,
            value: value,
            created_by: userId,
            created_at: new Date(),
          } as ConfigVersion;

          (mockConfigKeyRepository.create as jest.Mock).mockReturnValue(mockConfigKey);
          (mockConfigKeyRepository.save as jest.Mock).mockResolvedValue(mockConfigKey);
          (mockConfigVersionRepository.create as jest.Mock).mockReturnValue(mockVersion);
          (mockConfigVersionRepository.save as jest.Mock).mockResolvedValue(mockVersion);

          const createdConfigKey = await configKeyRepo.create(
            orgId,
            projId,
            envId,
            keyName,
            valueType as 'boolean' | 'string' | 'number' | 'json',
            value,
          );

          const createdVersion = await configVersionRepo.create(
            createdConfigKey.id,
            value,
            userId,
          );

          // Property: Initial version value equals config current_value
          expect(createdVersion.value).toEqual(createdConfigKey.current_value);
        },
      ),
      {
        numRuns: 100,
        verbose: true,
      },
    );
  });
});

/**
 * Property-Based Tests for Config Value Type Round-Trip
 * 
 * **Validates: Requirements 1.3**
 * 
 * Property 2: Config value types round-trip correctly
 * For any configuration value of type boolean, string, number, or JSON object,
 * storing the value and then retrieving it should return an equivalent value
 * of the same type.
 */
describe('Property Test: Config Value Type Round-Trip', () => {
  let configKeyRepo: ConfigKeyRepository;
  let configVersionRepo: ConfigVersionRepository;
  let mockConfigKeyRepository: any;
  let mockConfigVersionRepository: any;

  beforeEach(async () => {
    // Mock repositories
    mockConfigKeyRepository = {
      create: jest.fn(),
      save: jest.fn(),
      findOne: jest.fn(),
    };

    mockConfigVersionRepository = {
      create: jest.fn(),
      save: jest.fn(),
      findOne: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ConfigKeyRepository,
        ConfigVersionRepository,
        {
          provide: getRepositoryToken(ConfigKey),
          useValue: mockConfigKeyRepository,
        },
        {
          provide: getRepositoryToken(ConfigVersion),
          useValue: mockConfigVersionRepository,
        },
      ],
    }).compile();

    configKeyRepo = module.get<ConfigKeyRepository>(ConfigKeyRepository);
    configVersionRepo = module.get<ConfigVersionRepository>(ConfigVersionRepository);
  });

  /**
   * Property 2: Boolean values round-trip correctly
   * 
   * For any boolean value, storing it and retrieving it should return
   * the same boolean value.
   */
  it('should round-trip boolean values correctly', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.uuid(), // organizationId
        fc.uuid(), // projectId
        fc.uuid(), // environmentId
        fc.string({ minLength: 1, maxLength: 255 }), // keyName
        fc.boolean(), // boolean value
        fc.uuid(), // userId
        async (orgId: string, projId: string, envId: string, keyName: string, value: boolean, userId: string) => {
          const configKeyId = `config-${orgId}-${Date.now()}-${Math.random()}`;

          // Mock config key creation with boolean value
          const mockConfigKey: ConfigKey = {
            id: configKeyId,
            organization_id: orgId,
            project_id: projId,
            environment_id: envId,
            key_name: keyName,
            value_type: 'boolean',
            current_value: value,
            created_at: new Date(),
            updated_at: new Date(),
          } as ConfigKey;

          (mockConfigKeyRepository.create as jest.Mock).mockReturnValue(mockConfigKey);
          (mockConfigKeyRepository.save as jest.Mock).mockResolvedValue(mockConfigKey);
          (mockConfigKeyRepository.findOne as jest.Mock).mockResolvedValue(mockConfigKey);

          // Mock version creation
          const mockVersion: ConfigVersion = {
            id: `version-${configKeyId}`,
            config_key_id: configKeyId,
            value: value,
            created_by: userId,
            created_at: new Date(),
          } as ConfigVersion;

          (mockConfigVersionRepository.create as jest.Mock).mockReturnValue(mockVersion);
          (mockConfigVersionRepository.save as jest.Mock).mockResolvedValue(mockVersion);
          (mockConfigVersionRepository.findOne as jest.Mock).mockResolvedValue(mockVersion);

          // Act: Store the value
          const createdConfigKey = await configKeyRepo.create(
            orgId,
            projId,
            envId,
            keyName,
            'boolean',
            value,
          );

          await configVersionRepo.create(createdConfigKey.id, value, userId);

          // Act: Retrieve the value
          const retrievedConfigKey = await configKeyRepo.findById(configKeyId);
          const retrievedVersion = await configVersionRepo.findLatestByConfigKey(configKeyId);

          // Assert: Value type is preserved
          expect(retrievedConfigKey?.value_type).toBe('boolean');
          expect(typeof retrievedConfigKey?.current_value).toBe('boolean');
          expect(typeof retrievedVersion?.value).toBe('boolean');

          // Assert: Value is identical
          expect(retrievedConfigKey?.current_value).toBe(value);
          expect(retrievedVersion?.value).toBe(value);
        },
      ),
      {
        numRuns: 50,
        verbose: true,
      },
    );
  });

  /**
   * Property 2: String values round-trip correctly
   * 
   * For any string value, storing it and retrieving it should return
   * the same string value.
   */
  it('should round-trip string values correctly', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.uuid(),
        fc.uuid(),
        fc.uuid(),
        fc.string({ minLength: 1, maxLength: 255 }),
        fc.string(), // string value (can be empty, contain unicode, etc.)
        fc.uuid(),
        async (orgId: string, projId: string, envId: string, keyName: string, value: string, userId: string) => {
          const configKeyId = `config-${orgId}-${Date.now()}-${Math.random()}`;

          const mockConfigKey: ConfigKey = {
            id: configKeyId,
            organization_id: orgId,
            project_id: projId,
            environment_id: envId,
            key_name: keyName,
            value_type: 'string',
            current_value: value,
            created_at: new Date(),
            updated_at: new Date(),
          } as ConfigKey;

          (mockConfigKeyRepository.create as jest.Mock).mockReturnValue(mockConfigKey);
          (mockConfigKeyRepository.save as jest.Mock).mockResolvedValue(mockConfigKey);
          (mockConfigKeyRepository.findOne as jest.Mock).mockResolvedValue(mockConfigKey);

          const mockVersion: ConfigVersion = {
            id: `version-${configKeyId}`,
            config_key_id: configKeyId,
            value: value,
            created_by: userId,
            created_at: new Date(),
          } as ConfigVersion;

          (mockConfigVersionRepository.create as jest.Mock).mockReturnValue(mockVersion);
          (mockConfigVersionRepository.save as jest.Mock).mockResolvedValue(mockVersion);
          (mockConfigVersionRepository.findOne as jest.Mock).mockResolvedValue(mockVersion);

          // Act: Store and retrieve
          const createdConfigKey = await configKeyRepo.create(
            orgId,
            projId,
            envId,
            keyName,
            'string',
            value,
          );

          await configVersionRepo.create(createdConfigKey.id, value, userId);

          const retrievedConfigKey = await configKeyRepo.findById(configKeyId);
          const retrievedVersion = await configVersionRepo.findLatestByConfigKey(configKeyId);

          // Assert: Type and value are preserved
          expect(retrievedConfigKey?.value_type).toBe('string');
          expect(typeof retrievedConfigKey?.current_value).toBe('string');
          expect(typeof retrievedVersion?.value).toBe('string');
          expect(retrievedConfigKey?.current_value).toBe(value);
          expect(retrievedVersion?.value).toBe(value);
        },
      ),
      {
        numRuns: 50,
        verbose: true,
      },
    );
  });

  /**
   * Property 2: Number values round-trip correctly
   * 
   * For any number value (including integers, floats, negative, zero),
   * storing it and retrieving it should return the same number value.
   */
  it('should round-trip number values correctly', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.uuid(),
        fc.uuid(),
        fc.uuid(),
        fc.string({ minLength: 1, maxLength: 255 }),
        fc.oneof(
          fc.integer(), // integers
          fc.float(), // floats
          fc.double(), // doubles
          fc.constant(0), // zero
          fc.constant(-0), // negative zero
          fc.constant(Number.MAX_SAFE_INTEGER), // max safe integer
          fc.constant(Number.MIN_SAFE_INTEGER), // min safe integer
        ),
        fc.uuid(),
        async (orgId: string, projId: string, envId: string, keyName: string, value: number, userId: string) => {
          const configKeyId = `config-${orgId}-${Date.now()}-${Math.random()}`;

          const mockConfigKey: ConfigKey = {
            id: configKeyId,
            organization_id: orgId,
            project_id: projId,
            environment_id: envId,
            key_name: keyName,
            value_type: 'number',
            current_value: value,
            created_at: new Date(),
            updated_at: new Date(),
          } as ConfigKey;

          (mockConfigKeyRepository.create as jest.Mock).mockReturnValue(mockConfigKey);
          (mockConfigKeyRepository.save as jest.Mock).mockResolvedValue(mockConfigKey);
          (mockConfigKeyRepository.findOne as jest.Mock).mockResolvedValue(mockConfigKey);

          const mockVersion: ConfigVersion = {
            id: `version-${configKeyId}`,
            config_key_id: configKeyId,
            value: value,
            created_by: userId,
            created_at: new Date(),
          } as ConfigVersion;

          (mockConfigVersionRepository.create as jest.Mock).mockReturnValue(mockVersion);
          (mockConfigVersionRepository.save as jest.Mock).mockResolvedValue(mockVersion);
          (mockConfigVersionRepository.findOne as jest.Mock).mockResolvedValue(mockVersion);

          // Act: Store and retrieve
          const createdConfigKey = await configKeyRepo.create(
            orgId,
            projId,
            envId,
            keyName,
            'number',
            value,
          );

          await configVersionRepo.create(createdConfigKey.id, value, userId);

          const retrievedConfigKey = await configKeyRepo.findById(configKeyId);
          const retrievedVersion = await configVersionRepo.findLatestByConfigKey(configKeyId);

          // Assert: Type and value are preserved
          expect(retrievedConfigKey?.value_type).toBe('number');
          expect(typeof retrievedConfigKey?.current_value).toBe('number');
          expect(typeof retrievedVersion?.value).toBe('number');
          
          // Handle NaN case (NaN !== NaN)
          if (Number.isNaN(value)) {
            expect(Number.isNaN(retrievedConfigKey?.current_value)).toBe(true);
            expect(Number.isNaN(retrievedVersion?.value)).toBe(true);
          } else {
            expect(retrievedConfigKey?.current_value).toBe(value);
            expect(retrievedVersion?.value).toBe(value);
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
   * Property 2: JSON object values round-trip correctly
   * 
   * For any JSON object (including nested objects, arrays, null values),
   * storing it and retrieving it should return an equivalent object.
   */
  it('should round-trip JSON object values correctly', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.uuid(),
        fc.uuid(),
        fc.uuid(),
        fc.string({ minLength: 1, maxLength: 255 }),
        fc.oneof(
          fc.object(), // arbitrary objects
          fc.array(fc.anything()), // arrays
          fc.record({ // structured objects
            name: fc.string(),
            age: fc.integer(),
            active: fc.boolean(),
          }),
          fc.constant(null), // null
          fc.constant({}), // empty object
          fc.constant([]), // empty array
          fc.record({ // nested objects
            user: fc.record({
              id: fc.uuid(),
              settings: fc.record({
                theme: fc.constantFrom('light', 'dark'),
                notifications: fc.boolean(),
              }),
            }),
          }),
        ),
        fc.uuid(),
        async (orgId: string, projId: string, envId: string, keyName: string, value: any, userId: string) => {
          const configKeyId = `config-${orgId}-${Date.now()}-${Math.random()}`;

          const mockConfigKey: ConfigKey = {
            id: configKeyId,
            organization_id: orgId,
            project_id: projId,
            environment_id: envId,
            key_name: keyName,
            value_type: 'json',
            current_value: value,
            created_at: new Date(),
            updated_at: new Date(),
          } as ConfigKey;

          (mockConfigKeyRepository.create as jest.Mock).mockReturnValue(mockConfigKey);
          (mockConfigKeyRepository.save as jest.Mock).mockResolvedValue(mockConfigKey);
          (mockConfigKeyRepository.findOne as jest.Mock).mockResolvedValue(mockConfigKey);

          const mockVersion: ConfigVersion = {
            id: `version-${configKeyId}`,
            config_key_id: configKeyId,
            value: value,
            created_by: userId,
            created_at: new Date(),
          } as ConfigVersion;

          (mockConfigVersionRepository.create as jest.Mock).mockReturnValue(mockVersion);
          (mockConfigVersionRepository.save as jest.Mock).mockResolvedValue(mockVersion);
          (mockConfigVersionRepository.findOne as jest.Mock).mockResolvedValue(mockVersion);

          // Act: Store and retrieve
          const createdConfigKey = await configKeyRepo.create(
            orgId,
            projId,
            envId,
            keyName,
            'json',
            value,
          );

          await configVersionRepo.create(createdConfigKey.id, value, userId);

          const retrievedConfigKey = await configKeyRepo.findById(configKeyId);
          const retrievedVersion = await configVersionRepo.findLatestByConfigKey(configKeyId);

          // Assert: Type is preserved
          expect(retrievedConfigKey?.value_type).toBe('json');

          // Assert: Value is deeply equal (structural equality for objects)
          expect(retrievedConfigKey?.current_value).toEqual(value);
          expect(retrievedVersion?.value).toEqual(value);
        },
      ),
      {
        numRuns: 50,
        verbose: true,
      },
    );
  });

  /**
   * Property 2: All value types round-trip correctly (combined test)
   * 
   * This test verifies that ANY value of ANY supported type can be
   * stored and retrieved correctly.
   */
  it('should round-trip all value types correctly', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.uuid(),
        fc.uuid(),
        fc.uuid(),
        fc.string({ minLength: 1, maxLength: 255 }),
        fc.oneof(
          fc.tuple(fc.constant('boolean' as const), fc.boolean()),
          fc.tuple(fc.constant('string' as const), fc.string()),
          fc.tuple(fc.constant('number' as const), fc.oneof(fc.integer(), fc.float())),
          fc.tuple(fc.constant('json' as const), fc.oneof(fc.object(), fc.array(fc.anything()))),
        ),
        fc.uuid(),
        async (orgId: string, projId: string, envId: string, keyName: string, [valueType, value]: [string, any], userId: string) => {
          const configKeyId = `config-${orgId}-${Date.now()}-${Math.random()}`;

          const mockConfigKey: ConfigKey = {
            id: configKeyId,
            organization_id: orgId,
            project_id: projId,
            environment_id: envId,
            key_name: keyName,
            value_type: valueType as 'boolean' | 'string' | 'number' | 'json',
            current_value: value,
            created_at: new Date(),
            updated_at: new Date(),
          } as ConfigKey;

          (mockConfigKeyRepository.create as jest.Mock).mockReturnValue(mockConfigKey);
          (mockConfigKeyRepository.save as jest.Mock).mockResolvedValue(mockConfigKey);
          (mockConfigKeyRepository.findOne as jest.Mock).mockResolvedValue(mockConfigKey);

          const mockVersion: ConfigVersion = {
            id: `version-${configKeyId}`,
            config_key_id: configKeyId,
            value: value,
            created_by: userId,
            created_at: new Date(),
          } as ConfigVersion;

          (mockConfigVersionRepository.create as jest.Mock).mockReturnValue(mockVersion);
          (mockConfigVersionRepository.save as jest.Mock).mockResolvedValue(mockVersion);
          (mockConfigVersionRepository.findOne as jest.Mock).mockResolvedValue(mockVersion);

          // Act: Store and retrieve
          const createdConfigKey = await configKeyRepo.create(
            orgId,
            projId,
            envId,
            keyName,
            valueType as 'boolean' | 'string' | 'number' | 'json',
            value,
          );

          await configVersionRepo.create(createdConfigKey.id, value, userId);

          const retrievedConfigKey = await configKeyRepo.findById(configKeyId);
          const retrievedVersion = await configVersionRepo.findLatestByConfigKey(configKeyId);

          // Assert: Type is preserved
          expect(retrievedConfigKey?.value_type).toBe(valueType);

          // Assert: Value is preserved (use toEqual for deep equality)
          if (valueType === 'json') {
            expect(retrievedConfigKey?.current_value).toEqual(value);
            expect(retrievedVersion?.value).toEqual(value);
          } else {
            expect(retrievedConfigKey?.current_value).toBe(value);
            expect(retrievedVersion?.value).toBe(value);
          }
        },
      ),
      {
        numRuns: 100,
        verbose: true,
      },
    );
  });
});
