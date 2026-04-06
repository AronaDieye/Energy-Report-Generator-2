# Workspace — Générateur de Rapport d'Audit Énergétique

## Overview

Application web pour générer automatiquement des rapports d'audit énergétique à partir de fichiers DOCX ou CSV issus de logiciels d'audit.

## Stack

- **Monorepo tool**: pnpm workspaces
- **Node.js version**: 24
- **Package manager**: pnpm
- **TypeScript version**: 5.9
- **Frontend**: React + Vite + Tailwind CSS + shadcn/ui (artifacts/energy-audit)
- **API framework**: Express 5 (artifacts/api-server)
- **Database**: PostgreSQL + Drizzle ORM
- **File parsing**: mammoth (DOCX), csv-parse (CSV), multer (upload)
- **Validation**: Zod (`zod/v4`), `drizzle-zod`
- **API codegen**: Orval (from OpenAPI spec)
- **Build**: esbuild (CJS bundle)

## Features

- Upload de fichiers DOCX ou CSV (glisser-déposer ou clic)
- Extraction automatique de toutes les données du bâtiment
- Affichage structuré : infos bâtiment, consommations, coûts, CO2, enveloppe, HVAC, label énergétique
- Liste des rapports récents avec statistiques agrégées
- Suppression de rapports
- Impression/export du rapport

## Key Commands

- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- `pnpm --filter @workspace/api-server run dev` — run API server locally

## Database Schema

- `audit_reports` table: all extracted fields from uploaded audit files (building info, consumption, costs, CO2, envelope, HVAC, energy label, recommendations, rawFields as JSONB)

## Key Files

- `lib/db/src/schema/auditReports.ts` — DB schema
- `artifacts/api-server/src/routes/audit.ts` — API routes
- `artifacts/api-server/src/lib/fileExtractor.ts` — DOCX/CSV extraction logic
- `lib/api-spec/openapi.yaml` — OpenAPI contract

## Key Commands

- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- `pnpm --filter @workspace/api-server run dev` — run API server locally

See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details.
