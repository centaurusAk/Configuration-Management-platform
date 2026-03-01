import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';
import { User } from '../entities/user.entity';
import { ApiKey } from '../entities/api-key.entity';

export interface JwtPayload {
  user_id: string;
  organization_id: string;
  role: 'Admin' | 'Editor' | 'Viewer';
  exp: number;
}

@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    @InjectRepository(ApiKey)
    private readonly apiKeyRepository: Repository<ApiKey>,
    private readonly jwtService: JwtService,
  ) {}

  /**
   * Register a new user with organization
   */
  async register(
    email: string,
    password: string,
    organizationName: string,
    role: 'Admin' | 'Editor' | 'Viewer' = 'Admin',
  ): Promise<{ token: string; user: User }> {
    // Check if user already exists
    const existingUser = await this.userRepository.findOne({ where: { email } });
    if (existingUser) {
      throw new UnauthorizedException('User with this email already exists');
    }

    // Hash password
    const passwordHash = await this.hashPassword(password);

    // Create organization and user in a transaction
    const queryRunner = this.userRepository.manager.connection.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      // Create organization
      const organization = await queryRunner.manager.query(
        'INSERT INTO organizations (name) VALUES ($1) RETURNING id',
        [organizationName],
      );
      const organizationId = organization[0].id;

      // Create user
      const userResult = await queryRunner.manager.query(
        'INSERT INTO users (organization_id, email, password_hash, role) VALUES ($1, $2, $3, $4) RETURNING *',
        [organizationId, email, passwordHash, role],
      );
      const user = userResult[0];

      await queryRunner.commitTransaction();

      // Generate token
      const token = await this.generateToken(user);

      return { token, user };
    } catch (error) {
      if (queryRunner.isTransactionActive) {
        await queryRunner.rollbackTransaction();
      }
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  /**
   * Authenticate user with email and password, return JWT token
   * Requirement 7.1: JWT authentication for dashboard
   */
  async login(email: string, password: string): Promise<{ token: string; user: User }> {
    const user = await this.userRepository.findOne({ where: { email } });
    
    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const valid = await bcrypt.compare(password, user.password_hash);
    
    if (!valid) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const payload = {
      user_id: user.id,
      organization_id: user.organization_id,
      role: user.role,
    };

    const token = this.jwtService.sign(payload);
    
    return { token, user };
  }

  /**
   * Validate JWT token and return payload
   * Requirement 7.1: Token validation
   */
  async validateToken(token: string): Promise<JwtPayload> {
    try {
      return this.jwtService.verify<JwtPayload>(token);
    } catch (error) {
      throw new UnauthorizedException('Invalid or expired token');
    }
  }

  /**
   * Hash password using bcrypt
   * Requirement 7.1: Password hashing with bcrypt
   */
  async hashPassword(password: string): Promise<string> {
    const saltRounds = 10;
    return bcrypt.hash(password, saltRounds);
  }

  /**
   * Verify password against hash
   */
  async verifyPassword(password: string, hash: string): Promise<boolean> {
    return bcrypt.compare(password, hash);
  }

  /**
   * Generate JWT token for a user
   */
  async generateToken(user: User): Promise<string> {
    const payload = {
      user_id: user.id,
      organization_id: user.organization_id,
      role: user.role,
    };

    return this.jwtService.sign(payload);
  }

  /**
   * Generate API key with cryptographically secure random bytes
   * Requirement 14.1: Generate cryptographically secure random key
   */
  async generateApiKey(
    projectId: string,
    environmentId: string,
    createdBy: string,
    expiresAt?: Date,
  ): Promise<string> {
    // Generate 32 bytes (256 bits) of cryptographically secure random data
    const key = crypto.randomBytes(32).toString('base64url');
    
    // Hash using bcrypt (Requirement 14.3)
    const keyHash = await bcrypt.hash(key, 10);
    
    // Store prefix (first 8 characters) for display (Requirement 14.5)
    const prefix = key.substring(0, 8);
    
    // Store in database
    await this.apiKeyRepository.save({
      key_hash: keyHash,
      prefix: prefix,
      project_id: projectId,
      environment_id: environmentId,
      created_by: createdBy,
      expires_at: expiresAt,
      revoked: false,
    });
    
    // Return plaintext key only once
    return key;
  }

  /**
   * Validate API key
   * Requirement 14.4: Validate API key hash
   */
  async validateApiKey(key: string): Promise<ApiKey | null> {
    // Find by prefix for efficiency
    const prefix = key.substring(0, 8);
    const candidates = await this.apiKeyRepository.find({
      where: { prefix, revoked: false },
    });
    
    for (const candidate of candidates) {
      // Check if expired (Requirement 14.7)
      if (candidate.expires_at && candidate.expires_at < new Date()) {
        continue;
      }
      
      // Verify hash (Requirement 14.4)
      const valid = await bcrypt.compare(key, candidate.key_hash);
      if (valid) {
        return candidate;
      }
    }
    
    return null;
  }

  /**
   * Revoke an API key
   * Requirement 14.6: Mark API key as inactive
   */
  async revokeApiKey(keyId: string): Promise<void> {
    await this.apiKeyRepository.update(keyId, { revoked: true });
  }
}
