import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import electron from 'electron';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, '..');

async function run() {
  await new Promise<void>((resolve, reject) => {
    const tscPath = path.resolve(projectRoot, 'node_modules', 'typescript', 'bin', 'tsc');
    const build = spawn(process.execPath, [tscPath, '-p', path.join(projectRoot, 'tsconfig.json')], {
      cwd: projectRoot,
      stdio: 'inherit',
    });
    build.on('exit', (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`tsc exited with code ${code}`));
      }
    });
  });

  const rendererSrc = path.join(projectRoot, 'src', 'renderer', 'index.html');
  const rendererDest = path.join(projectRoot, 'dist', 'renderer', 'index.html');
  fs.mkdirSync(path.dirname(rendererDest), { recursive: true });
  fs.copyFileSync(rendererSrc, rendererDest);

  const child = spawn(String(electron), [path.join(projectRoot, 'dist', 'main.js')], {
    cwd: projectRoot,
    stdio: 'inherit',
  });

  child.on('exit', (code) => {
    process.exit(code ?? 0);
  });
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
