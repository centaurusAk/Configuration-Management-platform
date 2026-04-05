/**
 * Integration tests for Rule entity and repository
 * Validates Requirement 4.1: Rule data model with conditions array
 */

import { Test, TestingModule } from '@nestjs/testing';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RuleRepository } from './rule.repository';
import { ConfigKeyRepository } from './config-key.repository';
import { OrganizationRepository } from './organization.repository';
import { ProjectRepository } from './project.repository';
import { EnvironmentRepository } from './environment.repository';
import { UserRepository } from './user.repository';
import { 
  Rule, 
  ConfigKey, 
  Organization, 
  Project, 
  Environment, 
  User,
  ConfigVersion,
  ApiKey,
  AuditLog
} from '../entities';
import { Condition } from '../types/models';

describe('Rule Integration Tests', () => {
  let module: TestingModule;
  let ruleRepository: RuleRepository;
  let configKeyRepository: ConfigKeyRepository;
  let organizationRepository: OrganizationRepository;
  let projectRepository: ProjectRepository;
  let environmentRepository: EnvironmentRepository;
  let userRepository: UserRepository;

  let testOrg: Organization;
  let testProject: Project;
  let testEnv: Environment;
  let testUser: User;
  let testConfigKey: ConfigKey;

  beforeAll(async () => {
    module = await Test.createTestingModule({
      imports: [
        TypeOrmModule.forRoot({
          type: 'postgres',
          host: process.env.DB_HOST || 'localhost',
          port: parseInt(process.env.DB_PORT || '5432'),
          username: process.env.DB_USER || 'postgres',
          password: process.env.DB_PASSWORD || 'postgres',
          database: process.env.DB_NAME || 'config_management_test',
          entities: [Rule, ConfigKey, Organization, Project, Environment, User, ConfigVersion, ApiKey, AuditLog],
          synchronize: true,
          dropSchema: true,
        }),
        TypeOrmModule.forFeature([Rule, ConfigKey, Organization, Project, Environment, User, ConfigVersion, ApiKey, AuditLog]),
      ],
      providers: [
        RuleRepository,
        ConfigKeyRepository,
        OrganizationRepository,
        ProjectRepository,
        EnvironmentRepository,
        UserRepository,
      ],
    }).compile();

    ruleRepository = module.get<RuleRepository>(RuleRepository);
    configKeyRepository = module.get<ConfigKeyRepository>(ConfigKeyRepository);
    organizationRepository = module.get<OrganizationRepository>(OrganizationRepository);
    projectRepository = module.get<ProjectRepository>(ProjectRepository);
    environmentRepository = module.get<EnvironmentRepository>(EnvironmentRepository);
    userRepository = module.get<UserRepository>(UserRepository);
  });

  beforeEach(async () => {
    // Create test data
    testOrg = await organizationRepository.create('Test Org');
    testProject = await projectRepository.create(testOrg.id, 'Test Project');
    testEnv = await environmentRepository.create(testProject.id, 'development');
    testUser = await userRepository.create(
      testOrg.id,
      'test@example.com',
      'hashedpassword',
      'Admin',
    );
    testConfigKey = await configKeyRepository.create(
      testOrg.id,
      testProject.id,
      testEnv.id,
      'feature_flag',
      'boolean',
      false,
    );
  });

  afterEach(async () => {
    // Clean up test data after each test
    const ruleRepo = module.get('RuleRepository');
    const configKeyRepo = module.get('ConfigKeyRepository');
    const userRepo = module.get('UserRepository');
    const envRepo = module.get('EnvironmentRepository');
    const projectRepo = module.get('ProjectRepository');
    const orgRepo = module.get('OrganizationRepository');

    await ruleRepo.query('DELETE FROM rules');
    await configKeyRepo.query('DELETE FROM config_keys');
    await userRepo.query('DELETE FROM users');
    await envRepo.query('DELETE FROM environments');
    await projectRepo.query('DELETE FROM projects');
    await orgRepo.query('DELETE FROM organizations');
  });

  afterAll(async () => {
    await module.close();
  });

  describe('Rule CRUD Operations', () => {
    it('should create a rule with conditions array', async () => {
      const conditions: Condition[] = [
        { attribute: 'region', operator: 'equals', value: 'us-east-1' },
        { attribute: 'tier', operator: 'in_list', value: ['premium', 'enterprise'] },
      ];

      const rule = await ruleRepository.create(
        testConfigKey.id,
        100,
        conditions,
        { enabled: true },
      );

      expect(rule.id).toBeDefined();
      expect(rule.config_key_id).toBe(testConfigKey.id);
      expect(rule.priority).toBe(100);
      expect(rule.conditions).toHaveLength(2);
      expect(rule.conditions[0].attribute).toBe('region');
      expect(rule.conditions[0].operator).toBe('equals');
      expect(rule.conditions[1].attribute).toBe('tier');
      expect(rule.conditions[1].operator).toBe('in_list');
      expect(rule.value).toEqual({ enabled: true });
      expect(rule.enabled).toBe(true);
    });

    it('should support all condition operators', async () => {
      const operators: Condition['operator'][] = [
        'equals',
        'not_equals',
        'in_list',
        'not_in_list',
        'greater_than',
        'less_than',
        'regex_match',
      ];

      for (const operator of operators) {
        const conditions: Condition[] = [
          { attribute: 'test_attr', operator, value: 'test_value' },
        ];

        const rule = await ruleRepository.create(
          testConfigKey.id,
          Math.floor(Math.random() * 1000),
          conditions,
          { test: true },
        );

        expect(rule.conditions[0].operator).toBe(operator);
      }
    });

    it('should retrieve rules ordered by priority DESC', async () => {
      // Create multiple rules with different priorities
      await ruleRepository.create(
        testConfigKey.id,
        50,
        [{ attribute: 'region', operator: 'equals', value: 'us-west-2' }],
        { value: 'low' },
      );

      await ruleRepository.create(
        testConfigKey.id,
        100,
        [{ attribute: 'region', operator: 'equals', value: 'us-east-1' }],
        { value: 'high' },
      );

      await ruleRepository.create(
        testConfigKey.id,
        75,
        [{ attribute: 'region', operator: 'equals', value: 'eu-west-1' }],
        { value: 'medium' },
      );

      const rules = await ruleRepository.findByConfigKey(testConfigKey.id);

      expect(rules).toHaveLength(3);
      expect(rules[0].priority).toBe(100);
      expect(rules[1].priority).toBe(75);
      expect(rules[2].priority).toBe(50);
    });

    it('should filter enabled rules only', async () => {
      await ruleRepository.create(
        testConfigKey.id,
        100,
        [{ attribute: 'region', operator: 'equals', value: 'us-east-1' }],
        { value: 'enabled' },
        true,
      );

      const disabledRule = await ruleRepository.create(
        testConfigKey.id,
        50,
        [{ attribute: 'region', operator: 'equals', value: 'us-west-2' }],
        { value: 'disabled' },
        false,
      );

      const enabledRules = await ruleRepository.findEnabledByConfigKey(testConfigKey.id);
      const allRules = await ruleRepository.findByConfigKey(testConfigKey.id);

      expect(allRules).toHaveLength(2);
      expect(enabledRules).toHaveLength(1);
      expect(enabledRules[0].enabled).toBe(true);
    });

    it('should update rule properties', async () => {
      const rule = await ruleRepository.create(
        testConfigKey.id,
        100,
        [{ attribute: 'region', operator: 'equals', value: 'us-east-1' }],
        { value: 'original' },
      );

      const newConditions: Condition[] = [
        { attribute: 'tier', operator: 'in_list', value: ['premium'] },
      ];

      const updated = await ruleRepository.update(rule.id, {
        priority: 200,
        conditions: newConditions,
        value: { value: 'updated' },
        enabled: false,
      });

      expect(updated).toBeDefined();
      expect(updated!.priority).toBe(200);
      expect(updated!.conditions).toEqual(newConditions);
      expect(updated!.value).toEqual({ value: 'updated' });
      expect(updated!.enabled).toBe(false);
    });

    it('should delete a rule', async () => {
      const rule = await ruleRepository.create(
        testConfigKey.id,
        100,
        [{ attribute: 'region', operator: 'equals', value: 'us-east-1' }],
        { value: 'test' },
      );

      await ruleRepository.delete(rule.id);

      const found = await ruleRepository.findById(rule.id);
      expect(found).toBeNull();
    });

    it('should update priorities for multiple rules in a transaction', async () => {
      const rule1 = await ruleRepository.create(
        testConfigKey.id,
        100,
        [{ attribute: 'region', operator: 'equals', value: 'us-east-1' }],
        { value: 'rule1' },
      );

      const rule2 = await ruleRepository.create(
        testConfigKey.id,
        50,
        [{ attribute: 'region', operator: 'equals', value: 'us-west-2' }],
        { value: 'rule2' },
      );

      await ruleRepository.updatePriorities([
        { id: rule1.id, priority: 200 },
        { id: rule2.id, priority: 150 },
      ]);

      const updated1 = await ruleRepository.findById(rule1.id);
      const updated2 = await ruleRepository.findById(rule2.id);

      expect(updated1!.priority).toBe(200);
      expect(updated2!.priority).toBe(150);
    });
  });

  describe('Rule Conditions', () => {
    it('should store complex condition values', async () => {
      const conditions: Condition[] = [
        { attribute: 'user_id', operator: 'in_list', value: ['user1', 'user2', 'user3'] },
        { attribute: 'app_version', operator: 'regex_match', value: '^2\\.\\d+\\.\\d+$' },
        { attribute: 'tier', operator: 'not_in_list', value: ['free', 'trial'] },
      ];

      const rule = await ruleRepository.create(
        testConfigKey.id,
        100,
        conditions,
        { feature_enabled: true },
      );

      const retrieved = await ruleRepository.findById(rule.id);

      expect(retrieved).toBeDefined();
      expect(retrieved!.conditions).toHaveLength(3);
      expect(retrieved!.conditions[0].value).toEqual(['user1', 'user2', 'user3']);
      expect(retrieved!.conditions[1].value).toBe('^2\\.\\d+\\.\\d+$');
      expect(retrieved!.conditions[2].value).toEqual(['free', 'trial']);
    });

    it('should store numeric comparison conditions', async () => {
      const conditions: Condition[] = [
        { attribute: 'account_age_days', operator: 'greater_than', value: 30 },
        { attribute: 'usage_count', operator: 'less_than', value: 100 },
      ];

      const rule = await ruleRepository.create(
        testConfigKey.id,
        100,
        conditions,
        { discount: 0.2 },
      );

      const retrieved = await ruleRepository.findById(rule.id);

      expect(retrieved).toBeDefined();
      expect(retrieved!.conditions[0].value).toBe(30);
      expect(retrieved!.conditions[1].value).toBe(100);
    });
  });

  describe('Rule Value Storage', () => {
    it('should store boolean values', async () => {
      const rule = await ruleRepository.create(
        testConfigKey.id,
        100,
        [{ attribute: 'region', operator: 'equals', value: 'us-east-1' }],
        true,
      );

      expect(rule.value).toBe(true);
    });

    it('should store string values', async () => {
      const rule = await ruleRepository.create(
        testConfigKey.id,
        100,
        [{ attribute: 'region', operator: 'equals', value: 'us-east-1' }],
        'premium_feature',
      );

      expect(rule.value).toBe('premium_feature');
    });

    it('should store number values', async () => {
      const rule = await ruleRepository.create(
        testConfigKey.id,
        100,
        [{ attribute: 'region', operator: 'equals', value: 'us-east-1' }],
        42,
      );

      expect(rule.value).toBe(42);
    });

    it('should store JSON object values', async () => {
      const complexValue = {
        enabled: true,
        config: {
          timeout: 5000,
          retries: 3,
          endpoints: ['api1.example.com', 'api2.example.com'],
        },
      };

      const rule = await ruleRepository.create(
        testConfigKey.id,
        100,
        [{ attribute: 'region', operator: 'equals', value: 'us-east-1' }],
        complexValue,
      );

      expect(rule.value).toEqual(complexValue);
    });
  });
});
