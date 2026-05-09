import { spawn } from 'node:child_process';
import process from 'node:process';

const commands = [
  ['server', 'npm', ['--prefix', 'server', 'run', 'dev']],
  ['client', 'npm', ['--prefix', 'client', 'run', 'dev']]
];

const children = commands.map(([name, cmd, args]) => {
  const child = spawn(cmd, args, { stdio: 'inherit', shell: process.platform === 'win32' });
  child.on('exit', (code) => {
    if (code && code !== 0) {
      console.error(`[${name}] exited with code ${code}`);
      process.exitCode = code;
    }
  });
  return child;
});

function shutdown() {
  for (const child of children) child.kill('SIGTERM');
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
