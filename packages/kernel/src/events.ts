import { deepFreeze } from "./canonical";

/**
 * Append-only event log — the audit seam. No update, no delete, by
 * construction. Persistence is an adapter concern (in-memory here; a durable
 * adapter binds the same interface later).
 */
export interface DomainEvent {
  readonly seq: number;
  readonly type: string;
  readonly at: string;
  readonly tenantId: string;
  readonly payload: Readonly<Record<string, unknown>>;
}

export interface EventLogPort {
  append(evt: Omit<DomainEvent, "seq">): DomainEvent;
  list(): readonly DomainEvent[];
}

export class InMemoryEventLog implements EventLogPort {
  private events: DomainEvent[] = [];

  append(evt: Omit<DomainEvent, "seq">): DomainEvent {
    const stored = deepFreeze({ ...evt, seq: this.events.length + 1 });
    this.events.push(stored);
    return stored;
  }

  list(): readonly DomainEvent[] {
    return this.events;
  }
}
