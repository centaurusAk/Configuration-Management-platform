import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule } from '@nestjs/config';
import { ControllersModule } from './controllers/controllers.module';
import { Organization } from './entities/organization.entity';
import { Project } from './entities/project.entity';
import { Environment } from './entities/environment.entity';
import { User } from './entities/user.entity';
import { ConfigKey } from './entities/config-key.entity';
import { ConfigVersion } from './entities/config-version.entity';
import { Rule } from './entities/rule.entity';
import { ApiKey } from './entities/api-key.entity';
import { AuditLog } from './entities/audit-log.entity';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    TypeOrmModule.forRoot({
      type: 'postgres',
      host: process.env.DATABASE_HOST || 'localhost',
      port: parseInt(process.env.DATABASE_PORT || '5432'),
      username: process.env.DATABASE_USER || 'postgres',
      password: process.env.DATABASE_PASSWORD || 'postgres',
      database: process.env.DATABASE_NAME || 'config_management',
      entities: [
        Organization,
        Project,
        Environment,
        User,
        ConfigKey,
        ConfigVersion,
        Rule,
        ApiKey,
        AuditLog,
      ],
      synchronize: false, // Use migrations in production
    }),
    ControllersModule,
  ],
})
export class AppModule {}
