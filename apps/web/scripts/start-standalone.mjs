import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const standaloneServer = fileURLToPath(
  new URL('../.next/standalone/apps/web/server.js', import.meta.url),
);
const child = spawn(process.execPath, [standaloneServer], {
  env: {
    ...process.env,
    // Hosting providers commonly set HOSTNAME to a container identifier. That
    // identifier cannot be used as a network bind address, so only honor the
    // application-specific override.
    HOSTNAME: process.env.WEB_HOSTNAME ?? '0.0.0.0',
    PORT: process.env.WEB_PORT ?? process.env.PORT ?? '3000',
  },
  stdio: 'inherit',
});

child.on('exit', (code) => {
  process.exit(code ?? 1);
});
