import { Controller, Get, Param, Query } from '@nestjs/common';
import { AccessLogsService } from './access-logs.service';
import { QueryAccessLogsDto } from './dto/query-access-logs.dto';

@Controller('access-logs')
export class AccessLogsController {
  constructor(private readonly accessLogsService: AccessLogsService) {}

  @Get()
  findAll(@Query() query: QueryAccessLogsDto) {
    return this.accessLogsService.findAll(query);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.accessLogsService.findOne(id);
  }
}
