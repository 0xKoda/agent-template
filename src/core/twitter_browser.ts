/**
 * Browser-based Twitter Client
 * Implements Twitter functionality using browser-like requests:
 * - Handles Twitter API calls through browser simulation
 * - Manages authentication and cookies
 * - Implements rate limiting and error handling
 */

import { Logger } from './logger';
import type { Env } from './types';
import type { TwitterInterface } from './twitter_interface';

export class TwitterBrowserClient implements TwitterInterface {
    private bearerToken: string;
    private isInitialized: boolean;
    private guestToken: string | null;
    private csrfToken: string | null;
    private authToken: string | null;
    private cookies: Array<{key: string, value: string, domain?: string}>;
    private env: Env;

    constructor(env: Env) {
        this.env = env;
        this.bearerToken = 'AAAAAAAAAAAAAAAAAAAAANRILgAAAAAAnNwIzUejRCOuH5E6I8xnZz4puTs=1Zv7ttfk8LF81IUq16cHjhLTvJu4FA33AGWWjCpTnA';
        this.isInitialized = false;
        this.guestToken = null;
        this.csrfToken = null;
        this.authToken = null;
        this.cookies = [];
    }

    async initialize(): Promise<void> {
        if (this.isInitialized) return;
        
        try {
            if (!this.env.TWITTER_COOKIES) {
                throw new Error('No cookies provided');
            }

            let cookieData;
            try {
                cookieData = JSON.parse(this.env.TWITTER_COOKIES);

                if (typeof cookieData === 'string') {
                    cookieData = JSON.parse(cookieData);
                }

                if (!Array.isArray(cookieData)) {
                    throw new Error('Cookie data is not in the expected format');
                }

                this.cookies = cookieData.map(cookie => ({
                    key: cookie.name,
                    value: cookie.value,
                    domain: cookie.domain || '.twitter.com'
                }));

                const csrfCookie = cookieData.find(c => c.name === 'ct0');
                const authCookie = cookieData.find(c => c.name === 'auth_token');
                const guestCookie = cookieData.find(c => c.name === 'guest_id');

                if (!csrfCookie || !authCookie) {
                    throw new Error('Missing required cookies');
                }

                this.csrfToken = csrfCookie.value;
                this.authToken = authCookie.value;
                if (guestCookie) {
                    this.guestToken = guestCookie.value.replace('v1%3A', '');
                }

                this.isInitialized = true;
                Logger.info('Twitter browser client initialized successfully');

            } catch (parseError) {
                Logger.error("Debug - Parse error details:", {
                    error: parseError,
                    rawCookies: this.env.TWITTER_COOKIES,
                    cookieType: typeof this.env.TWITTER_COOKIES
                });
                throw new Error(`Failed to parse cookie data: ${parseError.message}`);
            }
        } catch (error) {
            Logger.error('Twitter initialization error:', {
                message: error.message,
                type: error.constructor.name,
                stack: error.stack
            });
            throw error;
        }
    }

