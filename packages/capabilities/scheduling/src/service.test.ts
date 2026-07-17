import { describe, expect, it } from "vitest";
import { FixedClock, SeqIdGen, isFactoryError } from "@repo/kernel";
import { schedulingConfigSchema } from "./model";
import { SchedulingService } from "./service";

function svc(date = "2026-07-17") {
  return new SchedulingService({
    clock: new FixedClock(date),
    idGen: new SeqIdGen(),
    config: schedulingConfigSchema.parse({}),
  });
}

describe("SchedulingService", () => {
  it("adds a task and rejects an inverted date range", () => {
    const s = svc();
    const p = s.addTask(s.empty(), {
      title: "Demolition",
      plannedStart: "2026-07-20",
      plannedEnd: "2026-07-24",
      assignee: "ops",
    });
    expect(p.tasks[0]!.status).toBe("planned");
    try {
      s.addTask(p, { title: "bad", plannedStart: "2026-07-24", plannedEnd: "2026-07-20" });
      throw new Error("should throw");
    } catch (e) {
      expect(isFactoryError(e, "INVALID_STATE")).toBe(true);
    }
  });

  it("marks progress and auto-completes at 100%", () => {
    const s = svc();
    let p = s.addTask(s.empty(), {
      title: "Tiling",
      plannedStart: "2026-07-20",
      plannedEnd: "2026-07-25",
    });
    const id = p.tasks[0]!.id;
    p = s.setProgress(p, id, 50);
    expect(p.tasks[0]!.status).toBe("in_progress");
    p = s.setProgress(p, id, 100);
    expect(p.tasks[0]!.status).toBe("done");
    expect(p.tasks[0]!.progressPct).toBe(100);
  });

  it("detects overdue tasks", () => {
    const s = svc("2026-07-30");
    let p = s.addTask(s.empty(), {
      title: "Late",
      plannedStart: "2026-07-10",
      plannedEnd: "2026-07-20",
    });
    p = s.addTask(p, { title: "Future", plannedStart: "2026-08-01", plannedEnd: "2026-08-05" });
    const late = s.overdue(p);
    expect(late).toHaveLength(1);
    expect(late[0]!.title).toBe("Late");
  });

  it("summarises tasks by status", () => {
    const s = svc();
    let p = s.addTask(s.empty(), {
      title: "A",
      plannedStart: "2026-07-20",
      plannedEnd: "2026-07-21",
    });
    p = s.addTask(p, { title: "B", plannedStart: "2026-07-20", plannedEnd: "2026-07-21" });
    p = s.setStatus(p, p.tasks[0]!.id, "done");
    expect(s.summary(p).find((x) => x.status === "done")!.count).toBe(1);
    expect(s.summary(p).find((x) => x.status === "planned")!.count).toBe(1);
  });
});
