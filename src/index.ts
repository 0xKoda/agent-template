import { Agent } from './core/agent';
import { Logger } from './core/logger';
import { ScheduledJobs } from './jobs/scheduled';
import type { Env, Message, ScheduledEvent } from './types';

export default {
  async fetch(request: Request, workerEnv: Env): Promise<Response> {
    try {
      Logger.info('Received request:', { 
        method: request.method, 
        url: request.url,
        headers: Object.fromEntries(request.headers)
      });

      // Initialize agent with worker environment
      const agent = new Agent(workerEnv);
      
      const url = new URL(request.url);
      const path = url.pathname;

      if (request.method === 'POST') {
        const body = await request.json();
        Logger.info('Received webhook body:', body);

        // Process webhook based on path
        switch (path) {
          case '/telegram':
            // Check if Telegram is explicitly disabled
            if (workerEnv.ENABLE_TELEGRAM === 'false' || workerEnv.ENABLE_TELEGRAM === false) {
              Logger.error('Telegram webhook disabled:', { ENABLE_TELEGRAM: workerEnv.ENABLE_TELEGRAM });
              return new Response('Telegram webhook not enabled', { status: 400 });
            }

            // Transform Telegram webhook format to our Message type
            const telegramMessage = transformTelegramWebhook(body);
            if (!telegramMessage) {
              Logger.error('Failed to transform Telegram message:', body);
              return new Response('Invalid message format', { status: 400 });
            }

            Logger.info('Processing Telegram message:', telegramMessage);
            try {
              await agent.processMessage(telegramMessage);
              return new Response('OK', { status: 200 });
            } catch (error) {
              Logger.error('Error processing message:', error);
              return new Response('OK', { status: 200 }); // Still return 200 to acknowledge receipt
            }

          case '/farcaster':
            Logger.info('Processing Farcaster webhook:', { 
              enabled: workerEnv.ENABLE_FARCASTER,
              type: body.type,
              body: body
            });
            
            if (!workerEnv.ENABLE_FARCASTER) {
              Logger.error('Farcaster webhook disabled');
              return new Response('Farcaster webhook not enabled', { status: 400 });
            }
            
            // Only process cast.created events
            if (body.type === 'cast.created') {
              const farcasterMessage = transformFarcasterWebhook(body);
              Logger.info('Transformed Farcaster message:', farcasterMessage);
              
              if (farcasterMessage) {
                await agent.processMessage(farcasterMessage);
              }
            } else {
              Logger.info('Skipping non-cast event:', body.type);
            }
            return new Response('OK', { status: 200 });

          default:
            Logger.warn('Unknown endpoint:', path);
            return new Response('Not found', { status: 404 });
        }
      }

      return new Response('Method not allowed', { status: 405 });
    } catch (error) {
      Logger.error('Error handling request:', error);
      return new Response('OK', { status: 200 }); // Return 200 even on error to prevent retries
    }
  },

  async scheduled(event: ScheduledEvent, env: Env, ctx: ExecutionContext) {
    const agent = new Agent(env);
    const jobs = new ScheduledJobs(agent, env);

    // Example: Run a job every 6 hours
    // if (event.cron === '0 */6 * * *') {
    //   await jobs.runExampleJob();
    // }

    // Add more scheduled jobs here
    // Example: Run a different job daily at midnight UTC
    // if (event.cron === '0 0 * * *') {
    //   await jobs.runDailyJob();
    // }
  }

};

// Transform Telegram webhook to our Message type
function transformTelegramWebhook(webhook: any): Message | null {
  try {
    if (!webhook.message) {
      Logger.info('No message in webhook:', webhook);
      return null;
    }

    const message = webhook.message;
    if (!message.text) {
      Logger.info('No text in message:', message);
      return null;
    }

    return {
      id: message.message_id.toString(),
      text: message.text,
      author: {
        username: message.from.username || String(message.from.id),
        displayName: `${message.from.first_name} ${message.from.last_name || ''}`.trim(),
        chatId: message.chat.id
      },
      timestamp: message.date * 1000,
      platform: 'telegram',
      replyTo: message.reply_to_message?.message_id?.toString(),
      raw: webhook
    };
  } catch (error) {
    Logger.error('Error transforming Telegram webhook:', error);
    return null;
  }
}

// Transform Farcaster webhook to our Message type
function transformFarcasterWebhook(webhook: any): Message | null {
  try {
    const { data } = webhook;
    if (!data?.text || !data?.author?.username) {
      Logger.error('Invalid Farcaster webhook format:', webhook);
      return null;
    }

    return {
      id: data.hash,
      text: data.text,
      author: {
        username: data.author.username,
        displayName: data.author.display_name,
        fid: data.author.fid.toString(),
        custody_address: data.author.custody_address,
        verifications: data.author.verifications
      },
      timestamp: new Date(data.timestamp).getTime(),
      platform: 'farcaster',
      hash: data.hash,
      thread_hash: data.thread_hash,
      parent_hash: data.parent_hash,
      parent_url: data.parent_url,
      embeds: data.embeds || [],
      raw: webhook
    };
  } catch (error) {
    Logger.error('Error transforming Farcaster webhook:', error);
    return null;
  }
}