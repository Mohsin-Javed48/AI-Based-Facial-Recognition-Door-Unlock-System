import {
  Controller,
  Get,
  NotFoundException,
  Param,
  StreamableFile,
} from '@nestjs/common';
import { createReadStream, existsSync } from 'fs';
import { basename, join } from 'path';

/**
 * Serves the JPEGs the Python recognition service saves under
 * recognition/data/snapshots/ (README Section 10.1 / Section 11 "Snapshot"
 * column). Assumes backend and recognition run on the same machine, sharing
 * a filesystem - this project's whole deployment model (README Section 1).
 * Behind the global JwtAuthGuard like every other endpoint - a snapshot is a
 * photo of whoever was at the gate, not something to leave unauthenticated.
 */
@Controller('snapshots')
export class SnapshotsController {
  private readonly snapshotsDir =
    process.env.RECOGNITION_SNAPSHOTS_DIR ??
    join(process.cwd(), '..', 'recognition', 'data', 'snapshots');

  @Get(':filename')
  getSnapshot(@Param('filename') filename: string): StreamableFile {
    // basename() strips any directory components (e.g. "../../etc/passwd")
    // so this can never read outside snapshotsDir.
    const safeName = basename(filename);
    const filePath = join(this.snapshotsDir, safeName);

    if (!existsSync(filePath)) {
      throw new NotFoundException('Snapshot not found');
    }

    return new StreamableFile(createReadStream(filePath));
  }
}
