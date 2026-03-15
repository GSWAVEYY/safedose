# drug-db-builder

Titan will implement drug DB builder scripts.

## Purpose

Converts public domain drug data (RxNorm + NDF-RT) into a compact SQLite database
bundled with the SafeDose mobile app for fully offline drug interaction checking.

## Data Sources

- **RxNorm** — NLM UMLS RRF files (drug names, RXCUIs, synonyms)
- **NDF-RT** — VA drug class and interaction data (available as public XML)

## Planned Output

`packages/drug-db-builder/output/drug-db.sqlite` — copied into `apps/mobile/assets/` at build time.

## Usage (once implemented)

```bash
pnpm --filter @safedose/drug-db-builder run build:db
```
