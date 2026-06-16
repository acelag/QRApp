import { Router } from 'express';
import { spawn, ChildProcess } from 'child_process';
import path from 'path';

const router = Router();

let botProcess: ChildProcess | null = null;

const BOT_SCRIPT = path.resolve(__dirname, '../../../scripts/sim-bot.js');

router.get('/status', (_req, res) => {
  res.json({ running: botProcess !== null && !botProcess.killed });
});

router.post('/start', (_req, res) => {
  if (botProcess && !botProcess.killed) {
    res.json({ running: true, message: 'Already running' });
    return;
  }
  botProcess = spawn('node', [BOT_SCRIPT], {
    stdio: ['ignore', 'pipe', 'pipe'],
    detached: false,
  });
  botProcess.stdout?.on('data', (d) => process.stdout.write('[sim-bot] ' + d));
  botProcess.stderr?.on('data', (d) => process.stderr.write('[sim-bot] ' + d));
  botProcess.on('exit', () => { botProcess = null; });
  res.json({ running: true, message: 'Bot started', pid: botProcess.pid });
});

router.post('/stop', (_req, res) => {
  if (!botProcess || botProcess.killed) {
    botProcess = null;
    res.json({ running: false, message: 'Not running' });
    return;
  }
  botProcess.kill('SIGTERM');
  botProcess = null;
  res.json({ running: false, message: 'Bot stopped' });
});

export default router;
