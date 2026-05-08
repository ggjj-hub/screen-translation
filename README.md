# ScreenTranslator 屏幕翻译工具

基于 Electron + Ollama 视觉模型的屏幕翻译工具，支持快捷键截图翻译。

## 功能特点

- **快捷键截图翻译** — `Ctrl+Alt+T` 快速触发框选翻译
- **视觉模型识图** — 使用 `qwen3-vl:8b` 本地视觉模型，直接识别图片中的文字并翻译
- **悬浮气泡显示** — 翻译结果以悬浮气泡展示，支持拖动和缩放
- **系统托盘后台运行** — 最小化到系统托盘，不干扰工作
- **翻译历史** — 自动保存24小时内的翻译记录

## 环境要求

- Windows 10/11 (64位)
- [Node.js](https://nodejs.org/) 18+
- [Ollama](https://ollama.com/) 已安装并运行

## 安装步骤

### 1. 安装 Ollama

```bash
# Windows
winget install Ollama.Ollama

# 拉取视觉模型
ollama pull qwen3-vl:8b
```

### 2. 启动 Ollama 服务

```bash
ollama serve
```

### 3. 安装项目依赖

```bash
cd screen-translator
npm install
```

### 4. 启动应用

```bash
npm start
```

## 使用方法

1. 按 `Ctrl+Alt+T` 触发截图翻译
2. 拖拽鼠标框选需要翻译的区域
3. 按 `Enter` 确认 / `ESC` 取消
4. 等待翻译结果在悬浮气泡中显示

## 快捷键

| 快捷键 | 功能 |
|--------|------|
| `Ctrl+Alt+T` | 触发截图翻译 |
| `Enter` | 确认框选区域 |
| `ESC` | 取消操作 |

## 项目结构

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
│   └── assets/               # 图标资源
├── package.json
└── .gitignore
```

## 技术栈

- **Electron** — 桌面应用框架
- **Ollama** — 本地大模型运行框架
- **qwen3-vl:8b** — 视觉语言模型（识图+翻译）

## 许可证

MIT
