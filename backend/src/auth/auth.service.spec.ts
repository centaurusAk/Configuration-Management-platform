import { Test, TestingModule } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { UnauthorizedException } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';
import { AuthService, JwtPayload } from './auth.service';
import { User } from '../entities/user.entity';
import { ApiKey } from '../entities/api-key.entity';

describe('AuthService', () => {
  let service: AuthService;
  let userRepository: Repository<User>;
  let apiKeyRepository: Repository<ApiKey>;
  let jwtService: JwtService;

  const mockUser: User = {
    id: '123e4567-e89b-12d3-a456-426614174000',
    organization_id: '123e4567-e89b-12d3-a456-426614174001',
    email: 'test@example.com',
    password_hash: '$2b$10$abcdefghijklmnopqrstuvwxyz', // Mock bcrypt hash
    role: 'Admin',
    created_at: new Date(),
    updated_at: new Date(),
  } as User;

  const mockUserRepository = {
    findOne: jest.fn(),
  };

  const mockApiKeyRepository = {
    save: jest.fn(),
    find: jest.fn(),
    update: jest.fn(),
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
    userRepository = module.get<Repository<User>>(getRepositoryToken(User));
    apiKeyRepository = module.get<Repository<ApiKey>>(getRepositoryToken(ApiKey));
    jwtService = module.get<JwtService>(JwtService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('login', () => {
    it('should return JWT token for valid credentials', async () => {
      const email = 'test@example.com';
      const password = 'password123';
      const expectedToken = 'jwt.token.here';

      mockUserRepository.findOne.mockResolvedValue(mockUser);
      jest.spyOn(bcrypt, 'compare').mockImplementation(() => Promise.resolve(true));
      mockJwtService.sign.mockReturnValue(expectedToken);

      const result = await service.login(email, password);

      expect(result.token).toBe(expectedToken);
      expect(result.user).toEqual(mockUser);
      expect(mockUserRepository.findOne).toHaveBeenCalledWith({ where: { email } });
      expect(bcrypt.compare).toHaveBeenCalledWith(password, mockUser.password_hash);
      expect(mockJwtService.sign).toHaveBeenCalledWith(
        expect.objectContaining({
          user_id: mockUser.id,
          organization_id: mockUser.organization_id,
          role: mockUser.role,
        }),
      );
    });

    it('should throw UnauthorizedException if user not found', async () => {
      mockUserRepository.findOne.mockResolvedValue(null);

      await expect(service.login('nonexistent@example.com', 'password')).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('should throw UnauthorizedException if password is invalid', async () => {
      mockUserRepository.findOne.mockResolvedValue(mockUser);
      jest.spyOn(bcrypt, 'compare').mockImplementation(() => Promise.resolve(false));

      await expect(service.login('test@example.com', 'wrongpassword')).rejects.toThrow(
        UnauthorizedException,
      );
    });
  });

  describe('validateToken', () => {
    it('should return payload for valid token', async () => {
      const token = 'valid.jwt.token';
      const payload: JwtPayload = {
        user_id: mockUser.id,
        organization_id: mockUser.organization_id,
        role: mockUser.role,
        exp: Math.floor(Date.now() / 1000) + 3600,
      };

      mockJwtService.verify.mockReturnValue(payload);

      const result = await service.validateToken(token);

      expect(result).toEqual(payload);
      expect(mockJwtService.verify).toHaveBeenCalledWith(token);
    });

    it('should throw UnauthorizedException for invalid token', async () => {
      const token = 'invalid.jwt.token';
      mockJwtService.verify.mockImplementation(() => {
        throw new Error('Invalid token');
      });

      await expect(service.validateToken(token)).rejects.toThrow(UnauthorizedException);
    });
  });

  describe('hashPassword', () => {
    it('should hash password using bcrypt', async () => {
      const password = 'password123';
      const hashedPassword = '$2b$10$hashedpassword';

      jest.spyOn(bcrypt, 'hash').mockImplementation(() => Promise.resolve(hashedPassword));

      const result = await service.hashPassword(password);

      expect(result).toBe(hashedPassword);
      expect(bcrypt.hash).toHaveBeenCalledWith(password, 10);
    });
  });

  describe('verifyPassword', () => {
    it('should return true for matching password', async () => {
      const password = 'password123';
      const hash = '$2b$10$hashedpassword';

      jest.spyOn(bcrypt, 'compare').mockImplementation(() => Promise.resolve(true));

      const result = await service.verifyPassword(password, hash);

      expect(result).toBe(true);
      expect(bcrypt.compare).toHaveBeenCalledWith(password, hash);
    });

    it('should return false for non-matching password', async () => {
      const password = 'wrongpassword';
      const hash = '$2b$10$hashedpassword';

      jest.spyOn(bcrypt, 'compare').mockImplementation(() => Promise.resolve(false));

      const result = await service.verifyPassword(password, hash);

      expect(result).toBe(false);
    });
  });

  describe('generateToken', () => {
    it('should generate JWT token for user', async () => {
      const expectedToken = 'generated.jwt.token';
      mockJwtService.sign.mockReturnValue(expectedToken);

      const result = await service.generateToken(mockUser);

      expect(result).toBe(expectedToken);
      expect(mockJwtService.sign).toHaveBeenCalledWith(
        expect.objectContaining({
          user_id: mockUser.id,
          organization_id: mockUser.organization_id,
          role: mockUser.role,
        }),
      );
    });
  });

  describe('generateApiKey', () => {
    it('should generate API key with cryptographically secure random bytes', async () => {
      const projectId = 'project-123';
      const environmentId = 'env-456';
      const createdBy = 'user-789';
      
      jest.spyOn(crypto, 'randomBytes').mockReturnValue(Buffer.from('a'.repeat(32)) as any);
      jest.spyOn(bcrypt, 'hash').mockImplementation(() => Promise.resolve('$2b$10$hashedkey'));
      mockApiKeyRepository.save.mockResolvedValue({
        id: 'api-key-id',
        key_hash: '$2b$10$hashedkey',
        prefix: 'YWFhYWFh',
        project_id: projectId,
        environment_id: environmentId,
        created_by: createdBy,
        revoked: false,
      });

      const result = await service.generateApiKey(projectId, environmentId, createdBy);

      // Verify key is returned (base64url encoded)
      expect(result).toBeDefined();
      expect(typeof result).toBe('string');
      
      // Verify bcrypt was called with the key
      expect(bcrypt.hash).toHaveBeenCalledWith(expect.any(String), 10);
      
      // Verify API key was saved with hash and prefix
      expect(mockApiKeyRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({
          key_hash: '$2b$10$hashedkey',
          prefix: expect.any(String),
          project_id: projectId,
          environment_id: environmentId,
          created_by: createdBy,
          revoked: false,
        }),
      );
    });

    it('should generate API key with expiration date', async () => {
      const projectId = 'project-123';
      const environmentId = 'env-456';
      const createdBy = 'user-789';
      const expiresAt = new Date('2025-12-31');
      
      jest.spyOn(crypto, 'randomBytes').mockReturnValue(Buffer.from('b'.repeat(32)) as any);
      jest.spyOn(bcrypt, 'hash').mockImplementation(() => Promise.resolve('$2b$10$hashedkey'));
      mockApiKeyRepository.save.mockResolvedValue({
        id: 'api-key-id',
        expires_at: expiresAt,
      });

      await service.generateApiKey(projectId, environmentId, createdBy, expiresAt);

      expect(mockApiKeyRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({
          expires_at: expiresAt,
        }),
      );
    });
  });

  describe('validateApiKey', () => {
    it('should return API key for valid key', async () => {
      const key = 'YWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFh';
      const mockApiKey: ApiKey = {
        id: 'api-key-id',
        key_hash: '$2b$10$hashedkey',
        prefix: 'YWFhYWFh',
        project_id: 'project-123',
        environment_id: 'env-456',
        created_by: 'user-789',
        revoked: false,
        created_at: new Date(),
      } as ApiKey;

      mockApiKeyRepository.find.mockResolvedValue([mockApiKey]);
      jest.spyOn(bcrypt, 'compare').mockImplementation(() => Promise.resolve(true));

      const result = await service.validateApiKey(key);

      expect(result).toEqual(mockApiKey);
      expect(mockApiKeyRepository.find).toHaveBeenCalledWith({
        where: { prefix: 'YWFhYWFh', revoked: false },
      });
      expect(bcrypt.compare).toHaveBeenCalledWith(key, mockApiKey.key_hash);
    });

    it('should return null for invalid key', async () => {
      const key = 'invalid-key-here';
      const mockApiKey: ApiKey = {
        id: 'api-key-id',
        key_hash: '$2b$10$hashedkey',
        prefix: 'invalid-',
        project_id: 'project-123',
        environment_id: 'env-456',
        created_by: 'user-789',
        revoked: false,
        created_at: new Date(),
      } as ApiKey;

      mockApiKeyRepository.find.mockResolvedValue([mockApiKey]);
      jest.spyOn(bcrypt, 'compare').mockImplementation(() => Promise.resolve(false));

      const result = await service.validateApiKey(key);

      expect(result).toBeNull();
    });

    it('should return null for expired key', async () => {
      const key = 'YWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFh';
      const expiredDate = new Date('2020-01-01');
      const mockApiKey: ApiKey = {
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

      mockApiKeyRepository.find.mockResolvedValue([mockApiKey]);
      jest.spyOn(bcrypt, 'compare').mockImplementation(() => Promise.resolve(true));

      const result = await service.validateApiKey(key);

      expect(result).toBeNull();
    });

    it('should return null for revoked key', async () => {
      const key = 'YWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFh';
      
      // Revoked keys are filtered out by the query
      mockApiKeyRepository.find.mockResolvedValue([]);

      const result = await service.validateApiKey(key);

      expect(result).toBeNull();
      expect(mockApiKeyRepository.find).toHaveBeenCalledWith({
        where: { prefix: 'YWFhYWFh', revoked: false },
      });
    });

    it('should return null when no matching prefix found', async () => {
      const key = 'nonexistent-key';
      
      mockApiKeyRepository.find.mockResolvedValue([]);

      const result = await service.validateApiKey(key);

      expect(result).toBeNull();
    });
  });

  describe('revokeApiKey', () => {
    it('should mark API key as revoked', async () => {
      const keyId = 'api-key-id';
      
      mockApiKeyRepository.update.mockResolvedValue({ affected: 1 });

      await service.revokeApiKey(keyId);

      expect(mockApiKeyRepository.update).toHaveBeenCalledWith(keyId, { revoked: true });
    });
  });
});
