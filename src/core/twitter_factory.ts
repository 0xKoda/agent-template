/**
 * Twitter Client Factory
 * Creates appropriate Twitter client instances:
 * - Determines which Twitter client implementation to use
 * - Manages client configuration and initialization
 * - Provides unified interface for Twitter interactions
 */
import { TwitterClient } from './twitter';
import { TwitterBrowserClient } from './twitter_browser';
import type { Env } from './types';
import { Logger } from './logger';

export class TwitterFactory {
    static async createClient(env: Env) {
        if (env.ENABLE_BROWSER_TWITTER) {
            Logger.info('Using Twitter Browser Client');
            const client = new TwitterBrowserClient(env);
            await client.initialize();
            return client;
        }
        
        if (env.ENABLE_TWITTER) {
            Logger.info('Using Twitter API Client');
            const client = new TwitterClient(env);
            await client.initialize();
            return client;
        }

        throw new Error('No Twitter client enabled. Set either ENABLE_TWITTER or ENABLE_BROWSER_TWITTER to true');
    }
}
