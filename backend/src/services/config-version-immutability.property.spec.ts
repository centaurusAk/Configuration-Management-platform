import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as fc from 'fast-check';
import { ConfigVersionRepository } from '../repositories/config-version.repository';
import { ConfigVersion } from '../entities';

/**
 * Property-Based Tests for Version Immutability
 * 
 * **Validates: Requirements 2.5**
 * 
 * Property 8: Version records are immutable
 * For any existing config_version record, attempting to update or delete it
 * should fail with an error.
 */
describe('Property Test: Version Immutability', () => {
  let configVersionRepo: ConfigVersionRepository;
  let mockConfigVersionRepository: any;

  beforeEach(async () => {
    // Mock repository
    mockConfigVersionRepository = {
      create: jest.fn(),
      save: jest.fn(),
      findOne: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      remove: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ConfigVersionRepository,
        {
          provide: getRepositoryToken(ConfigVersion),
          useValue: mockConfigVersionRepository,
        },
      ],
    }).compile();

    configVersionRepo = module.get<ConfigVersionRepository>(ConfigVersionRepository);
  });

  /**
   * Property 8: Version records cannot be updated
   * 
   * This property tests that for ANY existing version, attempting to update
   * it should fail. The repository intentionally does not provide an update method.
   */
  it('should not provide update method for version records', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.uuid(), // versionId
        fc.uuid(), // configKeyId
        fc.oneof(fc.boolean(), fc.string(), fc.integer(), fc.object()), // original value
        fc.oneof(fc.boolean(), fc.string(), fc.integer(), fc.object()), // new value (different)
        fc.uuid(), // userId
        async (
          versionId: string,
          configKeyId: string,
          originalValue: any,
          newValue: any,
          userId: string,
        ) => {
          // Create a mock version
          const mockVersion: ConfigVersion = {
            id: versionId,
            config_key_id: configKeyId,
            value: originalValue,
            created_by: userId,
            created_at: new Date(),
          } as ConfigVersion;

          (mockConfigVersionRepository.findOne as jest.Mock).mockResolvedValue(mockVersion);

          // Property: ConfigVersionRepository should NOT have an update method
          expect((configVersionRepo as any).update).toBeUndefined();

          // Property: Attempting to call update on the underlying repository should be blocked
          // In a real database, this would be prevented by triggers
          // Here we verify the repository doesn't expose update functionality
          const hasUpdateMethod = typeof (configVersionRepo as any).update === 'function';
          expect(hasUpdateMethod).toBe(false);
        },
      ),
      {
        numRuns: 100,
        verbose: true,
      },
    );
  });

  /**
   * Property 8: Version records cannot be deleted
   * 
   * This property tests that for ANY existing version, attempting to delete
   * it should fail. The repository intentionally does not provide a delete method.
   */
  it('should not provide delete method for version records', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.uuid(), // versionId
        fc.uuid(), // configKeyId
        fc.oneof(fc.boolean(), fc.string(), fc.integer(), fc.object()), // value
        fc.uuid(), // userId
        async (
          versionId: string,
          configKeyId: string,
          value: any,
          userId: string,
        ) => {
          // Create a mock version
          const mockVersion: ConfigVersion = {
            id: versionId,
            config_key_id: configKeyId,
            value: value,
            created_by: userId,
            created_at: new Date(),
          } as ConfigVersion;

          (mockConfigVersionRepository.findOne as jest.Mock).mockResolvedValue(mockVersion);

          // Property: ConfigVersionRepository should NOT have a delete method
          expect((configVersionRepo as any).delete).toBeUndefined();
          expect((configVersionRepo as any).remove).toBeUndefined();
          expect((configVersionRepo as any).softDelete).toBeUndefined();

          // Property: Repository doesn't expose delete functionality
          const hasDeleteMethod = typeof (configVersionRepo as any).delete === 'function';
          const hasRemoveMethod = typeof (configVersionRepo as any).remove === 'function';
          const hasSoftDeleteMethod = typeof (configVersionRepo as any).softDelete === 'function';

          expect(hasDeleteMethod).toBe(false);
          expect(hasRemoveMethod).toBe(false);
          expect(hasSoftDeleteMethod).toBe(false);
        },
      ),
      {
        numRuns: 100,
        verbose: true,
      },
    );
  });

  /**
   * Property 8: Only create operation is allowed
   * 
   * This property verifies that the ConfigVersionRepository only exposes
   * read and create operations, enforcing the append-only pattern.
   */
  it('should only allow create and read operations', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.uuid(), // configKeyId
        fc.oneof(fc.boolean(), fc.string(), fc.integer(), fc.object()), // value
        fc.uuid(), // userId
        async (
          configKeyId: string,
          value: any,
          userId: string,
        ) => {
          const versionId = `version-${configKeyId}-${Date.now()}`;

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
          (mockConfigVersionRepository.findOne as jest.Mock).mockResolvedValue(mockVersion);

          // Property: Create operation should work
          const createdVersion = await configVersionRepo.create(
            configKeyId,
            value,
            userId,
          );
          expect(createdVersion).toBeDefined();
          expect(createdVersion.id).toBe(versionId);

          // Property: Read operations should work
          const foundVersion = await configVersionRepo.findById(versionId);
          expect(foundVersion).toBeDefined();

          // Property: Write operations (update, delete) should NOT be available
          const allowedMethods = ['create', 'findById', 'findByConfigKey', 'findLatestByConfigKey', 'countByConfigKey'];
          const disallowedMethods = ['update', 'delete', 'remove', 'softDelete', 'restore'];

          // Check that allowed methods exist
          for (const method of allowedMethods) {
            expect(typeof (configVersionRepo as any)[method]).toBe('function');
          }

          // Check that disallowed methods do NOT exist
          for (const method of disallowedMethods) {
            expect((configVersionRepo as any)[method]).toBeUndefined();
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
   * Additional property: Version created_at timestamp is immutable
   * 
   * This ensures that once a version is created, its timestamp cannot be changed.
   */
  it('should preserve created_at timestamp immutably', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.uuid(),
        fc.uuid(),
        fc.oneof(fc.boolean(), fc.string(), fc.integer()),
        fc.uuid(),
        async (
          versionId: string,
          configKeyId: string,
          value: any,
          userId: string,
        ) => {
          const originalTimestamp = new Date('2024-01-01T00:00:00Z');

          // Create a mock version with a specific timestamp
          const mockVersion: ConfigVersion = {
            id: versionId,
            config_key_id: configKeyId,
            value: value,
            created_by: userId,
            created_at: originalTimestamp,
          } as ConfigVersion;

          (mockConfigVersionRepository.findOne as jest.Mock).mockResolvedValue(mockVersion);

          // Retrieve the version
          const retrievedVersion = await configVersionRepo.findById(versionId);

          // Property: Timestamp should be exactly the same
          expect(retrievedVersion?.created_at).toEqual(originalTimestamp);

          // Property: No method exists to modify the timestamp
          expect((configVersionRepo as any).updateTimestamp).toBeUndefined();
          expect((configVersionRepo as any).setCreatedAt).toBeUndefined();
        },
      ),
      {
        numRuns: 50,
        verbose: true,
      },
    );
  });

  /**
   * Additional property: Version value is immutable
   * 
   * This ensures that once a version is created with a value, that value
   * cannot be changed.
   */
  it('should preserve version value immutably', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.uuid(),
        fc.uuid(),
        fc.oneof(
          fc.boolean(),
          fc.string(),
          fc.integer(),
          fc.record({
            name: fc.string(),
            count: fc.integer(),
          }),
        ),
        fc.uuid(),
        async (
          versionId: string,
          configKeyId: string,
          originalValue: any,
          userId: string,
        ) => {
          // Create a mock version
          const mockVersion: ConfigVersion = {
            id: versionId,
            config_key_id: configKeyId,
            value: originalValue,
            created_by: userId,
            created_at: new Date(),
          } as ConfigVersion;

          (mockConfigVersionRepository.findOne as jest.Mock).mockResolvedValue(mockVersion);

          // Retrieve the version
          const retrievedVersion = await configVersionRepo.findById(versionId);

          // Property: Value should be exactly the same
          expect(retrievedVersion?.value).toEqual(originalValue);

          // Property: No method exists to modify the value
          expect((configVersionRepo as any).updateValue).toBeUndefined();
          expect((configVersionRepo as any).setValue).toBeUndefined();
          expect((configVersionRepo as any).changeValue).toBeUndefined();
        },
      ),
      {
        numRuns: 50,
        verbose: true,
      },
    );
  });
});
