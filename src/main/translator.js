const http = require('http');

class TranslationManager {
  constructor(config = {}) {
    this.baseUrl = config.baseUrl || 'http://localhost:11434';
    this.model = config.model || 'qwen3-vl:8b';
    this.timeout = config.timeout || 60000;
    this.cache = new Map();
    this.maxCacheSize = 1000;
  }

  async translateWithImage(imageBuffer, targetLang = 'zh') {
    const startTime = Date.now();
    const prompt = this.buildImagePrompt(targetLang);

    try {
      console.log('=== translateWithImage called ===');
      console.log('Image buffer length:', imageBuffer.length);
      console.log('Model:', this.model);

      const base64Image = imageBuffer.toString('base64');
      console.log('Base64 image length:', base64Image.length);

      console.log('Calling Ollama API...');
      const response = await this.callOllamaWithImage(prompt, base64Image);
      const elapsed = Date.now() - startTime;

      console.log(`视觉翻译耗时: ${elapsed}ms`);
      console.log('Response:', response);

      return {
        translation: response,
        elapsed: elapsed,
        model: this.model
      };
    } catch (error) {
      console.error('视觉翻译失败:', error);
      throw error;
    }
  }

  async translate(text, targetLang = 'zh') {
    const cacheKey = `${text}:${targetLang}`;
    const cached = this.cache.get(cacheKey);
    if (cached) {
      return cached;
    }

    const startTime = Date.now();
    const prompt = this.buildTextPrompt(text, targetLang);

    try {
      const response = await this.callOllama(prompt);
      const elapsed = Date.now() - startTime;

      console.log(`翻译耗时: ${elapsed}ms`);

      const result = {
        translation: response,
        elapsed: elapsed,
        model: this.model
      };

      this.setCache(cacheKey, result);

      return result;
    } catch (error) {
      console.error('翻译失败:', error);
      throw error;
    }
  }

  buildImagePrompt(targetLang) {
    const langMap = {
      'zh': '中文',
      'en': 'English',
      'ja': '日本語',
      'ko': '한국어'
    };

    const targetLanguage = langMap[targetLang] || '中文';

    return `请完成以下任务：
1. 识别图片中的所有文字内容
2. 将识别出的文字翻译成${targetLanguage}

要求：
- 直接返回翻译结果
- 不要添加任何解释或前缀
- 如果图片中没有文字，请返回"未识别到文字"
- 如果文字已经是${targetLanguage}，直接返回原文`;
  }

  buildTextPrompt(text, targetLang) {
    const langMap = {
      'zh': '中文',
      'en': 'English',
      'ja': '日本語',
      'ko': '한국어'
    };

    const targetLanguage = langMap[targetLang] || '中文';

    return `你是一个专业的翻译助手。请将以下文本翻译成${targetLanguage}。

要求：
1. 保持原文意思准确
2. 翻译要自然流畅
3. 仅返回翻译结果，不要添加任何解释
4. 如果原文已经是${targetLanguage}，请返回原文

原文：
${text}

翻译：`;
  }

  async callOllamaWithImage(prompt, base64Image) {
    return new Promise((resolve, reject) => {
      const postData = JSON.stringify({
        model: this.model,
        messages: [
          {
            role: 'user',
            content: prompt,
            images: [base64Image]
          }
        ],
        stream: false,
        options: {
          temperature: 0.3,
          top_p: 0.9,
          num_predict: 2000
        }
      });

      console.log('Ollama request:', JSON.stringify({
        model: this.model,
        prompt: prompt.substring(0, 100) + '...',
        images: [base64Image.substring(0, 50) + '...']
      }));

      const req = http.request({
        hostname: 'localhost',
        port: 11434,
        path: '/api/chat',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(postData)
        },
        timeout: this.timeout
      }, (res) => {
        let data = '';

        res.on('data', (chunk) => {
          data += chunk;
        });

        res.on('end', () => {
          try {
            console.log('Ollama raw response:', data);
            const result = JSON.parse(data);

            let text = '';
            if (result.message && result.message.content) {
              text = result.message.content;
            } else if (result.response) {
              text = result.response;
            }

            console.log('Extracted text:', text);
            resolve(text);
          } catch (e) {
            console.error('Parse error:', e.message, 'Raw data:', data);
            reject(new Error('解析响应失败: ' + e.message));
          }
        });
      });

      req.on('error', (err) => {
        console.error('Request error:', err);
        reject(err);
      });
      req.on('timeout', () => {
        req.destroy();
        reject(new Error('请求超时'));
      });

      req.write(postData);
      req.end();
    });
  }

  async callOllama(prompt) {
    return new Promise((resolve, reject) => {
      const postData = JSON.stringify({
        model: this.model,
        prompt: prompt,
        stream: false,
        options: {
          temperature: 0.3,
          top_p: 0.9,
          num_predict: 1000,
          repeat_penalty: 1.1
        }
      });

      const req = http.request({
        hostname: 'localhost',
        port: 11434,
        path: '/api/generate',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(postData)
        },
        timeout: this.timeout
      }, (res) => {
        let data = '';

        res.on('data', (chunk) => {
          data += chunk;
        });

        res.on('end', () => {
          try {
            const result = JSON.parse(data);
            resolve(result.response);
          } catch (e) {
            reject(new Error('解析响应失败'));
          }
        });
      });

      req.on('error', reject);
      req.on('timeout', () => {
        req.destroy();
        reject(new Error('请求超时'));
      });

      req.write(postData);
      req.end();
    });
  }

  setCache(key, value) {
    if (this.cache.size >= this.maxCacheSize) {
      const firstKey = this.cache.keys().next().value;
      this.cache.delete(firstKey);
    }
    this.cache.set(key, value);
  }

  getCache(key) {
    return this.cache.get(key);
  }

  clearCache() {
    this.cache.clear();
  }

  setModel(model) {
    this.model = model;
  }

  getModel() {
    return this.model;
  }
}

module.exports = TranslationManager;
