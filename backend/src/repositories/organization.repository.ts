import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Organization } from '../entities/organization.entity';

@Injectable()
export class OrganizationRepository {
  constructor(
    @InjectRepository(Organization)
    private readonly repository: Repository<Organization>,
  ) {}

  async create(name: string): Promise<Organization> {
    const organization = this.repository.create({ name });
    return this.repository.save(organization);
  }

  async findById(id: string): Promise<Organization | null> {
    return this.repository.findOne({ where: { id } });
  }

  async findAll(): Promise<Organization[]> {
    return this.repository.find();
  }

  async update(id: string, name: string): Promise<Organization | null> {
    await this.repository.update(id, { name });
    return this.findById(id);
  }

  async delete(id: string): Promise<void> {
    await this.repository.delete(id);
  }
}
