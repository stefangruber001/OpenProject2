/**
 * Turn an arbitrary string into a URL-safe slug.
 * e.g. "My First Post!" -> "my-first-post"
 */
export function slugify(input: string): string {
  return input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/**
 * Truncate a string to `max` characters, adding an ellipsis if it was cut.
 * e.g. truncate("hello world", 5) -> "hello…"
 */
export function truncate(input: string, max: number): string {
  return input.length <= max ? input : input.slice(0, max) + "…";
}
