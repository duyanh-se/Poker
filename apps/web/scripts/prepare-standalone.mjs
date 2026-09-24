import { cp, stat } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptsDirectory = dirname(fileURLToPath(import.meta.url));
const webDirectory = join(scriptsDirectory, '..');
const standaloneDirectory = join(webDirectory, '.next', 'standalone', 'apps', 'web');

async function exists(path) {
  try {
    await stat(path);
    return true;
  } catch {
    return false;
  }
}

async function copyDirectory(source, destination) {
  if (await exists(source)) {
    await cp(source, destination, { recursive: true, force: true });
  }
}

await copyDirectory(
  join(webDirectory, '.next', 'static'),
  join(standaloneDirectory, '.next', 'static'),
);
await copyDirectory(join(webDirectory, 'public'), join(standaloneDirectory, 'public'));
