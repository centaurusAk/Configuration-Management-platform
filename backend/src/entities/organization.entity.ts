import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, OneToMany } from 'typeorm';
import { Project } from './project.entity';
import { User } from './user.entity';
import { ConfigKey } from './config-key.entity';
import { AuditLog } from './audit-log.entity';

@Entity('organizations')
export class Organization {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 255 })
  name: string;

  @CreateDateColumn({ type: 'timestamp' })
  created_at: Date;

  @UpdateDateColumn({ type: 'timestamp' })
  updated_at: Date;

  @OneToMany(() => Project, project => project.organization)
  projects: Project[];

  @OneToMany(() => User, user => user.organization)
  users: User[];

  @OneToMany(() => ConfigKey, configKey => configKey.organization)
  config_keys: ConfigKey[];

  @OneToMany(() => AuditLog, auditLog => auditLog.organization)
  audit_logs: AuditLog[];
}
