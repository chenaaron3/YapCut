/**
 * Seed both global audio libraries (SFX then music). Idempotent.
 *
 * Usage:
 *   npm run seed:global
 *   npm run seed:global -- --force
 */
import { seedGlobalMusic } from "./seed-global-music";
import { seedGlobalSfx } from "./seed-global-sfx";

async function main(): Promise<void> {
  const force = process.argv.slice(2).includes("--force");
  await seedGlobalSfx({ force });
  await seedGlobalMusic({ force });
}

main()
  .then(() => process.exit(0))
  .catch((error: unknown) => {
    console.error("[seed-global] failed:", error);
    process.exit(1);
  });
