import { Injectable, ConflictException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Project } from '../entities/project.entity';

@Injectable()
export class ProjectRepository {
  constructor(
    @InjectRepository(Project)
    private readonly repository: Repository<Project>,
  ) {}

  async create(organizationId: string, name: string): Promise<Project> {
    try {
      const project = this.repository.create({
        organization_id: organizationId,
        name,
      });
      return await this.repository.save(project);
    } catch (error: any) {
      // Handle unique constraint violation
      if (error.code === '23505') { // PostgreSQL unique violation error code
        throw new ConflictException(
          `Project with name '${name}' already exists in this organization`
        );
      }
      throw error;
    }
  }

  async findById(id: string): Promise<Project | null> {
    return this.repository.findOne({ where: { id } });
  }

  async findByOrganization(organizationId: string): Promise<Project[]> {
    return this.repository.find({
      where: { organization_id: organizationId },
    });
  }

  async findAll(): Promise<Project[]> {
    return this.repository.find();
  }

  async update(id: string, name: string): Promise<Project | null> {
    try {
      await this.repository.update(id, { name });
      return this.findById(id);
    } catch (error: any) {
      // Handle unique constraint violation
      if (error.code === '23505') {
        throw new ConflictException(
          `Project with name '${name}' already exists in this organization`
        );
      }
      throw error;
    }
  }

  async delete(id: string): Promise<void> {
    await this.repository.delete(id);
  }
}
