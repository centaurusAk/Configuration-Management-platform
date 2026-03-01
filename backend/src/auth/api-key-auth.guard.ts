import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
} from '@nestjs/common';
import { AuthService } from './auth.service';

/**
 * Guard for API key authentication
 * Used for SDK endpoints
 * Requirement 7.6: API key authentication for SDK endpoints
 */
@Injectable()
export class ApiKeyAuthGuard implements CanActivate {
  constructor(private readonly authService: AuthService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    
    // Extract API key from Authorization header
    // Expected format: "Bearer <api_key>" or "ApiKey <api_key>"
    const authHeader = request.headers['authorization'];
    
    if (!authHeader) {
      throw new UnauthorizedException('API key required');
    }

    const parts = authHeader.split(' ');
    if (parts.length !== 2) {
      throw new UnauthorizedException('Invalid authorization header format');
    }

    const [scheme, key] = parts;
    if (scheme !== 'Bearer' && scheme !== 'ApiKey') {
      throw new UnauthorizedException('Invalid authorization scheme');
    }

    // Validate API key
    const apiKey = await this.authService.validateApiKey(key);
    
    if (!apiKey) {
      throw new UnauthorizedException('Invalid or expired API key');
    }

    // Attach API key info to request for use in controllers
    request.apiKey = apiKey;
    
    return true;
  }
}
