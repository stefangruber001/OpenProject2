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
    // Twice at least: the wordmark at the top and the legal foot at the
    // bottom. The name is live text in both, which is what makes the identity
    // survive a client that strips the mark.
    expect(html.match(/Reformas Vallès, S\.L\./g)?.length).toBeGreaterThanOrEqual(2);
  });

  it("is built from green blocks, not one green strip", () => {
    // The brand has to carry down the whole message, which on a phone means
    // bands of colour rather than a header nobody scrolls back up to. Three
    // greens, each doing a different job: the credentials, the steps, and the
    // legal foot that closes the message.
    const html = inviteHtml(content());
    for (const band of [`background:#31532A`, `background:#48733C`, `background:#E7F0E1`])
      expect(html).toContain(band);
    // And the gold rule that separates the masthead from the message.
    expect(html).toContain("#F2C230");
  });

  it("carries the mark as a cid: part, and fetches nothing", () => {
    // THIS ASSERTION USED TO SAY «loads no images at all», and it was right
    // about the reasons: a remote logo is blocked by default in Outlook and
    // Gmail and renders as a broken box, and an inline <svg> is stripped by
    // Gmail outright. A `cid:` image is neither — it travels inside the
    // message and both clients draw it. So the rule is no longer "no images",
    // it is "nothing fetched, and nothing lost if the image is dropped":
    // every image is a cid: reference, it carries alt text, and the company's
    // name is live text beside it.
    const html = inviteHtml(content());
    expect(html).toMatch(/<img\b/i);
    for (const m of html.match(/<img\b[^>]*>/gi) || []) {
      expect(m).toMatch(/src="cid:/);
      expect(m).toMatch(/alt="[^"]+"/);
    }
    expect(html).not.toMatch(/src="https?:/i);
    expect(html).not.toMatch(/background-image/i);
  });

  it("carries the company's legal identity in the foot", () => {
    // LSSI-CE art. 10: a commercial electronic communication has to let the
    // reader identify the company behind it. The invitation carried none of
    // this until the design moved to the shared builder.
    const html = inviteHtml(
      content({
        issuer: {
          legalName: "Canei Subirats, S.L.",
          tradeName: "Canei Subirats",
          taxId: "B66666660",
          registeredAddress: "Carrer de la Creu 74, 08960 Sant Just Desvern",
          registry: "R.M. Barcelona · Tomo 45.231",
          phone: "+34 934 77 12 08",
          email: "hola@caneisubirats.com",
          web: "www.caneisubirats.com",
        },
      }),
    );
    for (const fact of [
      "Canei Subirats, S.L.",
      "NIF B66666660",
      "Carrer de la Creu 74",
      "R.M. Barcelona",
      "+34 934 77 12 08",
      "hola@caneisubirats.com",
      "www.caneisubirats.com",
      "confidenciales",
      "RGPD (UE) 2016/679",
    ])
      expect(html).toContain(fact);
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
