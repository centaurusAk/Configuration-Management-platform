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
    
    // Extract API key from X-API-Key header or Authorization header
    // Supports: X-API-Key: <api_key>, Authorization: "Bearer <api_key>", Authorization: "ApiKey <api_key>"
    let key: string | undefined;

    const xApiKey = request.headers['x-api-key'];
    const authHeader = request.headers['authorization'];

    if (xApiKey) {
      key = xApiKey;
    } else if (authHeader) {
      const parts = authHeader.split(' ');
      if (parts.length !== 2) {
        throw new UnauthorizedException('Invalid authorization header format');
      }
      const [scheme, token] = parts;
      if (scheme !== 'Bearer' && scheme !== 'ApiKey') {
        throw new UnauthorizedException('Invalid authorization scheme');
      }
      key = token;
    }

    if (!key) {
      throw new UnauthorizedException('API key required. Use X-API-Key header or Authorization: Bearer/ApiKey <key>');
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
