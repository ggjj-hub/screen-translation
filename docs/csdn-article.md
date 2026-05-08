# Electron + Ollama 搭建本地屏幕翻译工具（完整教程）

> 本文介绍如何使用 Electron + Ollama 视觉模型搭建一个本地屏幕翻译工具，支持快捷键截图翻译，完全离线运行，保护隐私。

## 前言

在日常工作和学习中，经常需要翻译屏幕上的英文内容。传统的翻译工具需要手动输入文字，效率较低。本文将介绍如何搭建一个**屏幕翻译工具**，支持：

- **快捷键截图翻译** — `Ctrl+Alt+T` 快速触发
- **视觉模型识图翻译** — 使用 `qwen3-vl` 直接识别图片中的文字并翻译
- **本地运行** — 所有数据在本地处理，不上传云端
- **悬浮气泡显示** — 翻译结果即时展示

## 环境准备

### 1. 安装 Node.js

前往 [Node.js 官网](https://nodejs.org/) 下载并安装 Node.js 18+ 版本。

验证安装：
```bash
node --version
npm --version
```

### 2. 安装 Ollama

Ollama 是一个本地运行大模型的工具。

```bash
# Windows (使用 winget)
winget install Ollama.Ollama

# 或者从官网下载：https://ollama.com/download
```

验证安装：
```bash
ollama --version
```

### 3. 拉取视觉模型

```bash
# 拉取 qwen3-vl 视觉模型（约 6GB）
ollama pull qwen3-vl:8b
```

等待下载完成，验证模型：
```bash
ollama list
```

## 项目搭建

### 1. 创建项目

```bash
mkdir screen-translator
cd screen-translator
npm init -y
```

### 2. 安装依赖

```bash
# 生产依赖
npm install uuid electron-store

# 开发依赖
npm install --save-dev electron electron-builder
```

### 3. 项目结构

```
screen-translator/
├── src/
│   ├── main/
│   │   ├── index.js          # 主进程入口
│   │   ├── preload.js        # 预加载脚本
│   │   ├── screenshot.js     # 截图模块
│   │   ├── translator.js     # 翻译模块（Ollama视觉模型）
│   │   ├── tray.js           # 系统托盘
│   │   └── history.js        # 翻译历史
│   ├── renderer/
│   │   ├── index.html        # 主界面
│   │   ├── bubble.html       # 悬浮气泡
│   │   └── selection.html    # 区域选择
│   └── assets/
│       └── icon.png          # 应用图标
├── package.json
└── .gitignore
```

### 4. package.json 配置

```json
{
  "name": "screen-translator",
  "version": "1.0.0",
  "description": "屏幕翻译工具 - 支持快捷键截图翻译，本地Ollama视觉模型识图翻译",
  "main": "src/main/index.js",
  "scripts": {
    "start": "electron .",
    "build": "electron-builder --win --x64"
  },
  "dependencies": {
    "electron-store": "^8.1.0",
    "uuid": "^9.0.0"
  },
  "devDependencies": {
    "electron": "^28.0.0",
    "electron-builder": "^24.9.1"
  }
}
```

## 核心代码实现

### 1. 主进程入口（index.js）

主进程负责窗口管理、快捷键注册和模块协调：

```javascript
const { app, BrowserWindow, globalShortcut, ipcMain, screen } = require('electron');
const path = require('path');

let mainWindow = null;
let bubbleWindow = null;
let selectionWindow = null;

app.whenReady().then(() => {
  createMainWindow();
  createBubbleWindow();
  
  // 注册全局快捷键
  globalShortcut.register('CommandOrControl+Alt+T', () => {
    createSelectionWindow();
  });
});
```

### 2. 翻译模块（translator.js）

核心是调用 Ollama 的 `/api/chat` 接口，发送图片进行识别和翻译：

```javascript
async translateWithImage(imageBuffer, targetLang = 'zh') {
  const base64Image = imageBuffer.toString('base64');
  
  const postData = JSON.stringify({
    model: 'qwen3-vl:8b',
    messages: [{
      role: 'user',
      content: `请识别图片中的文字并翻译成中文，直接返回翻译结果`,
      images: [base64Image]
    }],
    stream: false
  });

  // 调用 Ollama API
  const response = await this.callOllama('/api/chat', postData);
  return response;
}
```

### 3. 截图模块（screenshot.js）

使用 Electron 的 `desktopCapturer` API 进行屏幕截图：

```javascript
async captureRegion(rect) {
  const sources = await desktopCapturer.getSources({
    types: ['screen'],
    thumbnailSize: screen.getPrimaryDisplay().size
  });

  if (sources.length > 0) {
    const thumbnail = sources[0].thumbnail;
    const scaleFactor = screen.getPrimaryDisplay().scaleFactor || 1;
    
    // 按缩放比例裁剪区域
    const scaledRect = {
      x: Math.round(rect.x * scaleFactor),
      y: Math.round(rect.y * scaleFactor),
      width: Math.round(rect.width * scaleFactor),
      height: Math.round(rect.height * scaleFactor)
    };

    return thumbnail.crop(scaledRect).toPNG();
  }
}
```

### 4. 区域选择（selection.html）

创建一个全屏透明窗口，支持鼠标拖拽选择区域：

```html
<script>
  document.body.addEventListener('mousedown', function(e) {
    startX = e.clientX;
    startY = e.clientY;
    isSelecting = true;
  });

  document.body.addEventListener('mouseup', function(e) {
    if (hasSelection) {
      // 发送坐标给主进程
      electronAPI.selectionComplete({
        x: rect.left, y: rect.top,
        width: rect.width, height: rect.height
      });
    }
  });

  document.addEventListener('keydown', function(e) {
    if (e.key === 'Enter' && hasSelection) doConfirm();
    if (e.key === 'Escape') doCancel();
  });
</script>
```

### 5. 悬浮气泡（bubble.html）

透明窗口显示翻译结果，支持拖动和缩放：

```javascript
// 主进程创建窗口
bubbleWindow = new BrowserWindow({
  width: 400,
  height: 300,
  transparent: true,
  frame: false,
  alwaysOnTop: true,
  resizable: true,
  movable: true
});

// CSS 拖动支持
.header {
  -webkit-app-region: drag;  /* 标题栏可拖动 */
}
.close-btn {
  -webkit-app-region: no-drag;  /* 按钮不可拖动 */
}
```

## 运行和打包

### 开发模式

```bash
# 启动 Ollama 服务
ollama serve

# 另开终端，启动应用
npm start
```

### 打包为 exe

```bash
npm run build
```

输出文件位于 `dist/` 目录：
- `ScreenTranslator Setup 1.0.0.exe` — 安装版
- `ScreenTranslator-1.0.0-portable.exe` — 便携版

## 使用方法

1. 启动 Ollama 服务：`ollama serve`
2. 运行应用（双击 exe 或 `npm start`）
3. 按 `Ctrl+Alt+T` 触发截图翻译
4. 拖拽鼠标框选文字区域
5. 按 `Enter` 确认，等待翻译结果显示在悬浮气泡中

## 常见问题

### Q1: 翻译速度慢？
视觉模型处理图片需要时间，首次使用可能需要 10-30 秒。后续使用会更快。

### Q2: Ollama 连接失败？
确保 Ollama 服务正在运行：
```bash
ollama serve
```

### Q3: 框选后没有反应？
框选区域太小会导致识别失败，建议框选包含完整文字的区域（至少 50x20 像素）。

## 总结

本文介绍了如何使用 Electron + Ollama 搭建一个本地屏幕翻译工具。通过视觉模型直接识图翻译，无需额外的 OCR 引擎，简化了技术栈。所有数据在本地处理，保护用户隐私。

项目地址：https://github.com/ggjj-hub/screen-translation

---

**标签**: Electron, Ollama, 屏幕翻译, qwen3-vl, 本地大模型
