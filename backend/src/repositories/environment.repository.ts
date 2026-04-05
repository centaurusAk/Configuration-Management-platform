import { Injectable, ConflictException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Environment } from '../entities/environment.entity';

@Injectable()
export class EnvironmentRepository {
  constructor(
    @InjectRepository(Environment)
    private readonly repository: Repository<Environment>,
  ) {}

  async create(projectId: string, name: string): Promise<Environment> {
    try {
      const environment = this.repository.create({
        project_id: projectId,
        name,
      });
      return await this.repository.save(environment);
    } catch (error: any) {
      // Handle unique constraint violation
      if (error.code === '23505') { // PostgreSQL unique violation error code
        throw new ConflictException(
          `Environment with name '${name}' already exists in this project`
        );
      }
      throw error;
    }
  }

  async findById(id: string): Promise<Environment | null> {
    return this.repository.findOne({ where: { id } });
  }

  async findByProject(projectId: string): Promise<Environment[]> {
    return this.repository.find({
      where: { project_id: projectId },
    });
  }

  async findAll(): Promise<Environment[]> {
    return this.repository.find();
  }

  async delete(id: string): Promise<void> {
    await this.repository.delete(id);
  }
}
