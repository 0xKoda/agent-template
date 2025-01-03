import { Logger } from './logger';
import { Agent } from './agent';
import { ScheduledJobs } from '../jobs/scheduled';
import type { Env, ScheduledEvent } from './types';

export class Scheduler {
  private agent: Agent;
  private jobs: ScheduledJobs;

  constructor(env: Env) {
    this.agent = new Agent(env);
    this.jobs = new ScheduledJobs(this.agent, env);
  }

  async handleScheduledEvent(event: ScheduledEvent): Promise<void> {
    try {
      // Financial analysis runs at 00:00, 06:00, 12:00, 18:00 UTC
      if (event.cron === '0 */6 * * *') {
        await this.jobs.runScheduledFinancialAnalysis();
      }
      
      // ETF flows runs at 03:00, 09:00, 15:00, 21:00 UTC
      // This staggers it 3 hours after each financial analysis
      if (event.cron === '0 3/6 * * *') {
        await this.jobs.runScheduledETFFlowsAnalysis();
      }
    } catch (error) {
      Logger.error('Error handling scheduled event:', error);
      throw error;
    }
  }
}
