import {
  FactoryError,
  roundDivHalfUp,
  sumCents,
  type Cents,
  type ClockPort,
  type IdGenPort,
} from "@repo/kernel";
import type { Book, ChapterLabour, TimeConfig, TimeEntry } from "./model";

export interface TimeDeps {
  clock: ClockPort;
  idGen: IdGenPort;
  config: TimeConfig;
}

/**
 * Time engine. Log labour minutes against a project/chapter/person and roll up
 * hours and labour cost. Cost = minutes × hourly-rate ÷ 60, in whole cents.
 */
export class TimeService {
  constructor(private readonly deps: TimeDeps) {}

  empty(): Book {
    return { entries: [] };
  }

  log(
    book: Book,
    input: {
      projectRef: string;
      personRef: string;
      minutes: number;
      chapter?: string;
      ratePerHourCents?: Cents;
      date?: string;
    },
  ): Book {
    if (input.minutes <= 0 || !Number.isInteger(input.minutes)) {
      throw new FactoryError("INVALID_STATE", "minutes must be a positive integer.");
    }
    const entry: TimeEntry = {
      id: this.deps.idGen.next("time"),
      projectRef: input.projectRef,
      chapter: input.chapter,
      personRef: input.personRef,
      date: input.date ?? this.deps.clock.todayIso(),
      minutes: input.minutes,
      ratePerHourCents: input.ratePerHourCents,
    };
    return { ...book, entries: [...book.entries, entry] };
  }

  private rate(entry: TimeEntry): Cents {
    return entry.ratePerHourCents ?? this.deps.config.defaultRatePerHourCents;
  }

  private cost(entry: TimeEntry): Cents {
    return roundDivHalfUp(entry.minutes * this.rate(entry), 60);
  }

  minutesForProject(book: Book, projectRef: string): number {
    return book.entries
      .filter((e) => e.projectRef === projectRef)
      .reduce((s, e) => s + e.minutes, 0);
  }

  labourCostForProject(book: Book, projectRef: string): Cents {
    return sumCents(
      book.entries.filter((e) => e.projectRef === projectRef).map((e) => this.cost(e)),
    );
  }

  /** Hours + labour cost by chapter for one project. */
  byChapter(book: Book, projectRef: string): ChapterLabour[] {
    const entries = book.entries.filter((e) => e.projectRef === projectRef);
    const chapters = new Set<string>(entries.map((e) => e.chapter ?? "(unassigned)"));
    return [...chapters].map((chapter) => {
      const rows = entries.filter((e) => (e.chapter ?? "(unassigned)") === chapter);
      return {
        chapter,
        minutes: rows.reduce((s, e) => s + e.minutes, 0),
        costCents: sumCents(rows.map((e) => this.cost(e))),
      };
    });
  }
}
