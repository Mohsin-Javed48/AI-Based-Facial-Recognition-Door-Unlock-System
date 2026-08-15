import { Controller, Get } from '@nestjs/common';
import { Public } from '../auth/public.decorator';
import { HealthService } from './health.service';

@Controller('health')
export class HealthController {
  constructor(private readonly healthService: HealthService) {}

  // Public like any conventional health-check endpoint (load balancers,
  // uptime monitors) - it reveals only up/down status, no sensitive data,
  // so this isn't the same as "disabling auth for convenience" (Section 20
  // Rule 5). Every other endpoint stays behind JwtAuthGuard.
  @Public()
  @Get()
  check() {
    return this.healthService.check();
  }
}
