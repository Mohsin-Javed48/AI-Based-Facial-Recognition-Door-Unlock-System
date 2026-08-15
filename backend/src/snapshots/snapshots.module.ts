import { Module } from '@nestjs/common';
import { SnapshotsController } from './snapshots.controller';

@Module({
  controllers: [SnapshotsController],
})
export class SnapshotsModule {}
