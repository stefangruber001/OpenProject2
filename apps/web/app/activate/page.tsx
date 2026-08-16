/**
 * Choosing your own password.
 *
 * The screen an invited person lands on. It is a plain form posting to
 * /api/auth/activate; the administrator never sees what is typed here, which is
 * the entire reason invitations work this way rather than the admin generating
 * a password and reading it out.
 */
import { ActivateForm } from "./form";

const SANS = 'Inter, system-ui, -apple-system, "Segoe UI", Arial, sans-serif';
const SERIF = '"Roboto Serif", Georgia, serif';

export default async function ActivatePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const token = typeof params.token === "string" ? params.token : "";

  return (
    <main
      style={{
        fontFamily: SANS,
        maxWidth: 460,
        margin: "10vh auto",
        padding: 24,
        color: "#14160f",
      }}
    >
      <h1 style={{ fontFamily: SERIF, fontSize: 22, marginBottom: 6 }}>Canei Subirats</h1>
      <p style={{ color: "#6b7060", fontSize: 14, marginBottom: 22, lineHeight: 1.5 }}>
        Elija la contraseña de su cuenta. Nadie más la conocerá: no se envía a quien le ha dado de
        alta.
      </p>
      {token ? (
        <ActivateForm token={token} />
      ) : (
        <div
          role="alert"
          style={{
            background: "#f6e3df",
            border: "1px solid #e3b7ae",
            color: "#8f2d1b",
            borderRadius: 11,
            padding: "11px 13px",
            font: `600 13.5px/1.45 ${SANS}`,
          }}
        >
          Este enlace no incluye un código de activación. Pida uno nuevo.
        </div>
      )}
    </main>
  );
}
