/**
 * SafeDose Drug Database Builder — CLI entry point
 *
 * Usage:
 *   tsx src/index.ts fetch         — download raw data from NLM APIs
 *   tsx src/index.ts build         — process data/ → output/safedose-drugs.db
 *   tsx src/index.ts all           — fetch + build (full pipeline)
 *
 * Estimated run time for `all`:
 *   ~5-10 minutes depending on NLM API response times.
 *   The fetch step is idempotent — safe to re-run if interrupted.
 *
 * Output:
 *   output/safedose-drugs.db — ship this with the mobile app
 */

import { Command } from "commander";
import { fetchRxNorm } from "./fetch-rxnorm.js";
import { fetchInteractions } from "./fetch-interactions.js";
import { buildDb } from "./build-db.js";

const program = new Command();

program
  .name("drug-db-builder")
  .description("Build the SafeDose offline drug database from FDA/NLM sources")
  .version("0.1.0");

// ---------------------------------------------------------------------------
// fetch command
// ---------------------------------------------------------------------------

program
  .command("fetch")
  .description(
    "Download raw RxNorm and interaction data from NLM APIs (~5-10 min)"
  )
  .option(
    "--skip-interactions",
    "Only fetch RxNorm drug data, skip interaction fetching"
  )
  .action(async (options: { skipInteractions?: boolean }) => {
    console.log("=== SafeDose Drug DB Builder: Fetch Phase ===\n");
    console.log(
      "Rate limit: 20 req/sec (NLM policy). Do not interrupt mid-run.\n"
    );

    const rxnormResult = await fetchRxNorm();

    console.log(
      `\nRxNorm: ${rxnormResult.succeeded} fetched, ${rxnormResult.failed} failed, ${rxnormResult.skipped} cached`
    );

    if (!options.skipInteractions) {
      const rxcuis = Array.from(rxnormResult.rxcuiMap.values());
      console.log(`\nFetching interactions for ${rxcuis.length} drugs...\n`);

      const intResult = await fetchInteractions(rxcuis);

      console.log(
        `\nInteractions: ${intResult.totalInteractions} pairs found, ` +
          `${intResult.batchesProcessed} batches fetched, ` +
          `${intResult.batchesSkipped} cached, ` +
          `${intResult.failed} failed`
      );
    }

    console.log("\nFetch phase complete. Run `build` to process into SQLite.");
  });

// ---------------------------------------------------------------------------
// build command
// ---------------------------------------------------------------------------

program
  .command("build")
  .description(
    "Process fetched data into SQLite database (output/safedose-drugs.db)"
  )
  .action(async () => {
    console.log("=== SafeDose Drug DB Builder: Build Phase ===\n");

    const result = await buildDb();

    console.log(`\nBuild complete.`);
    console.log(`  DB path  : ${result.dbPath}`);
    console.log(`  Drugs    : ${result.totalDrugs.toLocaleString()}`);
    console.log(`  Interactions: ${result.totalInteractions.toLocaleString()}`);

    const mbSize = (result.dbSizeBytes / (1024 * 1024)).toFixed(1);
    console.log(`  Size     : ${mbSize} MB`);

    if (result.totalDrugs === 0) {
      console.warn(
        "\n[warn] Database is empty. Did you run `fetch` first?\n" +
          "       Run: tsx src/index.ts fetch"
      );
    }
  });

// ---------------------------------------------------------------------------
// all command (fetch + build)
// ---------------------------------------------------------------------------

program
  .command("all")
  .description("Run full pipeline: fetch data then build SQLite database")
  .option(
    "--skip-interactions",
    "Fetch only drug names, skip interaction data"
  )
  .action(async (options: { skipInteractions?: boolean }) => {
    console.log("=== SafeDose Drug DB Builder: Full Pipeline ===\n");
    console.log(
      "This will:\n" +
        "  1. Download top-200 drug data from NLM RxNorm API\n" +
        "  2. Download drug-drug interaction data\n" +
        "  3. Build SQLite database at output/safedose-drugs.db\n"
    );
    console.log(
      "Estimated time: 5-10 minutes. Safe to re-run — fetches are cached.\n"
    );

    // Step 1: RxNorm
    const rxnormResult = await fetchRxNorm();
    console.log(
      `\nRxNorm: ${rxnormResult.succeeded} fetched, ${rxnormResult.failed} failed, ${rxnormResult.skipped} cached`
    );

    // Step 2: Interactions
    if (!options.skipInteractions) {
      const rxcuis = Array.from(rxnormResult.rxcuiMap.values());

      if (rxcuis.length > 0) {
        console.log(
          `\nFetching interactions for ${rxcuis.length} drugs...\n`
        );
        const intResult = await fetchInteractions(rxcuis);
        console.log(
          `\nInteractions: ${intResult.totalInteractions} pairs found`
        );
      } else {
        console.warn(
          "\n[warn] No RxCUIs found — interaction fetch skipped."
        );
      }
    }

    // Step 3: Build DB
    console.log("\n");
    const buildResult = await buildDb();

    console.log(`\n=== Pipeline Complete ===`);
    console.log(`  Drugs        : ${buildResult.totalDrugs.toLocaleString()}`);
    console.log(
      `  Interactions : ${buildResult.totalInteractions.toLocaleString()}`
    );
    const mbSize = (buildResult.dbSizeBytes / (1024 * 1024)).toFixed(1);
    console.log(`  DB size      : ${mbSize} MB`);
    console.log(`  Output       : ${buildResult.dbPath}`);
    console.log(
      `\nNext step: copy output/safedose-drugs.db to apps/mobile/assets/`
    );
  });

// ---------------------------------------------------------------------------
// Parse + execute
// ---------------------------------------------------------------------------

program.parseAsync(process.argv).catch((err: unknown) => {
  console.error("[fatal]", err instanceof Error ? err.message : String(err));
  process.exit(1);
});
