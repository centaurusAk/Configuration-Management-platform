import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, ManyToOne, OneToMany, JoinColumn } from 'typeorm';
import { Organization } from './organization.entity';
import { ConfigVersion } from './config-version.entity';
import { ApiKey } from './api-key.entity';
import { AuditLog } from './audit-log.entity';

@Entity('users')
export class User {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  organization_id: string;

  @Column({ type: 'varchar', length: 255, unique: true })
  email: string;

  @Column({ type: 'varchar', length: 255 })
  password_hash: string;

  @Column({ type: 'varchar', length: 20 })
  role: 'Admin' | 'Editor' | 'Viewer';

  @CreateDateColumn({ type: 'timestamp' })
  created_at: Date;

  @UpdateDateColumn({ type: 'timestamp' })
  updated_at: Date;

  @ManyToOne(() => Organization, organization => organization.users)
  @JoinColumn({ name: 'organization_id' })
  organization: Organization;

  @OneToMany(() => ConfigVersion, configVersion => configVersion.created_by_user)
  config_versions: ConfigVersion[];

  @OneToMany(() => ApiKey, apiKey => apiKey.created_by_user)
  api_keys: ApiKey[];

  @OneToMany(() => AuditLog, auditLog => auditLog.user)
  audit_logs: AuditLog[];
}
