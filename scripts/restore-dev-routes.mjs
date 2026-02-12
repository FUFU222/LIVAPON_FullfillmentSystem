import fs from 'fs';
import path from 'path';

const root = process.cwd();
const sourceDir = path.join(root, '.tmp', 'dev-routes');
const targetDir = path.join(root, 'app', 'dev');

if (!fs.existsSync(sourceDir)) {
  console.log('[restore-dev-routes] stash not found; nothing to restore.');
  process.exit(0);
}

if (fs.existsSync(targetDir)) {
  console.warn('[restore-dev-routes] app/dev already exists; leaving stash in place:', sourceDir);
  process.exit(0);
}

fs.renameSync(sourceDir, targetDir);
console.log('[restore-dev-routes] restored app/dev from', sourceDir);
