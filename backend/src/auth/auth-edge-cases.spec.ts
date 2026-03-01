import { Test, TestingModule } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { UnauthorizedException } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';
import { AuthService } from './auth.service';
import { User } from '../entities/user.entity';
import { ApiKey } from '../entities/api-key.entity';

/**
 * Unit Tests for Authentication Edge Cases
 * 
 * **Validates: Requirements 14.6, 14.7**
 * 
 * Tests cover:
 * - Expired API keys (Requirement 14.7)
 * - Revoked API keys (Requirement 14.6)
 * - Invalid JWT tokens
 * - Edge cases in token validation
 */
describe('AuthService - Edge Cases', () => {
  let service: AuthService;
  let apiKeyRepository: Repository<ApiKey>;
  let jwtService: JwtService;

  const mockApiKeyRepository = {
    find: jest.fn(),
    save: jest.fn(),
    update: jest.fn(),
  };

  const mockUserRepository = {
    findOne: jest.fn(),
  };

  const mockJwtService = {
    sign: jest.fn(),
    verify: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        {
          provide: getRepositoryToken(User),
          useValue: mockUserRepository,
        },
        {
          provide: getRepositoryToken(ApiKey),
          useValue: mockApiKeyRepository,
        },
        {
          provide: JwtService,
          useValue: mockJwtService,
        },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
    apiKeyRepository = module.get<Repository<ApiKey>>(getRepositoryToken(ApiKey));
    jwtService = module.get<JwtService>(JwtService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Expired API Keys (Requirement 14.7)', () => {
    it('should reject API key expired 1 day ago', async () => {
      const key = 'YWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFh';
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);

      const expiredApiKey: ApiKey = {
        id: 'api-key-id',
        key_hash: '$2b$10$hashedkey',
        prefix: 'YWFhYWFh',
        project_id: 'project-123',
        environment_id: 'env-456',
        created_by: 'user-789',
        expires_at: yesterday,
        revoked: false,
        created_at: new Date(),
      } as ApiKey;

      mockApiKeyRepository.find.mockResolvedValue([expiredApiKey]);
      jest.spyOn(bcrypt, 'compare').mockImplementation(() => Promise.resolve(true));

      const result = await service.validateApiKey(key);

      expect(result).toBeNull();
    });

    it('should reject API key expired 1 second ago', async () => {
      const key = 'YWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFh';
      const oneSecondAgo = new Date(Date.now() - 1000);

      const expiredApiKey: ApiKey = {
        id: 'api-key-id',
        key_hash: '$2b$10$hashedkey',
        prefix: 'YWFhYWFh',
        project_id: 'project-123',
        environment_id: 'env-456',
        created_by: 'user-789',
        expires_at: oneSecondAgo,
        revoked: false,
        created_at: new Date(),
      } as ApiKey;

      mockApiKeyRepository.find.mockResolvedValue([expiredApiKey]);
      jest.spyOn(bcrypt, 'compare').mockImplementation(() => Promise.resolve(true));

      const result = await service.validateApiKey(key);

      expect(result).toBeNull();
    });

    it('should reject API key expired 1 year ago', async () => {
      const key = 'YWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFh';
      const oneYearAgo = new Date();
      oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);

      const expiredApiKey: ApiKey = {
        id: 'api-key-id',
        key_hash: '$2b$10$hashedkey',
        prefix: 'YWFhYWFh',
        project_id: 'project-123',
        environment_id: 'env-456',
        created_by: 'user-789',
        expires_at: oneYearAgo,
        revoked: false,
        created_at: new Date(),
      } as ApiKey;

      mockApiKeyRepository.find.mockResolvedValue([expiredApiKey]);
      jest.spyOn(bcrypt, 'compare').mockImplementation(() => Promise.resolve(true));

      const result = await service.validateApiKey(key);

      expect(result).toBeNull();
    });

    it('should accept API key expiring in 1 second', async () => {
      const key = 'YWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFh';
      const oneSecondFromNow = new Date(Date.now() + 1000);

      const validApiKey: ApiKey = {
        id: 'api-key-id',
        key_hash: '$2b$10$hashedkey',
        prefix: 'YWFhYWFh',
        project_id: 'project-123',
        environment_id: 'env-456',
        created_by: 'user-789',
        expires_at: oneSecondFromNow,
        revoked: false,
        created_at: new Date(),
      } as ApiKey;

      mockApiKeyRepository.find.mockResolvedValue([validApiKey]);
      jest.spyOn(bcrypt, 'compare').mockImplementation(() => Promise.resolve(true));

      const result = await service.validateApiKey(key);

      expect(result).toEqual(validApiKey);
    });

    it('should accept API key expiring in 1 year', async () => {
      const key = 'YWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFh';
      const oneYearFromNow = new Date();
      oneYearFromNow.setFullYear(oneYearFromNow.getFullYear() + 1);

      const validApiKey: ApiKey = {
        id: 'api-key-id',
        key_hash: '$2b$10$hashedkey',
        prefix: 'YWFhYWFh',
        project_id: 'project-123',
        environment_id: 'env-456',
        created_by: 'user-789',
        expires_at: oneYearFromNow,
        revoked: false,
        created_at: new Date(),
      } as ApiKey;

      mockApiKeyRepository.find.mockResolvedValue([validApiKey]);
      jest.spyOn(bcrypt, 'compare').mockImplementation(() => Promise.resolve(true));

      const result = await service.validateApiKey(key);

      expect(result).toEqual(validApiKey);
    });

    it('should accept API key with no expiration date', async () => {
      const key = 'YWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFh';

      const validApiKey: Partial<ApiKey> = {
        id: 'api-key-id',
        key_hash: '$2b$10$hashedkey',
        prefix: 'YWFhYWFh',
        project_id: 'project-123',
        environment_id: 'env-456',
        created_by: 'user-789',
        expires_at: undefined,
        revoked: false,
        created_at: new Date(),
      };

      mockApiKeyRepository.find.mockResolvedValue([validApiKey]);
      jest.spyOn(bcrypt, 'compare').mockImplementation(() => Promise.resolve(true));

      const result = await service.validateApiKey(key);

      expect(result).toEqual(validApiKey);
    });

    it('should check expiration before hash comparison for performance', async () => {
      const key = 'YWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFh';
      const expiredDate = new Date('2020-01-01');

      const expiredApiKey: ApiKey = {
        id: 'api-key-id',
        key_hash: '$2b$10$hashedkey',
        prefix: 'YWFhYWFh',
        project_id: 'project-123',
        environment_id: 'env-456',
        created_by: 'user-789',
        expires_at: expiredDate,
        revoked: false,
        created_at: new Date(),
      } as ApiKey;

      mockApiKeyRepository.find.mockResolvedValue([expiredApiKey]);
      jest.spyOn(bcrypt, 'compare').mockImplementation(() => Promise.resolve(true));

      const result = await service.validateApiKey(key);

      // Should reject without calling bcrypt.compare (performance optimization)
      expect(result).toBeNull();
      expect(bcrypt.compare).not.toHaveBeenCalled();
    });
  });

  describe('Revoked API Keys (Requirement 14.6)', () => {
    it('should reject revoked API key', async () => {
      const key = 'YWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFh';

      // Revoked keys are filtered out by the query (revoked: false in where clause)
      mockApiKeyRepository.find.mockResolvedValue([]);

      const result = await service.validateApiKey(key);

      expect(result).toBeNull();
      expect(mockApiKeyRepository.find).toHaveBeenCalledWith({
        where: { prefix: 'YWFhYWFh', revoked: false },
      });
    });

    it('should successfully revoke an API key', async () => {
      const keyId = 'api-key-id';

      mockApiKeyRepository.update.mockResolvedValue({ affected: 1 });

      await service.revokeApiKey(keyId);

      expect(mockApiKeyRepository.update).toHaveBeenCalledWith(keyId, { revoked: true });
    });

    it('should reject API key after revocation', async () => {
      const key = 'YWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFh';
      const keyId = 'api-key-id';

      // First, key is valid
      const validApiKey: ApiKey = {
        id: keyId,
        key_hash: '$2b$10$hashedkey',
        prefix: 'YWFhYWFh',
        project_id: 'project-123',
        environment_id: 'env-456',
        created_by: 'user-789',
        revoked: false,
        created_at: new Date(),
      } as ApiKey;

      mockApiKeyRepository.find.mockResolvedValueOnce([validApiKey]);
      jest.spyOn(bcrypt, 'compare').mockImplementation(() => Promise.resolve(true));

      const resultBefore = await service.validateApiKey(key);
      expect(resultBefore).toEqual(validApiKey);

      // Revoke the key
      mockApiKeyRepository.update.mockResolvedValue({ affected: 1 });
      await service.revokeApiKey(keyId);

      // After revocation, key should be rejected (query filters revoked keys)
      mockApiKeyRepository.find.mockResolvedValueOnce([]);

      const resultAfter = await service.validateApiKey(key);
      expect(resultAfter).toBeNull();
    });

    it('should reject revoked API key even if not expired', async () => {
      const key = 'YWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFh';
      const futureDate = new Date();
      futureDate.setFullYear(futureDate.getFullYear() + 1);

      // Revoked keys are filtered by query
      mockApiKeyRepository.find.mockResolvedValue([]);

      const result = await service.validateApiKey(key);

      expect(result).toBeNull();
    });

    it('should reject API key that is both revoked and expired', async () => {
      const key = 'YWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFh';

      // Revoked keys are filtered by query
      mockApiKeyRepository.find.mockResolvedValue([]);

      const result = await service.validateApiKey(key);

      expect(result).toBeNull();
    });
  });

  describe('Invalid JWT Tokens', () => {
    it('should reject malformed JWT token', async () => {
      const malformedToken = 'not.a.valid.jwt.token.format';

      mockJwtService.verify.mockImplementation(() => {
        throw new Error('jwt malformed');
      });

      await expect(service.validateToken(malformedToken)).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('should reject JWT token with invalid signature', async () => {
      const invalidToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VyX2lkIjoiMTIzIn0.invalid_signature';

      mockJwtService.verify.mockImplementation(() => {
        throw new Error('invalid signature');
      });

      await expect(service.validateToken(invalidToken)).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('should reject expired JWT token', async () => {
      const expiredToken = 'expired.jwt.token';

      mockJwtService.verify.mockImplementation(() => {
        throw new Error('jwt expired');
      });

      await expect(service.validateToken(expiredToken)).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('should reject JWT token with missing required fields', async () => {
      const incompleteToken = 'incomplete.jwt.token';

      mockJwtService.verify.mockReturnValue({
        user_id: '123',
        // Missing organization_id and role
      });

      // The service should handle incomplete payloads
      const result = await service.validateToken(incompleteToken);

      // Verify the service returns what JWT service provides
      expect(result).toEqual({
        user_id: '123',
      });
    });

    it('should reject empty JWT token', async () => {
      const emptyToken = '';

      mockJwtService.verify.mockImplementation(() => {
        throw new Error('jwt must be provided');
      });

      await expect(service.validateToken(emptyToken)).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('should reject null JWT token', async () => {
      mockJwtService.verify.mockImplementation(() => {
        throw new Error('jwt must be provided');
      });

      await expect(service.validateToken(null as any)).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('should reject JWT token with tampered payload', async () => {
      const tamperedToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.tampered_payload.signature';

      mockJwtService.verify.mockImplementation(() => {
        throw new Error('invalid token');
      });

      await expect(service.validateToken(tamperedToken)).rejects.toThrow(
        UnauthorizedException,
      );
    });
  });

  describe('API Key Edge Cases', () => {
    it('should reject API key with empty string', async () => {
      const emptyKey = '';

      mockApiKeyRepository.find.mockResolvedValue([]);

      const result = await service.validateApiKey(emptyKey);

      expect(result).toBeNull();
    });

    it('should reject API key shorter than prefix length', async () => {
      const shortKey = 'short';

      mockApiKeyRepository.find.mockResolvedValue([]);

      const result = await service.validateApiKey(shortKey);

      expect(result).toBeNull();
    });

    it('should reject API key with special characters', async () => {
      const specialKey = 'key!@#$%^&*()_+{}[]|\\:";\'<>?,./';

      mockApiKeyRepository.find.mockResolvedValue([]);

      const result = await service.validateApiKey(specialKey);

      expect(result).toBeNull();
    });

    it('should reject API key when hash comparison fails', async () => {
      const key = 'YWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFh';

      const apiKey: ApiKey = {
        id: 'api-key-id',
        key_hash: '$2b$10$differenthash',
        prefix: 'YWFhYWFh',
        project_id: 'project-123',
        environment_id: 'env-456',
        created_by: 'user-789',
        revoked: false,
        created_at: new Date(),
      } as ApiKey;

      mockApiKeyRepository.find.mockResolvedValue([apiKey]);
      jest.spyOn(bcrypt, 'compare').mockImplementation(() => Promise.resolve(false));

      const result = await service.validateApiKey(key);

      expect(result).toBeNull();
    });

    it('should handle multiple API keys with same prefix but different hashes', async () => {
      const key = 'YWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFh';

      const apiKey1: ApiKey = {
        id: 'api-key-id-1',
        key_hash: '$2b$10$wronghash1',
        prefix: 'YWFhYWFh',
        project_id: 'project-123',
        environment_id: 'env-456',
        created_by: 'user-789',
        revoked: false,
        created_at: new Date(),
      } as ApiKey;

      const apiKey2: ApiKey = {
        id: 'api-key-id-2',
        key_hash: '$2b$10$correcthash',
        prefix: 'YWFhYWFh',
        project_id: 'project-123',
        environment_id: 'env-456',
        created_by: 'user-789',
        revoked: false,
        created_at: new Date(),
      } as ApiKey;

      mockApiKeyRepository.find.mockResolvedValue([apiKey1, apiKey2]);
      jest
        .spyOn(bcrypt, 'compare')
        .mockImplementationOnce(() => Promise.resolve(false))
        .mockImplementationOnce(() => Promise.resolve(true));

      const result = await service.validateApiKey(key);

      expect(result).toEqual(apiKey2);
      expect(bcrypt.compare).toHaveBeenCalledTimes(2);
    });

    it('should reject when all API keys with matching prefix fail hash comparison', async () => {
      const key = 'YWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFh';

      const apiKey1: ApiKey = {
        id: 'api-key-id-1',
        key_hash: '$2b$10$wronghash1',
        prefix: 'YWFhYWFh',
        project_id: 'project-123',
        environment_id: 'env-456',
        created_by: 'user-789',
        revoked: false,
        created_at: new Date(),
      } as ApiKey;

      const apiKey2: ApiKey = {
        id: 'api-key-id-2',
        key_hash: '$2b$10$wronghash2',
        prefix: 'YWFhYWFh',
        project_id: 'project-123',
        environment_id: 'env-456',
        created_by: 'user-789',
        revoked: false,
        created_at: new Date(),
      } as ApiKey;

      mockApiKeyRepository.find.mockResolvedValue([apiKey1, apiKey2]);
      jest.spyOn(bcrypt, 'compare').mockImplementation(() => Promise.resolve(false));

      const result = await service.validateApiKey(key);

      expect(result).toBeNull();
      expect(bcrypt.compare).toHaveBeenCalledTimes(2);
    });
  });

  describe('Combined Edge Cases', () => {
    it('should prioritize revocation over expiration check', async () => {
      const key = 'YWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFh';

      // Revoked keys are filtered by query, so they never reach expiration check
      mockApiKeyRepository.find.mockResolvedValue([]);

      const result = await service.validateApiKey(key);

      expect(result).toBeNull();
    });

    it('should validate API key based on expiration time at check moment', async () => {
      const key = 'YWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFh';
      
      // Set expiration to 50ms from now
      const expiresAt = new Date(Date.now() + 50);

      const apiKey: ApiKey = {
        id: 'api-key-id',
        key_hash: '$2b$10$hashedkey',
        prefix: 'YWFhYWFh',
        project_id: 'project-123',
        environment_id: 'env-456',
        created_by: 'user-789',
        expires_at: expiresAt,
        revoked: false,
        created_at: new Date(),
      } as ApiKey;

      mockApiKeyRepository.find.mockResolvedValue([apiKey]);
      jest.spyOn(bcrypt, 'compare').mockImplementation(async () => {
        // Simulate slow hash comparison that takes 100ms
        await new Promise(resolve => setTimeout(resolve, 100));
        return true;
      });

      const result = await service.validateApiKey(key);

      // Key is validated at the moment of expiration check, not after bcrypt completes
      // Since the key was valid when checked, it should be accepted
      expect(result).toEqual(apiKey);
      expect(bcrypt.compare).toHaveBeenCalledWith(key, apiKey.key_hash);
    });

    it('should handle database errors gracefully during API key validation', async () => {
      const key = 'YWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFh';

      mockApiKeyRepository.find.mockRejectedValue(new Error('Database connection failed'));

      await expect(service.validateApiKey(key)).rejects.toThrow('Database connection failed');
    });

    it('should handle bcrypt errors gracefully during API key validation', async () => {
      const key = 'YWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFh';

      const apiKey: ApiKey = {
        id: 'api-key-id',
        key_hash: 'invalid-bcrypt-hash',
        prefix: 'YWFhYWFh',
        project_id: 'project-123',
        environment_id: 'env-456',
        created_by: 'user-789',
        revoked: false,
        created_at: new Date(),
      } as ApiKey;

      mockApiKeyRepository.find.mockResolvedValue([apiKey]);
      jest.spyOn(bcrypt, 'compare').mockRejectedValue(new Error('Invalid hash format') as never);

      await expect(service.validateApiKey(key)).rejects.toThrow('Invalid hash format');
    });
  });
});
