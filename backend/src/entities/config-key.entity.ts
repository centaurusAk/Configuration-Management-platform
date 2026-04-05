import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, ManyToOne, OneToMany, JoinColumn, DeleteDateColumn } from 'typeorm';
import { Organization } from './organization.entity';
import { Project } from './project.entity';
import { Environment } from './environment.entity';
import { ConfigVersion } from './config-version.entity';
import { Rule } from './rule.entity';

@Entity('config_keys')
export class ConfigKey {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  organization_id: string;

  @Column({ type: 'uuid' })
  project_id: string;

  @Column({ type: 'uuid' })
  environment_id: string;

  @Column({ type: 'varchar', length: 255 })
  key_name: string;

  @Column({ type: 'varchar', length: 20 })
  value_type: 'boolean' | 'string' | 'number' | 'json';

  @Column({ type: 'jsonb' })
  current_value: any;

  @Column({ type: 'jsonb', nullable: true })
  schema?: object;

  @DeleteDateColumn({ type: 'timestamp', nullable: true })
  deleted_at?: Date;

  @CreateDateColumn({ type: 'timestamp' })
  created_at: Date;

  @UpdateDateColumn({ type: 'timestamp' })
  updated_at: Date;

  @ManyToOne(() => Organization, organization => organization.config_keys)
  @JoinColumn({ name: 'organization_id' })
  organization: Organization;

  @ManyToOne(() => Project, project => project.config_keys)
  @JoinColumn({ name: 'project_id' })
  project: Project;

  @ManyToOne(() => Environment, environment => environment.config_keys)
  @JoinColumn({ name: 'environment_id' })
  environment: Environment;

  @OneToMany(() => ConfigVersion, configVersion => configVersion.config_key)
  versions: ConfigVersion[];

  @OneToMany(() => Rule, rule => rule.config_key)
  rules: Rule[];
}
