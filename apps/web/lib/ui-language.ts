/**
 * The words the sign-in screen needs, in all three languages.
 *
 * WHY THIS IS A TABLE AND NOT THE RUNTIME TRANSLATION LAYER. Everywhere else,
 * translation happens in the browser by rewriting rendered text (site/i18n.js).
 * That cannot work here. The sign-in page carries no client JavaScript at all —
 * deliberately, because it is the one screen that must render when everything
 * else has failed — so there is nothing to do the rewriting. It is also the
 * first thing anybody sees, and a page that arrives in Spanish and flips to
 * Catalan a moment later looks broken rather than multilingual.
 *
 * So this screen is translated on the server, from a table, and it is small
 * enough that a table is the honest tool: about a dozen strings, chosen once.
 */
export const LANGUAGES = ["es", "ca", "en"] as const;
export type Language = (typeof LANGUAGES)[number];

/** Language names are always written in their own language. */
export const LANGUAGE_NAMES: Record<Language, string> = {
  es: "Español",
  ca: "Català",
  en: "English",
};

export const LANGUAGE_SHORT: Record<Language, string> = { es: "ES", ca: "CA", en: "EN" };

/** The cookie a device's language choice lives in. Readable without JS, which
 *  is the whole point: the server needs it to render the page. */
export const LANG_COOKIE = "canei_lang";

export function asLanguage(value: unknown): Language | null {
  const v = String(value ?? "")
    .trim()
    .toLowerCase()
    .slice(0, 2);
  return (LANGUAGES as readonly string[]).includes(v) ? (v as Language) : null;
}

type Copy = Record<Language, string>;

export const SIGN_IN: Record<string, Copy> = {
  tagline: {
    es: "Sistema de gestión",
    ca: "Sistema de gestió",
    en: "Management system",
  },
  email: { es: "Correo electrónico", ca: "Correu electrònic", en: "Email" },
  password: { es: "Contraseña", ca: "Contrasenya", en: "Password" },
  submit: { es: "Entrar", ca: "Entrar", en: "Sign in" },
  failed: {
    es: "Correo o contraseña incorrectos.",
    ca: "Correu o contrasenya incorrectes.",
    en: "Incorrect email or password.",
  },
  blankIfShared: {
    es: "Déjelo vacío si solo tiene la contraseña.",
    ca: "Deixeu-ho buit si només teniu la contrasenya.",
    en: "Leave blank if you only have the password.",
  },
  staySignedIn: {
    es: "Permanecerá conectado en este dispositivo.",
    ca: "Us mantindreu connectat en aquest dispositiu.",
    en: "You stay signed in on this device.",
  },
  hintWeb: {
    es: "Guarde la contraseña para entrar con Face ID.",
    ca: "Deseu la contrasenya per entrar amb Face ID.",
    en: "Save the password to sign in with Face ID.",
  },
  hintApp: {
    es: "La próxima vez entrará con Face ID.",
    ca: "La propera vegada entrareu amb Face ID.",
    en: "Next time you will sign in with Face ID.",
  },
  languageGroup: { es: "Idioma", ca: "Llengua", en: "Language" },
  notConfiguredTitle: {
    es: "El acceso no está configurado",
    ca: "L'accés no està configurat",
    en: "Sign-in is not configured",
  },
  notConfiguredBody: {
    es: "Este servidor no tiene cuentas configuradas, así que no hay nada a lo que acceder.",
    ca: "Aquest servidor no té comptes configurats, així que no hi ha res on accedir.",
    en: "This server has no accounts set up, so there is nothing to sign in to.",
  },
};

export function t(key: keyof typeof SIGN_IN, lang: Language): string {
  return SIGN_IN[key]![lang];
}
