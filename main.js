const { app, BrowserWindow } = require('electron');
const path = require('path');
const { spawn } = require('child_process');
const http = require('http');

let mainWindow;
let pythonProcess;

function checkServerReady(url) {
  return new Promise((resolve) => {
    const check = () => {
      http.get(url, (res) => {
        if (res.statusCode === 200) {
          resolve();
        } else {
          setTimeout(check, 500);
        }
      }).on('error', () => {
        setTimeout(check, 500);
      });
    };
    check();
  });
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true
    },
    autoHideMenuBar: true,
    title: "FableOS IDE"
  });

  // Start the Python backend
  const backendPath = path.join(__dirname, 'backend', 'main.py');
  
  // Add unbuffered python execution so we see logs immediately
  pythonProcess = spawn('python', ['-u', 'main.py'], {
    cwd: path.join(__dirname, 'backend')
  });

  pythonProcess.stdout.on('data', (data) => console.log(`Backend: ${data}`));
  pythonProcess.stderr.on('data', (data) => console.error(`Backend Err: ${data}`));

  // Wait for FastAPI to start up
  checkServerReady('http://127.0.0.1:8000/health').then(() => {
    // Load the web app served by FastAPI
    mainWindow.loadURL('http://127.0.0.1:8000');
  });

  mainWindow.on('closed', function () {
    mainWindow = null;
  });
}

app.on('ready', createWindow);

app.on('window-all-closed', function () {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('quit', () => {
  if (pythonProcess) {
    pythonProcess.kill();
  }
});
