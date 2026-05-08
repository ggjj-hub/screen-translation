const { app, Menu, Tray, nativeImage, dialog, BrowserWindow } = require('electron');
const path = require('path');

class TrayManager {
  constructor(mainWindow) {
    this.tray = null;
    this.mainWindow = mainWindow;
    this.contextMenu = null;
  }

  create() {
    const iconPath = path.join(__dirname, '../assets/icon.png');
    let trayIcon;
    
    try {
      trayIcon = nativeImage.createFromPath(iconPath);
      if (trayIcon.isEmpty()) {
        trayIcon = this.createDefaultIcon();
      }
    } catch (error) {
      trayIcon = this.createDefaultIcon();
    }
    
    this.tray = new Tray(trayIcon);

    this.tray.setToolTip('屏幕翻译工具 - Ctrl+Alt+T 截图翻译');

    const menuTemplate = [
      {
        label: '显示主窗口',
        click: () => this.showMainWindow()
      },
      { type: 'separator' },
      {
        label: '截图翻译',
        accelerator: 'Ctrl+Alt+T',
        click: () => this.captureScreen()
      },
      { type: 'separator' },
      {
        label: '设置',
        submenu: [
          {
            label: '翻译模型',
            submenu: [
              { label: 'qwen3-vl:8b', type: 'radio', checked: true, click: () => this.setModel('qwen3-vl:8b') },
              { label: 'qwen2.5:7b', type: 'radio', click: () => this.setModel('qwen2.5:7b') },
              { label: 'llava:7b', type: 'radio', click: () => this.setModel('llava:7b') }
            ]
          },
          {
            label: '目标语言',
            submenu: [
              { label: '中文', type: 'radio', checked: true, click: () => this.setTargetLang('zh') },
              { label: 'English', type: 'radio', click: () => this.setTargetLang('en') },
              { label: '日本語', type: 'radio', click: () => this.setTargetLang('ja') }
            ]
          },
          { type: 'separator' },
          {
            label: '开机自启',
            type: 'checkbox',
            checked: false,
            click: (menuItem) => this.toggleAutoLaunch(menuItem.checked)
          }
        ]
      },
      { type: 'separator' },
      {
        label: '翻译历史',
        click: () => this.showHistory()
      },
      { type: 'separator' },
      {
        label: '关于',
        click: () => this.showAbout()
      },
      { type: 'separator' },
      {
        label: '退出',
        click: () => this.quit()
      }
    ];

    this.contextMenu = Menu.buildFromTemplate(menuTemplate);
    this.tray.setContextMenu(this.contextMenu);

    this.tray.on('double-click', () => {
      this.showMainWindow();
    });

    this.tray.on('click', () => {
      if (process.platform === 'win32') {
        this.tray.popUpContextMenu(this.contextMenu);
      }
    });
  }

  showMainWindow() {
    if (this.mainWindow) {
      if (this.mainWindow.isMinimized()) {
        this.mainWindow.restore();
      }
      this.mainWindow.show();
      this.mainWindow.focus();
    }
  }

  captureScreen() {
    if (this.mainWindow) {
      this.mainWindow.webContents.send('start-capture');
    }
  }

  showHistory() {
    if (this.mainWindow) {
      this.mainWindow.webContents.send('show-history');
    }
  }

  showAbout() {
    dialog.showMessageBox(this.mainWindow, {
      type: 'info',
      title: '关于屏幕翻译工具',
      message: 'ScreenTranslator v1.0.0',
      detail: '基于 Electron + Tesseract.js + Ollama\n支持100+语言识别和翻译',
      buttons: ['确定']
    });
  }

  setModel(model) {
    if (this.mainWindow) {
      this.mainWindow.webContents.send('set-model', model);
    }
  }

  setTargetLang(lang) {
    if (this.mainWindow) {
      this.mainWindow.webContents.send('set-target-lang', lang);
    }
  }

  toggleAutoLaunch(enable) {
    app.setLoginItemSettings({
      openAtLogin: enable,
      path: app.getPath('exe')
    });
  }

  quit() {
    app.isQuitting = true;
    app.quit();
  }

  destroy() {
    if (this.tray) {
      this.tray.destroy();
    }
  }

  createDefaultIcon() {
    const size = 16;
    const canvas = Buffer.alloc(size * size * 4);
    
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const offset = (y * size + x) * 4;
        const centerX = size / 2;
        const centerY = size / 2;
        const radius = size / 2 - 1;
        const distance = Math.sqrt((x - centerX) ** 2 + (y - centerY) ** 2);
        
        if (distance <= radius) {
          canvas[offset] = 102;
          canvas[offset + 1] = 126;
          canvas[offset + 2] = 234;
          canvas[offset + 3] = 255;
        } else {
          canvas[offset] = 0;
          canvas[offset + 1] = 0;
          canvas[offset + 2] = 0;
          canvas[offset + 3] = 0;
        }
      }
    }
    
    return nativeImage.createFromBuffer(canvas, { width: size, height: size });
  }
}

module.exports = TrayManager;
