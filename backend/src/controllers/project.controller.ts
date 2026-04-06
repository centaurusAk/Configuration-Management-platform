import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  UseGuards,
  Req,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PermissionsGuard } from '../auth/permissions.guard';
import { RequirePermission } from '../auth/require-permission.decorator';
import { Permission } from '../auth/permissions';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Project } from '../entities/project.entity';
import { Environment } from '../entities/environment.entity';

@Controller('projects')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class ProjectController {
  constructor(
    @InjectRepository(Project)
    private readonly projectRepository: Repository<Project>,
    @InjectRepository(Environment)
    private readonly environmentRepository: Repository<Environment>,
  ) {}

  @Get()
  @RequirePermission(Permission.READ_CONFIG)
  async list(@Req() req: any) {
    const user = req.user;
    return this.projectRepository.find({
      where: { organization_id: user.organization_id },
      order: { created_at: 'ASC' },
    });
  }

  @Get(':id/environments')
  @RequirePermission(Permission.READ_CONFIG)
  async getEnvironments(@Param('id') projectId: string) {
    return this.environmentRepository.find({
      where: { project_id: projectId },
      order: { created_at: 'ASC' },
    });
  }

  @Post()
  @RequirePermission(Permission.MANAGE_PROJECTS)
  async create(@Req() req: any, @Body() body: { name: string }) {
    const user = req.user;
    
    // Create the project
    const project = this.projectRepository.create({
      organization_id: user.organization_id,
      name: body.name,
    });
    const savedProject = await this.projectRepository.save(project);

    // Create default environments
    const environments = ['development', 'staging', 'production'].map(name => {
      return this.environmentRepository.create({
        project_id: savedProject.id,
        name,
      });
    });
    await this.environmentRepository.save(environments);

    return savedProject;
  }
}
