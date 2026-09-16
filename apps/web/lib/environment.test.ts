import { afterEach, describe, expect, it } from "vitest";
import { ENVIRONMENT_BAND, environmentName, isDevEnvironment } from "./environment";

/**
 * THE DIRECTION OF THE DEFAULT IS THE WHOLE FEATURE.
 *
 * There are two systems now, running the same image on the same machine. The
 * band that says "these figures are invented" must appear on one of them and
 * must NEVER appear on the other — and the two mistakes are not equally bad. A
 * missing band on the test system costs a moment's confusion between systems
 * that already differ by address and by password. A band wrongly drawn over a
 * real company's invoices tells them their own books are fiction.
 *
 * So the rule is: only an explicit marker makes this a test system. Everything
 * else — unset, empty, whitespace, a typo, a value somebody half-changed —
 * reads as production and shows nothing. These tests exist because that rule is
 * one `||` away from being inverted by someone who thinks they are fixing a bug.
 */

const original = process.env.ERP_ENVIRONMENT;
afterEach(() => {
  if (original === undefined) delete process.env.ERP_ENVIRONMENT;
  else process.env.ERP_ENVIRONMENT = original;
});

const set = (v: string | undefined) => {
  if (v === undefined) delete process.env.ERP_ENVIRONMENT;
  else process.env.ERP_ENVIRONMENT = v;
};

describe("environmentName", () => {
  it("is production when nothing is set — the case production actually runs in", () => {
    set(undefined);
    expect(environmentName()).toBe("production");
    expect(isDevEnvironment()).toBe(false);
  });

  it.each(["", "   ", "\t\n"])("is production for the empty value %j", (v) => {
    set(v);
    expect(environmentName()).toBe("production");
  });

  it.each(["dev", "development", "staging", "test"])("is dev for the marker %j", (v) => {
    set(v);
    expect(environmentName()).toBe("dev");
    expect(isDevEnvironment()).toBe(true);
  });

  it.each(["DEV", "Dev", " dev ", "Development"])("accepts %j — case and padding", (v) => {
    set(v);
    expect(environmentName()).toBe("dev");
  });

  /* The important half. Anything unrecognised must fall to production, because
     the alternative is a band on a real customer's invoice register. */
  it.each(["prod", "production", "live", "devel", "d3v", "yes", "true", "1", "dev-2", "staging-1"])(
    "is production for the unrecognised value %j",
    (v) => {
      set(v);
      expect(environmentName()).toBe("production");
      expect(isDevEnvironment()).toBe(false);
    },
  );
});

describe("the band text", () => {
  it("carries all three languages the product speaks", () => {
    expect(Object.keys(ENVIRONMENT_BAND).sort()).toEqual(["ca", "en", "es"]);
  });

  it("says the data is invented, not merely that this is a test", () => {
    // "TEST ENVIRONMENT" alone reads as a status label. What somebody needs to
    // know before they act on a figure is that the figure is not real.
    expect(ENVIRONMENT_BAND.es).toMatch(/inventados/);
    expect(ENVIRONMENT_BAND.ca).toMatch(/inventades/);
    expect(ENVIRONMENT_BAND.en).toMatch(/invented/);
  });
});
