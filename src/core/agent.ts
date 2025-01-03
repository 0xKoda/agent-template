import { TelegramClient } from './telegram';
import { FarcasterClient } from './farcaster';
import { Memory } from './memory';
import { Logger } from './logger';
import { TwitterClient } from './twitter';
import type { Message, Env, ActionResult, TelegramConfig, FarcasterConfig, TwitterConfig } from './types';
import { loadActions } from '../actions';
import character from '../config/character.json';

export class Agent {
  private env: Env;
  private memory?: Memory;
  private telegram?: TelegramClient;
  private farcaster?: FarcasterClient;
  private twitter?: TwitterClient;
  private character: typeof character;
  private actions: Record<string, any>;

  constructor(env: Env) {
    this.env = env;
    this.memory = new Memory({ agent_memory: env.agent_memory });
    this.character = character;
    this.actions = loadActions();
    
    // Initialize actions with env
    Object.values(this.actions).forEach(action => action.setEnv(env));

    // Initialize enabled clients
    this.initializeClients();
  }

  private initializeClients() {
    if (this.env.ENABLE_TELEGRAM) {
      const telegramConfig: TelegramConfig = {
        enabled: true,
        env: this.env,
        botToken: this.env.TELEGRAM_BOT_TOKEN
      };
      this.telegram = new TelegramClient(telegramConfig);
    }

    if (this.env.ENABLE_FARCASTER) {
      Logger.info('Initializing Farcaster client with config:', { 
        enabled: this.env.ENABLE_FARCASTER,
        hasApiKey: Boolean(this.env.FARCASTER_NEYNAR_API_KEY),
        hasSignerUuid: Boolean(this.env.FARCASTER_NEYNAR_SIGNER_UUID),
        hasFid: Boolean(this.env.FARCASTER_FID)
      });

      const farcasterConfig: FarcasterConfig = {
        enabled: true,
        env: this.env,
        fid: this.env.FARCASTER_FID,
        neynarApiKey: this.env.FARCASTER_NEYNAR_API_KEY,
        signerUuid: this.env.FARCASTER_NEYNAR_SIGNER_UUID
      };
      this.farcaster = new FarcasterClient(farcasterConfig);
    }

    if (this.env.ENABLE_TWITTER) {
      const twitterConfig: TwitterConfig = {
        enabled: true,
        env: this.env,
        apiKey: this.env.TWITTER_API_KEY,
        apiKeySecret: this.env.TWITTER_API_KEY_SECRET,
        accessToken: this.env.TWITTER_ACCESS_TOKEN,
        accessTokenSecret: this.env.TWITTER_ACCESS_TOKEN_SECRET
      };
      this.twitter = new TwitterClient(twitterConfig);
    }
  }

  updateEnv(env: Env) {
    this.env = env;
    this.memory = new Memory({ agent_memory: env.agent_memory });
    
    // Reinitialize clients with new env
    this.initializeClients();
    
    // Update actions with new env
    Object.values(this.actions).forEach(action => action.setEnv(env));
  }

  async processMessage(message: Message): Promise<ActionResult> {
    try {
      Logger.info('Processing message:', { platform: message.platform, text: message.text });

      // Transform message based on platform
      let transformedMessage: Message | null = null;
      switch (message.platform) {
        case 'telegram':
          if (!this.telegram) {
            throw new Error('Telegram client not initialized');
          }
          transformedMessage = this.telegram.transformWebhook(message.raw);
          break;

        case 'farcaster':
          if (!this.farcaster) {
            throw new Error('Farcaster client not initialized');
          }
          transformedMessage = this.farcaster.transformWebhook(message.raw);
          break;

        default:
          Logger.error('Unknown platform:', message.platform);
          throw new Error(`Unknown platform: ${message.platform}`);
      }

      if (!transformedMessage) {
        Logger.error('Failed to transform message:', message);
        throw new Error('Failed to transform message');
      }

      // Check for actions first, before getting any history
      const actionResult = await this.checkActions(transformedMessage);
      if (actionResult) {
        if (actionResult.context) {
          // If action provides context, use LLM to generate response
          const llmResponse = await this.generateLLMResponse(
            [
              { role: "system", content: actionResult.context },
              { role: "user", content: actionResult.text }
            ],
            message.platform
          );
          
          const finalResponse = `${actionResult.text}\n\n🔍 Analysis:\n${llmResponse}`;
          await this.sendReply(finalResponse, transformedMessage);
          
          return {
            text: finalResponse,
            shouldSendMessage: true
          };
        } else {
          // If no context, send action result directly
          await this.sendReply(actionResult.text, transformedMessage);
          return actionResult;
        }
      }

      // Only get conversation history if no action was triggered
      const conversationId = await this.getConversationId(transformedMessage);
      const history = await this.memory.getConversations(conversationId);
      
      // Get long-term memory context
      const longTermContext = await this.getLongTermContext(transformedMessage.author.username);

      // Generate response using character and context
      const response = await this.generateResponse(transformedMessage, history, longTermContext);

      // Store message in conversation history
      await this.memory.storeConversation(conversationId, {
        role: 'user',
        content: transformedMessage.text,
      });

      // Store response in conversation history
      await this.memory.storeConversation(conversationId, {
        role: 'assistant',
        content: response,
      });

      // Send reply
      await this.sendReply(response, transformedMessage);

      return {
        text: response,
        shouldSendMessage: true,
      };
    } catch (error) {
      Logger.error('Error processing message:', error);
      throw error;
    }
  }

