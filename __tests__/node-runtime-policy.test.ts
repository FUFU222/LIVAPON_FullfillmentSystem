/** @jest-environment node */

import { readFileSync } from 'fs';
import path from 'path';

const rootDir = path.resolve(__dirname, '..');

function readText(relativePath: string) {
  return readFileSync(path.join(rootDir, relativePath), 'utf8');
}

describe('Node runtime policy', () => {
  it('pins the app, lockfile, and CI to Node.js 24', () => {
    const packageJson = JSON.parse(readText('package.json'));
    const packageLock = JSON.parse(readText('package-lock.json'));
    const ciWorkflow = readText('.github/workflows/ci.yml');

    expect(packageJson.engines?.node).toBe('24.x');
    expect(packageJson.dependencies?.next).toBe('16.2.4');
    expect(packageJson.overrides?.postcss).toBe('8.5.14');
    expect(packageJson.devDependencies?.['@types/node']).toMatch(/^24\./);
    expect(packageLock.packages[''].engines?.node).toBe('24.x');
    expect(readText('.nvmrc').trim()).toBe('24');
    expect(readText('.node-version').trim()).toBe('24');
    expect(ciWorkflow).toContain('FORCE_JAVASCRIPT_ACTIONS_TO_NODE24: true');
    expect(ciWorkflow).toContain('uses: actions/checkout@v6');
    expect(ciWorkflow).toContain('uses: actions/setup-node@v6');
    expect(ciWorkflow).toContain("node-version: '24'");
    expect(ciWorkflow).not.toContain("node-version: '20'");
  });
});
