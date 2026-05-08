const { app, BrowserWindow, globalShortcut, ipcMain, screen, Menu } = require('electron');
const path = require('path');
const TrayManager = require('./tray');
const ScreenshotManager = require('./screenshot');
const TranslationManager = require('./translator');
const HistoryManager = require('./history');

let mainWindow = null;
let bubbleWindow = null;
let selectionWindow = null;
let trayManager = null;
let screenshotManager = null;
let translationManager = null;
let historyManager = null;
let isQuitting = false;

const gotTheLock = app.requestSingleInstanceLock();

if (!gotTheLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.show();
      mainWindow.focus();
    }
  });

  app.whenReady().then(() => {
    initializeManagers();
    createMainWindow();
    createBubbleWindow();
    registerShortcuts();
    trayManager = new TrayManager(mainWindow);
    trayManager.create();
    Menu.setApplicationMenu(null);

    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) {
        createMainWindow();
      }
    });
  });

  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin' && isQuitting) {
      app.quit();
    }
  });

  app.on('before-quit', () => {
    isQuitting = true;
    globalShortcut.unregisterAll();
  });

  app.on('will-quit', () => {
    globalShortcut.unregisterAll();
  });
}

function initializeManagers() {
  screenshotManager = new ScreenshotManager();
  translationManager = new TranslationManager();
  historyManager = new HistoryManager();
}

function createMainWindow() {
  mainWindow = new BrowserWindow({
    width: 800,
    height: 600,
    show: false,
    icon: path.join(__dirname, '../assets/icon.png'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'));

  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
  });

  mainWindow.on('show', () => {
    mainWindow.webContents.send('show-history');
  });

  mainWindow.on('close', (event) => {
    if (!isQuitting) {
      event.preventDefault();
      mainWindow.hide();
      return false;
    }
  });
}

function createBubbleWindow() {
  const { width: screenWidth, height: screenHeight } = screen.getPrimaryDisplay().workAreaSize;

  bubbleWindow = new BrowserWindow({
    width: 400,
    height: 300,
    minWidth: 280,
    minHeight: 180,
    x: screenWidth - 420,
    y: screenHeight - 320,
    transparent: true,
    frame: false,
    alwaysOnTop: true,
    skipTaskbar: true,
    resizable: true,
    movable: true,
    show: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  bubbleWindow.loadFile(path.join(__dirname, '../renderer/bubble.html'));

  bubbleWindow.on('closed', () => {
    bubbleWindow = null;
  });
}

function createSelectionWindow() {
  if (selectionWindow) {
    selectionWindow.close();
  }

  const { width: screenWidth, height: screenHeight } = screen.getPrimaryDisplay().workAreaSize;

  selectionWindow = new BrowserWindow({
    width: screenWidth,
    height: screenHeight,
    x: 0,
    y: 0,
    transparent: true,
    frame: false,
    alwaysOnTop: true,
    skipTaskbar: true,
    resizable: false,
    show: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  selectionWindow.loadFile(path.join(__dirname, '../renderer/selection.html'));

  selectionWindow.once('ready-to-show', () => {
    selectionWindow.showInactive();
    selectionWindow.focus();
    selectionWindow.setAlwaysOnTop(true, 'screen-saver');
  });

  selectionWindow.on('closed', () => {
    selectionWindow = null;
  });
}

function registerShortcuts() {
  const ret = globalShortcut.register('CommandOrControl+Alt+T', () => {
    startScreenCapture();
  });

  if (!ret) {
    console.log('快捷键注册失败');
  }
}

function startScreenCapture() {
  console.log('startScreenCapture called');
  createSelectionWindow();
}

async function processSelection(rect) {
  console.log('processSelection called, rect:', rect);

  if (rect.width < 50 || rect.height < 20) {
    console.log('Selection too small:', rect.width, 'x', rect.height);
    if (bubbleWindow) {
      bubbleWindow.webContents.send('show-loading');
      bubbleWindow.show();
      bubbleWindow.webContents.send('show-error', {
        message: '框选区域太小，请重新选择更大的区域'
      });
    }
    return;
  }

  try {
    console.log('Bubble window exists:', !!bubbleWindow);
    if (bubbleWindow) {
      console.log('Sending show-loading...');
      bubbleWindow.webContents.send('show-loading');
      bubbleWindow.show();
      console.log('Bubble window shown for loading');
    }

    console.log('Capturing screen region...');
    const imageBuffer = await screenshotManager.captureRegion(rect);

    if (!imageBuffer) {
      throw new Error('截图失败');
    }

    console.log('Image captured, length:', imageBuffer.length);
    console.log('Sending to vision model...');

    const result = await translationManager.translateWithImage(imageBuffer);
    console.log('=== Translation result ===');
    console.log(JSON.stringify(result));

    if (result && result.translation) {
      const text = result.translation.trim();
      console.log('Translation text:', text);

      if (text && text !== '未识别到文字' && !text.includes('未识别到文字')) {
        console.log('Bubble window exists:', !!bubbleWindow);
        if (bubbleWindow) {
          console.log('Sending update-translation to bubble...');
          bubbleWindow.webContents.send('update-translation', {
            original: '(图片文字识别+翻译)',
            translation: text,
            model: result.model,
            confidence: 100
          });
          console.log('Showing bubble window...');
          bubbleWindow.show();
          bubbleWindow.focus();
        } else {
          console.log('ERROR: bubbleWindow is null!');
        }

        historyManager.addRecord({
          original: '(图片文字识别+翻译)',
          translation: text,
          model: result.model,
          confidence: 100
        });
        console.log('History record added');
      } else {
        if (bubbleWindow) {
          bubbleWindow.webContents.send('show-error', {
            message: '未识别到文字，请重新选择区域'
          });
        }
      }
    } else {
      if (bubbleWindow) {
        bubbleWindow.webContents.send('show-error', {
          message: '翻译结果为空'
        });
      }
    }
  } catch (error) {
    console.error('处理失败:', error.message);
    if (bubbleWindow) {
      bubbleWindow.webContents.send('show-error', {
        message: '处理失败: ' + error.message
      });
    }
  }
}

ipcMain.on('selection-complete', (event, rect) => {
  console.log('=== selection-complete received ===');
  console.log('Rect:', JSON.stringify(rect));
  processSelection(rect);
});

ipcMain.on('cancel-selection', (event, data) => {
  console.log('=== cancel-selection received ===');
  if (selectionWindow) {
    selectionWindow.close();
  }
});

ipcMain.on('hide-bubble', () => {
  if (bubbleWindow) {
    bubbleWindow.hide();
  }
});

ipcMain.on('show-bubble', () => {
  if (bubbleWindow) {
    bubbleWindow.show();
  }
});

ipcMain.on('start-capture', () => {
  console.log('=== start-capture received ===');
  startScreenCapture();
});

ipcMain.on('show-history', () => {
  if (mainWindow) {
    mainWindow.webContents.send('show-history');
    mainWindow.show();
  }
});

ipcMain.on('get-history', (event) => {
  const history = historyManager.getRecords();
  console.log('get-history called, records:', history.length);
  event.returnValue = history;
});

ipcMain.on('clear-history', () => {
  historyManager.clearRecords();
});

ipcMain.on('delete-history-item', (event, id) => {
  historyManager.deleteRecord(id);
});
