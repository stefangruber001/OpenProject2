/**
 * WHICH SYSTEM AM I?
 *
 * There are two now: production, holding a real company's invoice register, and
 * a development stack holding invented data. They run the SAME image on the SAME
 * server and differ only by environment — which is what makes them useful and
 * what makes them confusable.
 *
 * THE DEFAULT IS PRODUCTION, AND THE DIRECTION OF THAT DEFAULT IS THE WHOLE
 * DESIGN. Only an explicit marker makes this a test system. Anything else — the
 * variable unset, empty, misspelt, lost in a compose edit — reads as production
 * and shows no band.
 *
 * That is deliberately the FAIL-OPEN direction, chosen against the usual
 * instinct, because the two failures are not symmetrical:
 *
 *   · a missing band on dev costs a moment's confusion between two systems that
 *     already have different addresses and different passwords;
 *   · a band wrongly on PRODUCTION tells a real company that their live invoices
 *     are "not real data", which is alarming, looks like a fault, and damages
 *     trust in the one system that has to be trusted.
 *
 * So the band is the third line of defence, never the first. The hostname and
 * the password are the first two.
 */

export type EnvironmentName = "production" | "dev";

/** The markers that mean "this is not the real system". Anything else is. */
const DEV_MARKERS = new Set(["dev", "development", "staging", "test"]);

export function environmentName(): EnvironmentName {
  const raw = (process.env.ERP_ENVIRONMENT ?? "").trim().toLowerCase();
  return DEV_MARKERS.has(raw) ? "dev" : "production";
}

export function isDevEnvironment(): boolean {
  return environmentName() === "dev";
}

/**
 * The band's text, in the three languages the product speaks. Not routed
 * through lib/i18n because this has to be readable by whoever is looking,
 * whatever the interface language happens to be set to — a warning nobody can
 * read is not a warning. Spanish leads because the company does.
 */
export const ENVIRONMENT_BAND = {
  es: "ENTORNO DE PRUEBAS · los datos aquí son inventados",
  ca: "ENTORN DE PROVES · les dades d'aquí són inventades",
  en: "TEST ENVIRONMENT · the data here is invented",
} as const;

/** One line carrying all three, for surfaces that render a single string. */
export function environmentBandText(): string {
  return `${ENVIRONMENT_BAND.es}  ·  ${ENVIRONMENT_BAND.en}`;
}
