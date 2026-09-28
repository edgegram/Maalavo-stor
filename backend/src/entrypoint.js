import { spawn } from 'node:child_process';

const children = [
  spawn(process.execPath, ['src/server-v5.js'], { stdio: 'inherit', env: process.env }),
  spawn(process.execPath, ['src/telegram-bot.js'], { stdio: 'inherit', env: process.env })
];

let shuttingDown = false;
function shutdown(signal) {
  if (shuttingDown) return;
  shuttingDown = true;
  for (const child of children) {
    if (!child.killed) child.kill(signal);
  }
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

for (const child of children) {
  child.on('exit', (code, signal) => {
    if (shuttingDown) return;
    if (code && code !== 0) {
      console.error(`[entrypoint] child exited with code ${code}`);
      shutdown('SIGTERM');
      process.exit(code);
    }
    if (signal) {
      console.error(`[entrypoint] child exited from ${signal}`);
      shutdown('SIGTERM');
      process.exit(1);
    }
  });
  child.on('error', (error) => {
    console.error('[entrypoint] child process error:', error);
    shutdown('SIGTERM');
    process.exit(1);
  });
}
