import { NotFoundException, StreamableFile } from '@nestjs/common';
import { mkdtempSync, rmSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { SnapshotsController } from './snapshots.controller';

describe('SnapshotsController', () => {
  let dir: string;
  let controller: SnapshotsController;
  const originalEnv = { ...process.env };

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'snapshots-test-'));
    writeFileSync(join(dir, 'real.jpg'), 'fake-jpeg-bytes');
    process.env.RECOGNITION_SNAPSHOTS_DIR = dir;
    controller = new SnapshotsController();
  });

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
    process.env = originalEnv;
  });

  it('streams the actual content of an existing snapshot file', async () => {
    const result = controller.getSnapshot('real.jpg');
    expect(result).toBeInstanceOf(StreamableFile);

    // Read the stream to completion (and let the underlying file handle
    // close) before this test returns - otherwise afterEach's rmSync races
    // fs.createReadStream's deferred open() and can delete the file out
    // from under it, emitting an unhandled 'error' on a detached stream.
    const stream = result.getStream();
    const chunks: Buffer[] = [];
    await new Promise<void>((resolve, reject) => {
      stream.on('data', (chunk: Buffer) => chunks.push(chunk));
      stream.on('end', resolve);
      stream.on('error', reject);
    });

    expect(Buffer.concat(chunks).toString('utf8')).toBe('fake-jpeg-bytes');
  });

  it('throws NotFoundException for a missing file', () => {
    expect(() => controller.getSnapshot('does-not-exist.jpg')).toThrow(
      NotFoundException,
    );
  });

  it('strips directory components to prevent path traversal', () => {
    // Would resolve outside `dir` if the raw filename were joined directly.
    expect(() => controller.getSnapshot('../../../../etc/passwd')).toThrow(
      NotFoundException,
    );
  });
});