  async processScheduledMessage(message: Message, options: { context?: string } = {}): Promise<ActionResult | null> {
    try {
      Logger.info('Processing scheduled message:', { platform: message.platform, text: message.text });

      const actionResult = await this.checkActions(message);
      if (actionResult) {
        if (actionResult.context || options.context) {
          // Use provided context or fall back to action context
          const context = options.context || actionResult.context;
          
          const llmResponse = await this.generateLLMResponse(
            [
              { role: "system", content: context },
              { role: "user", content: actionResult.text }
            ],
            message.platform
          );
          
          return {
            text: llmResponse, // For scheduled posts, only return the analysis without the raw data
            shouldSendMessage: true
          };
        }
        return actionResult;
      }
      return null;
    } catch (error) {
      Logger.error('Error processing scheduled message:', error);
      throw error;
    }
  }

  private async sendReply(text: string, message: Message): Promise<void> {
    try {
      Logger.info('Attempting to send reply:', { platform: message.platform, text: text });
      
      switch (message.platform) {
        case 'telegram':
          if (!this.telegram) {
            Logger.error('Telegram client not initialized');
            throw new Error('Telegram client not initialized');
          }
          if (!message.author.chatId) {
            Logger.error('No chatId in message:', message);
            throw new Error('No chatId in message');
          }
          Logger.info('Sending Telegram message:', { chatId: message.author.chatId, text: text });
          await this.telegram.sendMessage(message.author.chatId, text);
          break;
          
        case 'farcaster':
          if (this.farcaster) {
            // Use the parent hash from the message for replies
            const parentHash = message.hash;
            Logger.info('Replying to Farcaster cast:', { parentHash, text });
            await this.farcaster.publishCast(text, parentHash);
          }
          break;
          
        case 'twitter':
          if (this.env.ENABLE_TWITTER) {
            await this.publishTweet(text);
          }
          break;
          
        default:
          Logger.error('Unknown platform:', message.platform);
      }
    } catch (error) {
      Logger.error('Error sending reply:', error);
      throw error;
    }
  }

  async publishFarcasterCast(text: string): Promise<void> {
    if (this.farcaster) {
      await this.farcaster.publishCast(text, null);
    } else {
      throw new Error('Farcaster client not initialized');
    }
  }

  private getTwitterClient(): TwitterClient {
    if (!this.env.ENABLE_TWITTER) {
      throw new Error('Twitter is not enabled');
    }

    const config: TwitterConfig = {
      enabled: true,
      env: this.env,
      apiKey: this.env.TWITTER_API_KEY,
      apiKeySecret: this.env.TWITTER_API_KEY_SECRET,
      accessToken: this.env.TWITTER_ACCESS_TOKEN,
      accessTokenSecret: this.env.TWITTER_ACCESS_TOKEN_SECRET
    };

    return new TwitterClient(config);
  }

  async publishTweet(text: string): Promise<void> {
    if (!this.env.ENABLE_TWITTER) {
      throw new Error('Twitter is not enabled');
    }

    const twitterClient = this.getTwitterClient();
    await twitterClient.postTweet(text);
  }

  async generateResponse(message: Message, history: any[], longTermContext: string): Promise<string> {
    Logger.debug('Generating response with context:', { history, longTermContext });

    // Combine all context
    const fullContext = longTermContext + '\n' + history.map(item => item.content).join('\n');
    console.log('Full context:', fullContext); // Keep debug logging

    // Generate response using OpenRouter
    const response = await this.generateLLMResponse(
      [
        { role: "system", content: this.character.system_prompt },
        { role: "system", content: fullContext },
        { role: "user", content: message.text }
      ],
      message.platform
    );
    
    return response;
  }

  // Make public for use by scheduled jobs
  async generateLLMResponse(messages: any[], platform: string): Promise<string> {
    Logger.debug('Generating LLM response:', { messages });

    const apiKey = this.env.OPENROUTER_API_KEY;
    if (!apiKey) {
      throw new Error('Missing OpenRouter API key');
    }

    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'https://github.com/arjunb023/ax',
        'X-Title': 'Ax'
      },
      body: JSON.stringify({
        model: this.env.LLM_MODEL || 'openai/gpt-3.5-turbo',
        messages,
        max_tokens: 700,
        temperature: 0.7
      })
    });

    if (!response.ok) {
      throw new Error(`OpenRouter API error: ${response.statusText}`);
    }

    const data = await response.json();
    const content = data.choices[0].message.content;

    // Apply platform-specific character limits
    switch (platform) {
      case 'telegram':
        // Telegram has a 4096 character limit
        return content.length > 4096 ? content.slice(0, 4093) + '...' : content;
      case 'farcaster':
        // Farcaster has a 320 character limit
        return content.length > 320 ? content.slice(0, 317) + '...' : content;
      default:
        Logger.warn('Unknown platform, no character limit applied:', platform);
        return content;
    }
  }

  private async getConversationId(message: Message): Promise<string> {
    // Keep existing conversation ID logic - important for memory continuity
    return message.author.username;
  }

  private async getLongTermContext(username: string): Promise<string> {
    // Get all memories for context
    const memories = await this.memory.getAllMemories(username);
    return this.memory.formatMemoriesForContext(memories);
  }

  private async checkActions(message: Message): Promise<ActionResult | null> {
    // Only check current message for actions, not history
    for (const [actionName, action] of Object.entries(this.actions)) {
      const shouldExecute = await action.shouldExecute(message);
      if (shouldExecute) {
        Logger.info('Executing action:', actionName);
        return await action.execute(message);
      }
    }
    return null;
  }
}
