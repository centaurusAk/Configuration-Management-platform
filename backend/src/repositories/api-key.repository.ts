import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, LessThan } from 'typeorm';
import { ApiKey } from '../entities/api-key.entity';

@Injectable()
export class ApiKeyRepository {
  constructor(
    @InjectRepository(ApiKey)
    private readonly repository: Repository<ApiKey>,
  ) {}

  async create(
    keyHash: string,
    prefix: string,
    projectId: string,
    environmentId: string,
    createdBy: string,
    expiresAt?: Date,
  ): Promise<ApiKey> {
    const apiKey = this.repository.create({
      key_hash: keyHash,
      prefix,
      project_id: projectId,
      environment_id: environmentId,
      created_by: createdBy,
      expires_at: expiresAt,
      revoked: false,
    });
    return this.repository.save(apiKey);
  }

  async findById(id: string): Promise<ApiKey | null> {
    return this.repository.findOne({ where: { id } });
  }

  /**
   * Find API keys by prefix for authentication
   * Requirement 14.4: Validate API key hash
   */
  async findByPrefix(prefix: string): Promise<ApiKey[]> {
    return this.repository.find({
      where: { prefix, revoked: false },
    });
  }

  async findByProject(projectId: string): Promise<ApiKey[]> {
    return this.repository.find({
      where: { project_id: projectId },
    });
  }

  async findByEnvironment(
    projectId: string,
    environmentId: string,
  ): Promise<ApiKey[]> {
    return this.repository.find({
      where: {
        project_id: projectId,
        environment_id: environmentId,
      },
    });
  }

  async findAll(): Promise<ApiKey[]> {
    return this.repository.find();
  }

  /**
   * Revoke an API key
   * Requirement 14.6: Mark API key as inactive
   */
  async revoke(id: string): Promise<void> {
    await this.repository.update(id, { revoked: true });
  }

  /**
   * Find expired API keys
   */
  async findExpired(): Promise<ApiKey[]> {
    return this.repository.find({
      where: {
        expires_at: LessThan(new Date()),
        revoked: false,
      },
    });
  }

  /**
   * Check if an API key is valid (not revoked and not expired)
   */
  async isValid(id: string): Promise<boolean> {
    const apiKey = await this.findById(id);
    if (!apiKey || apiKey.revoked) {
      return false;
    }
    if (apiKey.expires_at && apiKey.expires_at < new Date()) {
      return false;
    }
    return true;
  }
}
