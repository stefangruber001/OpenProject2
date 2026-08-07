/**
 * The sign-in page.
 *
 * A plain HTML form that posts to /api/auth/login. No client JavaScript at all,
 * so it works in the phone app's web view regardless of what else on the page
 * did or did not load — the one screen that must never fail is the one standing
 * between somebody and their work.
 *
 * Styles are inline for the same reason: this page renders correctly even if
 * the stylesheet is unreachable.
 */
import { loginConfigured } from "@/lib/auth";

export const dynamic = "force-dynamic";

const CANEI = "#1F4E5F";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const failed = params.error !== undefined;
  const nextRaw = typeof params.next === "string" ? params.next : "/";
  // Same rule as the route handler: only ever a path on this site.
  const next = nextRaw.startsWith("/") && !nextRaw.startsWith("//") ? nextRaw : "/";

  if (!loginConfigured()) {
    return (
      <main
        style={{ fontFamily: "var(--font-sans)", maxWidth: 560, margin: "12vh auto", padding: 24 }}
      >
        <h1 style={{ fontSize: 20, marginBottom: 12 }}>Sign-in is not configured</h1>
        <p style={{ color: "#555", lineHeight: 1.6 }}>
          This server has no accounts set up, so there is nothing to sign in to. Either it is a
          single-operator deployment reachable only over a tunnel, or <code>ERP_USERS</code> and{" "}
          <code>SESSION_SECRET</code> are missing from its configuration.
        </p>
      </main>
    );
  }

  return (
    <main
      style={{
        fontFamily: "var(--font-sans)",
        minHeight: "100dvh",
        display: "grid",
        placeItems: "center",
        padding: 24,
        background: "#F7F8F8",
      }}
    >
      <form
        method="post"
        action="/api/auth/login"
        style={{
          width: "min(100%, 380px)",
          background: "#fff",
          border: "1px solid #E4E7E7",
          borderRadius: 14,
          padding: 28,
          boxShadow: "0 1px 2px rgba(16,24,40,.04), 0 8px 24px rgba(16,24,40,.06)",
        }}
      >
        <div style={{ fontWeight: 600, fontSize: 18, color: CANEI }}>Canei Subirats</div>
        <div style={{ color: "#667", fontSize: 14, marginTop: 2, marginBottom: 22 }}>
          Sistema de gestión
        </div>

        {failed && (
          <div
            role="alert"
            style={{
              background: "#FEF3F2",
              border: "1px solid #FDA29B",
              color: "#912018",
              borderRadius: 8,
              padding: "10px 12px",
              fontSize: 14,
              marginBottom: 16,
            }}
          >
            Correo o contraseña incorrectos.
          </div>
        )}

        <input type="hidden" name="next" value={next} />

        <label style={{ display: "block", fontSize: 13, color: "#344", marginBottom: 6 }}>
          Correo electrónico
        </label>
        <input
          name="email"
          type="email"
          autoComplete="username"
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          required
          autoFocus
          style={{
            width: "100%",
            boxSizing: "border-box",
            padding: "11px 12px",
            fontSize: 16, // 16px or iOS zooms the page on focus
            border: "1px solid #D0D5DD",
            borderRadius: 8,
            marginBottom: 14,
          }}
        />

        <label style={{ display: "block", fontSize: 13, color: "#344", marginBottom: 6 }}>
          Contraseña
        </label>
        <input
          name="password"
          type="password"
          autoComplete="current-password"
          required
          style={{
            width: "100%",
            boxSizing: "border-box",
            padding: "11px 12px",
            fontSize: 16,
            border: "1px solid #D0D5DD",
            borderRadius: 8,
            marginBottom: 20,
          }}
        />

        <button
          type="submit"
          style={{
            width: "100%",
            padding: "12px 14px",
            fontSize: 15,
            fontWeight: 600,
            color: "#fff",
            background: CANEI,
            border: "none",
            borderRadius: 8,
            cursor: "pointer",
          }}
        >
          Entrar
        </button>
      </form>
    </main>
  );
}
