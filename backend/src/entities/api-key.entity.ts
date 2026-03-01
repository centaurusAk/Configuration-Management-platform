import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, ManyToOne, JoinColumn } from 'typeorm';
import { Project } from './project.entity';
import { Environment } from './environment.entity';
import { User } from './user.entity';

@Entity('api_keys')
export class ApiKey {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 255 })
  key_hash: string;

  @Column({ type: 'varchar', length: 8 })
  prefix: string;

  @Column({ type: 'uuid' })
  project_id: string;

  @Column({ type: 'uuid' })
  environment_id: string;

  @Column({ type: 'uuid' })
  created_by: string;

  @Column({ type: 'timestamp', nullable: true })
  expires_at?: Date;

  @Column({ type: 'boolean', default: false })
  revoked: boolean;

  @CreateDateColumn({ type: 'timestamp' })
  created_at: Date;

  @ManyToOne(() => Project, project => project.api_keys)
  @JoinColumn({ name: 'project_id' })
  project: Project;

  @ManyToOne(() => Environment, environment => environment.api_keys)
  @JoinColumn({ name: 'environment_id' })
  environment: Environment;

  @ManyToOne(() => User, user => user.api_keys)
  @JoinColumn({ name: 'created_by' })
  created_by_user: User;
}
