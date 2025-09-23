import { spawn, spawnSync } from 'node:child_process';
import { createInterface } from 'node:readline/promises';
import { stdin as input, stdout as output } from 'node:process';

function detectOS() {
  switch (process.platform) {
    case 'win32':
      return 'Windows';
    case 'darwin':
      return 'macOS';
    default:
      return 'Linux';
  }
}

function commandExists(command) {
  const checker = process.platform === 'win32' ? 'where' : 'which';
  const result = spawnSync(checker, [command], {
    stdio: 'ignore',
    shell: process.platform === 'win32',
  });
  return result.status === 0;
}

function runSync(command, args = []) {
  const child = spawnSync(command, args, {
    stdio: 'pipe',
    encoding: 'utf-8',
    shell: process.platform === 'win32',
  });
  const output = (child.stdout || '').trim() || (child.stderr || '').trim();
  return {
    ok: child.status === 0,
    output,
  };
}

async function runCommand(command, args = []) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      stdio: 'inherit',
      shell: process.platform === 'win32',
    });

    child.on('close', (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`Command failed: ${command} ${args.join(' ')}`));
      }
    });

    child.on('error', (error) => {
      reject(error);
    });
  });
}

function checkPnpm() {
  if (commandExists('pnpm')) {
    const result = runSync('pnpm', ['--version']);
    if (result.ok) {
      console.log(`✔ pnpm detectado (versión ${result.output}).`);
      return true;
    }
  }

  console.error('✖ pnpm no está disponible en el PATH. Ejecuta `corepack enable pnpm` e inténtalo de nuevo.');
  return false;
}

function checkPython() {
  const candidates = process.platform === 'win32'
    ? [
        ['py', ['-3', '--version']],
        ['python', ['--version']],
      ]
    : [
        ['python3', ['--version']],
        ['python', ['--version']],
      ];

  for (const [command, args] of candidates) {
    const result = runSync(command, args);
    if (result.ok) {
      console.log(`✔ Python detectado (${result.output}).`);
      return true;
    }
  }

  console.error('✖ No se encontró Python 3. Instálalo antes de continuar.');
  return false;
}

async function ensureWindowsBuildTools(rl) {
  const install = await rl.question('¿Deseas instalar automáticamente Windows Build Tools con "pnpm dlx windows-build-tools@latest"? (y/N) ');
  if (install.trim().toLowerCase() === 'y') {
    try {
      await runCommand('pnpm', ['dlx', 'windows-build-tools@latest']);
      console.log('✔ Windows Build Tools instalados.');
      return true;
    } catch (error) {
      console.error('✖ No se pudieron instalar automáticamente los Windows Build Tools.', error.message);
      return false;
    }
  }
  return false;
}

async function checkBuildTools(rl) {
  if (process.platform === 'win32') {
    const hasMsBuild = commandExists('msbuild');
    const hasVSWhere = commandExists('vswhere');

    if (hasMsBuild || hasVSWhere) {
      console.log('✔ Herramientas de compilación de Windows detectadas.');
      return true;
    }

    console.warn('⚠ No se encontraron Windows Build Tools.');
    const installed = await ensureWindowsBuildTools(rl);
    if (installed) {
      const recheck = commandExists('msbuild') || commandExists('vswhere');
      if (recheck) {
        return true;
      }
    }

    console.warn('Instala "Visual Studio Build Tools" o ejecuta `pnpm dlx windows-build-tools@latest` y vuelve a ejecutar este asistente.');
    return false;
  }

  const hasMake = commandExists('make');
  const hasGcc = commandExists('gcc') || commandExists('g++');

  if (hasMake && hasGcc) {
    console.log('✔ Herramientas de compilación detectadas (make/gcc).');
    return true;
  }

  console.warn('⚠ No se detectaron herramientas de compilación (make/gcc). Instala "build-essential" o las herramientas equivalentes para tu distribución.');
  return false;
}

async function selectService(rl) {
  const options = [
    { label: 'Iniciar todos los servicios (pnpm dev)', args: ['dev'] },
    { label: 'API (pnpm --filter @flstudio/api dev)', args: ['--filter', '@flstudio/api', 'dev'] },
    { label: 'SFU (pnpm --filter @flstudio/sfu dev)', args: ['--filter', '@flstudio/sfu', 'dev'] },
    { label: 'Companion (pnpm --filter @flstudio/companion dev)', args: ['--filter', '@flstudio/companion', 'dev'] },
  ];

  console.log('\n¿Qué servicio deseas iniciar?');
  options.forEach((option, index) => {
    console.log(`  ${index + 1}. ${option.label}`);
  });
  console.log('  0. Salir');

  const answer = await rl.question('Selecciona una opción: ');
  const selection = Number.parseInt(answer, 10);

  if (Number.isNaN(selection) || selection < 0 || selection > options.length) {
    console.warn('Opción no válida. Finalizando.');
    return null;
  }

  if (selection === 0) {
    return null;
  }

  return options[selection - 1];
}

async function main() {
  console.log('=== Asistente de arranque ===');
  console.log(`Sistema operativo detectado: ${detectOS()}`);

  const rl = createInterface({ input, output });
  let rlClosed = false;
  const closeRl = () => {
    if (!rlClosed) {
      rl.close();
      rlClosed = true;
    }
  };

  try {
    if (!checkPnpm()) {
      process.exitCode = 1;
      return;
    }

    const pythonOk = checkPython();
    const buildToolsOk = await checkBuildTools(rl);

    if (!pythonOk) {
      process.exitCode = 1;
      return;
    }

    if (!buildToolsOk) {
      const proceed = await rl.question('Las herramientas de compilación no se detectaron. ¿Deseas continuar de todos modos? (y/N) ');
      if (proceed.trim().toLowerCase() !== 'y') {
        process.exitCode = 1;
        return;
      }
    }

    console.log('\nInstalando dependencias con pnpm install...');
    await runCommand('pnpm', ['install']);
    console.log('✔ Dependencias instaladas correctamente.');

    const choice = await selectService(rl);
    closeRl();

    if (!choice) {
      console.log('Asistente finalizado.');
      return;
    }

    console.log(`\nEjecutando: pnpm ${choice.args.join(' ')}`);
    await runCommand('pnpm', choice.args);
  } catch (error) {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  } finally {
    closeRl();
  }
}

await main();
