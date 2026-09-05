import { describe, expect, it } from "vitest";
import { inviteHtml, inviteText, type InviteContent } from "./invite-mail";

/**
 * WHAT THESE PIN. The invitation is the first thing a new colleague ever sees
 * of this system, and it is the one message nobody on the team reads before it
 * goes out — it is written into a Drafts folder and sent. So the things that
 * would embarrass it, or make it not work, are asserted rather than eyeballed:
 * the credentials are present and correct, the sign-in page is a real link, the
 * plain part is a readable message and not markup, and nothing is left as a
 * template hole.
 */
const content = (over: Partial<InviteContent> = {}): InviteContent => ({
  to: "ana@example.com",
  loginUrl: "https://erp.example.com/login",
  tempPassword: "ABCD-EFGH-JKMN",
  link: "https://erp.example.com/activate?token=abc123",
  purpose: "activation",
  company: "Canei Subirats",
  ...over,
});

describe("the invitation, as HTML", () => {
  it("carries the two things somebody needs: where to go, and what to type", () => {
    const html = inviteHtml(content());
    expect(html).toContain('href="https://erp.example.com/login"');
    expect(html).toContain("ana@example.com");
    expect(html).toContain("ABCD-EFGH-JKMN");
    expect(html).toContain("Contraseña temporal");
  });

  it("keeps the one-time link as the other way in", () => {
    expect(inviteHtml(content())).toContain("https://erp.example.com/activate?token=abc123");
  });

  it("wears the company's identity, not the product's", () => {
    const html = inviteHtml(content({ company: "Reformas Vallès, S.L." }));
    expect(html).toContain("Reformas Vallès, S.L.");
    // The monogram stands in for a logo that cannot be loaded. "S.L." is not a
    // word of the name, so this is RV and never RS.
    expect(html).toContain(">RV<");
  });

  it("is built from green blocks, not one green strip", () => {
    // The brand has to carry down the whole message, which on a phone means
    // bands of colour rather than a header nobody scrolls back up to. Three
    // greens, each doing a different job: masthead and sign-off, the
    // credentials, and the steps.
    const html = inviteHtml(content());
    for (const band of [`background:#31532a`, `background:#48733c`, `background:#e7f0e1`])
      expect(html).toContain(band);
    // Deep green twice — it opens and closes the message.
    expect(html.match(/background:#31532a/g)?.length).toBeGreaterThanOrEqual(2);
    // And the gold rule that separates the masthead from the page.
    expect(html).toContain("#f2c230");
  });

  it("loads no images at all", () => {
    // A remote logo is blocked by default in Outlook and Gmail and renders as a
    // broken box; an inlined one becomes an attachment some clients strip. The
    // identity here has to survive both, so there is nothing to fetch.
    const html = inviteHtml(content());
    expect(html).not.toMatch(/<img\b/i);
    expect(html).not.toMatch(/background-image/i);
  });

  it("escapes what it interpolates", () => {
    const html = inviteHtml(content({ company: 'Ana <script>alert("x")</script>' }));
    expect(html).not.toContain("<script>");
    expect(html).toContain("&lt;script&gt;");
  });

  it("says something sensible when there is no temporary password", () => {
    const html = inviteHtml(content({ tempPassword: "" }));
    expect(html).not.toContain("Contraseña temporal");
    expect(html).toContain("https://erp.example.com/activate?token=abc123");
  });

  it("leaves no template holes anywhere", () => {
    const html = inviteHtml(content());
    expect(html).not.toContain("undefined");
    expect(html).not.toContain("[object Object]");
    expect(html).not.toMatch(/\$\{/);
  });

  it("changes its title for a reset", () => {
    expect(inviteHtml(content({ purpose: "reset" }))).toContain("Su nueva contraseña");
  });
});

describe("the invitation, as plain text", () => {
  it("is a message, not stripped markup", () => {
    const text = inviteText(content());
    expect(text).not.toMatch(/[<>]/);
    expect(text).toContain("https://erp.example.com/login");
    expect(text).toContain("ABCD-EFGH-JKMN");
    expect(text).toContain("ana@example.com");
  });

  it("falls back to the link when no password could be set", () => {
    const text = inviteText(content({ tempPassword: "" }));
    expect(text).not.toContain("Contraseña temporal:");
    expect(text).toContain("https://erp.example.com/activate?token=abc123");
  });
});
