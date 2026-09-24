import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';

const command = process.argv[2];
const require = createRequire(import.meta.url);
const nextCli = require.resolve('next/dist/bin/next');
const port = process.env.WEB_PORT ?? '3000';
const child = spawn(process.execPath, [nextCli, command, '--port', port], {
  stdio: 'inherit',
});

child.on('exit', (code) => {
  process.exit(code ?? 1);
});
