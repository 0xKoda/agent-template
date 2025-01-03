import type { FarcasterConfig, Message } from './types';
import { Logger } from './logger';
import { Memory } from './memory';

export class FarcasterClient {
  private config: FarcasterConfig;
  private memory: Memory;

  constructor(config: FarcasterConfig) {
    this.config = config;
    this.memory = new Memory({ agent_memory: config.env.agent_memory });
  }

  async publishCast(text: string, parentHash: string | null = null, embeds: any[] | null = null): Promise<any> {
    const apiKey = this.config.neynarApiKey;
    if (!apiKey) {
      throw new Error('Missing Farcaster API key');
    }

    Logger.info('Publishing cast:', { text, parentHash, hasEmbeds: Boolean(embeds) });

    const body: any = {
      signer_uuid: this.config.signerUuid,
      text: text,
      idem: crypto.randomUUID().slice(0, 16)
    };

    // Add parent hash for replies
    if (parentHash) {
      body.parent = parentHash;
      Logger.info('Adding parent hash to cast:', parentHash);
    }

    // Add embeds if provided
    if (embeds) {
      body.embeds = embeds;
      Logger.debug('Adding embeds to cast:', JSON.stringify(embeds));
    }

    const options = {
      method: 'POST',
      headers: {
        accept: 'application/json',
        'content-type': 'application/json',
        'x-api-key': apiKey
      },
      body: JSON.stringify(body)
    };

    Logger.debug('Request headers:', JSON.stringify(options.headers, null, 2));
    Logger.debug('Request body:', JSON.stringify(body, null, 2));

    const response = await fetch('https://api.neynar.com/v2/farcaster/cast', options);
    Logger.info('Response status:', response.status);
    
    if (!response.ok) {
      const error = await response.json();
      Logger.error('Neynar API error response:', error);
      throw new Error(`Neynar API error: ${response.status}`);
    }

    const data = await response.json();
    Logger.info('Successfully published cast:', data);
    return data;
  }

  /**
   * Transform Farcaster webhook to our Message type
   */
  transformWebhook(webhook: any): Message | null {
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

  // Helper function to trim text to Farcaster's character limit
  private trimToFarcasterLimit(text: string): string {
    const FARCASTER_LIMIT = 280;
    if (text.length <= FARCASTER_LIMIT) return text;

    // Try to cut at the last sentence
    let trimmed = text.slice(0, FARCASTER_LIMIT);
    const lastPeriod = trimmed.lastIndexOf('.');
    
    if (lastPeriod > 0) {
      trimmed = trimmed.slice(0, lastPeriod + 1);
    }

    return trimmed;
  }
}
