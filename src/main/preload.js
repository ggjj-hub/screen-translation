const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  startCapture: () => ipcRenderer.send('start-capture'),
  hideBubble: () => ipcRenderer.send('hide-bubble'),
  showBubble: () => ipcRenderer.send('show-bubble'),
  showHistory: () => ipcRenderer.send('show-history'),
  cancelSelection: () => ipcRenderer.send('cancel-selection'),

  selectionComplete: (rect) => ipcRenderer.send('selection-complete', rect),

  onShowLoading: (callback) => ipcRenderer.on('show-loading', callback),
  onUpdateTranslation: (callback) => ipcRenderer.on('update-translation', (event, data) => callback(data)),
  onShowError: (callback) => ipcRenderer.on('show-error', (event, data) => callback(data)),
  onShowHistory: (callback) => ipcRenderer.on('show-history', callback),

  getHistory: () => ipcRenderer.sendSync('get-history'),
  clearHistory: () => ipcRenderer.send('clear-history'),
  deleteHistoryItem: (id) => ipcRenderer.send('delete-history-item', id)
});
