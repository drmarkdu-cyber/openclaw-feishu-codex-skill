#!/usr/bin/env node
import { spawn } from 'node:child_process';
import { createWriteStream } from 'node:fs';
import { mkdir, readFile } from 'node:fs/promises';
import path from 'node:path';

const home = process.env.HOME || process.env.USERPROFILE || '';
const defaultConfig = path.join(home, '.openclaw', 'codex-runner.env');

await loadEnvFile(process.env.CODEX_RUNNER_CONFIG || defaultConfig);

const codexBin = process.env.CODEX_BIN || 'codex';
const workspace = path.resolve(process.env.CODEX_RUNNER_WORKSPACE || path.join(home, 'Documents', 'Codex', 'codex-work'));
const defaultOutputDir = path.resolve(process.env.CODEX_RUNNER_DEFAULT_OUTPUT_DIR || path.join(workspace, 'tmp_codex'));
const runsDir = path.resolve(process.env.CODEX_RUNNER_RUNS_DIR || path.join(home, '.openclaw', 'codex-runs'));
const sandbox = process.env.CODEX_RUNNER_SANDBOX || 'workspace-write';
const approval = process.env.CODEX_RUNNER_APPROVAL || 'never';
const timeoutSeconds = Number.parseInt(process.env.CODEX_RUNNER_TIMEOUT_SECONDS || '900', 10);
const model = process.env.CODEX_RUNNER_MODEL || '';
const useSearch = truthy(process.env.CODEX_RUNNER_SEARCH);
const codexExecHelp = await getCodexExecHelp();

if (process.argv.includes('--print-config')) {
  console.log(JSON.stringify({
    codexBin,
    workspace,
    defaultOutputDir,
    runsDir,
    sandbox,
    timeoutSeconds,
    model,
    search: useSearch,
    configFile: process.env.CODEX_RUNNER_CONFIG || defaultConfig,
  }, null, 2));
  process.exit(0);
}

const promptArg = process.argv.filter((arg) => arg !== '--').slice(2).join(' ').trim();
const stdin = await readStdin();
const prompt = [promptArg, stdin].filter(Boolean).join('\n\n').trim();

if (!prompt) {
  console.error('Usage: codex-runner.mjs "<task>"');
  console.error('Or pipe a task into stdin.');
  process.exit(64);
}

await mkdir(workspace, { recursive: true, mode: 0o755 });
await mkdir(defaultOutputDir, { recursive: true, mode: 0o700 });
await mkdir(runsDir, { recursive: true, mode: 0o700 });

const runId = new Date().toISOString().replace(/[-:.TZ]/g, '').slice(0, 14);
const jobDir = path.join(runsDir, runId);
await mkdir(jobDir, { recursive: true, mode: 0o700 });

const finalPath = path.join(jobDir, 'final.txt');
const logPath = path.join(jobDir, 'codex.log');
const log = createWriteStream(logPath, { flags: 'a' });

const args = [
  'exec',
  '--cd',
  workspace,
  '--skip-git-repo-check',
  '--sandbox',
  sandbox,
  '--output-last-message',
  finalPath,
];

if (codexExecHelp.includes('--ask-for-approval')) {
  args.push('--ask-for-approval', approval);
} else if (codexExecHelp.includes(' -a, --ask-for-approval')) {
  args.push('-a', approval);
}

if (model) args.push('--model', model);
if (useSearch) args.push('--search');
args.push('-');

log.write(`# OpenClaw Codex Bridge\n`);
log.write(`# Started: ${new Date().toISOString()}\n`);
log.write(`# Workspace: ${workspace}\n`);
log.write(`# Default output dir: ${defaultOutputDir}\n`);
log.write(`# Command: ${codexBin} ${args.join(' ')}\n\n`);

