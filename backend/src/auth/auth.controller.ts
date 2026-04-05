import { Controller, Post, Get, Body, HttpCode, HttpStatus, UseGuards, Req } from '@nestjs/common';
import { AuthService } from './auth.service';
import { JwtAuthGuard } from './jwt-auth.guard';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('register')
  @HttpCode(HttpStatus.CREATED)
  async register(
    @Body() body: { email: string; password: string; organizationName: string },
  ) {
    const { token, user, organizationName } = await this.authService.register(
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
        organizationId: user.organization_id,
        organizationName,
      },
    };
  }

  @Post('login')
  @HttpCode(HttpStatus.OK)
  async login(@Body() body: { email: string; password: string }) {
    const { token, user, organizationName } = await this.authService.login(body.email, body.password);
    return {
      token,
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
        organizationId: user.organization_id,
        organizationName,
      },
    };
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  async me(@Req() req: any) {
    const user = req.user;
    // Fetch org name
    const orgResult = await this.authService['userRepository'].manager.query(
      'SELECT name FROM organizations WHERE id = $1',
      [user.organization_id],
    );
    const organizationName = orgResult?.[0]?.name || '';

    return {
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
        organizationId: user.organization_id,
        organizationName,
      },
    };
  }
}
