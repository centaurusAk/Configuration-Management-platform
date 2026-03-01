import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../entities/user.entity';

@Injectable()
export class UserRepository {
  constructor(
    @InjectRepository(User)
    private readonly repository: Repository<User>,
  ) {}

  async create(
    organizationId: string,
    email: string,
    passwordHash: string,
    role: 'Admin' | 'Editor' | 'Viewer',
  ): Promise<User> {
    const user = this.repository.create({
      organization_id: organizationId,
      email,
      password_hash: passwordHash,
      role,
    });
    return this.repository.save(user);
  }

  async findById(id: string): Promise<User | null> {
    return this.repository.findOne({ where: { id } });
  }

  async findByEmail(email: string): Promise<User | null> {
    return this.repository.findOne({ where: { email } });
  }

  async findByOrganization(organizationId: string): Promise<User[]> {
    return this.repository.find({
      where: { organization_id: organizationId },
    });
  }

  async findAll(): Promise<User[]> {
    return this.repository.find();
  }

  async update(
    id: string,
    updates: Partial<Pick<User, 'email' | 'password_hash' | 'role'>>,
  ): Promise<User | null> {
    await this.repository.update(id, updates);
    return this.findById(id);
  }

  async delete(id: string): Promise<void> {
    await this.repository.delete(id);
  }
}
