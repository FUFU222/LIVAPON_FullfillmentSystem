import fs from 'fs';
import path from 'path';

const root = process.cwd();
const sourceDir = path.join(root, 'app', 'dev');
const stashRoot = path.join(root, '.tmp');
const stashDir = path.join(stashRoot, 'dev-routes');

if (process.env.SKIP_STRIP_DEV_ROUTES === 'true') {
  console.log('[strip-dev-routes] SKIP_STRIP_DEV_ROUTES=true; skipping.');
  process.exit(0);
}

if (!fs.existsSync(sourceDir)) {
  console.log('[strip-dev-routes] app/dev not found; nothing to strip.');
  process.exit(0);
}

if (fs.existsSync(stashDir)) {
  console.warn('[strip-dev-routes] stash already exists; skipping to avoid overwrite:', stashDir);
  process.exit(0);
}

fs.mkdirSync(stashRoot, { recursive: true });
fs.renameSync(sourceDir, stashDir);
console.log('[strip-dev-routes] moved app/dev to', stashDir);
