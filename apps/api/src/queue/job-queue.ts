import { Injectable, Logger, type OnApplicationShutdown, type OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { type Job, PgBoss, type SendOptions } from 'pg-boss';
import type { Env } from '../config/env.js';

export type QueueSettings = {
  // Attempts after the first one, with exponential backoff from `retryDelaySeconds`.
  retryLimit: number;
  retryDelaySeconds: number;
  // A job still running after this long counts as failed and is retried.
  expireInSeconds: number;
};

// A job as a worker sees it: its data, which attempt this is, and whether it is
// the last one the queue will make.
export type QueueJob<T> = { id: string; data: T; attempt: number; isLastAttempt: boolean };

// Background jobs on pg-boss, in its own `pgboss` schema of the app's database.
// Jobs live in Postgres, so they survive restarts, and failed ones are retried
// with backoff. Starts with the app; workers register in
// onApplicationBootstrap, after every module's onModuleInit has run.
@Injectable()
export class JobQueue implements OnModuleInit, OnApplicationShutdown {
  private readonly logger = new Logger(JobQueue.name);
  private readonly boss: PgBoss;
  private readonly settings = new Map<string, QueueSettings>();

  constructor(config: ConfigService<Env, true>) {
    this.boss = new PgBoss({
      connectionString: config.get('DATABASE_URL', { infer: true }),
      schema: 'pgboss',
    });
    this.boss.on('error', (error) => this.logger.error(error));
  }

  async onModuleInit(): Promise<void> {
    await this.boss.start();
  }

  // Lets running jobs finish, briefly, before the connection closes.
  async onApplicationShutdown(): Promise<void> {
    await this.boss.stop({ graceful: true, timeout: 10_000 });
  }

  // Creates the queue, or updates its settings when it already exists.
  async define(name: string, settings: QueueSettings): Promise<void> {
    const options = {
      retryLimit: settings.retryLimit,
      retryDelay: settings.retryDelaySeconds,
      retryBackoff: true,
      expireInSeconds: settings.expireInSeconds,
    };
    if (await this.boss.getQueue(name)) {
      await this.boss.updateQueue(name, options);
    } else {
      await this.boss.createQueue(name, options);
    }
    this.settings.set(name, settings);
  }

  async send<T extends object>(name: string, data: T, options?: SendOptions): Promise<void> {
    await this.boss.send(name, data, options);
  }

  // Runs `handler` for each job, one at a time. Throwing fails the attempt;
  // the queue retries it until its retryLimit is used up.
  async work<T extends object>(
    name: string,
    handler: (job: QueueJob<T>) => Promise<void>,
  ): Promise<void> {
    const settings = this.settings.get(name);
    if (!settings) {
      throw new Error(`Define queue "${name}" before working it`);
    }
    await this.boss.work<T>(name, async ([job]: Job<T>[]) => {
      await handler({
        id: job.id,
        data: job.data,
        attempt: job.retryCount + 1,
        isLastAttempt: job.retryCount >= settings.retryLimit,
      });
    });
  }
}
