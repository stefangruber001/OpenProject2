"use client";

/**
 * The activation form.
 *
 * A client component because it has to show the server's answer without losing
 * what was typed, and because the two password fields are compared here — a
 * round trip to be told they do not match is a poor way to learn it.
 *
 * The ten-character minimum is stated up front rather than as a rejection.
 * Telling somebody a rule after they have broken it is how people end up with
 * "Password1!".
 */
import Link from "next/link";
import { useState } from "react";

const SANS = 'Inter, system-ui, -apple-system, "Segoe UI", Arial, sans-serif';

const FIELD: React.CSSProperties = {
  width: "100%",
  font: `15px ${SANS}`,
  padding: "11px 12px",
  border: "1px solid #d8ded0",
  borderRadius: 11,
  background: "#fff",
  marginBottom: 14,
};

const LABEL: React.CSSProperties = {
  display: "block",
  font: `600 11.5px ${SANS}`,
  letterSpacing: ".08em",
  textTransform: "uppercase",
  color: "#6b7060",
  marginBottom: 7,
};

export function ActivateForm({ token }: { token: string }) {
  const [password, setPassword] = useState("");
  const [again, setAgain] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  if (done) {
    return (
      <div>
        <div
          style={{
            background: "#e6f0e2",
            border: "1px solid #bcd4b2",
            color: "#2f5127",
            borderRadius: 11,
            padding: "11px 13px",
            font: `600 13.5px/1.45 ${SANS}`,
            marginBottom: 16,
          }}
        >
          Contraseña guardada. Ya puede entrar.
        </div>
        <Link
          href="/login"
          style={{
            display: "inline-block",
            background: "#48733c",
            color: "#fff",
            textDecoration: "none",
            font: `600 14px ${SANS}`,
            padding: "11px 16px",
            borderRadius: 11,
          }}
        >
          Ir a la pantalla de acceso →
        </Link>
      </div>
    );
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (password !== again) {
      setError("Las dos contraseñas no coinciden.");
      return;
    }
    if (password.length < 10) {
      setError("La contraseña debe tener al menos 10 caracteres.");
      return;
    }
    setBusy(true);
    try {
      const res = await fetch("/api/auth/activate", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ token, password }),
      });
      const data = (await res.json().catch(() => ({}))) as { message?: string };
      if (res.ok) setDone(true);
      else setError(data.message || "Este enlace ya no es válido. Pida uno nuevo.");
    } catch {
      setError("No se ha podido contactar con el servidor. Vuelva a intentarlo.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit}>
      {error && (
        <div
          role="alert"
          style={{
            background: "#f6e3df",
            border: "1px solid #e3b7ae",
            color: "#8f2d1b",
            borderRadius: 11,
            padding: "11px 13px",
            font: `600 13.5px/1.45 ${SANS}`,
            marginBottom: 16,
          }}
        >
          {error}
        </div>
      )}

      <label htmlFor="pw" style={LABEL}>
        Contraseña (mínimo 10 caracteres)
      </label>
      <input
        id="pw"
        type="password"
        autoComplete="new-password"
        required
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        style={FIELD}
      />

      <label htmlFor="pw2" style={LABEL}>
        Repita la contraseña
      </label>
      <input
        id="pw2"
        type="password"
        autoComplete="new-password"
        required
        value={again}
        onChange={(e) => setAgain(e.target.value)}
        style={FIELD}
      />

      <button
        type="submit"
        disabled={busy}
        style={{
          width: "100%",
          background: busy ? "#8aa681" : "#48733c",
          color: "#fff",
          border: 0,
          font: `600 15px ${SANS}`,
          padding: "12px 16px",
          borderRadius: 11,
          cursor: busy ? "default" : "pointer",
        }}
      >
        {busy ? "Guardando…" : "Guardar contraseña"}
      </button>
    </form>
  );
}
