# AI Agent Template

This template helps you create an AI agent that can:
- Interact with users through Telegram and Farcaster
- Run scheduled jobs to post updates
- Use LLMs (like GPT-3.5) to generate responses
- Store conversation memory in Cloudflare KV

## Setup Instructions

1. **Clone and Install**
   ```bash
   git clone <your-repo>
   cd <your-repo>
   npm install
   ```

2. **Configure Wrangler**
   - Update the configuration in `wrangler.toml`:
     ```toml
     name = "your-project-name"
     ```

3. **Set Up KV Storage**
   ```bash
   # Create KV namespace
   wrangler kv:namespace create "agent_memory"
   # Create preview namespace
   wrangler kv:namespace create "agent_memory" --preview
   ```
   Update `wrangler.toml` with the returned IDs

4. **Configure Environment Variables**
   ```bash
   # Set required secrets
   wrangler secret put OPENROUTER_API_KEY
   wrangler secret put TELEGRAM_BOT_TOKEN
   wrangler secret put TELEGRAM_WEBHOOK_SECRET
   wrangler secret put FARCASTER_NEYNAR_API_KEY
   wrangler secret put FARCASTER_NEYNAR_SIGNER_UUID
   wrangler secret put FARCASTER_FID
   ```

5. **Platform Setup**
   - **Telegram**:
     1. Create a bot with [@BotFather](https://t.me/botfather)
     2. Set the webhook URL to `https://your-worker.workers.dev/telegram`
   
   - **Farcaster**:
     1. Get API credentials from [Neynar](https://neynar.com)
     2. Configure webhook in Neynar dashboard to `https://your-worker.workers.dev/farcaster`

## Creating Actions

1. Create a new file in `src/actions/your_action.ts`:
   ```typescript
   import { Action } from './base';
   import type { Message, ActionResult } from '../types';

   export class YourAction extends Action {
     constructor() {
       super('your_action', 'Description of your action');
     }

     shouldExecute(message: Message): boolean {
       // Define when this action should trigger
       return message.text?.includes('/your_command') ?? false;
     }

     async execute(message: Message): Promise<ActionResult> {
       // Implement your action logic
       return {
         text: "Your response",
         shouldSendMessage: true,
         context: "Context for LLM"
       };
     }
   }
   ```

2. Register your action in `src/actions/index.ts`:
   ```typescript
   import { YourAction } from './your_action';
   
   const actions: Record<string, Action> = {
     your_action: new YourAction()
   };
   ```

## Creating Scheduled Jobs

1. Add your job to `src/jobs/scheduled.ts`:
   ```typescript
   async runYourJob() {
     try {
       // Your job logic here
       const data = await this.yourAction.getData();
       
       const llmResponse = await this.agent.generateLLMResponse([
         { 
           role: "system", 
           content: "Your system prompt" 
         },
         { 
           role: "user", 
           content: data 
         }
       ]);

       await this.agent.publishFarcasterCast(llmResponse);
     } catch (error) {
       Logger.error('Error in your job:', error);
     }
   }
   ```

2. Schedule your job in `wrangler.toml`:
   ```toml
   [triggers]
   crons = [
     "0 0 * * *"  # Daily at midnight UTC
   ]
   ```

3. Register the schedule in `src/index.ts`:
   ```typescript
   async scheduled(event: ScheduledEvent, env: Env, ctx: ExecutionContext) {
     const agent = new Agent(env);
     const jobs = new ScheduledJobs(agent, env);

     if (event.cron === '0 0 * * *') {
       await jobs.runYourJob();
     }
   }
   ```

## Deployment

**Deployment**
```bash
npx wrangler deploy
```

## Configuration Options

In `wrangler.toml`:
- `ENABLE_TELEGRAM`: Enable/disable Telegram bot (default: true)
- `ENABLE_FARCASTER`: Enable/disable Farcaster bot (default: true)
- `LLM_MODEL`: LLM model to use (default: "openai/gpt-3.5-turbo")

## Best Practices

1. **Error Handling**
   - Always use try-catch blocks in actions and jobs
   - Log errors using the Logger utility
   - Provide meaningful error messages to users

2. **Rate Limiting**
   - Be mindful of API rate limits
   - Implement retries for transient failures
   - Add delays between consecutive API calls

3. **Testing**
   - Test your actions with various inputs
   - Verify scheduled jobs work as expected
   - Test error handling scenarios

4. **Security**
   - Never commit secrets to version control
   - Validate user inputs
   - Use environment variables for configuration

## Support

For issues and feature requests, please open an issue in the GitHub repository.
