import { ValidationService } from './validation.service';
import { BadRequestException } from '@nestjs/common';

/**
 * Unit tests for ValidationService
 * 
 * Requirements:
 * - 15.3: Detailed error messages on validation failure
 * - 15.4: Support JSON Schema Draft 7 validation rules
 */
describe('ValidationService', () => {
  let validationService: ValidationService;

  beforeEach(() => {
    validationService = new ValidationService();
  });

  describe('validateAgainstSchema', () => {
    describe('type validation', () => {
      it('should validate string type', () => {
        const schema = { type: 'string' };
        
        expect(() => validationService.validateAgainstSchema('hello', schema)).not.toThrow();
        expect(() => validationService.validateAgainstSchema(123, schema)).toThrow(BadRequestException);
        expect(() => validationService.validateAgainstSchema(true, schema)).toThrow(BadRequestException);
      });

      it('should validate number type', () => {
        const schema = { type: 'number' };
        
        expect(() => validationService.validateAgainstSchema(123, schema)).not.toThrow();
        expect(() => validationService.validateAgainstSchema(45.67, schema)).not.toThrow();
        expect(() => validationService.validateAgainstSchema('123', schema)).toThrow(BadRequestException);
      });

      it('should validate boolean type', () => {
        const schema = { type: 'boolean' };
        
        expect(() => validationService.validateAgainstSchema(true, schema)).not.toThrow();
        expect(() => validationService.validateAgainstSchema(false, schema)).not.toThrow();
        expect(() => validationService.validateAgainstSchema('true', schema)).toThrow(BadRequestException);
      });

      it('should validate object type', () => {
        const schema = { type: 'object' };
        
        expect(() => validationService.validateAgainstSchema({}, schema)).not.toThrow();
        expect(() => validationService.validateAgainstSchema({ key: 'value' }, schema)).not.toThrow();
        expect(() => validationService.validateAgainstSchema('{}', schema)).toThrow(BadRequestException);
      });

      it('should validate array type', () => {
        const schema = { type: 'array' };
        
        expect(() => validationService.validateAgainstSchema([], schema)).not.toThrow();
        expect(() => validationService.validateAgainstSchema([1, 2, 3], schema)).not.toThrow();
        expect(() => validationService.validateAgainstSchema('[]', schema)).toThrow(BadRequestException);
      });
    });

    describe('numeric constraints', () => {
      it('should validate minimum constraint', () => {
        const schema = { type: 'number', minimum: 0 };
        
        expect(() => validationService.validateAgainstSchema(0, schema)).not.toThrow();
        expect(() => validationService.validateAgainstSchema(10, schema)).not.toThrow();
        expect(() => validationService.validateAgainstSchema(-1, schema)).toThrow(BadRequestException);
      });

      it('should validate maximum constraint', () => {
        const schema = { type: 'number', maximum: 100 };
        
        expect(() => validationService.validateAgainstSchema(100, schema)).not.toThrow();
        expect(() => validationService.validateAgainstSchema(50, schema)).not.toThrow();
        expect(() => validationService.validateAgainstSchema(101, schema)).toThrow(BadRequestException);
      });

      it('should validate range constraint', () => {
        const schema = { type: 'number', minimum: 0, maximum: 100 };
        
        expect(() => validationService.validateAgainstSchema(0, schema)).not.toThrow();
        expect(() => validationService.validateAgainstSchema(50, schema)).not.toThrow();
        expect(() => validationService.validateAgainstSchema(100, schema)).not.toThrow();
        expect(() => validationService.validateAgainstSchema(-1, schema)).toThrow(BadRequestException);
        expect(() => validationService.validateAgainstSchema(101, schema)).toThrow(BadRequestException);
      });
    });

    describe('string constraints', () => {
      it('should validate minLength constraint', () => {
        const schema = { type: 'string', minLength: 3 };
        
        expect(() => validationService.validateAgainstSchema('abc', schema)).not.toThrow();
        expect(() => validationService.validateAgainstSchema('abcd', schema)).not.toThrow();
        expect(() => validationService.validateAgainstSchema('ab', schema)).toThrow(BadRequestException);
      });

      it('should validate maxLength constraint', () => {
        const schema = { type: 'string', maxLength: 5 };
        
        expect(() => validationService.validateAgainstSchema('abc', schema)).not.toThrow();
        expect(() => validationService.validateAgainstSchema('abcde', schema)).not.toThrow();
        expect(() => validationService.validateAgainstSchema('abcdef', schema)).toThrow(BadRequestException);
      });

      it('should validate pattern constraint', () => {
        const schema = { type: 'string', pattern: '^[a-z]+$' };
        
        expect(() => validationService.validateAgainstSchema('abc', schema)).not.toThrow();
        expect(() => validationService.validateAgainstSchema('xyz', schema)).not.toThrow();
        expect(() => validationService.validateAgainstSchema('ABC', schema)).toThrow(BadRequestException);
        expect(() => validationService.validateAgainstSchema('abc123', schema)).toThrow(BadRequestException);
      });

      it('should validate enum constraint', () => {
        const schema = { type: 'string', enum: ['red', 'green', 'blue'] };
        
        expect(() => validationService.validateAgainstSchema('red', schema)).not.toThrow();
        expect(() => validationService.validateAgainstSchema('green', schema)).not.toThrow();
        expect(() => validationService.validateAgainstSchema('yellow', schema)).toThrow(BadRequestException);
      });
    });

    describe('object constraints', () => {
      it('should validate required properties', () => {
        const schema = {
          type: 'object',
          required: ['name', 'age'],
          properties: {
            name: { type: 'string' },
            age: { type: 'number' },
          },
        };
        
        expect(() => validationService.validateAgainstSchema({ name: 'John', age: 30 }, schema)).not.toThrow();
        expect(() => validationService.validateAgainstSchema({ name: 'John' }, schema)).toThrow(BadRequestException);
        expect(() => validationService.validateAgainstSchema({ age: 30 }, schema)).toThrow(BadRequestException);
      });

      it('should validate property types', () => {
        const schema = {
          type: 'object',
          properties: {
            name: { type: 'string' },
            age: { type: 'number' },
            active: { type: 'boolean' },
          },
        };
        
        expect(() => validationService.validateAgainstSchema({
          name: 'John',
          age: 30,
          active: true,
        }, schema)).not.toThrow();
        
        expect(() => validationService.validateAgainstSchema({
          name: 123, // Wrong type
          age: 30,
          active: true,
        }, schema)).toThrow(BadRequestException);
      });

      it('should validate additionalProperties', () => {
        const schema = {
          type: 'object',
          properties: {
            name: { type: 'string' },
          },
          additionalProperties: false,
        };
        
        expect(() => validationService.validateAgainstSchema({ name: 'John' }, schema)).not.toThrow();
        expect(() => validationService.validateAgainstSchema({
          name: 'John',
          extra: 'field',
        }, schema)).toThrow(BadRequestException);
      });

      it('should validate nested objects', () => {
        const schema = {
          type: 'object',
          properties: {
            user: {
              type: 'object',
              required: ['name'],
              properties: {
                name: { type: 'string' },
                email: { type: 'string' },
              },
            },
          },
        };
        
        expect(() => validationService.validateAgainstSchema({
          user: { name: 'John', email: 'john@example.com' },
        }, schema)).not.toThrow();
        
        expect(() => validationService.validateAgainstSchema({
          user: { email: 'john@example.com' }, // Missing name
        }, schema)).toThrow(BadRequestException);
      });
    });

    describe('array constraints', () => {
      it('should validate array items type', () => {
        const schema = {
          type: 'array',
          items: { type: 'number' },
        };
        
        expect(() => validationService.validateAgainstSchema([1, 2, 3], schema)).not.toThrow();
        expect(() => validationService.validateAgainstSchema([1, 'two', 3], schema)).toThrow(BadRequestException);
      });

      it('should validate minItems constraint', () => {
        const schema = {
          type: 'array',
          minItems: 2,
        };
        
        expect(() => validationService.validateAgainstSchema([1, 2], schema)).not.toThrow();
        expect(() => validationService.validateAgainstSchema([1, 2, 3], schema)).not.toThrow();
        expect(() => validationService.validateAgainstSchema([1], schema)).toThrow(BadRequestException);
      });

      it('should validate maxItems constraint', () => {
        const schema = {
          type: 'array',
          maxItems: 3,
        };
        
        expect(() => validationService.validateAgainstSchema([1, 2, 3], schema)).not.toThrow();
        expect(() => validationService.validateAgainstSchema([1, 2], schema)).not.toThrow();
        expect(() => validationService.validateAgainstSchema([1, 2, 3, 4], schema)).toThrow(BadRequestException);
      });
    });

    describe('error message formatting', () => {
      it('should provide detailed error messages for type mismatches', () => {
        const schema = { type: 'number' };
        
        try {
          validationService.validateAgainstSchema('not-a-number', schema);
          fail('Should have thrown BadRequestException');
        } catch (error) {
          expect(error).toBeInstanceOf(BadRequestException);
          const response = (error as BadRequestException).getResponse();
          expect(response).toHaveProperty('message');
          expect(response).toHaveProperty('errors');
          expect(Array.isArray((response as any).errors)).toBe(true);
          expect((response as any).errors[0]).toContain('type');
        }
      });

      it('should provide detailed error messages for missing required fields', () => {
        const schema = {
          type: 'object',
          required: ['name', 'age'],
          properties: {
            name: { type: 'string' },
            age: { type: 'number' },
          },
        };
        
        try {
          validationService.validateAgainstSchema({ name: 'John' }, schema);
          fail('Should have thrown BadRequestException');
        } catch (error) {
          expect(error).toBeInstanceOf(BadRequestException);
          const response = (error as BadRequestException).getResponse();
          expect((response as any).errors[0]).toContain('age');
          expect((response as any).errors[0]).toContain('required');
        }
      });

      it('should provide detailed error messages for range violations', () => {
        const schema = { type: 'number', minimum: 0, maximum: 100 };
        
        try {
          validationService.validateAgainstSchema(150, schema);
          fail('Should have thrown BadRequestException');
        } catch (error) {
          expect(error).toBeInstanceOf(BadRequestException);
          const response = (error as BadRequestException).getResponse();
          expect((response as any).errors[0]).toContain('100');
          expect((response as any).errors[0]).toContain('<=');
        }
      });

      it('should provide detailed error messages for pattern violations', () => {
        const schema = { type: 'string', pattern: '^[a-z]+$' };
        
        try {
          validationService.validateAgainstSchema('ABC123', schema);
          fail('Should have thrown BadRequestException');
        } catch (error) {
          expect(error).toBeInstanceOf(BadRequestException);
          const response = (error as BadRequestException).getResponse();
          expect((response as any).errors[0]).toContain('pattern');
        }
      });

      it('should collect all errors when allErrors is enabled', () => {
        const schema = {
          type: 'object',
          required: ['name', 'age', 'email'],
          properties: {
            name: { type: 'string' },
            age: { type: 'number' },
            email: { type: 'string' },
          },
        };
        
        try {
          validationService.validateAgainstSchema({ name: 'John' }, schema);
          fail('Should have thrown BadRequestException');
        } catch (error) {
          expect(error).toBeInstanceOf(BadRequestException);
          const response = (error as BadRequestException).getResponse();
          // Should have errors for both missing 'age' and 'email'
          expect((response as any).errors.length).toBeGreaterThanOrEqual(2);
        }
      });
    });

    describe('complex schema scenarios', () => {
      it('should validate feature flag configuration schema', () => {
        const schema = {
          type: 'object',
          required: ['feature', 'enabled', 'rollout'],
          properties: {
            feature: { type: 'string', minLength: 1 },
            enabled: { type: 'boolean' },
            rollout: { type: 'number', minimum: 0, maximum: 100 },
            metadata: {
              type: 'object',
              properties: {
                description: { type: 'string' },
                owner: { type: 'string' },
              },
            },
          },
          additionalProperties: false,
        };
        
        // Valid configuration
        expect(() => validationService.validateAgainstSchema({
          feature: 'new-ui',
          enabled: true,
          rollout: 50,
          metadata: {
            description: 'New UI redesign',
            owner: 'team-frontend',
          },
        }, schema)).not.toThrow();
        
        // Invalid: rollout out of range
        expect(() => validationService.validateAgainstSchema({
          feature: 'new-ui',
          enabled: true,
          rollout: 150,
        }, schema)).toThrow(BadRequestException);
        
        // Invalid: additional property
        expect(() => validationService.validateAgainstSchema({
          feature: 'new-ui',
          enabled: true,
          rollout: 50,
          extra: 'field',
        }, schema)).toThrow(BadRequestException);
      });

      it('should validate API configuration schema', () => {
        const schema = {
          type: 'object',
          required: ['baseUrl', 'timeout'],
          properties: {
            baseUrl: { type: 'string', pattern: '^https?://' },
            timeout: { type: 'number', minimum: 1000, maximum: 60000 },
            retries: { type: 'number', minimum: 0, maximum: 5 },
            headers: {
              type: 'object',
              additionalProperties: { type: 'string' },
            },
          },
        };
        
        // Valid configuration
        expect(() => validationService.validateAgainstSchema({
          baseUrl: 'https://api.example.com',
          timeout: 5000,
          retries: 3,
          headers: {
            'Content-Type': 'application/json',
            'Authorization': 'Bearer token',
          },
        }, schema)).not.toThrow();
        
        // Invalid: baseUrl doesn't match pattern
        expect(() => validationService.validateAgainstSchema({
          baseUrl: 'not-a-url',
          timeout: 5000,
        }, schema)).toThrow(BadRequestException);
      });
    });
  });
});
