import { Command } from '@nestjs/cqrs';

// Deletes uploads that were registered more than 24 hours before `now` and
// never completed, with any object that reached storage. Resolves to how many
// files it removed.
export class CleanUpAbandonedUploadsCommand extends Command<number> {
  constructor(readonly now: Date = new Date()) {
    super();
  }
}
