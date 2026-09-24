import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const standaloneServer = fileURLToPath(
  new URL('../.next/standalone/apps/web/server.js', import.meta.url),
);
const child = spawn(process.execPath, [standaloneServer], {
  env: {
    ...process.env,
    HOSTNAME: process.env.HOSTNAME ?? '0.0.0.0',
    PORT: process.env.WEB_PORT ?? '3000',
  },
  stdio: 'inherit',
});

child.on('exit', (code) => {
  process.exit(code ?? 1);
});
