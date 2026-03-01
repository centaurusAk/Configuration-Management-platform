import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, ManyToOne, JoinColumn } from 'typeorm';
import { User } from './user.entity';
import { Organization } from './organization.entity';

@Entity('audit_logs')
export class AuditLog {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @CreateDateColumn({ type: 'timestamp' })
  timestamp: Date;

  @Column({ type: 'uuid' })
  user_id: string;

  @Column({ type: 'uuid' })
  organization_id: string;

  @Column({ type: 'varchar', length: 20 })
  action_type: 'CREATE' | 'UPDATE' | 'DELETE' | 'ROLLBACK';

  @Column({ type: 'varchar', length: 20 })
  resource_type: 'CONFIG_KEY' | 'CONFIG_VERSION' | 'RULE' | 'API_KEY' | 'USER';

  @Column({ type: 'uuid' })
  resource_id: string;

  @Column({ type: 'jsonb', nullable: true })
  old_value?: any;

  @Column({ type: 'jsonb', nullable: true })
  new_value?: any;

  @Column({ type: 'jsonb', nullable: true })
  metadata?: Record<string, any>;

  @ManyToOne(() => User, user => user.audit_logs)
  @JoinColumn({ name: 'user_id' })
  user: User;

  @ManyToOne(() => Organization, organization => organization.audit_logs)
  @JoinColumn({ name: 'organization_id' })
  organization: Organization;
}
