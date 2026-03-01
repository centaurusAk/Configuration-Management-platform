import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  ConfigKeyRepository,
  ConfigVersionRepository,
  AuditLogRepository,
} from './index';
import { ConfigKey, ConfigVersion, AuditLog } from '../entities';

describe('Repository Tests', () => {
  describe('ConfigKeyRepository', () => {
    let repository: ConfigKeyRepository;
    let mockRepository: Partial<Repository<ConfigKey>>;

    beforeEach(async () => {
      mockRepository = {
        create: jest.fn(),
        save: jest.fn(),
        findOne: jest.fn(),
        find: jest.fn(),
        update: jest.fn(),
        softDelete: jest.fn(),
        restore: jest.fn(),
      };

      const module: TestingModule = await Test.createTestingModule({
        providers: [
          ConfigKeyRepository,
          {
            provide: getRepositoryToken(ConfigKey),
            useValue: mockRepository,
          },
        ],
      }).compile();

      repository = module.get<ConfigKeyRepository>(ConfigKeyRepository);
    });

    it('should be defined', () => {
      expect(repository).toBeDefined();
    });

    it('should create a config key', async () => {
      const mockConfigKey = {
        id: '123',
        organization_id: 'org1',
        project_id: 'proj1',
        environment_id: 'env1',
        key_name: 'test.key',
        value_type: 'string' as const,
        current_value: 'test value',
        created_at: new Date(),
        updated_at: new Date(),
      };

      (mockRepository.create as jest.Mock).mockReturnValue(mockConfigKey);
      (mockRepository.save as jest.Mock).mockResolvedValue(mockConfigKey);

      const result = await repository.create(
        'org1',
        'proj1',
        'env1',
        'test.key',
        'string',
        'test value',
      );

      expect(result).toEqual(mockConfigKey);
      expect(mockRepository.create).toHaveBeenCalled();
      expect(mockRepository.save).toHaveBeenCalled();
    });

    it('should soft delete a config key', async () => {
      (mockRepository.softDelete as jest.Mock).mockResolvedValue({ affected: 1 });

      await repository.softDelete('123');

      expect(mockRepository.softDelete).toHaveBeenCalledWith('123');
    });
  });

  describe('ConfigVersionRepository', () => {
    let repository: ConfigVersionRepository;
    let mockRepository: Partial<Repository<ConfigVersion>>;

    beforeEach(async () => {
      mockRepository = {
        create: jest.fn(),
        save: jest.fn(),
        findOne: jest.fn(),
        find: jest.fn(),
        count: jest.fn(),
      };

      const module: TestingModule = await Test.createTestingModule({
        providers: [
          ConfigVersionRepository,
          {
            provide: getRepositoryToken(ConfigVersion),
            useValue: mockRepository,
          },
        ],
      }).compile();

      repository = module.get<ConfigVersionRepository>(ConfigVersionRepository);
    });

    it('should be defined', () => {
      expect(repository).toBeDefined();
    });

    it('should create a config version (append-only)', async () => {
      const mockVersion = {
        id: 'v1',
        config_key_id: 'key1',
        value: 'new value',
        created_by: 'user1',
        created_at: new Date(),
      };

      (mockRepository.create as jest.Mock).mockReturnValue(mockVersion);
      (mockRepository.save as jest.Mock).mockResolvedValue(mockVersion);

      const result = await repository.create('key1', 'new value', 'user1');

      expect(result).toEqual(mockVersion);
      expect(mockRepository.create).toHaveBeenCalled();
      expect(mockRepository.save).toHaveBeenCalled();
    });

    it('should find versions in reverse chronological order', async () => {
      const mockVersions = [
        {
          id: 'v2',
          config_key_id: 'key1',
          value: 'newer value',
          created_by: 'user1',
          created_at: new Date('2024-01-02'),
        },
        {
          id: 'v1',
          config_key_id: 'key1',
          value: 'older value',
          created_by: 'user1',
          created_at: new Date('2024-01-01'),
        },
      ];

      (mockRepository.find as jest.Mock).mockResolvedValue(mockVersions);

      const result = await repository.findByConfigKey('key1');

      expect(result).toEqual(mockVersions);
      expect(mockRepository.find).toHaveBeenCalledWith({
        where: { config_key_id: 'key1' },
        order: { created_at: 'DESC' },
      });
    });

    it('should not have update or delete methods', () => {
      expect((repository as any).update).toBeUndefined();
      expect((repository as any).delete).toBeUndefined();
    });
  });

  describe('AuditLogRepository', () => {
    let repository: AuditLogRepository;
    let mockRepository: Partial<Repository<AuditLog>>;

    beforeEach(async () => {
      mockRepository = {
        create: jest.fn(),
        save: jest.fn(),
        findOne: jest.fn(),
        find: jest.fn(),
      };

      const module: TestingModule = await Test.createTestingModule({
        providers: [
          AuditLogRepository,
          {
            provide: getRepositoryToken(AuditLog),
            useValue: mockRepository,
          },
        ],
      }).compile();

      repository = module.get<AuditLogRepository>(AuditLogRepository);
    });

    it('should be defined', () => {
      expect(repository).toBeDefined();
    });

    it('should create an audit log entry (append-only)', async () => {
      const mockAuditLog = {
        id: 'audit1',
        timestamp: new Date(),
        user_id: 'user1',
        organization_id: 'org1',
        action_type: 'CREATE' as const,
        resource_type: 'CONFIG_KEY' as const,
        resource_id: 'key1',
        old_value: null,
        new_value: { value: 'test' },
      };

      (mockRepository.create as jest.Mock).mockReturnValue(mockAuditLog);
      (mockRepository.save as jest.Mock).mockResolvedValue(mockAuditLog);

      const result = await repository.create(
        'user1',
        'org1',
        'CREATE',
        'CONFIG_KEY',
        'key1',
        null,
        { value: 'test' },
      );

      expect(result).toEqual(mockAuditLog);
      expect(mockRepository.create).toHaveBeenCalled();
      expect(mockRepository.save).toHaveBeenCalled();
    });

    it('should query audit logs with filters', async () => {
      const mockLogs = [
        {
          id: 'audit1',
          timestamp: new Date(),
          user_id: 'user1',
          organization_id: 'org1',
          action_type: 'CREATE' as const,
          resource_type: 'CONFIG_KEY' as const,
          resource_id: 'key1',
        },
      ];

      (mockRepository.find as jest.Mock).mockResolvedValue(mockLogs);

      const result = await repository.query({
        userId: 'user1',
        actionType: 'CREATE',
      });

      expect(result).toEqual(mockLogs);
      expect(mockRepository.find).toHaveBeenCalled();
    });

    it('should not have update or delete methods', () => {
      expect((repository as any).update).toBeUndefined();
      expect((repository as any).delete).toBeUndefined();
    });
  });
});
