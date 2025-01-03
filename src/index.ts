import type { Env, ScheduledEvent } from './core/types';
import { Agent } from './core/agent';
import { WebhookHandler } from './core/webhook';
import { Scheduler } from './core/scheduler';

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const agent = new Agent(env);
    const webhookHandler = new WebhookHandler(agent, env);
    return await webhookHandler.handleWebhook(request);
  },

  async scheduled(event: ScheduledEvent, env: Env, ctx: ExecutionContext) {
    const scheduler = new Scheduler(env);
    await scheduler.handleScheduledEvent(event);
  }
};