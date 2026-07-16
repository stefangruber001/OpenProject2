import { describe, it, expect } from "vitest";
import { slugify, truncate } from "./format";

describe("slugify", () => {
  it("lowercases and hyphenates", () => {
    expect(slugify("My First Post!")).toBe("my-first-post");
  });

  it("trims leading and trailing separators", () => {
    expect(slugify("  Hello, World!  ")).toBe("hello-world");
  });
});

describe("truncate", () => {
  it("leaves short strings unchanged", () => {
    expect(truncate("hello", 10)).toBe("hello");
  });

  it("cuts long strings and adds an ellipsis", () => {
    expect(truncate("hello world", 5)).toBe("hello…");
  });
});
