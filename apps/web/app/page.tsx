const pillars = [
  "Version control & protected main with PR review",
  "Documented architecture & decisions (ADRs)",
  "Consistent monorepo structure & conventions",
  "Automated quality gates (lint, types, tests) in CI",
  "Testing setup (unit + end-to-end)",
  "Type-safe data layer (Prisma + PostgreSQL)",
  "Environment config & secrets kept out of code",
  "Dependency & security automation",
];

export default function Home() {
  return (
    <main className="mx-auto flex min-h-screen max-w-3xl flex-col gap-12 px-6 py-16">
      <header className="flex flex-col gap-3">
        <span className="text-sm font-medium uppercase tracking-widest text-neutral-500">
          OpenProject2
        </span>
        <h1 className="text-4xl font-bold tracking-tight text-neutral-900 dark:text-neutral-50">
          A solid foundation, ready to build on.
        </h1>
        <p className="text-lg text-neutral-600 dark:text-neutral-400">
          The engineering foundation is in place. The product isn&apos;t defined yet — when it is,
          it gets built here, on top of the pillars below.
        </p>
      </header>

      <section className="flex flex-col gap-4">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-neutral-500">
          What&apos;s already in place
        </h2>
        <ul className="grid gap-2 sm:grid-cols-2">
          {pillars.map((pillar) => (
            <li
              key={pillar}
              className="flex items-start gap-2 text-sm text-neutral-700 dark:text-neutral-300"
            >
              <span aria-hidden className="mt-0.5 text-green-600">
                ✓
              </span>
              {pillar}
            </li>
          ))}
        </ul>
      </section>

      <footer className="mt-auto text-sm text-neutral-500">
        Start with the{" "}
        <a
          className="underline underline-offset-2"
          href="https://github.com/stefangruber001/OpenProject2/blob/main/docs/architecture.md"
        >
          architecture docs
        </a>
        . Health check at <code className="font-mono text-xs">/api/health</code>.
      </footer>
    </main>
  );
}
