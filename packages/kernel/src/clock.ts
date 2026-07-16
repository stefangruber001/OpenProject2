/** Injected time — deterministic artifacts need deterministic clocks. */
export interface ClockPort {
  todayIso(): string;
  nowIso(): string;
}

export class FixedClock implements ClockPort {
  constructor(private readonly dateIso: string) {}
  todayIso(): string {
    return this.dateIso;
  }
  nowIso(): string {
    return `${this.dateIso}T00:00:00.000Z`;
  }
}

export class SystemClock implements ClockPort {
  todayIso(): string {
    return new Date().toISOString().slice(0, 10);
  }
  nowIso(): string {
    return new Date().toISOString();
  }
}
