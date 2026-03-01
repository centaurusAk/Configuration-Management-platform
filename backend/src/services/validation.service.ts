import { Injectable, BadRequestException } from '@nestjs/common';
import Ajv, { ValidateFunction, ErrorObject } from 'ajv';

/**
 * ValidationService - Provides JSON Schema validation using ajv
 * 
 * Requirements:
 * - 15.1: Accept JSON schema for value validation
 * - 15.4: Support JSON Schema Draft 7 validation rules
 */
@Injectable()
export class ValidationService {
  private readonly ajv: Ajv;
  private readonly schemaCache: Map<string, ValidateFunction>;

  constructor() {
    // Initialize ajv with JSON Schema Draft 7 support (Requirement 15.4)
    this.ajv = new Ajv({
      allErrors: true, // Collect all errors, not just the first one
      verbose: true,   // Include schema and data in errors
      strict: false,   // Allow additional properties by default
    });

    this.schemaCache = new Map();
  }

  /**
   * Validate a value against a JSON schema
   * Requirement 15.2: Validate values against schema on update
   * Requirement 15.3: Return 400 with detailed errors on validation failure
   * 
   * @param value - The value to validate
   * @param schema - The JSON schema to validate against
   * @throws BadRequestException if validation fails with detailed error messages
   */
  validateAgainstSchema(value: any, schema: object): void {
    // Get or compile the validation function
    const validate = this.getValidateFunction(schema);

    // Perform validation
    const valid = validate(value);

    if (!valid) {
      // Requirement 15.3: Return 400 with detailed errors
      const errors = this.formatErrors(validate.errors || []);
      throw new BadRequestException({
        message: 'Value does not match schema',
        errors: errors,
      });
    }
  }

  /**
   * Get or compile a validation function for a schema
   * Uses caching to avoid recompiling the same schema multiple times
   */
  private getValidateFunction(schema: object): ValidateFunction {
    const schemaKey = JSON.stringify(schema);

    // Check cache first
    if (this.schemaCache.has(schemaKey)) {
      return this.schemaCache.get(schemaKey)!;
    }

    // Compile and cache the validation function
    const validate = this.ajv.compile(schema);
    this.schemaCache.set(schemaKey, validate);

    return validate;
  }

  /**
   * Format ajv errors into a more readable format
   * Requirement 15.3: Detailed error messages
   */
  private formatErrors(errors: ErrorObject[]): string[] {
    return errors.map((error) => {
      const path = error.instancePath || 'root';
      const message = error.message || 'validation failed';

      // Include additional context based on error keyword
      switch (error.keyword) {
        case 'type':
          return `${path}: expected type ${error.params.type}, got ${typeof error.data}`;
        case 'required':
          return `${path}: missing required property '${error.params.missingProperty}'`;
        case 'enum':
          return `${path}: value must be one of ${JSON.stringify(error.params.allowedValues)}`;
        case 'minimum':
          return `${path}: value must be >= ${error.params.limit}`;
        case 'maximum':
          return `${path}: value must be <= ${error.params.limit}`;
        case 'minLength':
          return `${path}: string length must be >= ${error.params.limit}`;
        case 'maxLength':
          return `${path}: string length must be <= ${error.params.limit}`;
        case 'pattern':
          return `${path}: string must match pattern ${error.params.pattern}`;
        case 'format':
          return `${path}: string must be valid ${error.params.format}`;
        case 'additionalProperties':
          return `${path}: additional property '${error.params.additionalProperty}' is not allowed`;
        default:
          return `${path}: ${message}`;
      }
    });
  }
}
