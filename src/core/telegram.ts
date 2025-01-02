import { Logger } from './logger';
import type { Message, TelegramConfig } from '../types';

export class TelegramClient {
  private token: string;
  private webhookSecret: string;

  constructor(config: TelegramConfig) {
    this.token = config.botToken;
    this.webhookSecret = config.webhookSecret;
  }

  /**
   * Send a message to a Telegram chat
   */
  async sendMessage(chatId: number, text: string): Promise<void> {
    if (!this.token) {
      throw new Error('Telegram bot token not configured');
    }

    try {
      const response = await fetch(`https://api.telegram.org/bot${this.token}/sendMessage`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          chat_id: chatId,
          text: text,
          parse_mode: 'HTML',
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        Logger.error('Failed to send Telegram message:', error);
        throw new Error(`Telegram API error: ${error.description}`);
      }

      Logger.debug('Sent Telegram message:', { chatId, text });
    } catch (error) {
      Logger.error('Error sending Telegram message:', error);
      throw error;
    }
  }

  /**
   * Convert a Telegram update to our Message format
   */
  convertUpdate(update: any): Message | null {
    Logger.info('Converting Telegram update:', update);
    
    if (!update.message?.text) {
      Logger.info('Not a text message:', update);
      return null; // Not a text message
    }

    const message = update.message;
    return {
      id: String(message.message_id),
      text: message.text,
      author: {
        username: message.from.username || String(message.from.id),
        displayName: `${message.from.first_name} ${message.from.last_name || ''}`.trim(),
        chatId: message.chat.id
      },
      timestamp: message.date * 1000, // Convert Unix timestamp to milliseconds
      platform: 'telegram',
      replyTo: message.reply_to_message?.message_id?.toString(),
      raw: update
    };
  }

  /**
   * Verify that the webhook request is authentic
   */
  verifyWebhook(request: Request): boolean {
    const signature = request.headers.get('X-Telegram-Bot-Api-Secret-Token');
    return signature === this.webhookSecret;
  }
}