    async postTweet(text: string): Promise<any> {
        // Force re-initialization each time // remove this if issues. 
        this.isInitialized = false;
        await this.initialize();

        try {
            // Add a small random delay to mimic human behavior
            await new Promise(resolve => setTimeout(resolve, Math.random() * 2000 + 1000)); // remove this if doesnt work gain, as it may cause isssues

            const cookieString = this.cookies
                .map(cookie => `${cookie.key}=${cookie.value}`)
                .join('; ');

            const headers = new Headers({
                'authorization': `Bearer ${this.bearerToken}`,
                'cookie': cookieString,
                'content-type': 'application/json',
                'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
                'x-guest-token': this.guestToken!,
                'x-twitter-auth-type': 'OAuth2Client',
                'x-twitter-active-user': 'yes',
                'x-twitter-client-language': 'en',
                'x-csrf-token': this.csrfToken!,
                'accept': '*/*',
                'accept-language': 'en-US,en;q=0.9',
                'origin': 'https://twitter.com',
                'referer': 'https://twitter.com/home',
                'sec-ch-ua': '"Not_A Brand";v="8", "Chromium";v="120"',
                'sec-ch-ua-mobile': '?0',
                'sec-ch-ua-platform': '"macOS"',
                'sec-fetch-dest': 'empty',
                'sec-fetch-mode': 'cors',
                'sec-fetch-site': 'same-origin',
                'viewport-width': '1728',
                'device-memory': '8',
                'ect': '4g',
                'downlink': '10',
                'rtt': '50'
            });

            const variables = {
                tweet_text: text,
                dark_request: false,
                media: {
                    media_entities: [],
                    possibly_sensitive: false
                },
                semantic_annotation_ids: []
            };

            const requestBody = {
                variables,
                features: {
                    interactive_text_enabled: true,
                    longform_notetweets_inline_media_enabled: false,
                    responsive_web_text_conversations_enabled: false,
                    tweet_with_visibility_results_prefer_gql_limited_actions_policy_enabled: false,
                    vibe_api_enabled: false,
                    rweb_lists_timeline_redesign_enabled: true,
                    responsive_web_graphql_exclude_directive_enabled: true,
                    verified_phone_label_enabled: false,
                    creator_subscriptions_tweet_preview_api_enabled: true,
                    responsive_web_graphql_timeline_navigation_enabled: true,
                    responsive_web_graphql_skip_user_profile_image_extensions_enabled: false,
                    tweetypie_unmention_optimization_enabled: true,
                    responsive_web_edit_tweet_api_enabled: true,
                    graphql_is_translatable_rweb_tweet_is_translatable_enabled: true,
                    view_counts_everywhere_api_enabled: true,
                    longform_notetweets_consumption_enabled: true,
                    tweet_awards_web_tipping_enabled: false,
                    freedom_of_speech_not_reach_fetch_enabled: true,
                    standardized_nudges_misinfo: true,
                    longform_notetweets_rich_text_read_enabled: true,
                    responsive_web_enhance_cards_enabled: false,
                    subscriptions_verification_info_enabled: true,
                    subscriptions_verification_info_reason_enabled: true,
                    subscriptions_verification_info_verified_since_enabled: true,
                    super_follow_badge_privacy_enabled: false,
                    super_follow_exclusive_tweet_notifications_enabled: false,
                    super_follow_tweet_api_enabled: false,
                    super_follow_user_api_enabled: false,
                    android_graphql_skip_api_media_color_palette: false,
                    creator_subscriptions_subscription_count_enabled: false,
                    blue_business_profile_image_shape_enabled: false,
                    unified_cards_ad_metadata_container_dynamic_card_content_query_enabled: false,
                    rweb_video_timestamps_enabled: false,
                    c9s_tweet_anatomy_moderator_badge_enabled: false,
                    responsive_web_twitter_article_tweet_consumption_enabled: false
                },
                fieldToggles: {}
            };

            const response = await fetch(
                'https://twitter.com/i/api/graphql/a1p9RWpkYKBjWv_I3WzS-A/CreateTweet',
                {
                    method: 'POST',
                    headers,
                    body: JSON.stringify(requestBody)
                }
            );

            const responseText = await response.text();
            const responseData = {
                status: response.status,
                headers: Object.fromEntries(response.headers.entries()),
                body: responseText
            };

            Logger.info('Tweet response:', responseData);

            if (!response.ok) {
                throw new Error(JSON.stringify({
                    error: `Tweet failed: ${responseText}`,
                    response: responseData
                }));
            }

            let result;
            try {
                result = JSON.parse(responseText);
            } catch (parseError) {
                Logger.error("Debug - JSON Parse Error:", parseError);
                throw new Error(JSON.stringify({
                    error: `Failed to parse response: ${responseText}`,
                    response: responseData
                }));
            }

            return {
                success: true,
                response: responseData,
                result
            };

        } catch (error) {
            Logger.error('Error sending tweet:', {
                message: error.message,
                stack: error.stack,
                runtime: {
                    hasSettings: true,
                    hasCookies: true,
                    isInitialized: this.isInitialized,
                    hasCSRF: !!this.csrfToken,
                    hasGuestToken: !!this.guestToken
                }
            });
            throw error;
        }
    }
}
