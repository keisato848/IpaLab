#!/usr/bin/env node
import { existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const composePath = resolve(root, 'cosmos-emulator/docker-compose.yml');
const defaultArgs = ['up', '-d'];
const composeFiles = ['-f', 'cosmos-emulator/docker-compose.yml'];

function splitCommand(command) {
  return command.trim().split(/\s+/).filter(Boolean);
}

function candidates() {
  const configured = process.env.COSMOS_EMULATOR_COMPOSE_COMMAND || process.env.COMPOSE_COMMAND;
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
    console.error(`[cosmos-emulator] Compose 互換 CLI が見つかりません。試行: ${tried}`);
    console.error('[cosmos-emulator] Docker Desktop、Rancher Desktop、Podman などの Compose 互換ランタイムを起動してください。');
    console.error('[cosmos-emulator] 必要に応じて COSMOS_EMULATOR_COMPOSE_COMMAND="nerdctl compose" のように指定できます。');
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
    console.error(`[cosmos-emulator] 実行に失敗しました: ${result.error.message}`);
    process.exit(1);
  }

  process.exit(result.status ?? 1);
}

if (!existsSync(composePath)) {
  console.error(`[cosmos-emulator] compose ファイルが見つかりません: ${composePath}`);
  process.exit(1);
}

const requestedArgs = process.argv.slice(2);
const composeCommand = resolveComposeCommand();
const actionArgs = requestedArgs.length > 0 ? requestedArgs : defaultArgs;
console.log(`[cosmos-emulator] ${composeCommand.join(' ')} ${[...composeFiles, ...actionArgs].join(' ')}`);
run(composeCommand, [...composeFiles, ...actionArgs]);
