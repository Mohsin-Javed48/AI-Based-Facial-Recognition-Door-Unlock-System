import { UnauthorizedException } from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import { AuthService } from './auth.service';

describe('AuthService', () => {
  const jwtService = { signAsync: jest.fn() };
  let service: AuthService;
  const originalEnv = { ...process.env };

  beforeAll(async () => {
    process.env.ADMIN_USERNAME = 'admin';
    process.env.ADMIN_PASSWORD_HASH = await bcrypt.hash('secretpw', 10);
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  beforeEach(() => {
    jest.clearAllMocks();
    service = new AuthService(jwtService as never);
  });

  it('issues an access token for valid credentials', async () => {
    jwtService.signAsync.mockResolvedValue('signed.jwt.token');

    const result = await service.login('admin', 'secretpw');

    expect(result.accessToken).toBe('signed.jwt.token');
    expect(jwtService.signAsync).toHaveBeenCalledWith({
      sub: 'admin',
      username: 'admin',
    });
  });

  it('rejects an invalid password', async () => {
    await expect(service.login('admin', 'wrong-password')).rejects.toThrow(
      UnauthorizedException,
    );
    expect(jwtService.signAsync).not.toHaveBeenCalled();
  });

  it('rejects an unknown username', async () => {
    await expect(service.login('someone-else', 'secretpw')).rejects.toThrow(
      UnauthorizedException,
    );
    expect(jwtService.signAsync).not.toHaveBeenCalled();
  });
});
