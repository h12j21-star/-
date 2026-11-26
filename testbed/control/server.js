// CertBear 테스트베드 제어 서버 — 의존성 없이 docker compose 를 호출한다.
// 도커: docker compose up -d --build control   /   로컬: node control/server.js
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const { spawn } = require('node:child_process');

const PORT = Number(process.env.CONTROL_PORT || 7000);
const TESTBED_DIR = process.env.TESTBED_DIR || path.resolve(__dirname, '..');
const PROJECT = 'certbear-testbed';
const modules = JSON.parse(fs.readFileSync(path.join(__dirname, 'modules.json'), 'utf8'));
const jobs = new Map(); // moduleId -> { action, running, output, exitCode, startedAt }

function run(command, args, onData) {
  return new Promise((resolve) => {
    const child = spawn(command, args, { cwd: TESTBED_DIR, env: process.env });
    let output = '';
    const collect = (chunk) => {
      output += chunk;
      if (onData) onData(chunk.toString());
    };
    child.stdout.on('data', collect);
    child.stderr.on('data', collect);
    child.on('error', (error) => resolve({ code: -1, output: output + String(error) }));
    child.on('close', (code) => resolve({ code, output }));
  });
}

const compose = (args, onData) => run('docker', ['compose', '--profile', '*', ...args], onData);

async function containerStates() {
  const { output } = await run('docker', [
    'ps', '-a',
    '--filter', `label=com.docker.compose.project=${PROJECT}`,
    '--format', '{{.Label "com.docker.compose.service"}}\t{{.State}}\t{{.Status}}',
  ]);
  const states = {};
  for (const line of output.split('\n').filter(Boolean)) {
    const [service, state, status] = line.split('\t');
    states[service] = { state, status };
  }
  return states;
}

function moduleStatus(module, states) {
  const services = module.services.map((name) => ({ name, ...(states[name] || { state: 'none', status: '' }) }));
  const running = services.filter((s) => s.state === 'running');
  const unhealthy = running.some((s) => /unhealthy|health: starting/.test(s.status));
  let status = 'off';
  if (running.length === services.length) status = unhealthy ? 'starting' : 'on';
  else if (running.length > 0 || services.some((s) => s.state === 'restarting')) status = 'partial';
  return { services, status };
}

function startJob(module, action, args) {
  const current = jobs.get(module.id);
  if (current && current.running) return false;
  const job = { action, running: true, output: `$ docker compose ${args.join(' ')}\n`, exitCode: null, startedAt: Date.now() };
  jobs.set(module.id, job);
  compose(args, (chunk) => {
    job.output = (job.output + chunk).slice(-200_000);
  }).then(({ code }) => {
    job.running = false;
    job.exitCode = code;
  });
  return true;
}

async function runAction(module, actionId) {
  const action = (module.actions || []).find((a) => a.id === actionId);
  if (!action) return { code: 404, output: 'unknown action' };
  const [command, ...args] = action.command;
  const result = await run(command, args);
  let output = result.output;
  if (result.code === 0 && action.decodeBase64) output = Buffer.from(output.trim(), 'base64').toString('utf8');
  if (action.grep) output = output.split('\n').filter((line) => line.includes(action.grep)).join('\n');
  return { code: result.code, output };
}

function send(res, status, body, type = 'application/json; charset=utf-8') {
  res.writeHead(status, { 'Content-Type': type, 'Cache-Control': 'no-store' });
  res.end(typeof body === 'string' || Buffer.isBuffer(body) ? body : JSON.stringify(body));
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://localhost');
  const parts = url.pathname.split('/').filter(Boolean);

  if (req.method === 'GET' && url.pathname === '/') {
    return send(res, 200, fs.readFileSync(path.join(__dirname, 'index.html')), 'text/html; charset=utf-8');
  }

  if (req.method === 'GET' && url.pathname === '/api/modules') {
    const states = await containerStates();
    return send(res, 200, modules.map((module) => {
      const job = jobs.get(module.id);
      return {
        ...module,
        ...moduleStatus(module, states),
        job: job && { action: job.action, running: job.running, exitCode: job.exitCode },
      };
    }));
  }

  const module = parts[0] === 'api' && parts[1] === 'modules' ? modules.find((m) => m.id === parts[2]) : undefined;
  if (!module) return send(res, 404, { error: 'not found' });
  const verb = parts[3];

  if (req.method === 'POST' && verb === 'on') {
    const started = startJob(module, 'on', ['up', '-d', '--build', ...module.services]);
    return send(res, started ? 202 : 409, { started });
  }
  if (req.method === 'POST' && verb === 'off') {
    const started = startJob(module, 'off', ['stop', ...module.services]);
    return send(res, started ? 202 : 409, { started });
  }
  if (req.method === 'GET' && verb === 'job') {
    return send(res, 200, jobs.get(module.id) || { output: '' });
  }
  if (req.method === 'GET' && verb === 'logs') {
    const { output } = await compose(['logs', '--no-color', '--tail', '300', ...module.services]);
    return send(res, 200, { output });
  }
  if (req.method === 'POST' && verb === 'actions' && parts[4]) {
    return send(res, 200, await runAction(module, parts[4]));
  }
  return send(res, 404, { error: 'not found' });
});

server.listen(PORT, () => {
  console.log(`CertBear testbed control: http://localhost:${PORT}  (compose dir: ${TESTBED_DIR})`);
});
