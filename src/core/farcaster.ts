// import type { Env, Message, FarcasterConfig } from '../types';
import type {FarcasterConfig } from '../types';
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

}
