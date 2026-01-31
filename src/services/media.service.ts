import axios from 'axios';
import FormData from 'form-data';
import fs from 'fs';
import path from 'path';
import { logger } from '../utils/logger.js';

/**
 * Media Upload Service for DingTalk
 * Handles image uploads to DingTalk
 */
export class MediaService {
  private accessToken: string;

  constructor(accessToken: string) {
    this.accessToken = accessToken;
  }

  /**
   * Set access token (for refresh)
   */
  setAccessToken(token: string): void {
    this.accessToken = token;
  }

  /**
   * Upload image to DingTalk
   */
  async uploadImage(filePath: string): Promise<string | null> {
    try {
      const absPath = filePath.startsWith('file://') ? filePath.slice(7) : filePath;

      // Check if file exists
      if (!fs.existsSync(absPath)) {
        logger.warn(`Image file not found: ${absPath}`);
        return null;
      }

      const form = new FormData();
      form.append('media', fs.createReadStream(absPath), {
        filename: path.basename(absPath),
        contentType: 'image/jpeg',
      });

      const response = await axios.post(
        `https://oapi.dingtalk.com/media/upload?access_token=${this.accessToken}&type=image`,
        form,
        {
          headers: {
            ...form.getHeaders(),
          },
          timeout: 30000,
        }
      );

      const mediaId = response.data?.media_id;
      if (mediaId) {
        logger.info(`Uploaded image: ${absPath} -> ${mediaId}`);
        return `@${mediaId}`;
      }

      return null;
    } catch (error) {
      logger.error('Failed to upload image:', error);
      return null;
    }
  }

  /**
   * Process local image paths in content and upload them
   */
  async processLocalImages(content: string): Promise<string> {
    // Regex patterns for local image paths
    const markdownImageRe =
      /!\[([^\]]*)\]\(((?:file:\/\/|MEDIA:|attachment:\/\/)[^\s)]+|\/(?:tmp|var|private|Users)[^\s)]+)\)/g;
    const barePathRe =
      /`?(\/(?:tmp|var|private|Users)\/[^\s`'",)]+\.(?:png|jpg|jpeg|gif|bmp|webp))`?/gi;

    let processed = content;

    // Process markdown images: ![alt](file:///path)
    const markdownMatches = content.matchAll(markdownImageRe);
    for (const match of markdownMatches) {
      const [fullMatch, alt, filePath] = match;
      const mediaId = await this.uploadImage(filePath);
      if (mediaId) {
        processed = processed.replace(fullMatch, `![${alt}](${mediaId})`);
      }
    }

    // Process bare paths: /tmp/xxx.png
    const bareMatches = processed.matchAll(barePathRe);
    for (const match of bareMatches) {
      const [fullMatch, filePath] = match;
      const mediaId = await this.uploadImage(filePath);
      if (mediaId) {
        processed = processed.replace(fullMatch, `![image](${mediaId})`);
      }
    }

    return processed;
  }

  /**
   * Build system prompt for media handling
   */
  static buildMediaSystemPrompt(): string {
    return `
## 钉钉图片显示规则
显示图片时，直接使用本地文件路径，系统会自动上传处理。

### 正确方式
![描述](file:///path/to/image.jpg)
![描述](/tmp/screenshot.png)

### 禁止
- 不要自己执行 curl 上传
- 不要猜测或构造 URL
- 不要使用 https://oapi.dingtalk.com/... 这类地址
`;
  }
}
