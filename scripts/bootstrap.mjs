#!/usr/bin/env node
import { spawn } from 'node:child_process';
import readline from 'node:readline/promises';
import process from 'node:process';

const isWindows = process.platform === 'win32';
const rl = readline.createInterface({ input: process.stdin, output: process.stdout });

function joinCommand(command, args = []) {
  if (!args.length) {
    return command;
  }
  return `${command} ${args.map((arg) => (arg.includes(' ') ? `"${arg}"` : arg)).join(' ')}`;
}

async function runCommand(command, args = [], options = {}) {
  const child = spawn(command, args, {
    stdio: 'inherit',
    shell: options.shell ?? false,
    ...options,
  });

  return await new Promise((resolve, reject) => {
    child.on('error', reject);
    child.on('exit', (code) => resolve(code ?? 0));
  });
}

async function captureCommand(command, args = [], options = {}) {
  const child = spawn(command, args, {
    stdio: ['ignore', 'pipe', 'pipe'],
    shell: options.shell ?? false,
    ...options,
  });

  return await new Promise((resolve) => {
    let stdout = '';
    let stderr = '';
    child.stdout?.on('data', (chunk) => {
      stdout += chunk.toString();
    });
    child.stderr?.on('data', (chunk) => {
      stderr += chunk.toString();
    });
    child.on('error', (error) => {
      resolve({ ok: false, stdout, stderr, error });
    });
    child.on('exit', (code) => {
      resolve({ ok: code === 0, code: code ?? 0, stdout, stderr });
    });
  });
}

async function confirm(question, { defaultValue = false } = {}) {
  const answer = await rl.question(`${question} ${defaultValue ? '[Y/n]' : '[y/N]'} `);
  if (!answer) {
    return defaultValue;
  }
  const normalized = answer.trim().toLowerCase();
  return normalized === 'y' || normalized === 'yes' || normalized === 's' || normalized === 'si';
}

async function detectPython() {
  const candidates = isWindows
    ? [
        { command: 'py', args: ['-3', '--version'], display: 'py -3' },
        { command: 'python', args: ['--version'], display: 'python' },
        { command: 'python3', args: ['--version'], display: 'python3' },
      ]
    : [
        { command: 'python3', args: ['--version'], display: 'python3' },
        { command: 'python', args: ['--version'], display: 'python' },
      ];

  for (const candidate of candidates) {
    const result = await captureCommand(candidate.command, candidate.args);
    if (result.ok) {
      const version = (result.stdout || result.stderr).trim();
      return { command: candidate.display, version };
    }
  }
  return null;
}

async function detectWindowsBuildTools() {
  const msBuild = await captureCommand('cmd', ['/c', 'where msbuild']);
  const cl = await captureCommand('cmd', ['/c', 'where cl']);
  return msBuild.ok || cl.ok;
}

async function detectUnixBuildTools() {
  const gcc = await captureCommand('gcc', ['--version']);
  if (gcc.ok) {
    return true;
  }
  const make = await captureCommand('make', ['--version']);
  return make.ok;
}

async function ensureWindowsBuildTools() {
  const available = await detectWindowsBuildTools();
  if (available) {
    console.log('✓ Visual Studio Build Tools detectadas.');
    return;
  }

  console.warn('\nNo se encontraron Visual Studio Build Tools 2022.');
  const install = await confirm('¿Quieres ejecutar "pnpm dlx windows-build-tools@latest" ahora?');
  if (!install) {
    console.warn('Puedes instalarlas manualmente desde https://aka.ms/vs/17/release/vs_BuildTools.exe');
    return;
  }

  const pnpm = isWindows ? 'pnpm.cmd' : 'pnpm';
  const exitCode = await runCommand(pnpm, ['dlx', 'windows-build-tools@latest']);
  if (exitCode === 0) {
    console.log('✓ Instalación de windows-build-tools finalizada.');
  } else {
    console.error('La instalación de windows-build-tools no se completó correctamente.');
  }
}

async function ensureUnixBuildTools() {
  const available = await detectUnixBuildTools();
  if (available) {
    console.log('✓ Toolchain nativa detectada (gcc/make).');
    return;
  }
  console.warn('\nNo se detectó un toolchain nativo (gcc/make). Instala build-essential o Xcode Command Line Tools antes de compilar módulos nativos.');
}

async function installDependencies() {
  const pnpm = isWindows ? 'pnpm.cmd' : 'pnpm';
  console.log('\n📦 Ejecutando pnpm install (puede tardar unos minutos)...');
  const exitCode = await runCommand(pnpm, ['install']);
  if (exitCode !== 0) {
    throw new Error('pnpm install finalizó con errores. Revisa el log anterior.');
  }
  console.log('✓ Dependencias instaladas.');
}

async function launchMenu() {
  const pnpm = isWindows ? 'pnpm.cmd' : 'pnpm';
  const options = [
    { key: '1', label: 'Iniciar todo (pnpm dev)', command: [pnpm, ['dev']] },
    { key: '2', label: 'Solo API (pnpm --filter @flstudio/api dev)', command: [pnpm, ['--filter', '@flstudio/api', 'dev']] },
    { key: '3', label: 'Solo SFU (pnpm --filter @flstudio/sfu dev)', command: [pnpm, ['--filter', '@flstudio/sfu', 'dev']] },
    { key: '4', label: 'Solo Companion (pnpm --filter @flstudio/companion dev)', command: [pnpm, ['--filter', '@flstudio/companion', 'dev']] },
    { key: '5', label: 'Salir', command: null },
  ];

  let continueLoop = true;
  while (continueLoop) {
    console.log('\nSelecciona una opción:');
    for (const option of options) {
      console.log(`  ${option.key}. ${option.label}`);
    }
    const answer = await rl.question('> ');
    const chosen = options.find((option) => option.key === answer.trim());
    if (!chosen) {
      console.log('Opción inválida, intenta nuevamente.');
      continue;
    }
    if (!chosen.command) {
      continueLoop = false;
      break;
    }
    const [cmd, args] = chosen.command;
    console.log(`\nEjecutando ${joinCommand(cmd, args)}...`);
    const exitCode = await runCommand(cmd, args);
    if (exitCode !== 0) {
      console.error(`El comando ${joinCommand(cmd, args)} finalizó con código ${exitCode}.`);
    }
  }
}

async function main() {
  console.log('FL Studio Compartido – asistente de arranque\n');
  console.log(`Plataforma detectada: ${isWindows ? 'Windows' : process.platform}`);

  const python = await detectPython();
  if (python) {
    console.log(`✓ Python detectado (${python.version}) via "${python.command}".`);
  } else {
    console.warn('No se encontró Python 3 en el PATH. Instálalo antes de continuar (https://www.python.org/downloads/).');
  }

  if (isWindows) {
    await ensureWindowsBuildTools();
  } else {
    await ensureUnixBuildTools();
  }

  try {
    await installDependencies();
  } catch (error) {
    console.error(error.message);
    process.exit(1);
  }

  await launchMenu();
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(() => {
    rl.close();
  });
