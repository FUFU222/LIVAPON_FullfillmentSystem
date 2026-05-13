import { execFileSync } from 'node:child_process';
import path from 'node:path';

describe('PackingSlipDocument', () => {
  it('renders a Japanese packing slip PDF using the bundled font', async () => {
    const tsxBin = path.join(
      process.cwd(),
      'node_modules',
      '.bin',
      process.platform === 'win32' ? 'tsx.cmd' : 'tsx'
    );

    const output = execFileSync(tsxBin, ['scripts/verify-packing-slip-render.ts'], {
      cwd: process.cwd(),
      encoding: 'utf8',
      timeout: 15000
    });

    expect(output).toContain('packing-slip-render-ok');
  });
});
