import { deepFreeze } from "./canonical";

/**
 * Append-only event log — the audit seam. No update, no delete, by
 * construction. Async so durable adapters are drop-ins; adapters must pass
 * the same behaviour (sequential seq, frozen entries).
 */
export interface DomainEvent {
  readonly seq: number;
  readonly type: string;
  readonly at: string;
  readonly tenantId: string;
  readonly payload: Readonly<Record<string, unknown>>;
}

export interface EventLogPort {
  append(evt: Omit<DomainEvent, "seq">): Promise<DomainEvent>;
  list(): Promise<readonly DomainEvent[]>;
}

export class InMemoryEventLog implements EventLogPort {
  private events: DomainEvent[] = [];

  async append(evt: Omit<DomainEvent, "seq">): Promise<DomainEvent> {
    const stored = deepFreeze({ ...evt, seq: this.events.length + 1 });
    this.events.push(stored);
    return stored;
  }

  async list(): Promise<readonly DomainEvent[]> {
    return this.events;
  }
}
