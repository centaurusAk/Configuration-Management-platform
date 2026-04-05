import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { RuleRepository } from './rule.repository';
import { Rule } from '../entities/rule.entity';
import { Condition } from '../types/models';

describe('RuleRepository', () => {
  let ruleRepository: RuleRepository;
  let mockRepository: Partial<Repository<Rule>>;

  beforeEach(async () => {
    mockRepository = {
      create: jest.fn(),
      save: jest.fn(),
      findOne: jest.fn(),
      find: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      manager: {
        transaction: jest.fn(),
      } as any,
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RuleRepository,
        {
          provide: getRepositoryToken(Rule),
          useValue: mockRepository,
        },
      ],
    }).compile();

    ruleRepository = module.get<RuleRepository>(RuleRepository);
  });

  describe('create', () => {
    it('should create a rule with conditions array', async () => {
      const configKeyId = 'config-123';
      const priority = 100;
      const conditions: Condition[] = [
        { attribute: 'region', operator: 'equals', value: 'us-east-1' },
        { attribute: 'tier', operator: 'in_list', value: ['premium', 'enterprise'] },
      ];
      const value = { enabled: true };

      const mockRule: Rule = {
        id: 'rule-123',
        config_key_id: configKeyId,
        priority,
        conditions,
        value,
        enabled: true,
        created_at: new Date(),
        updated_at: new Date(),
      } as Rule;

      (mockRepository.create as jest.Mock).mockReturnValue(mockRule);
      (mockRepository.save as jest.Mock).mockResolvedValue(mockRule);

      const result = await ruleRepository.create(configKeyId, priority, conditions, value);

      expect(mockRepository.create).toHaveBeenCalledWith({
        config_key_id: configKeyId,
        priority,
        conditions,
        value,
        enabled: true,
      });
      expect(mockRepository.save).toHaveBeenCalledWith(mockRule);
      expect(result).toEqual(mockRule);
      expect(result.conditions).toHaveLength(2);
      expect(result.conditions[0].operator).toBe('equals');
      expect(result.conditions[1].operator).toBe('in_list');
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
          { attribute: 'test', operator, value: 'test-value' },
        ];

        const mockRule: Rule = {
          id: 'rule-123',
          config_key_id: 'config-123',
          priority: 100,
          conditions,
          value: {},
          enabled: true,
          created_at: new Date(),
          updated_at: new Date(),
        } as Rule;

        (mockRepository.create as jest.Mock).mockReturnValue(mockRule);
        (mockRepository.save as jest.Mock).mockResolvedValue(mockRule);

        const result = await ruleRepository.create('config-123', 100, conditions, {});

        expect(result.conditions[0].operator).toBe(operator);
      }
    });
  });

  describe('findByConfigKey', () => {
    it('should return rules ordered by priority DESC', async () => {
      const configKeyId = 'config-123';
      const mockRules: Rule[] = [
        {
          id: 'rule-1',
          config_key_id: configKeyId,
          priority: 100,
          conditions: [],
          value: {},
          enabled: true,
          created_at: new Date(),
          updated_at: new Date(),
        } as unknown as Rule,
        {
          id: 'rule-2',
          config_key_id: configKeyId,
          priority: 50,
          conditions: [],
          value: {},
          enabled: true,
          created_at: new Date(),
          updated_at: new Date(),
        } as unknown as Rule,
      ];

      (mockRepository.find as jest.Mock).mockResolvedValue(mockRules);

      const result = await ruleRepository.findByConfigKey(configKeyId);

      expect(mockRepository.find).toHaveBeenCalledWith({
        where: { config_key_id: configKeyId },
        order: { priority: 'DESC' },
      });
      expect(result).toEqual(mockRules);
    });
  });

  describe('findEnabledByConfigKey', () => {
    it('should return only enabled rules ordered by priority DESC', async () => {
      const configKeyId = 'config-123';
      const mockRules: Rule[] = [
        {
          id: 'rule-1',
          config_key_id: configKeyId,
          priority: 100,
          conditions: [],
          value: {},
          enabled: true,
          created_at: new Date(),
          updated_at: new Date(),
        } as unknown as Rule,
      ];

      (mockRepository.find as jest.Mock).mockResolvedValue(mockRules);

      const result = await ruleRepository.findEnabledByConfigKey(configKeyId);

      expect(mockRepository.find).toHaveBeenCalledWith({
        where: { config_key_id: configKeyId, enabled: true },
        order: { priority: 'DESC' },
      });
      expect(result).toEqual(mockRules);
    });
  });

  describe('update', () => {
    it('should update rule properties', async () => {
      const ruleId = 'rule-123';
      const updates = {
        priority: 200,
        enabled: false,
      };

      const updatedRule: Rule = {
        id: ruleId,
        config_key_id: 'config-123',
        priority: 200,
        conditions: [],
        value: {},
        enabled: false,
        created_at: new Date(),
        updated_at: new Date(),
      } as unknown as Rule;

      (mockRepository.update as jest.Mock).mockResolvedValue({ affected: 1 });
      (mockRepository.findOne as jest.Mock).mockResolvedValue(updatedRule);

      const result = await ruleRepository.update(ruleId, updates);

      expect(mockRepository.update).toHaveBeenCalledWith(ruleId, updates);
      expect(result).toEqual(updatedRule);
    });
  });

  describe('delete', () => {
    it('should delete a rule', async () => {
      const ruleId = 'rule-123';

      (mockRepository.delete as jest.Mock).mockResolvedValue({ affected: 1 });

      await ruleRepository.delete(ruleId);

      expect(mockRepository.delete).toHaveBeenCalledWith(ruleId);
    });
  });

  describe('updatePriorities', () => {
    it('should update priorities for multiple rules in a transaction', async () => {
      const updates = [
        { id: 'rule-1', priority: 100 },
        { id: 'rule-2', priority: 50 },
      ];

      const mockManager = {
        update: jest.fn().mockResolvedValue({ affected: 1 }),
      };

      (mockRepository.manager!.transaction as jest.Mock).mockImplementation(
        async (callback) => callback(mockManager),
      );

      await ruleRepository.updatePriorities(updates);

      expect(mockRepository.manager!.transaction).toHaveBeenCalled();
      expect(mockManager.update).toHaveBeenCalledTimes(2);
      expect(mockManager.update).toHaveBeenCalledWith(Rule, 'rule-1', { priority: 100 });
      expect(mockManager.update).toHaveBeenCalledWith(Rule, 'rule-2', { priority: 50 });
    });
  });
});
