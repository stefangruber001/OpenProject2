import { existsSync, mkdirSync, readFileSync, writeFileSync, appendFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { parse } from "yaml";
import { formatMoney, isFactoryError, resolveTenant } from "@repo/kernel";
import { runDemo } from "./demo";
import { registries } from "./registry";

const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..");

function loadSpec(path: string): unknown {
  return parse(readFileSync(path, "utf8"));
}

function fail(message: string): never {
  console.error(message);
  process.exit(1);
}

const [cmd, ...rest] = process.argv.slice(2);

try {
  switch (cmd) {
    case "resolve": {
      const specPath = rest[0] ?? fail("usage: factory resolve <tenant.yaml>");
      const resolved = resolveTenant(loadSpec(specPath), registries);
      console.log(JSON.stringify(resolved.report, null, 2));
      break;
    }

    case "validate": {
      const specPath = rest[0] ?? fail("usage: factory validate <tenant.yaml>");
      const resolved = resolveTenant(loadSpec(specPath), registries);
      console.log(
        `OK — tenant "${resolved.spec.tenant}" resolves: ` +
          `${resolved.report.capabilities.length} capabilities, ` +
          `${resolved.report.packs.length} packs, ` +
          `${resolved.report.boundPorts.length} ports bound.`,
      );
      break;
    }

    case "new-tenant": {
      // Config-only tenant creation — the §12.2 marginal-cost path. Timed.
      const started = performance.now();
      const nameIdx = rest.indexOf("--name");
      const id = nameIdx >= 0 ? rest[nameIdx + 1] : undefined;
      if (!id) fail('usage: factory new-tenant --name <tenant-id> [--legal-name "Name S.L."]');
      const legalIdx = rest.indexOf("--legal-name");
      const legalName = legalIdx >= 0 ? (rest[legalIdx + 1] ?? id) : `${id} S.L.`;

      const dir = join(REPO_ROOT, "tenants", id);
      const file = join(dir, "tenant.yaml");
      if (existsSync(file)) fail(`tenant "${id}" already exists at ${file}`);
      const template = readFileSync(join(REPO_ROOT, "tenants/_template/tenant.yaml"), "utf8");
      const spec = template.replaceAll("{{TENANT_ID}}", id).replaceAll("{{LEGAL_NAME}}", legalName);
      mkdirSync(dir, { recursive: true });
      writeFileSync(file, spec);
      const resolved = resolveTenant(parse(spec), registries);
      appendFileSync(
        join(REPO_ROOT, "tenants/INDEX.md"),
        `| ${id} | ${resolved.report.packs.map((p) => p.id).join(" + ")} | ${resolved.kernelVersion} |\n`,
      );
      const seconds = ((performance.now() - started) / 1000).toFixed(2);
      console.log(
        `OK — tenant "${id}" created and resolved in ${seconds}s (config only, zero code).`,
      );
      console.log(`  spec: ${file}`);
      console.log(`  next: pnpm factory demo ${file.replace(`${REPO_ROOT}/`, "")}`);
      break;
    }

    case "demo": {
      const specPath = rest[0] ?? fail("usage: factory demo <tenant.yaml> [--out <dir>]");
      const outIdx = rest.indexOf("--out");
      const out = outIdx >= 0 ? rest[outIdx + 1]! : "out";
      const result = await runDemo(specPath, out);
      const { invoiceEligible: a, invoiceBusiness: b, resolved } = result;
      const locale = resolved.kernelConfig.locale;
      const currency = resolved.kernelConfig.currency;
      console.log(`Tenant "${resolved.spec.tenant}" — demo slice complete:\n`);
      for (const inv of [a, b]) {
        const rate = inv.taxSummary[0]!;
        console.log(
          `  ${inv.displayNumber}  ${inv.buyer.name}\n` +
            `    base ${formatMoney(inv.baseCents, currency, locale)} · ` +
            `tax ${rate.rateBp / 100}% (${rate.taxCode}) ${formatMoney(inv.taxCents, currency, locale)} · ` +
            `total ${formatMoney(inv.totalCents, currency, locale)}\n` +
            `    justification: ${inv.taxDecisions[0]!.justification.legalBasis}\n` +
            `    seal: #${inv.seal?.seq} ${inv.seal?.hash.slice(0, 16)}…`,
        );
      }
      console.log(`\n  artifacts (${result.files.length}) in ${result.outDir}/`);
      break;
    }

    default:
      console.log(
        [
          "factory — spec in, running tested ERP out",
          "",
          "commands:",
          "  resolve   <tenant.yaml>   print the machine-readable resolution report",
          "  validate  <tenant.yaml>   check spec + config against composed schema",
          "  new-tenant --name <id>    create a tenant from the template (timed, config-only)",
          "  demo      <tenant.yaml>   run the presupuesto→factura slice, write artifacts",
        ].join("\n"),
      );
  }
} catch (e) {
  if (isFactoryError(e)) fail(e.message);
  throw e;
}
