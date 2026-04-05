import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, ManyToOne, JoinColumn } from 'typeorm';
import { ConfigKey } from './config-key.entity';
import { User } from './user.entity';

@Entity('config_versions')
export class ConfigVersion {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  config_key_id: string;

  @Column({ type: 'jsonb' })
  value: any;

  @Column({ type: 'uuid' })
  created_by: string;

  @CreateDateColumn({ type: 'timestamp' })
  created_at: Date;

  @ManyToOne(() => ConfigKey, configKey => configKey.versions)
  @JoinColumn({ name: 'config_key_id' })
  config_key: ConfigKey;

  @ManyToOne(() => User, user => user.config_versions)
  @JoinColumn({ name: 'created_by' })
  created_by_user: User;
}
