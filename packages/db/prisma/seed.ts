import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

/**
 * Seed the database with placeholder data so a freshly cloned project has
 * something to look at. Replace this once the project defines real models.
 * Safe to run repeatedly (idempotent upsert).
 */
async function main() {
  const example = await prisma.example.upsert({
    where: { id: "seed-example" },
    update: {},
    create: { id: "seed-example", name: "Hello from the seed script" },
  });

  console.log(`Seeded example "${example.name}" (${example.id})`);
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
