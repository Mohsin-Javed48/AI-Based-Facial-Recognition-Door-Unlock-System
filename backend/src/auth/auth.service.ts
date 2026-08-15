import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';

/**
 * Single-admin login (README Section 14 / Section 20 Rule 5) - there is no
 * users table. Credentials come from the environment; never hardcoded.
 */
@Injectable()
export class AuthService {
  constructor(private readonly jwtService: JwtService) {}

  async login(
    username: string,
    password: string,
  ): Promise<{ accessToken: string }> {
    const adminUsername = process.env.ADMIN_USERNAME;
    const adminPasswordHash = process.env.ADMIN_PASSWORD_HASH;

    if (!adminUsername || !adminPasswordHash) {
      throw new UnauthorizedException('Authentication is not configured');
    }

    const usernameMatches = username === adminUsername;
    // Always run the hash comparison, even for an unknown username, so
    // response timing doesn't leak which check failed.
    const passwordMatches = await bcrypt.compare(password, adminPasswordHash);

    if (!usernameMatches || !passwordMatches) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const accessToken = await this.jwtService.signAsync({
      sub: username,
      username,
    });
    return { accessToken };
  }
}
