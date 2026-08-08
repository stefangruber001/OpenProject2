/**
 * The sign-in page.
 *
 * A plain HTML form that posts to /api/auth/login. No client JavaScript at all,
 * so it works in the phone app's web view regardless of what else on the page
 * did or did not load — the one screen that must never fail is the one standing
 * between somebody and their work. Styles are inline for the same reason: this
 * renders correctly even if the stylesheet is unreachable.
 *
 * IDENTITY. It used to be teal (#1F4E5F) while every other screen is Canei
 * green. On a phone, where the login is the whole screen and arrives before
 * anything else, that read as a different company's page — the one moment the
 * brand has full attention was the one place it was absent. The palette here is
 * now the same green, deep green and spark yellow the ERP uses, with the house
 * mark from /brand/.
 *
 * FACE ID. There is no web API for it, and nothing here calls one. What makes
 * iOS offer Face ID is recognising this as a login form and unlocking the saved
 * password from the keychain: a real <form> that POSTs, one field marked
 * `autocomplete="username"`, one `autocomplete="current-password"`, and stable
 * `id`/`name` pairs so the saved entry keeps matching. Those are load-bearing,
 * not decoration — drop them and the QuickType bar silently stops offering to
 * fill, which reads to the operator as "Face ID broke".
 */
import { loginConfigured } from "@/lib/auth";
import { sharedAccessEnabled } from "@/lib/access";

export const dynamic = "force-dynamic";

/* The corporate palette — the same values site/*.html uses. */
const GREEN = "#48733c";
const GREEN_DEEP = "#31532a";
const SPARK = "#f2c230";
const INK = "#14160f";
const BODY = "#4f5347";
const MUTED = "#8b8f80";
const LINE = "#dde5d6";
const SERIF = '"Roboto Serif", Georgia, "Times New Roman", serif';
const SANS = 'Inter, system-ui, -apple-system, "Segoe UI", Arial, sans-serif';

const FIELD: React.CSSProperties = {
  width: "100%",
  boxSizing: "border-box",
  padding: "13px 14px",
  // 16px exactly, or iOS zooms the page the moment the field is focused and the
  // operator is left pinching back out on every sign-in.
  fontSize: 16,
  fontFamily: SANS,
  color: INK,
  background: "#fff",
  border: `1px solid ${LINE}`,
  borderRadius: 11,
  outlineColor: GREEN,
};

