import { Controller, HttpCode, Post } from '@nestjs/common';
import { GateService } from './gate.service';

@Controller('gate')
export class GateController {
  constructor(private readonly gateService: GateService) {}

  @Post('trigger')
  @HttpCode(200)
  trigger() {
    return this.gateService.triggerManual();
  }
}
