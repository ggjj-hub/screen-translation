const { desktopCapturer, screen } = require('electron');
const path = require('path');
const fs = require('fs');
const os = require('os');

class ScreenshotManager {
  constructor() {
    this.tempDir = path.join(os.tmpdir(), 'screen-translator');
    if (!fs.existsSync(this.tempDir)) {
      fs.mkdirSync(this.tempDir, { recursive: true });
    }
  }

  async captureScreen() {
    try {
      const sources = await desktopCapturer.getSources({
        types: ['screen'],
        thumbnailSize: screen.getPrimaryDisplay().size
      });

      if (sources.length > 0) {
        return sources[0].thumbnail.toDataURL();
      }
      return null;
    } catch (error) {
      console.error('截图失败:', error);
      throw error;
    }
  }

  async captureRegion(rect) {
    try {
      const sources = await desktopCapturer.getSources({
        types: ['screen'],
        thumbnailSize: screen.getPrimaryDisplay().size
      });

      if (sources.length > 0) {
        const thumbnail = sources[0].thumbnail;
        const size = thumbnail.getSize();

        const scaleFactor = screen.getPrimaryDisplay().scaleFactor || 1;

        const scaledRect = {
          x: Math.round(rect.x * scaleFactor),
          y: Math.round(rect.y * scaleFactor),
          width: Math.round(rect.width * scaleFactor),
          height: Math.round(rect.height * scaleFactor)
        };

        const croppedImage = thumbnail.crop(scaledRect);
        return croppedImage.toPNG();
      }
      return null;
    } catch (error) {
      console.error('区域截图失败:', error);
      throw error;
    }
  }

  dataURLToBuffer(dataURL) {
    const base64 = dataURL.replace(/^data:image\/\w+;base64,/, '');
    return Buffer.from(base64, 'base64');
  }

  async saveTempImage(buffer, filename) {
    const filePath = path.join(this.tempDir, filename || `screenshot-${Date.now()}.png`);
    fs.writeFileSync(filePath, buffer);
    return filePath;
  }

  cleanupTempFiles() {
    try {
      const files = fs.readdirSync(this.tempDir);
      const now = Date.now();

      files.forEach(file => {
        const filePath = path.join(this.tempDir, file);
        const stats = fs.statSync(filePath);
        const age = now - stats.mtimeMs;

        if (age > 24 * 60 * 60 * 1000) {
          fs.unlinkSync(filePath);
        }
      });
    } catch (error) {
      console.error('清理临时文件失败:', error);
    }
  }
}

module.exports = ScreenshotManager;
