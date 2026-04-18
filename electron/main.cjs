const { app, BrowserWindow } = require('electron');
const path = require('path');
const { spawn } = require('child_process');

let botProcess = null;

function startBackend() {
  console.log('🚀 Starting Gravity Hub Backend...');
  botProcess = spawn('bun', ['src/lib/bot.ts'], {
    cwd: path.join(__dirname, '..'),
    stdio: 'inherit'
  });

  botProcess.on('close', (code) => {
    console.log(`📡 Backend process exited with code ${code}`);
  });
}

function createWindow() {
  const win = new BrowserWindow({
    width: 1200,
    height: 800,
    title: "Gravity Hub - Mission Control",
    titleBarStyle: 'hiddenInset',
    backgroundColor: '#050505',
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
    }
  });

  win.loadURL('http://localhost:3000');
  win.removeMenu();
}

app.whenReady().then(() => {
  startBackend();
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (botProcess) {
    botProcess.kill();
    console.log('🛑 Gravity Hub Backend Terminated.');
  }
  if (process.platform !== 'darwin') app.quit();
});
