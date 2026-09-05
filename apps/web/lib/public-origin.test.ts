import { afterEach, describe, expect, it } from "vitest";
import { isInternalHost, originIsReachable, publicOrigin } from "./public-origin";

const env = { ...process.env };
afterEach(() => {
  process.env = { ...env };
});

const req = (url: string, headers: Record<string, string> = {}) => new Request(url, { headers });

/**
 * THE BUG THIS PINS. An activation link is pasted into WhatsApp and opened on
 * somebody else's phone, so it has to be the address the outside world uses.
 * Built from `req.url` it was `https://0.0.0.0:3000/activate?token=…` — a valid
 * token behind an address that resolves to nothing.
 */
describe("publicOrigin", () => {
  it("prefers the proxy's forwarded host over the address the app bound to", () => {
    delete process.env.ERP_PUBLIC_URL;
    expect(
      publicOrigin(
        req("http://0.0.0.0:3000/api/~/users", {
          "x-forwarded-host": "178-105-10-156.sslip.io",
          "x-forwarded-proto": "https",
          host: "0.0.0.0:3000",
        }),
      ),
    ).toBe("https://178-105-10-156.sslip.io");
  });

  it("reads only the first entry of a chained forwarded header", () => {
    delete process.env.ERP_PUBLIC_URL;
    expect(
      publicOrigin(
        req("http://app:3000/x", {
          "x-forwarded-host": "erp.example.com, inner.internal",
          "x-forwarded-proto": "https, http",
        }),
      ),
    ).toBe("https://erp.example.com");
  });

  it("falls back to Host when the app is reached directly", () => {
    delete process.env.ERP_PUBLIC_URL;
    expect(publicOrigin(req("http://erp.example.com/x", { host: "erp.example.com" }))).toBe(
      "http://erp.example.com",
    );
  });

  it("lets explicit configuration win, trailing slash and all", () => {
    process.env.ERP_PUBLIC_URL = "https://canei.example.com/";
    expect(
      publicOrigin(req("http://0.0.0.0:3000/x", { "x-forwarded-host": "wrong.example.com" })),
    ).toBe("https://canei.example.com");
  });

  it("does not invent a public address when there is none", () => {
    delete process.env.ERP_PUBLIC_URL;
    // No proxy, no useful Host: the honest answer is still the internal one,
    // and `originIsReachable` is what tells the screen to say so.
    const o = publicOrigin(req("http://0.0.0.0:3000/x", { host: "0.0.0.0:3000" }));
    expect(o).toBe("http://0.0.0.0:3000");
    expect(originIsReachable(o)).toBe(false);
  });
});

describe("isInternalHost", () => {
  it("knows the addresses that cannot be sent to anybody", () => {
    for (const h of ["0.0.0.0:3000", "127.0.0.1", "localhost:3000", "app:3000", "[::1]"])
      expect(isInternalHost(h)).toBe(true);
  });

  it("and leaves real ones alone", () => {
    for (const h of ["178-105-10-156.sslip.io", "erp.example.com", "canei.app:8443"])
      expect(isInternalHost(h)).toBe(false);
  });
});