const codexPrompt = [
  'You are local Codex called through Feishu/OpenClaw.',
  `Current Codex workspace: ${workspace}`,
  `Default output directory: ${defaultOutputDir}`,
  `Sandbox mode: ${sandbox}`,
  '',
  'Execution rules:',
  '- If the user does not specify a file path, create scripts, temporary files, and generated outputs in the default output directory.',
  "- Do not write temporary task files into OpenClaw's workspace or OpenClaw's log directory.",
  '- If the user explicitly asks for a path outside the workspace, try it only when the sandbox allows it; if blocked, use the default output directory and explain briefly.',
  '- Keep the final answer concise. Say whether the task succeeded, list created files, and include key run output.',
  '- If a file was successfully written inside the default output directory, do not claim that the sandbox prevented file writing.',
  '',
  'User task:',
  prompt,
].join('\n');

const child = spawn(codexBin, args, {
  cwd: workspace,
  env: { ...process.env, FORCE_COLOR: '0', NO_COLOR: '1' },
  stdio: ['pipe', 'pipe', 'pipe'],
});

let timedOut = false;
const timer = Number.isFinite(timeoutSeconds) && timeoutSeconds > 0
  ? setTimeout(() => {
      timedOut = true;
      child.kill('SIGTERM');
    }, timeoutSeconds * 1000)
  : null;

child.stdout.pipe(log, { end: false });
child.stderr.pipe(log, { end: false });
child.stdin.end(codexPrompt);

const result = await new Promise((resolve) => {
  child.on('error', (error) => resolve({ code: 1, error }));
  child.on('close', (code, signal) => resolve({ code, signal }));
});

if (timer) clearTimeout(timer);
log.write(`\n# Ended: ${new Date().toISOString()}\n`);
log.write(`# Exit: ${result.code ?? ''}\n`);
log.write(`# Signal: ${result.signal ?? ''}\n`);
if (timedOut) log.write(`# Timed out after ${timeoutSeconds}s\n`);
if (result.error) log.write(`# Error: ${result.error.message}\n`);
log.end();

const finalText = await readText(finalPath);
const fallbackLog = await readText(logPath);
const output = finalText || tail(fallbackLog, 4000) || '(Codex did not produce output.)';

const status = result.code === 0 && !timedOut ? '完成' : '未成功结束';
console.log(`Codex 任务${status}`);
console.log(`工作目录：${workspace}`);
console.log(`完整日志：${logPath}`);
console.log('');
console.log(truncate(output, 6000));

process.exit(result.code === 0 && !timedOut ? 0 : 1);

async function readStdin() {
  if (process.stdin.isTTY) return '';
  const chunks = [];
  for await (const chunk of process.stdin) chunks.push(Buffer.from(chunk));
  return Buffer.concat(chunks).toString('utf8').trim();
}

async function readText(file) {
  try {
    return await readFile(file, 'utf8');
  } catch {
    return '';
  }
}

async function loadEnvFile(file) {
  let text = '';
  try {
    text = await readFile(file, 'utf8');
  } catch {
    return;
  }
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;
    const index = line.indexOf('=');
    if (index <= 0) continue;
    const key = line.slice(0, index).trim();
    let value = line.slice(index + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (!(key in process.env)) process.env[key] = value;
  }
}

async function getCodexExecHelp() {
  return await new Promise((resolve) => {
    const child = spawn(codexBin, ['exec', '--help'], { stdio: ['ignore', 'pipe', 'ignore'] });
    const chunks = [];
    child.stdout.on('data', (chunk) => chunks.push(Buffer.from(chunk)));
    child.on('error', () => resolve(''));
    child.on('close', () => resolve(Buffer.concat(chunks).toString('utf8')));
  });
}

function truthy(value) {
  return ['1', 'true', 'yes', 'y', 'on'].includes(String(value || '').toLowerCase());
}

function truncate(text, max) {
  if (text.length <= max) return text;
  return `${text.slice(0, max - 80)}\n\n...已截断。请查看完整日志。`;
}

function tail(text, max) {
  if (text.length <= max) return text;
  return text.slice(text.length - max);
}
