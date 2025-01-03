export interface Env {
  // OpenRouter API key for LLM access
  OPENROUTER_API_KEY: string;

  // Feature flags (optional to maintain backward compatibility)
  ENABLE_TELEGRAM?: boolean;
  ENABLE_FARCASTER?: boolean;

  // LLM model (optional)
  LLM_MODEL?: string;

  // Telegram configuration
  TELEGRAM_BOT_TOKEN: string;
  TELEGRAM_WEBHOOK_SECRET: string;

  // Farcaster configuration
  FARCASTER_FID: string;
  FARCASTER_NEYNAR_API_KEY: string;
  FARCASTER_NEYNAR_SIGNER_UUID: string;

  // Memory configuration (required for agent functionality)
  agent_memory: KVNamespace;

  ENABLE_TWITTER: boolean;
  TWITTER_API_KEY: string;
  TWITTER_API_KEY_SECRET: string;
  TWITTER_ACCESS_TOKEN: string;
  TWITTER_ACCESS_TOKEN_SECRET: string;
}

export interface Author {
  username: string;
  displayName: string;
  fid?: string;      // Farcaster-specific (numeric FID)
  custody_address?: string; // Farcaster-specific
  chatId?: number;   // Telegram-specific
  verifications?: string[]; // Farcaster-specific
}

export interface Message {
  id: string;
  text: string;
  author: Author;
  timestamp: number;
  platform: 'farcaster' | 'telegram';
  replyTo?: string;
  hash?: string;      // Farcaster-specific (cast hash)
  thread_hash?: string; // Farcaster-specific
  parent_hash?: string; // Farcaster-specific
  parent_url?: string;  // Farcaster-specific
  embeds?: any[];      // Farcaster-specific
  raw: any;           // Platform-specific raw data
}

export interface ActionResult {
  text: string;
  shouldSendMessage: boolean;
  context?: string;
  embeds?: any[];   // For rich media attachments
}

export interface MemoryEntry {
  type: 'conversation' | 'long_term';
  content: string;
  timestamp: number;
  ttl: number;
}

// Base interface for client configuration
export interface ClientConfig {
  enabled: boolean;
  env: Env;
}

// Client-specific configurations
export interface TelegramConfig extends ClientConfig {
  botToken: string;
}

export interface FarcasterConfig extends ClientConfig {
  fid: string;
  neynarApiKey: string;
  signerUuid: string;
}

export interface AgentConfig {
  env: Env;
  memory?: KVNamespace;
  character?: any;
  telegramConfig?: TelegramConfig;
  farcasterConfig?: FarcasterConfig;
}

export interface ScheduledEvent {
  cron: string;
  scheduledTime: number;
  type: string;
}

export interface TwitterConfig extends ClientConfig {
  apiKey: string;
  apiKeySecret: string;
  accessToken: string;
  accessTokenSecret: string;
}
