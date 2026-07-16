/** Injected id generation — deterministic in demos/tests, random in prod. */
export interface IdGenPort {
  next(prefix: string): string;
}

export class SeqIdGen implements IdGenPort {
  private counters = new Map<string, number>();
  next(prefix: string): string {
    const n = (this.counters.get(prefix) ?? 0) + 1;
    this.counters.set(prefix, n);
    return `${prefix}_${String(n).padStart(4, "0")}`;
  }
}

export class RandomIdGen implements IdGenPort {
  next(prefix: string): string {
    return `${prefix}_${globalThis.crypto.randomUUID()}`;
  }
}
