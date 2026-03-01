import { Controller, Post, Body, HttpCode, HttpStatus } from '@nestjs/common';
import { AuthService } from './auth.service';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('register')
  @HttpCode(HttpStatus.CREATED)
  async register(
    @Body() body: { email: string; password: string; organizationName: string },
  ) {
    const { token, user } = await this.authService.register(
      body.email,
      body.password,
      body.organizationName,
    );

    return {
      token,
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
        organization_id: user.organization_id,
      },
    };
  }

  @Post('login')
  @HttpCode(HttpStatus.OK)
  async login(@Body() body: { email: string; password: string }) {
    const { token, user } = await this.authService.login(body.email, body.password);
    return {
      token,
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
        organization_id: user.organization_id,
      },
    };
  }
}
