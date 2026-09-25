import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const server = spawn('node', ['--import', 'tsx', 'server.ts'], {
  cwd: __dirname,
  env: { ...process.env, NODE_ENV: 'development' },
  stdio: ['pipe', 'pipe', 'pipe']
});

server.stdout.on('data', d => process.stdout.write('[OUT] ' + d.toString()));
server.stderr.on('data', d => process.stderr.write('[ERR] ' + d.toString()));

await new Promise(r => setTimeout(r, 60000));
console.log('\n[TIMEOUT] Server did not start within 60s');
server.kill();
process.exit(1);
