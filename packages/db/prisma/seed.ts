import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

/**
 * Seed the fleet registry with the demo tenants so a fresh database mirrors
 * `tenants/INDEX.md`. Idempotent.
 */
async function main() {
  for (const t of [
    { id: "reformas-demo", name: "Reformas Iberia Demo S.L." },
    { id: "azulejos-lopez", name: "Azulejos López S.L.U." },
  ]) {
    await prisma.tenant.upsert({ where: { id: t.id }, update: { name: t.name }, create: t });
    console.log(`Seeded tenant ${t.id}`);
  }
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
