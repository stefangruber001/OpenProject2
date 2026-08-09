/**
 * Connect the company mailbox — the whole setup, on one screen.
 *
 * This exists so nobody has to touch GitHub secrets, SSH, or a shell to change
 * where the ERP files its drafts. The operator opens a link on their phone,
 * types the address and the password, and presses Save. The server proves the
 * credential against the real mail server before storing it, so "saved" means
 * "working" rather than "written down".
 *
 * No client JavaScript, and the same visual language as the sign-in page, for
 * the same reason: this is a screen that asks for a password, and it must work
 * even if nothing else on the page does.
 *
 * IT IS DELIBERATELY NOT IN THE ERP's NAVIGATION. Mailbox setup is something
 * done once and then forgotten; putting it in the tab bar would spend permanent
 * space on it, and the operator was explicit that the workspace UI should not
 * change. It is reachable by its address.
 */
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { mailFrom, mailboxFromEnv } from "@/lib/draft-mailbox";
import { loadMailSettings } from "@/lib/erp-runtime";
import { defaultTenant } from "@/lib/access";
import { SESSION_COOKIE, readSession } from "@/lib/session-token";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

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
  fontSize: 16, // 16 exactly, or iOS zooms the page on focus
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

export default async function MailSettingsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const status = typeof params.status === "string" ? params.status : "";
  const detail = typeof params.detail === "string" ? params.detail : "";

  // Same gate as everything else. A form that stores a mailbox password must
  // not be reachable by anyone who happens to know the address.
  const secret = process.env.SESSION_SECRET?.trim();
  if (secret) {
    const token = (await cookies()).get(SESSION_COOKIE)?.value;
    const claims = await readSession(token, secret, Math.floor(Date.now() / 1000));
    if (!claims) redirect("/login?next=%2Fsettings%2Femail");
  }

  const fromEnv = mailboxFromEnv();
  const stored = fromEnv
    ? null
    : ((await loadMailSettings(defaultTenant()).catch(() => null)) as {
        user?: string;
        host?: string;
      } | null);

  const currentAddress = fromEnv ? fromEnv.user : stored?.user || "";
  const currentHost = fromEnv ? fromEnv.host : stored?.host || "";
  const connected = Boolean(currentAddress);

  return (
    <main
      style={{
        fontFamily: SANS,
        minHeight: "100dvh",
        display: "grid",
        placeItems: "center",
        padding: "24px 20px calc(24px + env(safe-area-inset-bottom, 0px))",
        color: BODY,
        background: `
          radial-gradient(1200px 620px at 88% -14%, rgba(72,115,60,.20), transparent 58%),
          radial-gradient(820px 460px at -6% 4%, rgba(242,194,48,.14), transparent 55%),
          #eef3ea`,
      }}
    >
      <div style={{ width: "min(100%, 440px)" }}>
        <div style={{ marginBottom: 18, paddingLeft: 2 }}>
          <div style={{ font: `600 20px/1.1 ${SERIF}`, color: INK, letterSpacing: "-.02em" }}>
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
            Buzón para borradores
          </div>
        </div>

        <form
          method="post"
          action="/api/mail-settings"
          style={{
            background: "#fff",
            border: `1px solid ${LINE}`,
            borderRadius: 18,
            padding: "26px 24px 24px",
            boxShadow: "0 1px 2px rgba(24,32,16,.04), 0 30px 60px -32px rgba(24,32,16,.34)",
          }}
        >
          <div
            aria-hidden
            style={{
              height: 3,
              width: 46,
              borderRadius: 999,
              background: `linear-gradient(90deg, ${GREEN}, ${SPARK})`,
              marginBottom: 18,
            }}
          />

          {status === "ok" && (
            <Banner tone="good">
              Conectado. Se ha dejado un borrador de prueba en{" "}
              <b>{detail || "la carpeta de borradores"}</b>.
            </Banner>
          )}
          {status === "failed" && (
            <Banner tone="bad">
              El servidor de correo no aceptó estos datos, así que no se ha guardado nada.
              {detail ? ` (${detail})` : ""}
            </Banner>
          )}
          {status === "bad" && <Banner tone="bad">{detail || "Revise los datos."}</Banner>}

          {connected && !status && (
            <Banner tone="info">
              Buzón actual: <b>{currentAddress}</b>
              {currentHost ? ` · ${currentHost}` : ""}
              {fromEnv ? " (fijado en el servidor)" : ""}
            </Banner>
          )}

          <p style={{ font: `400 13px/1.55 ${SANS}`, color: BODY, margin: "0 0 18px" }}>
            El ERP dejará sus emails como <b>borradores</b> en este buzón. Nunca envía nada: usted
            los revisa y los envía desde su propio correo.
          </p>

          <label htmlFor="address" style={LABEL}>
            Dirección de correo
          </label>
          <input
            id="address"
            name="address"
            type="email"
            autoComplete="username"
            inputMode="email"
            required
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            defaultValue={currentAddress}
            placeholder="if@2iberia.com"
            style={{ ...FIELD, marginBottom: 16 }}
          />

          <label htmlFor="password" style={LABEL}>
            Contraseña del buzón
          </label>
          <input
            id="password"
            name="password"
            type="password"
            autoComplete="current-password"
            required
            style={{ ...FIELD, marginBottom: 6 }}
          />
          <p style={{ font: `400 12px/1.5 ${SANS}`, color: MUTED, margin: "0 0 16px" }}>
            Se guarda cifrada en el servidor. No se muestra nunca más.
          </p>

          <details style={{ marginBottom: 18 }}>
            <summary style={{ font: `600 12.5px ${SANS}`, color: GREEN, cursor: "pointer" }}>
              Ajustes avanzados
            </summary>
            <div style={{ paddingTop: 12 }}>
              <label htmlFor="host" style={LABEL}>
                Servidor IMAP
              </label>
              <input
                id="host"
                name="host"
                type="text"
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck={false}
                defaultValue={currentHost}
                placeholder="imap.hostinger.com"
                style={{ ...FIELD, marginBottom: 12 }}
              />
              <label htmlFor="drafts" style={LABEL}>
                Carpeta de borradores
              </label>
              <input
                id="drafts"
                name="drafts"
                type="text"
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck={false}
                placeholder="(se detecta sola)"
                style={FIELD}
              />
            </div>
          </details>

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
            Guardar y probar
          </button>

          <p
            style={{
              font: `400 12px/1.5 ${SANS}`,
              color: MUTED,
              textAlign: "center",
              margin: "16px 0 0",
            }}
          >
            Se comprueba con el servidor de correo antes de guardar.
          </p>
        </form>

        <p style={{ font: `400 12px/1.5 ${SANS}`, color: MUTED, margin: "14px 2px 0" }}>
          Enviando desde {mailFrom() || currentAddress || "—"}
        </p>
      </div>
    </main>
  );
}

function Banner({ tone, children }: { tone: "good" | "bad" | "info"; children: React.ReactNode }) {
  const palette = {
    good: { bg: "#e7f0e1", border: "#bcd4b1", color: "#31532a" },
    bad: { bg: "#f6e3df", border: "#e3b7ae", color: "#8f2d1b" },
    info: { bg: "#eef3ea", border: "#dde5d6", color: "#4f5347" },
  }[tone];
  return (
    <div
      role={tone === "bad" ? "alert" : undefined}
      style={{
        background: palette.bg,
        border: `1px solid ${palette.border}`,
        color: palette.color,
        borderRadius: 11,
        padding: "11px 13px",
        font: `500 13px/1.45 ${SANS}`,
        marginBottom: 16,
        wordBreak: "break-word",
      }}
    >
      {children}
    </div>
  );
}
