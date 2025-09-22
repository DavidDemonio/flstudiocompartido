import path from 'node:path';
import { app, BrowserWindow, ipcMain } from 'electron';
import dotenv from 'dotenv';
import { AsioBridge, type BridgeConfig } from './bridge';

dotenv.config();

let mainWindow: BrowserWindow | null = null;
const bridge = new AsioBridge();

async function createWindow() {
  mainWindow = new BrowserWindow({
    width: 640,
    height: 480,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
    },
  });

  await mainWindow.loadFile(path.join(__dirname, 'renderer', 'index.html'));
}

app.whenReady().then(() => {
  void createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      void createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

bridge.on('stats', (stats) => {
  mainWindow?.webContents.send('bridge-stats', stats);
});

bridge.on('error', (error) => {
  mainWindow?.webContents.send('bridge-error', error.message);
});

ipcMain.handle('bridge:start', async (_event, config: Partial<BridgeConfig>) => {
  const signalUrl = process.env.COMPANION_SIGNAL_URL ?? 'ws://localhost:4443';
  const bridgeConfig: BridgeConfig = {
    signalUrl,
    roomId: config.roomId ?? 'default',
    channelCount: config.channelCount ?? 2,
    sampleRate: config.sampleRate ?? 48000,
    bufferSize: config.bufferSize ?? 128,
    deviceId: config.deviceId,
    hostAPIName: config.hostAPIName ?? 'asio',
  };
  await bridge.start(bridgeConfig);
  return { status: 'started' };
});

ipcMain.handle('bridge:stop', async () => {
  await bridge.stop();
  return { status: 'stopped' };
});
