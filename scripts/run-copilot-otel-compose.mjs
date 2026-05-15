#!/usr/bin/env node
import { existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const setupScript = resolve(root, 'scripts/setup-copilot-otel.mjs');
const defaultArgs = ['up', '-d', 'langfuse-web', 'otel-collector'];
const composeFiles = ['--env-file', '.env', '-f', 'langfuse/docker-compose.yml', '-f', '.devcontainer/docker-compose.yml'];

function splitCommand(command) {
  return command.trim().split(/\s+/).filter(Boolean);
}

function candidates() {
  const configured = process.env.COPILOT_OTEL_COMPOSE_COMMAND || process.env.COMPOSE_COMMAND;
  if (configured) {
    return [splitCommand(configured)];
  }

  return [
    ['docker', 'compose'],
    ['docker-compose'],
    ['nerdctl', 'compose'],
    ['podman', 'compose'],
  ];
}

function canRun(commandParts) {
  const [command, ...args] = commandParts;
  const result = spawnSync(command, [...args, 'version'], {
    cwd: root,
    env: process.env,
    stdio: 'ignore',
  });

  return result.status === 0;
}

function resolveComposeCommand() {
  const detected = candidates().find(canRun);
  if (!detected) {
    const tried = candidates().map(parts => parts.join(' ')).join(', ');
    console.error(`[otel-compose] Compose 互換 CLI が見つかりません。試行: ${tried}`);
    console.error('[otel-compose] Docker Desktop、Rancher Desktop、Podman などの Compose 互換ランタイムを起動してください。');
    console.error('[otel-compose] 必要に応じて COPILOT_OTEL_COMPOSE_COMMAND="nerdctl compose" のように指定できます。');
    process.exit(1);
  }

  return detected;
}

function run(commandParts, args) {
  const [command, ...commandArgs] = commandParts;
  const result = spawnSync(command, [...commandArgs, ...args], {
    cwd: root,
    env: process.env,
    stdio: 'inherit',
  });

  if (result.error) {
    console.error(`[otel-compose] 実行に失敗しました: ${result.error.message}`);
    process.exit(1);
  }

  process.exit(result.status ?? 1);
}

if (!existsSync(setupScript)) {
  console.error(`[otel-compose] セットアップスクリプトが見つかりません: ${setupScript}`);
  process.exit(1);
}

const requestedArgs = process.argv.slice(2);
if (requestedArgs.length === 0 || requestedArgs[0] === 'up') {
  const setupResult = spawnSync(process.execPath, [setupScript], {
    cwd: root,
    env: process.env,
    stdio: 'inherit',
  });

  if (setupResult.status !== 0) {
    process.exit(setupResult.status ?? 1);
  }
}

const composeCommand = resolveComposeCommand();
const actionArgs = requestedArgs.length > 0 ? requestedArgs : defaultArgs;
console.log(`[otel-compose] ${composeCommand.join(' ')} ${[...composeFiles, ...actionArgs].join(' ')}`);
run(composeCommand, [...composeFiles, ...actionArgs]);