const LABEL: React.CSSProperties = {
  display: "block",
  font: `600 11.5px ${SANS}`,
  letterSpacing: ".08em",
  textTransform: "uppercase",
  color: MUTED,
  marginBottom: 7,
};

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
  const shared = sharedAccessEnabled();

  if (!loginConfigured()) {
    return (
      <main style={{ fontFamily: SANS, maxWidth: 560, margin: "12vh auto", padding: 24 }}>
        <h1 style={{ fontSize: 20, marginBottom: 12, fontFamily: SERIF }}>
          Sign-in is not configured
        </h1>
        <p style={{ color: BODY, lineHeight: 1.6 }}>
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
        fontFamily: SANS,
        minHeight: "100dvh",
        display: "grid",
        placeItems: "center",
        padding: "24px 20px calc(24px + env(safe-area-inset-bottom, 0px))",
        color: BODY,
        // The same light with a green cast the ERP screens sit on, so signing in
        // feels like the front door of the building rather than a different one.
        background: `
          radial-gradient(1200px 620px at 88% -14%, rgba(72,115,60,.20), transparent 58%),
          radial-gradient(820px 460px at -6% 4%, rgba(242,194,48,.14), transparent 55%),
          #eef3ea`,
      }}
    >
      <div style={{ width: "min(100%, 400px)" }}>
        {/* Brand mark, above the card: the company signs the page, the form is
            just the mechanism. */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 13,
            marginBottom: 20,
            paddingLeft: 2,
          }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element -- one static
              mark, no layout shift to optimise, and it must render even if the
              image pipeline is unavailable. */}
          <img
            src="/brand/icon.svg"
            alt=""
            width={44}
            height={44}
            style={{
              borderRadius: 12,
              display: "block",
              boxShadow: "0 6px 18px rgba(24,32,16,.18)",
            }}
          />
          <div>
            <div
              style={{
                font: `600 20px/1.1 ${SERIF}`,
                color: INK,
                letterSpacing: "-.02em",
              }}
            >
              Canei Subirats
            </div>
            <div
              style={{
                font: `600 10px ${SANS}`,
                letterSpacing: ".14em",
                textTransform: "uppercase",
                color: GREEN,
                marginTop: 4,
              }}
            >
              Sistema de gestión
            </div>
          </div>
        </div>

        <form
          method="post"
          action="/api/auth/login"
          // Named so a password manager can tell this form apart from any other
          // on the site and keep offering the same saved entry.
          id="canei-signin"
          name="canei-signin"
          style={{
            background: "#fff",
            border: `1px solid ${LINE}`,
            borderRadius: 18,
            padding: "26px 24px 24px",
            boxShadow: "0 1px 2px rgba(24,32,16,.04), 0 30px 60px -32px rgba(24,32,16,.34)",
          }}
        >
          {/* A thin spark rule: the one place the accent colour appears, so it
              reads as a signature rather than decoration. */}
          <div
            aria-hidden
            style={{
              height: 3,
              width: 46,
              borderRadius: 999,
              background: `linear-gradient(90deg, ${GREEN}, ${SPARK})`,
              marginBottom: 20,
            }}
          />

          {failed && (
            <div
              role="alert"
              style={{
                background: "#f6e3df",
                border: "1px solid #e3b7ae",
                color: "#8f2d1b",
                borderRadius: 11,
                padding: "11px 13px",
                font: `600 13.5px/1.45 ${SANS}`,
                marginBottom: 18,
              }}
            >
              Correo o contraseña incorrectos.
            </div>
          )}

          <input type="hidden" name="next" value={next} />

          <label htmlFor="canei-email" style={LABEL}>
            Correo electrónico
          </label>
          {shared && (
            // The shared password needs no address. Saying so is what makes a
            // link plus a password enough — otherwise the first thing somebody
            // evaluating the system does is invent an email address, and the
            // sign-in fails for a reason the screen never explains.
            <div style={{ font: `400 12.5px/1.4 ${SANS}`, color: MUTED, margin: "-3px 0 7px" }}>
              Déjelo vacío si sólo tiene la contraseña.
            </div>
          )}
          <input
            id="canei-email"
            name="email"
            type="email"
            autoComplete="username"
            inputMode="email"
            // `required` only when there is no shared password to fall back on;
            // with one, an empty address is the normal way in.
            {...(shared ? {} : { required: true })}
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            placeholder="nombre@caneisubirats.com"
            style={{ ...FIELD, marginBottom: 16 }}
          />

          <label htmlFor="canei-password" style={LABEL}>
            Contraseña
          </label>
          <input
            id="canei-password"
            name="password"
            type="password"
            autoComplete="current-password"
            required
            style={{ ...FIELD, marginBottom: 22 }}
          />

          <button
            type="submit"
            style={{
              width: "100%",
              padding: "15px 16px",
              font: `700 15.5px ${SANS}`,
              color: "#fff",
              background: `linear-gradient(120deg, ${GREEN_DEEP}, ${GREEN} 72%)`,
              border: "none",
              borderRadius: 12,
              cursor: "pointer",
              boxShadow: "0 10px 22px -12px rgba(49,83,42,.9)",
            }}
          >
            Entrar
          </button>

          <p
            style={{
              font: `400 12px/1.5 ${SANS}`,
              color: MUTED,
              textAlign: "center",
              margin: "16px 0 0",
            }}
          >
            La sesión se mantiene abierta en este dispositivo.
            <br />
            Guarde la contraseña para entrar con Face&nbsp;ID.
          </p>
        </form>
      </div>
    </main>
  );
}
