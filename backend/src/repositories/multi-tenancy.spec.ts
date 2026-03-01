import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ConflictException } from '@nestjs/common';
import { OrganizationRepository } from './organization.repository';
import { ProjectRepository } from './project.repository';
import { EnvironmentRepository } from './environment.repository';
import { Organization } from '../entities/organization.entity';
import { Project } from '../entities/project.entity';
import { Environment } from '../entities/environment.entity';

describe('Multi-Tenancy Repositories', () => {
  describe('OrganizationRepository', () => {
    let repository: OrganizationRepository;
    let mockRepository: Partial<Repository<Organization>>;

    beforeEach(async () => {
      mockRepository = {
        create: jest.fn(),
        save: jest.fn(),
        findOne: jest.fn(),
        find: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
      };

      const module: TestingModule = await Test.createTestingModule({
        providers: [
          OrganizationRepository,
          {
            provide: getRepositoryToken(Organization),
            useValue: mockRepository,
          },
        ],
      }).compile();

      repository = module.get<OrganizationRepository>(OrganizationRepository);
    });

    describe('CRUD operations', () => {
      it('should create an organization', async () => {
        const mockOrg = {
          id: '123',
          name: 'Test Organization',
          created_at: new Date(),
          updated_at: new Date(),
        };

        (mockRepository.create as jest.Mock).mockReturnValue(mockOrg);
        (mockRepository.save as jest.Mock).mockResolvedValue(mockOrg);

        const result = await repository.create('Test Organization');

        expect(result).toEqual(mockOrg);
        expect(mockRepository.create).toHaveBeenCalledWith({ name: 'Test Organization' });
        expect(mockRepository.save).toHaveBeenCalled();
      });

      it('should find organization by id', async () => {
        const mockOrg = {
          id: '123',
          name: 'Test Organization',
          created_at: new Date(),
          updated_at: new Date(),
        };

        (mockRepository.findOne as jest.Mock).mockResolvedValue(mockOrg);

        const result = await repository.findById('123');

        expect(result).toEqual(mockOrg);
        expect(mockRepository.findOne).toHaveBeenCalledWith({ where: { id: '123' } });
      });

      it('should return null for non-existent organization', async () => {
        (mockRepository.findOne as jest.Mock).mockResolvedValue(null);

        const result = await repository.findById('nonexistent');

        expect(result).toBeNull();
      });

      it('should find all organizations', async () => {
        const mockOrgs = [
          { id: '1', name: 'Org 1', created_at: new Date(), updated_at: new Date() },
          { id: '2', name: 'Org 2', created_at: new Date(), updated_at: new Date() },
        ];

        (mockRepository.find as jest.Mock).mockResolvedValue(mockOrgs);

        const result = await repository.findAll();

        expect(result).toEqual(mockOrgs);
        expect(mockRepository.find).toHaveBeenCalled();
      });

      it('should update organization name', async () => {
        const mockOrg = {
          id: '123',
          name: 'Updated Name',
          created_at: new Date(),
          updated_at: new Date(),
        };

        (mockRepository.update as jest.Mock).mockResolvedValue({ affected: 1 });
        (mockRepository.findOne as jest.Mock).mockResolvedValue(mockOrg);

        const result = await repository.update('123', 'Updated Name');

        expect(result).toEqual(mockOrg);
        expect(mockRepository.update).toHaveBeenCalledWith('123', { name: 'Updated Name' });
      });

      it('should delete organization', async () => {
        (mockRepository.delete as jest.Mock).mockResolvedValue({ affected: 1 });

        await repository.delete('123');

        expect(mockRepository.delete).toHaveBeenCalledWith('123');
      });
    });
  });

  describe('ProjectRepository', () => {
    let repository: ProjectRepository;
    let mockRepository: Partial<Repository<Project>>;

    beforeEach(async () => {
      mockRepository = {
        create: jest.fn(),
        save: jest.fn(),
        findOne: jest.fn(),
        find: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
      };

      const module: TestingModule = await Test.createTestingModule({
        providers: [
          ProjectRepository,
          {
            provide: getRepositoryToken(Project),
            useValue: mockRepository,
          },
        ],
      }).compile();

      repository = module.get<ProjectRepository>(ProjectRepository);
    });

    describe('CRUD operations', () => {
      it('should create a project', async () => {
        const mockProject = {
          id: '123',
          organization_id: 'org1',
          name: 'Test Project',
          created_at: new Date(),
          updated_at: new Date(),
        };

        (mockRepository.create as jest.Mock).mockReturnValue(mockProject);
        (mockRepository.save as jest.Mock).mockResolvedValue(mockProject);

        const result = await repository.create('org1', 'Test Project');

        expect(result).toEqual(mockProject);
        expect(mockRepository.create).toHaveBeenCalledWith({
          organization_id: 'org1',
          name: 'Test Project',
        });
        expect(mockRepository.save).toHaveBeenCalled();
      });

      it('should find project by id', async () => {
        const mockProject = {
          id: '123',
          organization_id: 'org1',
          name: 'Test Project',
          created_at: new Date(),
          updated_at: new Date(),
        };

        (mockRepository.findOne as jest.Mock).mockResolvedValue(mockProject);

        const result = await repository.findById('123');

        expect(result).toEqual(mockProject);
        expect(mockRepository.findOne).toHaveBeenCalledWith({ where: { id: '123' } });
      });

      it('should find projects by organization', async () => {
        const mockProjects = [
          { id: '1', organization_id: 'org1', name: 'Project 1', created_at: new Date(), updated_at: new Date() },
          { id: '2', organization_id: 'org1', name: 'Project 2', created_at: new Date(), updated_at: new Date() },
        ];

        (mockRepository.find as jest.Mock).mockResolvedValue(mockProjects);

        const result = await repository.findByOrganization('org1');

        expect(result).toEqual(mockProjects);
        expect(mockRepository.find).toHaveBeenCalledWith({
          where: { organization_id: 'org1' },
        });
      });

      it('should update project name', async () => {
        const mockProject = {
          id: '123',
          organization_id: 'org1',
          name: 'Updated Project',
          created_at: new Date(),
          updated_at: new Date(),
        };

        (mockRepository.update as jest.Mock).mockResolvedValue({ affected: 1 });
        (mockRepository.findOne as jest.Mock).mockResolvedValue(mockProject);

        const result = await repository.update('123', 'Updated Project');

        expect(result).toEqual(mockProject);
        expect(mockRepository.update).toHaveBeenCalledWith('123', { name: 'Updated Project' });
      });

      it('should delete project', async () => {
        (mockRepository.delete as jest.Mock).mockResolvedValue({ affected: 1 });

        await repository.delete('123');

        expect(mockRepository.delete).toHaveBeenCalledWith('123');
      });
    });

    describe('Unique constraints', () => {
      it('should throw ConflictException on duplicate project name in same organization', async () => {
        const error: any = new Error('Duplicate key');
        error.code = '23505'; // PostgreSQL unique violation

        (mockRepository.create as jest.Mock).mockReturnValue({});
        (mockRepository.save as jest.Mock).mockRejectedValue(error);

        await expect(repository.create('org1', 'Duplicate Project')).rejects.toThrow(
          ConflictException
        );
      });

      it('should throw ConflictException on duplicate update', async () => {
        const error: any = new Error('Duplicate key');
        error.code = '23505';

        (mockRepository.update as jest.Mock).mockRejectedValue(error);

        await expect(repository.update('123', 'Duplicate Name')).rejects.toThrow(
          ConflictException
        );
      });

      it('should rethrow non-unique-constraint errors', async () => {
        const error = new Error('Some other error');

        (mockRepository.create as jest.Mock).mockReturnValue({});
        (mockRepository.save as jest.Mock).mockRejectedValue(error);

        await expect(repository.create('org1', 'Test')).rejects.toThrow('Some other error');
      });
    });
  });

  describe('EnvironmentRepository', () => {
    let repository: EnvironmentRepository;
    let mockRepository: Partial<Repository<Environment>>;

    beforeEach(async () => {
      mockRepository = {
        create: jest.fn(),
        save: jest.fn(),
        findOne: jest.fn(),
        find: jest.fn(),
        delete: jest.fn(),
      };

      const module: TestingModule = await Test.createTestingModule({
        providers: [
          EnvironmentRepository,
          {
            provide: getRepositoryToken(Environment),
            useValue: mockRepository,
          },
        ],
      }).compile();

      repository = module.get<EnvironmentRepository>(EnvironmentRepository);
    });

    describe('CRUD operations', () => {
      it('should create an environment', async () => {
        const mockEnv = {
          id: '123',
          project_id: 'proj1',
          name: 'development',
          created_at: new Date(),
        };

        (mockRepository.create as jest.Mock).mockReturnValue(mockEnv);
        (mockRepository.save as jest.Mock).mockResolvedValue(mockEnv);

        const result = await repository.create('proj1', 'development');

        expect(result).toEqual(mockEnv);
        expect(mockRepository.create).toHaveBeenCalledWith({
          project_id: 'proj1',
          name: 'development',
        });
        expect(mockRepository.save).toHaveBeenCalled();
      });

      it('should find environment by id', async () => {
        const mockEnv = {
          id: '123',
          project_id: 'proj1',
          name: 'staging',
          created_at: new Date(),
        };

        (mockRepository.findOne as jest.Mock).mockResolvedValue(mockEnv);

        const result = await repository.findById('123');

        expect(result).toEqual(mockEnv);
        expect(mockRepository.findOne).toHaveBeenCalledWith({ where: { id: '123' } });
      });

      it('should find environments by project', async () => {
        const mockEnvs = [
          { id: '1', project_id: 'proj1', name: 'development', created_at: new Date() },
          { id: '2', project_id: 'proj1', name: 'production', created_at: new Date() },
        ];

        (mockRepository.find as jest.Mock).mockResolvedValue(mockEnvs);

        const result = await repository.findByProject('proj1');

        expect(result).toEqual(mockEnvs);
        expect(mockRepository.find).toHaveBeenCalledWith({
          where: { project_id: 'proj1' },
        });
      });

      it('should delete environment', async () => {
        (mockRepository.delete as jest.Mock).mockResolvedValue({ affected: 1 });

        await repository.delete('123');

        expect(mockRepository.delete).toHaveBeenCalledWith('123');
      });
    });

    describe('Unique constraints', () => {
      it('should throw ConflictException on duplicate environment name in same project', async () => {
        const error: any = new Error('Duplicate key');
        error.code = '23505'; // PostgreSQL unique violation

        (mockRepository.create as jest.Mock).mockReturnValue({});
        (mockRepository.save as jest.Mock).mockRejectedValue(error);

        await expect(repository.create('proj1', 'production')).rejects.toThrow(
          ConflictException
        );
      });

      it('should rethrow non-unique-constraint errors', async () => {
        const error = new Error('Some other error');

        (mockRepository.create as jest.Mock).mockReturnValue({});
        (mockRepository.save as jest.Mock).mockRejectedValue(error);

        await expect(repository.create('proj1', 'test')).rejects.toThrow('Some other error');
      });
    });
  });
});
