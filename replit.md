# Workspace — Générateur de Rapport d'Audit Énergétique

## Overview

Application web pour générer automatiquement des rapports d'audit énergétique à partir de fichiers DOCX ou CSV issus de BAO Evolution SED (logiciel d'audit énergétique français). Cible les auditeurs énergétiques français/belges.

## Stack

- **Monorepo tool**: pnpm workspaces
- **Node.js version**: 24
- **Package manager**: pnpm
- **TypeScript version**: 5.9
- **Frontend**: React + Vite + Tailwind CSS + shadcn/ui (`artifacts/energy-audit`, port from `$PORT`)
- **API framework**: Express 5 (`artifacts/api-server`, port 8080)
- **Database**: PostgreSQL + Drizzle ORM
- **File parsing**: mammoth (DOCX → raw text), csv-parse (CSV), multer (upload)
- **Validation**: Zod (`zod/v4`), `drizzle-zod`
- **API codegen**: Orval (from OpenAPI spec at `lib/api-spec/openapi.yaml`)
- **Build**: esbuild (CJS bundle)

## Features

- Upload de fichiers DOCX ou CSV (glisser-déposer ou clic)
- Extraction automatique depuis BAO Evolution SED : nom bâtiment, type, surfaces, DPE 3CL-2021, consommations par poste, coûts, CO2, enveloppe, CVC, 3 scénarios de travaux
- Affichage structuré : carte héro (infos bâtiment + DPE), consommations par poste, comparaison des scénarios (tableau), préconisations, enveloppe, CVC, contexte climatique, données brutes (collapsible)
- Liste des rapports récents avec statistiques agrégées (DPE label, surface, kWh)
- Suppression de rapports
- Impression/export du rapport (bouton "Imprimer")
- Interface entièrement en français

## BAO Evolution SED — Structure du fichier

Les sections clés extraites par `fileExtractor.ts` :
- **En-tête** : nom du projet (`LES PALAOS_AYD tel : fax :`)
- **DONNEES TECHNIQUES** : zone climatique, département, station météo
- **BÂTIMENT** : surfaces (hab, SHON), niveaux, hauteur, surface vitrée
- **ETAT INITIAL** : tableau consommations par poste (CHAUFFAGE, REFROIDISSEMENT, ECS, ECLAIRAGE, AUXILIAIRES) avec kWh/an, kWhEP/m²/an, €/an
- **ETIQUETTE DPE** : méthode 3CL-2021, kWhEP/m².an, kgéqCO2/m².an, label A-G
- **CATALOGUE DES PAROIS + DETAILS** : descriptions isolants murs (Parois ME), plafonds (Parois Ph), planchers bas (Parois Pb) + U-values
- **DESCRIPTIF DE LA MODIFICATION n° X** : scénarios SC1/SC2/SC3 avec conseils, investissement, temps de retour, kWhEP/m².an après, kgCO2/m² après

## Architecture API

- `GET /api/audit/reports` — liste des rapports (format summary flat)
- `GET /api/audit/reports/:id` — rapport complet avec tous les champs imbriqués
- `POST /api/audit/upload` — upload + extraction + sauvegarde en DB
- `DELETE /api/audit/reports/:id` — suppression
- `GET /api/audit/stats` — statistiques agrégées

## Key Files

- `lib/db/src/schema/auditReports.ts` — schéma DB (tous champs bâtiment/énergie/CVC/enveloppe)
- `artifacts/api-server/src/routes/audit.ts` — routes API
- `artifacts/api-server/src/lib/fileExtractor.ts` — logique extraction DOCX/CSV (mammoth + regex BAO)
- `lib/api-spec/openapi.yaml` — contrat OpenAPI
- `artifacts/energy-audit/src/pages/report-detail.tsx` — page rapport détaillé
- `artifacts/energy-audit/src/pages/home.tsx` — tableau de bord
- `artifacts/energy-audit/src/components/energy-label.tsx` — composant étiquette DPE

## Key Commands

- `pnpm run typecheck` — typecheck complet
- `pnpm run build` — typecheck + build tous les packages
- `pnpm --filter @workspace/api-spec run codegen` — régénérer les hooks API et schémas Zod depuis OpenAPI
- `pnpm --filter @workspace/db run push` — push schéma DB (dev uniquement)
- `pnpm --filter @workspace/api-server run dev` — démarrer le serveur API
- `pnpm --filter @workspace/energy-audit run dev` — démarrer le frontend

## Notes Techniques

- Le proxy Replit route `/api/*` vers l'API (port 8080) et le reste vers le frontend (port $PORT)
- `mammoth` aplatit les tableaux DOCX — chaque cellule sur une ligne séparée
- Les paires clé-valeur BAO utilisent `:` avec tabulation/espace comme séparateurs
- Les patterns Parois `ME` (mur ext), `Ph` (plafond), `Pb` (plancher bas) identifient les composants d'enveloppe
- Le label DPE est calculé depuis la consommation 3CL-2021 (pas Th-C-E)

See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details.
