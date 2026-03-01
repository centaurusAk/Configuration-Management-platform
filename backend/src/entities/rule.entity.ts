import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, ManyToOne, JoinColumn } from 'typeorm';
import { ConfigKey } from './config-key.entity';
import { Condition } from '../types/models';

@Entity('rules')
export class Rule {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  config_key_id: string;

  @Column({ type: 'integer' })
  priority: number;

  @Column({ type: 'jsonb' })
  conditions: Condition[];

  @Column({ type: 'jsonb' })
  value: any;

  @Column({ type: 'boolean', default: true })
  enabled: boolean;

  @CreateDateColumn({ type: 'timestamp' })
  created_at: Date;

  @UpdateDateColumn({ type: 'timestamp' })
  updated_at: Date;

  @ManyToOne(() => ConfigKey, configKey => configKey.rules)
  @JoinColumn({ name: 'config_key_id' })
  config_key: ConfigKey;
}
