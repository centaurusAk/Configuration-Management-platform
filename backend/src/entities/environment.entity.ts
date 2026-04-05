import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, ManyToOne, OneToMany, JoinColumn, Unique } from 'typeorm';
import { Project } from './project.entity';
import { ConfigKey } from './config-key.entity';
import { ApiKey } from './api-key.entity';

@Entity('environments')
@Unique(['project_id', 'name'])
export class Environment {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  project_id: string;

  @Column({ type: 'varchar', length: 50 })
  name: string;

  @CreateDateColumn({ type: 'timestamp' })
  created_at: Date;

  @ManyToOne(() => Project, project => project.environments)
  @JoinColumn({ name: 'project_id' })
  project: Project;

  @OneToMany(() => ConfigKey, configKey => configKey.environment)
  config_keys: ConfigKey[];

  @OneToMany(() => ApiKey, apiKey => apiKey.environment)
  api_keys: ApiKey[];
}
