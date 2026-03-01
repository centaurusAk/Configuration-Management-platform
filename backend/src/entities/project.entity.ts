import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, ManyToOne, OneToMany, JoinColumn, Unique } from 'typeorm';
import { Organization } from './organization.entity';
import { Environment } from './environment.entity';
import { ConfigKey } from './config-key.entity';
import { ApiKey } from './api-key.entity';

@Entity('projects')
@Unique(['organization_id', 'name'])
export class Project {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  organization_id: string;

  @Column({ type: 'varchar', length: 255 })
  name: string;

  @CreateDateColumn({ type: 'timestamp' })
  created_at: Date;

  @UpdateDateColumn({ type: 'timestamp' })
  updated_at: Date;

  @ManyToOne(() => Organization, organization => organization.projects)
  @JoinColumn({ name: 'organization_id' })
  organization: Organization;

  @OneToMany(() => Environment, environment => environment.project)
  environments: Environment[];

  @OneToMany(() => ConfigKey, configKey => configKey.project)
  config_keys: ConfigKey[];

  @OneToMany(() => ApiKey, apiKey => apiKey.project)
  api_keys: ApiKey[];
}
