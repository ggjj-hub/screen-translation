const fs = require('fs');
const path = require('path');
const { app } = require('electron');
const { v4: uuidv4 } = require('uuid');

class HistoryManager {
  constructor() {
    this.historyPath = path.join(app.getPath('userData'), 'history.json');
    this.records = [];
    this.maxAge = 24 * 60 * 60 * 1000;
    this.loadRecords();
    this.startCleanupTimer();
  }

  loadRecords() {
    try {
      if (fs.existsSync(this.historyPath)) {
        const data = fs.readFileSync(this.historyPath, 'utf-8');
        this.records = JSON.parse(data);
        this.cleanupOldRecords();
      }
    } catch (error) {
      console.error('加载历史记录失败:', error);
      this.records = [];
    }
  }

  saveRecords() {
    try {
      const dir = path.dirname(this.historyPath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      fs.writeFileSync(this.historyPath, JSON.stringify(this.records, null, 2), 'utf-8');
    } catch (error) {
      console.error('保存历史记录失败:', error);
    }
  }

  addRecord(record) {
    const newRecord = {
      id: uuidv4(),
      original: record.original,
      translation: record.translation,
      model: record.model,
      confidence: record.confidence,
      timestamp: new Date().toISOString()
    };

    this.records.unshift(newRecord);

    if (this.records.length > 1000) {
      this.records = this.records.slice(0, 1000);
    }

    this.saveRecords();
    return newRecord;
  }

  getRecords() {
    this.cleanupOldRecords();
    return this.records;
  }

  deleteRecord(id) {
    this.records = this.records.filter(record => record.id !== id);
    this.saveRecords();
  }

  clearRecords() {
    this.records = [];
    this.saveRecords();
  }

  cleanupOldRecords() {
    const now = Date.now();
    this.records = this.records.filter(record => {
      const recordTime = new Date(record.timestamp).getTime();
      return now - recordTime < this.maxAge;
    });
    this.saveRecords();
  }

  startCleanupTimer() {
    setInterval(() => {
      this.cleanupOldRecords();
    }, 60 * 60 * 1000);
  }
}

module.exports = HistoryManager;
