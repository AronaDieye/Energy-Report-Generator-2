import mammoth from "mammoth";
import { parse as csvParse } from "csv-parse/sync";

export interface RawField {
  key: string;
  value: string;
  section: string | null;
}

export interface BaoMetadata {
  bureauEtudes?: string | null;
  bureauAdresse?: string | null;
  bureauEmail?: string | null;
  bureauTelephone?: string | null;
  siret?: string | null;
  qualification?: string | null;
  maitreDoeuvre?: string | null;
  beneficiaire?: string | null;
  adresseClient?: string | null;
  dateVisite?: string | null;
  dateRealisation?: string | null;
  dateRestitution?: string | null;
  reference?: string | null;
  tExtBase?: string | null;
  rendementInitial?: string | null;
  cef3UsagesInitial?: number | null;
  cep3UsagesInitial?: number | null;
  cef5UsagesInitial?: number | null;
  cep5UsagesInitial?: number | null;
  gesInitialKgCo2M2?: number | null;
  scenarios?: Array<{
    index: number;
    travaux: string[];
    isolationToitures?: string | null;
    isolationMurs?: string | null;
    isolationPlancherBas?: string | null;
    energieChauffagePrincipal?: string | null;
    cef3KwhEfM2?: number | null;
    cep3KwhEpM2?: number | null;
    cef5KwhEfM2?: number | null;
    cep5KwhEpM2?: number | null;
    gesCo2KgM2?: number | null;
    gainEconomiqueEur?: number | null;
    gainEnergetiquePct?: number | null;
    tauxEnrRPct?: number | null;
    primeBarTh145Euros?: number | null;
    primeBarTh145KWhcumac?: number | null;
    labelDpe?: string | null;
    totalDepenseAnnuelle?: number | null;
    totalKwhEfAn?: number | null;
  }>;
}

export interface ExtractedAuditData {
  buildingName: string | null;
  buildingAddress: string | null;
  buildingType: string | null;
  constructionYear: number | null;
  totalSurface: number | null;
  heatedSurface: number | null;
  numberOfFloors: number | null;
  numberOfOccupants: number | null;
  climateZone: string | null;

  totalConsumption: number | null;
  electricityConsumption: number | null;
  gasConsumption: number | null;
  heatingConsumption: number | null;
  coolingConsumption: number | null;
  hotWaterConsumption: number | null;
  consumptionUnit: string | null;
  consumptionReferenceYear: number | null;

  totalCost: number | null;
  electricityCost: number | null;
  gasCost: number | null;
  currency: string | null;
  costReferenceYear: number | null;

  totalCo2Emissions: number | null;
  electricityCo2Emissions: number | null;
  gasCo2Emissions: number | null;
  co2Unit: string | null;

  wallInsulation: string | null;
  roofInsulation: string | null;
  floorInsulation: string | null;
  windowType: string | null;
  windowSurface: number | null;
  airTightness: number | null;
  thermalBridges: string | null;

  heatingSystem: string | null;
  heatingEfficiency: number | null;
  coolingSystem: string | null;
  coolingEfficiency: number | null;
  ventilationType: string | null;
  hotWaterSystem: string | null;

  currentLabel: string | null;
  primaryEnergyConsumption: number | null;
  referenceConsumption: number | null;
  energyIndex: number | null;

  recommendations: Array<{
    category: string;
    description: string;
    estimatedSaving: number | null;
    estimatedCost: number | null;
    priority: "high" | "medium" | "low";
    paybackPeriod: number | null;
  }>;

  rawFields: RawField[];
  metadata?: BaoMetadata | null;
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function parseNum(val: string | null | undefined): number | null {
  if (!val) return null;
  const cleaned = val.replace(/\s/g, "").replace(",", ".").replace(/[^\d.-]/g, "");
  const n = parseFloat(cleaned);
  return isNaN(n) ? null : n;
}

function extractYear(val: string | null | undefined): number | null {
  if (!val) return null;
  const match = val.match(/\b(19|20)\d{2}\b/);
  return match ? parseInt(match[0], 10) : null;
}

function extractNumber(val: string | null | undefined): number | null {
  if (!val) return null;
  const match = val.match(/([\d\s]+[,.]?\d*)/);
  if (!match) return null;
  return parseNum(match[1]);
}

function mapDpeLabel(consumptionKwhEP: number | null): string | null {
  if (consumptionKwhEP === null) return null;
  if (consumptionKwhEP <= 70) return "A";
  if (consumptionKwhEP <= 110) return "B";
  if (consumptionKwhEP <= 180) return "C";
  if (consumptionKwhEP <= 250) return "D";
  if (consumptionKwhEP <= 330) return "E";
  if (consumptionKwhEP <= 420) return "F";
  return "G";
}

function isSectionHeader(line: string): boolean {
  if (line.length < 5 || line.length > 120) return false;
  const known = [
    "DONNEES TECHNIQUES",
    "CATALOGUE DES PAROIS",
    "CATALOGUE DES VITRAGES",
    "CATALOGUE DES LINEIQUES",
    "ETAT INITIAL",
    "ETIQUETTE DPE",
    "DESCRIPTIF DE LA MODIFICATION",
    "REPARTITION DES",
    "BILAN ENERGETIQUE",
    "RECAPITULATIF",
    "SAISIE DES",
    "EVOLUTION EMISSION",
    "DETAILS DES PAROIS",
  ];
  const upper = line.toUpperCase();
  if (known.some((k) => upper.includes(k))) return true;
  if (line === line.toUpperCase() && /[A-Z]{4,}/.test(line) && !/^\d/.test(line)) return true;
  return false;
}

// ─── BAO Evolution SED: Ubat / Déperditions parser ──────────────────────────

export interface UbatParoisRow {
  designation: string;
  code: string | null;
  nb: string | null;
  u: string | null;       // standard rows: U (W/m².°C)
  psi: string | null;     // PT rows: ψ (W/m.K)
  b: string | null;
  surface: string | null; // standard rows: surface m²
  longueur: string | null;// PT rows: longueur m
  orie: string | null;
  deperd: string | null;  // W/°C
  ref: string | null;
  kind: "mur_ext" | "vitrage" | "porte" | "pont_thermique" | "autre";
}

interface UbatData {
  coefficient: number | null;
  ht: number | null;
  hd: number | null;
  hu: number | null;
  hs: number | null;
  at: number | null;
  ventilation: number | null;
  infiltrations: number | null;
  gv: number | null;
  deperditionsTotalesKw: number | null;
  // Grouped row-level totals
  mursExt: number | null;
  vitrages: number | null;
  portes: number | null;
  pontsThermiques: number | null;
  autresParois: number | null;
  // Individual rows for detailed table
  paroisRows: UbatParoisRow[];
}

const ORIENTATIONS = new Set(["Nord", "Sud", "Est", "Oue", "Int.", "Hori."]);

function parseUbatSection(text: string): UbatData {
  const empty: UbatData = {
    coefficient: null, ht: null, hd: null, hu: null, hs: null, at: null,
    ventilation: null, infiltrations: null, gv: null, deperditionsTotalesKw: null,
    mursExt: null, vitrages: null, portes: null, pontsThermiques: null, autresParois: null,
  };

  const sectionStart = text.indexOf("ETAT INITIAL : CALCUL du COEFFICIENT UBAT");
  if (sectionStart < 0) return empty;

  const section = text.slice(sectionStart, sectionStart + 14000);

  // ── Summary values ──
  const coefM = section.match(/COEFFICIENT UBAT\s*=\s*([\d,]+)/);
  const htM   = section.match(/HT\s*=\s*[\s\n]*([\d\s,]+)/);
  const hdM   = section.match(/Déperditions Parois Extérieures\s*HD\s*:\s*([\d\s,]+)\s*W\/°C/);
  const huM   = section.match(/Déperditions Parois Intérieures\s*HU\s*:\s*([\d\s,]+)\s*W\/°C/);
  const hsM   = section.match(/Déperditions par le sol\s*HS\s*:\s*([\d\s,]+)\s*W\/°C/);
  const atM   = section.match(/Surface Totale des parois déperditivesAT\s*:\s*([\d\s,]+)\s*m²/);
  const ventM = section.match(/Ventilation spécifique\s*:\s*([\d\s,]+)\s*W\/°C/);
  const infM  = section.match(/Infiltrations\s*:\s*([\d\s,]+)\s*W\/°C/);
  const gvM   = section.match(/Total\s*\(GV\)\s*:\s*([\d\s,]+)\s*W\/°C/);
  const depTM = section.match(/Déperditions totales\s*\(sans majoration\)\s*:\s*([\d\s,]+)\s*kW/);

  const result: UbatData = {
    coefficient: coefM ? parseNum(coefM[1]) : null,
    ht:          htM   ? parseNum(htM[1])   : null,
    hd:          hdM   ? parseNum(hdM[1])   : null,
    hu:          huM   ? parseNum(huM[1])   : null,
    hs:          hsM   ? parseNum(hsM[1])   : null,
    at:          atM   ? parseNum(atM[1])   : null,
    ventilation: ventM ? parseNum(ventM[1]) : null,
    infiltrations: infM ? parseNum(infM[1]) : null,
    gv:          gvM   ? parseNum(gvM[1])   : null,
    deperditionsTotalesKw: depTM ? parseNum(depTM[1]) : null,
    mursExt: null, vitrages: null, portes: null, pontsThermiques: null, autresParois: null,
    paroisRows: [],
  };

  // ── Row-level parsing (totals + individual rows) ──
  const lines = section.split("\n").map(l => l.trim()).filter(l => l.length > 0);

  // Find where table data starts (after header row "Désignation")
  const headerIdx = lines.findIndex(l => l === "Désignation");
  if (headerIdx < 0) return result;

  let mursExt = 0, vitrages = 0, portes = 0, pontsTh = 0, autresParois = 0;
  let gotMurs = false, gotVitrages = false, gotPortes = false, gotPT = false, gotAutres = false;

  const paroisRows: UbatParoisRow[] = [];

  let i = headerIdx + 1;
  while (i < lines.length) {
    const line = lines[i];

    // Stop at summary section
    if (line === "HT =" || /^COEFFICIENT UBAT/.test(line) || /^RECAPITULATIF/.test(line)) break;

    const isMurExt    = /^mur\s+ext/i.test(line);
    const isVitrage   = /^vitrage\s*\d+/i.test(line);
    const isPorte     = /^porte\s*\d*/i.test(line);
    const isPT        = /^p\s+th\./i.test(line);
    const isAutre     = /^(mur\s+int|plafond|plancher|dalle|paroi)/i.test(line);

    if (isMurExt || isVitrage || isPorte || isPT || isAutre) {
      const designation = line;
      // Collect block until next element or stop
      i++;
      const block: string[] = [];
      while (i < lines.length && block.length < 14) {
        const next = lines[i];
        if (next === "HT =" || /^COEFFICIENT UBAT/.test(next) || /^RECAPITULATIF/.test(next)) break;
        if (/^(mur\s+(ext|int)|vitrage\s*\d+|porte\s*\d*|p\s+th\.|plafond|plancher|dalle|paroi)/i.test(next)) break;
        block.push(next);
        i++;
      }

      // ── Build structured row ──
      const kind: UbatParoisRow["kind"] =
        isMurExt  ? "mur_ext"          :
        isVitrage ? "vitrage"          :
        isPorte   ? "porte"            :
        isPT      ? "pont_thermique"   : "autre";

      const row: UbatParoisRow = {
        designation, code: null, nb: null, u: null, psi: null,
        b: null, surface: null, longueur: null, orie: null, deperd: null, ref: null, kind,
      };

      if (block.length > 0) {
        row.code = block[0];
        if (isPT) {
          // PT: code, ψ, b, longueur, deperd, [ref]
          if (block.length > 1) row.psi = block[1];
          if (block.length > 2) row.b = block[2];
          if (block.length > 3) row.longueur = block[3];
          if (block.length > 4) row.deperd = block[4];
          if (block.length > 5 && /^[A-Z]/i.test(block[5])) row.ref = block[5];
        } else {
          // Standard: code, [Nb(int)], U, b, surface, Orie, deperd, [ref]
          let offset = 1;
          if (block.length > 1 && /^\d+$/.test(block[1])) {
            row.nb = block[1];
            offset = 2;
          }
          if (block.length > offset)     row.u       = block[offset];
          if (block.length > offset + 1) row.b       = block[offset + 1];
          if (block.length > offset + 2) row.surface = block[offset + 2];
          const orieIdx = block.findIndex(v => ORIENTATIONS.has(v));
          if (orieIdx >= 0) {
            row.orie = block[orieIdx];
            if (orieIdx + 1 < block.length) row.deperd = block[orieIdx + 1];
            if (orieIdx + 2 < block.length && /^[A-Za-z]/.test(block[orieIdx + 2])) {
              row.ref = block[orieIdx + 2];
            }
          }
        }
      }

      paroisRows.push(row);

      // ── Accumulate totals ──
      const deperdNum = row.deperd ? parseNum(row.deperd) : null;
      if (deperdNum !== null) {
        if (isMurExt)  { mursExt      += deperdNum; gotMurs     = true; }
        if (isVitrage) { vitrages     += deperdNum; gotVitrages = true; }
        if (isPorte)   { portes       += deperdNum; gotPortes   = true; }
        if (isPT)      { pontsTh      += deperdNum; gotPT       = true; }
        if (isAutre)   { autresParois += deperdNum; gotAutres   = true; }
      }
    } else {
      i++;
    }
  }

  const rnd = (v: number) => Math.round(v * 100) / 100;
  if (gotMurs)     result.mursExt         = rnd(mursExt);
  if (gotVitrages) result.vitrages        = rnd(vitrages);
  if (gotPortes)   result.portes          = rnd(portes);
  if (gotPT)       result.pontsThermiques = rnd(pontsTh);
  if (gotAutres)   result.autresParois    = rnd(autresParois);
  result.paroisRows = paroisRows;

  return result;
}

// ─── BAO Evolution SED: Consumption table parser ────────────────────────────

interface ConsumptionPost {
  finalKwhAn: number | null;
  primaryKwhEpM2: number | null;
  costEuros: number | null;
  energySource: string | null;
}

interface ConsumptionTable {
  CHAUFFAGE: ConsumptionPost;
  REFROIDISSEMENT: ConsumptionPost;
  ECS: ConsumptionPost;
  ECLAIRAGE: ConsumptionPost;
  AUXILIAIRES: ConsumptionPost;
  TOTAL: ConsumptionPost;
}

const ENERGY_POSTS = ["CHAUFFAGE", "REFROIDISSEMENT", "ECS", "ECLAIRAGE", "AUXILIAIRES", "VENTILATEURS", "AUTRES USAGES", "TOTAL"];
const ENERGY_SOURCES = ["Propane", "Gaz de réseau", "Electrique", "Bois", "Granulés bois", "Fioul", "Réseau de chaleur", "Butane"];

function isNumericValue(s: string): boolean {
  // A line that looks like a number (possibly with spaces as thousands separators)
  return /^[\d\s]+[,.]?\d*$/.test(s) && s.replace(/\s/g, "").length > 0;
}

function isEnergySource(s: string): boolean {
  return ENERGY_SOURCES.some((src) => s.toLowerCase().includes(src.toLowerCase()));
}

function parseEtatInitialSection(text: string): ConsumptionTable | null {
  // Find the ETAT INITIAL section text (first occurrence) 
  const match = text.match(/ETAT INITIAL\s[\s\S]*?(?=RELEVE de CONSOMMATION|REPARTITION des DEPERDITIONS|ETIQUETTE DPE|$)/);
  if (!match) return null;
  const section = match[0];

  // Find "CHAUFFAGE" as entry point to consumption table
  const chauffageIdx = section.indexOf("\nCHAUFFAGE\n");
  if (chauffageIdx === -1) return null;

  const tableText = section.substring(chauffageIdx);
  const lines = tableText.split("\n").map((l) => l.trim()).filter((l) => l.length > 0);

  const result: Record<string, ConsumptionPost> = {};
  let i = 0;

  while (i < lines.length) {
    const line = lines[i].toUpperCase();
    const postKey = ENERGY_POSTS.find((p) => line === p);

    if (postKey) {
      i++;
      let energySource: string | null = null;

      // Check if next line is an energy source (non-numeric text)
      if (i < lines.length && isEnergySource(lines[i]) && !ENERGY_POSTS.includes(lines[i].toUpperCase())) {
        energySource = lines[i];
        i++;
      }

      // Collect up to 3 numeric values
      const nums: number[] = [];
      while (i < lines.length && nums.length < 3 && !ENERGY_POSTS.includes(lines[i].toUpperCase())) {
        if (isNumericValue(lines[i])) {
          const n = parseNum(lines[i]);
          if (n !== null) nums.push(n);
          i++;
        } else if (isEnergySource(lines[i])) {
          // Second energy source (e.g. Granulés bois for chauffage after Gaz)
          i++;
        } else {
          break;
        }
      }

      result[postKey] = {
        finalKwhAn: nums[0] ?? null,
        primaryKwhEpM2: nums[1] ?? null,
        costEuros: nums[2] ?? null,
        energySource,
      };
    } else {
      // Stop parsing if we hit ABONNEMENTS or other non-post content
      if (
        line.includes("ABONNEMENT") ||
        line.includes("ENTRETIEN") ||
        line.includes("BILAN") ||
        line.includes("CALCUL")
      ) {
        break;
      }
      i++;
    }
  }

  if (!result["CHAUFFAGE"]) return null;

  return {
    CHAUFFAGE: result["CHAUFFAGE"] || { finalKwhAn: null, primaryKwhEpM2: null, costEuros: null, energySource: null },
    REFROIDISSEMENT: result["REFROIDISSEMENT"] || { finalKwhAn: null, primaryKwhEpM2: null, costEuros: null, energySource: null },
    ECS: result["ECS"] || { finalKwhAn: null, primaryKwhEpM2: null, costEuros: null, energySource: null },
    ECLAIRAGE: result["ECLAIRAGE"] || { finalKwhAn: null, primaryKwhEpM2: null, costEuros: null, energySource: null },
    AUXILIAIRES: result["AUXILIAIRES"] || { finalKwhAn: null, primaryKwhEpM2: null, costEuros: null, energySource: null },
    TOTAL: result["TOTAL"] || { finalKwhAn: null, primaryKwhEpM2: null, costEuros: null, energySource: null },
  };
}

// ─── BAO Evolution SED: Scenario parser ─────────────────────────────────────

interface ScenarioResult {
  code: string;
  conseils: string;
  investissement: number | null;
  tempsRetour: number | null;
  totalKwhEpM2: number | null;
  totalCo2KgM2: number | null;
  totalDepenseAnnuelle: number | null;
  totalMWhEp: number | null;
  co2TonnesAn: number | null;
  thceCepM2: number | null;
  thceGesKgM2: number | null;
  cefKwhAn: number | null;
}

function parseScenarios(text: string): ScenarioResult[] {
  const scenarios: ScenarioResult[] = [];
  const modifRegex = /DESCRIPTIF DE LA MODIFICATION n° (\d+)\s[\s\S]*?Modification\s*:\s*(\w+)[\s\S]*?Conseils\s+([\s\S]*?)(?:Avertissement|DESCRIPTIF DE LA MODIFICATION)/gi;

  let match;
  while ((match = modifRegex.exec(text)) !== null) {
    const modifNum = parseInt(match[1], 10);
    const code = match[2].trim();
    const conseilsRaw = match[3];

    const conseils = conseilsRaw
      .split(/\s*-\s*/)
      .map((s) => s.trim())
      .filter((s) => s.length > 3)
      .join(" / ");

    // Find the scenario results section (after Variante X : CODE)
    // Search for the modification results block
    const variantePattern = new RegExp(
      `${code}\\s*(?:Modification prioritaire)?\\s*Bâtiment[\\s\\S]*?Investissements\\s*:\\s*([\\d\\s]+)\\s*€\\s*Temps de retour\\s*:\\s*([\\d,]+)`,
      "i"
    );
    const varianteMatch = text.match(variantePattern);
    const investissement = varianteMatch ? parseNum(varianteMatch[1]) : null;
    const tempsRetour = varianteMatch ? parseNum(varianteMatch[2]) : null;

    // Find total kWhEP/m².an for this modification
    const totalEpPattern = new RegExp(
      `ETIQUETTE DPE de la MODIFICATION ${modifNum}[\\s\\S]{0,300}?Consommation\\s*:\\s*([\\d,]+)\\s*KWhEP\\/m²`,
      "i"
    );
    const totalEpMatch = text.match(totalEpPattern);
    const totalKwhEpM2 = totalEpMatch ? parseNum(totalEpMatch[1]) : null;

    // Find GES for this modification
    const gesPattern = new RegExp(
      `ETIQUETTE DPE de la MODIFICATION ${modifNum}[\\s\\S]{0,400}?Emission de GES\\s*:\\s*([\\d,]+)\\s*kgéqCO2`,
      "i"
    );
    const gesMatch = text.match(gesPattern);
    const totalCo2KgM2 = gesMatch ? parseNum(gesMatch[1]) : null;

    // Total dépense annuelle for this modification
    const depPattern = new RegExp(
      `TOTAL DEPENSE ANNUEL[\\s\\S]{0,50}?([\\d\\s,]+)\\s*\\n[\\s\\S]{0,200}?Bilan Energétique[\\s\\S]{0,200}?TOTAL  MWhEP\\/an\\s*:\\s*([\\d,]+)[\\s\\S]{0,50}?TOTAL  \\(tonnes\\)\\s*:\\s*([\\d,]+)[\\s\\S]{0,50}?TOTAL  kWhEP\\/m²\\.an\\s*:\\s*([\\d,]+)`,
      "i"
    );

    // Simpler approach: find the modification N depense/bilan block
    const bilanPattern = new RegExp(
      `Variante ${modifNum}\\s*:[\\s\\S]{0,3000}?TOTAL  MWhEP\\/an\\s*:\\s*([\\d,]+)[\\s\\S]{0,100}?TOTAL  \\(tonnes\\)\\s*:\\s*([\\d,]+)`,
      "i"
    );
    const bilanMatch = text.match(bilanPattern);
    const totalMWhEp = bilanMatch ? parseNum(bilanMatch[1]) : null;
    const co2TonnesAn = bilanMatch ? parseNum(bilanMatch[2]) : null;

    const depensePattern = new RegExp(
      `Variante ${modifNum}\\s*:[\\s\\S]{0,5000}?TOTAL DEPENSE ANNUEL[\\s\\S]{0,100}?([\\d\\s,]+)`,
      "i"
    );
    const depenseMatch = text.match(depensePattern);
    const totalDepenseStr = depenseMatch ? depenseMatch[1].trim() : null;
    const totalDepenseAnnuelle = totalDepenseStr ? parseNum(totalDepenseStr) : null;

    if (code && conseils) {
      scenarios.push({
        code,
        conseils,
        investissement,
        tempsRetour,
        totalKwhEpM2,
        totalCo2KgM2,
        totalDepenseAnnuelle,
        totalMWhEp,
        co2TonnesAn,
        thceCepM2: null,
        thceGesKgM2: null,
        cefKwhAn: null,
      });
    }
  }

  // Enrich each scenario with Th-C-E Bilan Energétique data
  // The Bilan sections appear in order: #0 = ETAT INITIAL, #1 = MODIFICATION 1, etc.
  const bilanPositions: number[] = [];
  let bSearch = 0;
  while (true) {
    const found = text.indexOf("Bilan Energétique", bSearch);
    if (found === -1) break;
    bilanPositions.push(found);
    bSearch = found + 1;
  }

  for (let i = 0; i < scenarios.length; i++) {
    const bilanIdx = bilanPositions[i + 1];
    if (bilanIdx !== undefined) {
      // Text after Bilan Energétique: TOTAL MWhEP, kWhEP/m².an, kg/m²
      const afterBlock = text.slice(bilanIdx, bilanIdx + 600);
      const cepM = afterBlock.match(/TOTAL\s+kWhEP\/m²\.an\s*:\s*([\d,\s]+)/);
      const gesM = afterBlock.match(/TOTAL\s+\(kg\/m²\)\s*:\s*([\d,\s]+)/);
      if (cepM) scenarios[i].thceCepM2 = parseNum(cepM[1]);
      if (gesM) scenarios[i].thceGesKgM2 = parseNum(gesM[1]);

      // Text before Bilan Energétique: TOTAL DEPENSE ANNUEL + CEF total kWh/an
      const beforeBlock = text.slice(Math.max(0, bilanIdx - 1500), bilanIdx);
      // CEF: the last standalone TOTAL row before Bilan holds [kWh/an finale, kWhEP/m²/an, €]
      const cefMatches = [...beforeBlock.matchAll(/\nTOTAL\s*\n\s*([\d\s,\.]+)\s*\n/g)];
      if (cefMatches.length > 0) {
        const lastCefVal = cefMatches[cefMatches.length - 1][1];
        scenarios[i].cefKwhAn = parseNum(lastCefVal);
      }
      const depM = beforeBlock.match(/TOTAL DEPENSE ANNUEL[\s\n]+([0-9\s,]+)/);
      if (depM && scenarios[i].totalDepenseAnnuelle === null) {
        scenarios[i].totalDepenseAnnuelle = parseNum(depM[1]);
      }
    }
  }

  return scenarios;
}

// ─── BAO Metadata: bureau/client info, synthèse table, travaux ───────────────

function extractSeqNumbers(section: string, n: number): (number | null)[] {
  const nums: (number | null)[] = [];
  const pattern = /(?<!\w)([\d][\d\s]*[,.][\d]+|[\d]{4,}[\d\s]*)/g;
  let m;
  while ((m = pattern.exec(section)) !== null && nums.length < n) {
    const val = parseNum(m[1]);
    if (val !== null && val > 0) nums.push(val);
  }
  while (nums.length < n) nums.push(null);
  return nums;
}

function parseBureauInfo(text: string): Partial<BaoMetadata> {
  const header = text.substring(0, Math.min(text.length, 4000));

  const bureauEtudes = extractField(header, "BUREAU D'ETUDES") ||
    extractField(header, "BUREAU D'ÉTUDES") ||
    extractField(header, "Bureau d'études");
  const bureauAdresse = extractField(header, "ADRESSE");
  const bureauEmail = extractField(header, "EMAIL");
  const bureauTelephone = extractField(header, "NUMERO TELEPHONE") ||
    extractField(header, "NUMÉRO TÉLÉPHONE") ||
    extractField(header, "Téléphone") ||
    extractField(header, "Telephone");
  const siret = extractField(header, "SIRET");
  const qualification = extractField(header, "QUALIFICATION");

  const maitreDoeuvre = extractField(header, "MAITRE D'ŒUVRE") ||
    extractField(header, "MAITRE D'OEUVRE") ||
    extractField(header, "Maître d'œuvre") ||
    extractField(header, "Maître d'oeuvre");
  const client = extractField(header, "CLIENT") ||
    extractField(header, "Bénéficiaire") ||
    extractField(header, "Beneficiaire");
  const adresseClient = extractField(header, "ADRESSE CLIENT") ||
    (/CLIENT\s*:\s*[^\n]+\s*\nADRESSE\s*:\s*([^\n]+)/i.exec(text)?.[1] ?? null);

  const dateVisite = extractField(header, "DATE DE LA VISITE") ||
    extractField(header, "Date de la visite");
  const dateRealisation = extractField(header, "DATE DE REALISATION") ||
    extractField(header, "DATE DE RÉALISATION") ||
    extractField(header, "Date de réalisation");
  const dateRestitution = extractField(header, "DATE DE RESTITUTION") ||
    extractField(header, "Date de restitution");
  const reference = extractField(header, "REFERENCE") ||
    extractField(header, "RÉFÉRENCE") ||
    extractField(header, "Référence");
  const tExtBase = extractField(header, "T° Ext de Base") ||
    extractField(text, "Température extérieure de base");
  const rendementInitial = extractField(header, "Rendement initial") ||
    extractField(text, "Rendement initial");

  return {
    bureauEtudes: bureauEtudes?.replace(/\s+/g, " ").trim() || null,
    bureauAdresse: bureauAdresse?.trim() || null,
    bureauEmail: bureauEmail?.trim() || null,
    bureauTelephone: bureauTelephone?.trim() || null,
    siret: siret?.trim() || null,
    qualification: qualification?.trim() || null,
    maitreDoeuvre: maitreDoeuvre?.replace(/\s+/g, " ").trim() || null,
    beneficiaire: client?.replace(/\s+/g, " ").trim() || null,
    adresseClient: adresseClient?.trim() || null,
    dateVisite: dateVisite?.trim() || null,
    dateRealisation: dateRealisation?.trim() || null,
    dateRestitution: dateRestitution?.trim() || null,
    reference: reference?.trim() || null,
    tExtBase: tExtBase?.trim() || null,
    rendementInitial: rendementInitial?.trim() || null,
  };
}

function parseSyntheseTable(text: string): Partial<BaoMetadata> {
  const result: Partial<BaoMetadata> = {};

  // Find the SYNTHESE AUDIT ENERGETIQUE GLOBALE section
  const synStart = text.search(/SYNTHESE\s+AUDIT\s+ENER/i);
  if (synStart < 0) return result;

  // Take a generous slice up to the first SCENARIO keyword
  const synEnd = text.search(/SC[EÉ]NARIO\s+1/i);
  const synSection = text.slice(synStart, synEnd > synStart ? synEnd : synStart + 8000);

  // ── Conso 3 usages: 8 numbers (CEF_init, CEP_init, CEF_sc1, CEP_sc1, CEF_sc2, CEP_sc2, CEF_sc3, CEP_sc3)
  const conso3Idx = synSection.search(/Conso\s*\(3\s*usages?\)/i);
  if (conso3Idx >= 0) {
    const slice3 = synSection.slice(conso3Idx, conso3Idx + 600);
    const nums3 = extractSeqNumbers(slice3, 8);
    result.cef3UsagesInitial = nums3[0];
    result.cep3UsagesInitial = nums3[1];
  }

  // ── Conso 5 usages (note: PDF has typo "ussges")
  const conso5Idx = synSection.search(/Conso\s*\(5\s*us+ages?\)/i);
  if (conso5Idx >= 0) {
    const slice5 = synSection.slice(conso5Idx, conso5Idx + 600);
    const nums5 = extractSeqNumbers(slice5, 8);
    result.cef5UsagesInitial = nums5[0];
    result.cep5UsagesInitial = nums5[1];
  }

  // ── GES (kgCO2/m².an) — first value is initial state
  const gesIdx = synSection.search(/GES\s*\[kgCO2/i);
  if (gesIdx >= 0) {
    const sliceGes = synSection.slice(gesIdx, gesIdx + 300);
    const gesNums = extractSeqNumbers(sliceGes, 4);
    result.gesInitialKgCo2M2 = gesNums[0];
  }

  // ── Per-scenario values (3 values each for sc1, sc2, sc3)
  const scResults: NonNullable<BaoMetadata["scenarios"]> = [];
  for (let sc = 1; sc <= 4; sc++) {
    scResults.push({ index: sc, travaux: [] });
  }

  // Gain économique [€]/an — 3 values (sc1, sc2, sc3)
  const gainEcoIdx = synSection.search(/Gain\s*[eé]conomique/i);
  if (gainEcoIdx >= 0) {
    const sliceGE = synSection.slice(gainEcoIdx, gainEcoIdx + 400);
    const geNums = extractSeqNumbers(sliceGE, 3);
    for (let sc = 0; sc < 3; sc++) {
      scResults[sc].gainEconomiqueEur = geNums[sc];
    }
  }

  // Taux ENR & R — 3 percentage values
  const enrIdx = synSection.search(/Taux\s+ENR/i);
  if (enrIdx >= 0) {
    const sliceEnr = synSection.slice(enrIdx, enrIdx + 300);
    const enrNums = extractSeqNumbers(sliceEnr, 3);
    for (let sc = 0; sc < 3; sc++) {
      scResults[sc].tauxEnrRPct = enrNums[sc];
    }
  }

  // Gain énergétique — 3 percentage values
  const gainEnIdx = synSection.search(/Gain\s+[eé]nerg[eé]tique/i);
  if (gainEnIdx >= 0) {
    const sliceGEn = synSection.slice(gainEnIdx, gainEnIdx + 300);
    const genNums = extractSeqNumbers(sliceGEn, 3);
    for (let sc = 0; sc < 3; sc++) {
      scResults[sc].gainEnergetiquePct = genNums[sc];
    }
  }

  // Prime BAR-TH-145 [€] — 3 values
  const primeEuroIdx = synSection.search(/Prime\s+BAR-TH-145(?!\s*\[KWh)/i);
  if (primeEuroIdx >= 0) {
    const slicePrime = synSection.slice(primeEuroIdx, primeEuroIdx + 500);
    const primeNums = extractSeqNumbers(slicePrime, 4);
    // Detect if 1st value or skip (if 0 it means that scenario has <50% ENR)
    const nonZero = primeNums.filter((v) => v !== null && v > 0);
    for (let sc = 0; sc < 3; sc++) {
      scResults[sc].primeBarTh145Euros = nonZero[sc] ?? null;
    }
  }

  // Prime BAR-TH-145 [KWhcumac] — pick lines with KWhcumac
  const primeKwhIdx = synSection.search(/Prime\s+BAR-TH-145\s*\[KWhcumac\]/i);
  if (primeKwhIdx >= 0) {
    const slicePK = synSection.slice(primeKwhIdx, primeKwhIdx + 600);
    const pkNums = extractSeqNumbers(slicePK, 3);
    for (let sc = 0; sc < 3; sc++) {
      if (pkNums[sc] !== null) scResults[sc].primeBarTh145KWhcumac = pkNums[sc];
    }
  }

  // Totaux kWh EF/an pour la table usage (3 usages: chauffage + refroid + ECS)
  const totalRowIdx = synSection.search(/^\s*Total\b/im);
  if (totalRowIdx >= 0) {
    const sliceTot = synSection.slice(totalRowIdx, totalRowIdx + 500);
    const totNums = extractSeqNumbers(sliceTot, 4);
    // Index 0 = initial, 1 = sc1, 2 = sc2, 3 = sc3
    for (let sc = 0; sc < 3; sc++) {
      scResults[sc].totalKwhEfAn = totNums[sc + 1];
    }
  }

  // GES per scenario from the GES row (4 values: init, sc1, sc2, sc3)
  if (gesIdx >= 0) {
    const sliceGes2 = synSection.slice(gesIdx, gesIdx + 400);
    const ges4 = extractSeqNumbers(sliceGes2, 4);
    for (let sc = 0; sc < 3; sc++) {
      scResults[sc].gesCo2KgM2 = ges4[sc + 1];
    }
  }

  // Conso 3 usages CEF/CEP per scenario from the sequential numbers
  if (conso3Idx >= 0) {
    const slice3 = synSection.slice(conso3Idx, conso3Idx + 600);
    const nums3 = extractSeqNumbers(slice3, 8);
    for (let sc = 0; sc < 3; sc++) {
      scResults[sc].cef3KwhEfM2 = nums3[(sc + 1) * 2];
      scResults[sc].cep3KwhEpM2 = nums3[(sc + 1) * 2 + 1];
    }
  }

  // Conso 5 usages CEF/CEP per scenario
  if (conso5Idx >= 0) {
    const slice5 = synSection.slice(conso5Idx, conso5Idx + 600);
    const nums5 = extractSeqNumbers(slice5, 8);
    for (let sc = 0; sc < 3; sc++) {
      scResults[sc].cef5KwhEfM2 = nums5[(sc + 1) * 2];
      scResults[sc].cep5KwhEpM2 = nums5[(sc + 1) * 2 + 1];
    }
  }

  result.scenarios = scResults.filter((s) => s.index <= 4);
  return result;
}

function parseFormattedScenarioPages(text: string): BaoMetadata["scenarios"] {
  const results: NonNullable<BaoMetadata["scenarios"]> = [];

  for (let scNum = 1; scNum <= 5; scNum++) {
    const scPattern = new RegExp(
      `SC[EÉ]NARIO\\s+${scNum}[^\\d][\\s\\S]{0,100}?(?=SC[EÉ]NARIO\\s+${scNum + 1}[^\\d]|CARACTERISTIQUES|IV\\.|PLAN|$)`,
      "i"
    );
    const scMatch = text.match(scPattern);
    if (!scMatch) break;
    const scText = scMatch[0];

    // Extract travaux bullet points
    const travaux: string[] = [];
    const travauxIdx = scText.search(/\bTRAVAUX\b/i);
    if (travauxIdx >= 0) {
      const travauxSection = scText.slice(travauxIdx, travauxIdx + 3000);
      const bulletLines = travauxSection.split(/\n/).map((l) => l.trim());
      for (const line of bulletLines) {
        if (/^[▪•\-\*]\s*\S/.test(line)) {
          const cleaned = line.replace(/^[▪•\-\*]\s*/, "").trim();
          if (cleaned.length > 8) travaux.push(cleaned);
        } else if (/^Les diff/.test(line) || /^Remplacement|^Mise en place|^Installation|^Isolation/i.test(line)) {
          // Some PDFs drop the bullet char; capture work items directly
          if (line.length > 10) travaux.push(line);
        }
      }
    }

    // Current state fields
    const isolToitures = extractField(scText, "Isolation des toitures") ||
      extractField(scText, "Isolations des toitures");
    const isolMurs = extractField(scText, "Isolations des murs") ||
      extractField(scText, "Isolation des murs");
    const isolPlancher = extractField(scText, "Isolations du plancher bas") ||
      extractField(scText, "Isolation du plancher bas");
    const energieChauffage = extractField(scText, "Énergie de chauffage principal") ||
      extractField(scText, "Energie de chauffage principal");

    // DPE label per scenario from the scenario page summary table
    const cepM = scText.match(/CEP\s*\[KWh\/m2\.an\]\s*:\s*([\d,]+)/i);
    const cepVal = cepM ? parseNum(cepM[1]) : null;
    const labelDpe = cepVal ? mapDpeLabel(cepVal) : null;

    // Total dépense per scenario (from scenario consumption page)
    const depPattern = /TOTAL\s+DEPENSE\s+ANNUEL[^\d]*([\d\s,]+)/i;
    const depMatch = scText.match(depPattern);
    const totalDepense = depMatch ? parseNum(depMatch[1]) : null;

    results.push({
      index: scNum,
      travaux,
      isolationToitures: isolToitures || null,
      isolationMurs: isolMurs || null,
      isolationPlancherBas: isolPlancher || null,
      energieChauffagePrincipal: energieChauffage || null,
      labelDpe,
      totalDepenseAnnuelle: totalDepense,
    });
  }

  return results;
}

function mergeSyntheseIntoScenarios(
  synScenarios: NonNullable<BaoMetadata["scenarios"]>,
  pageScenarios: NonNullable<BaoMetadata["scenarios"]>
): NonNullable<BaoMetadata["scenarios"]> {
  const maxIdx = Math.max(synScenarios.length, pageScenarios.length);
  const merged: NonNullable<BaoMetadata["scenarios"]> = [];
  for (let i = 0; i < maxIdx; i++) {
    const syn = synScenarios[i] ?? { index: i + 1, travaux: [] };
    const pg = pageScenarios[i] ?? { index: i + 1, travaux: [] };
    merged.push({
      ...syn,
      ...pg,
      travaux: pg.travaux.length > 0 ? pg.travaux : syn.travaux,
      gainEconomiqueEur: syn.gainEconomiqueEur ?? null,
      tauxEnrRPct: syn.tauxEnrRPct ?? null,
      gainEnergetiquePct: syn.gainEnergetiquePct ?? null,
      primeBarTh145Euros: syn.primeBarTh145Euros ?? null,
      primeBarTh145KWhcumac: syn.primeBarTh145KWhcumac ?? null,
      cef3KwhEfM2: syn.cef3KwhEfM2 ?? null,
      cep3KwhEpM2: syn.cep3KwhEpM2 ?? null,
      cef5KwhEfM2: syn.cef5KwhEfM2 ?? null,
      cep5KwhEpM2: syn.cep5KwhEpM2 ?? null,
      gesCo2KgM2: syn.gesCo2KgM2 ?? null,
      totalKwhEfAn: syn.totalKwhEfAn ?? null,
    });
  }
  return merged;
}

// ─── BAO Evolution SED specialized parser ───────────────────────────────────

function extractField(text: string, fieldName: string): string | null {
  const escaped = fieldName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const pattern = new RegExp(escaped + "\\s*:\\s*([^\\n\\r]+)", "i");
  const match = text.match(pattern);
  return match ? match[1].trim() : null;
}

function parseBaoEvolutionSed(text: string): ExtractedAuditData {
  const rawFields: RawField[] = [];

  // ── 1. DONNEES TECHNIQUES fields
  const zoneClimatique = extractField(text, "Zone climatique");
  const dept = extractField(text, "Département sélectionné");
  const typeBatiment = extractField(text, "Type de bâtiment");
  const anneeConstruction = extractField(text, "Année de construction");
  const altitude = extractField(text, "Altitude");
  const stationMeteo = extractField(text, "Station météo");
  const degreesJours = extractField(text, "Degrés-jours base 18°C");
  const tempBase = extractField(text, "Température extérieure de base");
  const bordureMer = extractField(text, "Bordure de mer");

  // ── 2. Building surfaces
  const surfaceHabitableMatch = text.match(/Surface habitable\s*:\s*([\d\s,]+)\s*m²/);
  const surfaceSHONMatch = text.match(/Surface\s*(?:Shon|SHON)\s*:\s*([\d\s,]+)\s*m²/);
  const surfaceVitreedMatch = text.match(/Surface vitrée totale\s*\n?\s*([\d\s,]+)/);
  const niveauxMatch = text.match(/Nombre de niveau\s*:\s*(\d+)/);
  const hauteurMatch = text.match(/Hauteur du bâtiment\s*:\s*([\d,]+)\s*m/);

  // ── 3. Consumption table from ETAT INITIAL
  const consumptionTable = parseEtatInitialSection(text);

  // ── 4. ETIQUETTE DPE (état initial - first occurrence, from 3CL method)
  const dpeConsomMatch = text.match(
    /ETIQUETTE DPE de l'ETAT INITIAL[\s\S]{0,200}?Consommation\s*:\s*([\d,]+)\s*KWhEP\/m²\.an/i
  );
  const dpeGesMatch = text.match(
    /ETIQUETTE DPE de l'ETAT INITIAL[\s\S]{0,200}?Emission de GES\s*:\s*([\d,]+)\s*kgéqCO2\/m²\.an/i
  );
  const dpeMethMatch = text.match(/(Méthode 3CL[^\n]+)/i);

  // ── 5. Bilan CO2 (from Th-C-E calculation - ETAT INITIAL)
  const totalCo2TonnesMatch = text.match(
    /ETAT INITIAL[\s\S]{0,2000}?TOTAL\s+\(tonnes\)\s*:\s*([\d\s,]+)/
  );
  const totalCo2KgM2Match = text.match(
    /ETAT INITIAL[\s\S]{0,2000}?TOTAL\s+\(kg\/m²\)\s*:\s*([\d\s,]+)/
  );

  // ── 6. Total dépense annuelle (état initial)
  const totalDepenseMatch = text.match(
    /ETAT INITIAL[\s\S]{0,3000}?TOTAL DEPENSE ANNUEL[\s\S]{0,50}?([\d\s,]+)\s*\n/
  );

  // ── 7. Total kWhEP/m².an (Th-C-E method, état initial)
  const totalEPMatch = text.match(
    /ETAT INITIAL[\s\S]{0,2000}?TOTAL\s+kWhEP\/m²\.an\s*:\s*([\d\s,]+)/
  );
  const totalMWhMatch = text.match(
    /ETAT INITIAL[\s\S]{0,2000}?TOTAL\s+MWhEP\/an\s*:\s*([\d\s,]+)/
  );

  // ── 8. Wall / envelope from DETAILS DES PAROIS section
  // Use "Parois MEX-X" code pattern to find the right section
  const murExtDescMatch = text.match(
    /Parois ME[\w-]+[\s\S]{0,400}?Descriptif\s*:\s*([^\n\r]+)/
  );
  const plafondDescMatch = text.match(
    /Parois Ph[\w-]+[\s\S]{0,400}?Descriptif\s*:\s*([^\n\r]+)/
  );
  const plancherDescMatch = text.match(
    /Parois Pb[\w-]+[\s\S]{0,400}?Descriptif\s*:\s*([^\n\r]+)/
  );

  // Extract U values for walls/roof/floor from DETAILS sections
  const wallUMatch = text.match(
    /Parois ME[\w-]+[\s\S]{0,800}?U retenu\s*:\s*([\d,]+)\s*W\/m²\.°C/
  );
  const roofUMatch = text.match(
    /Parois Ph[\w-]+[\s\S]{0,800}?U retenu\s*:\s*([\d,]+)\s*W\/m²\.°C/
  );

  // Window type
  const vitrageMatch = text.match(/(Fenêtre PVC|Fenêtre Bois|Fenêtre Alu|Porte fenêtre PVC|Porte fenêtre Bois)/);

  // ── 9. HVAC systems
  const heatingSystemMatch = text.match(
    /6-0[1-9]-0[1-9]\] Générateur\s*:\s*(.*?)(?:\n|\r)/
  );
  const generateurTypeMatch = text.match(
    /Type de générateur\s*:\s*(CHAUDIÈRE?[^\n]+|POMPE[^\n]+|CHAUDIERE[^\n]+|POILE[^\n]+)/i
  );
  const ventilationTypeMatch = text.match(/Type de ventilation\s*:\s*(.*?)(?:\n|\r)/);
  const ecsTypeMatch = text.match(/Type d'ECS\s*:\s*(.*?)(?:\n|\r)/);
  const eerMatch = text.match(/Eer nominal\s*:\s*([\d,]+)/);
  const copMatch = text.match(/Cop nominal\s*:\s*([\d,]+)/i);

  // ── 10. Building name - try to find the project title
  let buildingName: string | null = null;
  // Look for an all-caps project identifier like "LES PALAOS_AYD" before the first section
  const preSection = text.substring(0, text.indexOf("DONNEES TECHNIQUES"));
  // Pattern: name appears before "tel" keyword on the same line, or on its own line
  const nameMatch =
    preSection.match(/\n\s*([A-Z][A-Z0-9_'.\- ]{3,60})\s*tel\s*:/im) ||
    preSection.match(/\n\s*([A-Z][A-Z0-9_'.\- ]{3,60})\s*\n/m);
  if (nameMatch) {
    const candidate = nameMatch[1].trim();
    const excluded = /^(TEL|FAX|REF|MAITRE|ARCHITECTE|CONCEPTEUR|BUREAU|DATE|DU|LE|LA|LES)$/i;
    if (candidate.length > 4 && !excluded.test(candidate)) {
      buildingName = candidate;
    }
  }
  // Also look for "Etude" reference pattern: "Référence : Etude" then project name
  if (!buildingName) {
    const etudeMatch = preSection.match(/Référence[^\n]*\n[^\n]*\n\s*([A-Z][A-Z0-9_'\- ]{3,60})\s*\n/im);
    if (etudeMatch) buildingName = etudeMatch[1].trim();
  }

  // ── 11. Scenarios
  const scenarios = parseScenarios(text);

  // ── 11b. Ubat / Déperditions
  const ubat = parseUbatSection(text);

  // ── 11c. BAO Metadata (bureau, synthèse table, travaux per scenario)
  const bureauInfo = parseBureauInfo(text);
  const syntheseData = parseSyntheseTable(text);
  const formattedScPages = parseFormattedScenarioPages(text);
  const synScenarios = syntheseData.scenarios ?? [];
  const mergedScenarios = mergeSyntheseIntoScenarios(synScenarios, formattedScPages);
  const metadata: BaoMetadata = {
    ...bureauInfo,
    cef3UsagesInitial: syntheseData.cef3UsagesInitial ?? null,
    cep3UsagesInitial: syntheseData.cep3UsagesInitial ?? null,
    cef5UsagesInitial: syntheseData.cef5UsagesInitial ?? null,
    cep5UsagesInitial: syntheseData.cep5UsagesInitial ?? null,
    gesInitialKgCo2M2: syntheseData.gesInitialKgCo2M2 ?? null,
    scenarios: mergedScenarios.length > 0 ? mergedScenarios : undefined,
  };

  // ── 12. Build rawFields for display
  const addField = (key: string, value: string | null | undefined, section: string) => {
    if (value && value.trim()) rawFields.push({ key, value: value.trim(), section });
  };

  addField("Département", dept, "DONNÉES TECHNIQUES");
  addField("Zone climatique", zoneClimatique, "DONNÉES TECHNIQUES");
  addField("Station météo", stationMeteo, "DONNÉES TECHNIQUES");
  addField("Température extérieure de base", tempBase, "DONNÉES TECHNIQUES");
  addField("Degrés-jours base 18°C", degreesJours, "DONNÉES TECHNIQUES");
  addField("Altitude", altitude, "DONNÉES TECHNIQUES");
  addField("Bordure de mer", bordureMer, "DONNÉES TECHNIQUES");
  addField("Type de bâtiment", typeBatiment, "DONNÉES TECHNIQUES");
  addField("Année de construction", anneeConstruction, "DONNÉES TECHNIQUES");

  if (surfaceHabitableMatch) addField("Surface habitable", surfaceHabitableMatch[1].trim() + " m²", "BÂTIMENT");
  if (surfaceSHONMatch) addField("Surface SHON", surfaceSHONMatch[1].trim() + " m²", "BÂTIMENT");
  if (niveauxMatch) addField("Nombre de niveaux", niveauxMatch[1], "BÂTIMENT");
  if (hauteurMatch) addField("Hauteur du bâtiment", hauteurMatch[1] + " m", "BÂTIMENT");
  if (surfaceVitreedMatch) addField("Surface vitrée totale", surfaceVitreedMatch[1].trim() + " m²", "BÂTIMENT");

  if (consumptionTable) {
    const consoPostes: Array<{ tableKey: keyof ConsumptionTable; label: string }> = [
      { tableKey: "CHAUFFAGE", label: "Chauffage" },
      { tableKey: "REFROIDISSEMENT", label: "Refroidissement" },
      { tableKey: "ECS", label: "ECS" },
      { tableKey: "ECLAIRAGE", label: "Éclairage" },
      { tableKey: "AUXILIAIRES", label: "Auxiliaires" },
    ];
    for (const { tableKey, label } of consoPostes) {
      const post = consumptionTable[tableKey];
      if (post.energySource) addField(`${label} - Source d'énergie`, post.energySource, "CONSOMMATIONS");
      if (post.finalKwhAn !== null) addField(`${label} - Énergie finale`, post.finalKwhAn.toLocaleString("fr-FR") + " kWh/an", "CONSOMMATIONS");
      if (post.primaryKwhEpM2 !== null) addField(`${label} - Énergie primaire`, post.primaryKwhEpM2.toLocaleString("fr-FR") + " kWhEP/m²/an", "CONSOMMATIONS");
      if (post.costEuros !== null) addField(`${label} - Coût`, post.costEuros.toLocaleString("fr-FR") + " €/an", "CONSOMMATIONS");
    }
  }

  if (totalEPMatch) addField("Total énergie primaire (Th-C-E)", totalEPMatch[1].trim() + " kWhEP/m².an", "CONSOMMATIONS");
  if (totalMWhMatch) addField("Total MWhEP/an", totalMWhMatch[1].trim(), "CONSOMMATIONS");
  // CEF initial: total finale kWh/an ÷ surface habitable
  {
    const surfHabInline = surfaceHabitableMatch ? parseNum(surfaceHabitableMatch[1]) : null;
    const cefTotalKwhAn = consumptionTable?.TOTAL.finalKwhAn ?? null;
    if (cefTotalKwhAn !== null && surfHabInline !== null && surfHabInline > 0) {
      const cefM2 = cefTotalKwhAn / surfHabInline;
      addField("CEF initial (Th-C-E)", cefM2.toLocaleString("fr-FR", { maximumFractionDigits: 1 }) + " kWhef/m².an", "CONSOMMATIONS");
    }
  }
  if (totalDepenseMatch) addField("Total dépense annuelle", totalDepenseMatch[1].trim() + " €", "COÛTS");
  if (totalCo2TonnesMatch) addField("CO2 total (tonnes CO2éq/an)", totalCo2TonnesMatch[1].trim(), "BILAN CO2");
  if (totalCo2KgM2Match) addField("CO2 par m² (kg CO2éq/m²/an)", totalCo2KgM2Match[1].trim(), "BILAN CO2");
  if (dpeConsomMatch) addField("Consommation DPE 3CL", dpeConsomMatch[1] + " kWhEP/m².an", "ETIQUETTE DPE");
  if (dpeGesMatch) addField("Émission GES DPE 3CL", dpeGesMatch[1] + " kgéqCO2/m².an", "ETIQUETTE DPE");
  if (dpeMethMatch) addField("Méthode de calcul", dpeMethMatch[1], "ETIQUETTE DPE");

  addField("Isolation murs", murExtDescMatch ? murExtDescMatch[1] + (wallUMatch ? ` (U=${wallUMatch[1]} W/m².°C)` : "") : null, "ENVELOPPE");
  addField("Isolation toiture", plafondDescMatch ? plafondDescMatch[1] + (roofUMatch ? ` (U=${roofUMatch[1]} W/m².°C)` : "") : null, "ENVELOPPE");
  addField("Isolation plancher", plancherDescMatch ? plancherDescMatch[1] : null, "ENVELOPPE");
  addField("Type de menuiserie", vitrageMatch ? vitrageMatch[0] : null, "ENVELOPPE");

  // UBAT & déperditions rawFields
  if (ubat.coefficient !== null) addField("UBAT - Coefficient", ubat.coefficient.toLocaleString("fr-FR") + " W/m².°C", "UBAT");
  if (ubat.ht !== null) addField("UBAT - HT enveloppe", ubat.ht.toLocaleString("fr-FR") + " W/°C", "UBAT");
  if (ubat.at !== null) addField("UBAT - AT surface déperditive", ubat.at.toLocaleString("fr-FR") + " m²", "UBAT");
  if (ubat.gv !== null) addField("UBAT - GV total", ubat.gv.toLocaleString("fr-FR") + " W/°C", "UBAT");
  if (ubat.deperditionsTotalesKw !== null) addField("UBAT - Déperditions totales", ubat.deperditionsTotalesKw.toLocaleString("fr-FR") + " kW", "UBAT");
  // Répartition déperditions
  if (ubat.hd !== null) addField("Déperditions - HD parois ext.", ubat.hd.toLocaleString("fr-FR") + " W/°C", "RÉPARTITION DÉPERDITIONS");
  if (ubat.hu !== null) addField("Déperditions - HU parois int.", ubat.hu.toLocaleString("fr-FR") + " W/°C", "RÉPARTITION DÉPERDITIONS");
  if (ubat.hs !== null) addField("Déperditions - HS sol", ubat.hs.toLocaleString("fr-FR") + " W/°C", "RÉPARTITION DÉPERDITIONS");
  if (ubat.ventilation !== null) addField("Déperditions - Ventilation", ubat.ventilation.toLocaleString("fr-FR") + " W/°C", "RÉPARTITION DÉPERDITIONS");
  if (ubat.infiltrations !== null) addField("Déperditions - Infiltrations", ubat.infiltrations.toLocaleString("fr-FR") + " W/°C", "RÉPARTITION DÉPERDITIONS");
  // Détail par type d'élément (tableau Ubat)
  if (ubat.mursExt !== null) addField("Ubat - Murs extérieurs (total)", ubat.mursExt.toLocaleString("fr-FR") + " W/°C", "RÉPARTITION DÉPERDITIONS");
  if (ubat.vitrages !== null) addField("Ubat - Vitrages (total)", ubat.vitrages.toLocaleString("fr-FR") + " W/°C", "RÉPARTITION DÉPERDITIONS");
  if (ubat.pontsThermiques !== null) addField("Ubat - Ponts thermiques (total)", ubat.pontsThermiques.toLocaleString("fr-FR") + " W/°C", "RÉPARTITION DÉPERDITIONS");
  if (ubat.portes !== null) addField("Ubat - Portes (total)", ubat.portes.toLocaleString("fr-FR") + " W/°C", "RÉPARTITION DÉPERDITIONS");
  if (ubat.autresParois !== null) addField("Ubat - Autres parois (total)", ubat.autresParois.toLocaleString("fr-FR") + " W/°C", "RÉPARTITION DÉPERDITIONS");

  addField("Système de chauffage", heatingSystemMatch ? heatingSystemMatch[1] : generateurTypeMatch ? generateurTypeMatch[1] : null, "SYSTÈMES CVC");
  addField("Type de ventilation", ventilationTypeMatch ? ventilationTypeMatch[1] : null, "SYSTÈMES CVC");
  addField("Type d'ECS", ecsTypeMatch ? ecsTypeMatch[1] : null, "SYSTÈMES CVC");
  if (eerMatch) addField("EER nominal (PAC)", eerMatch[1], "SYSTÈMES CVC");
  if (copMatch) addField("COP nominal", copMatch[1], "SYSTÈMES CVC");

  // Scenario raw fields
  for (const sc of scenarios) {
    const scSection = `SCÉNARIO ${sc.code}`;
    addField(`${scSection} - Conseils`, sc.conseils, scSection);
    if (sc.investissement !== null) addField(`${scSection} - Investissement`, sc.investissement.toLocaleString("fr-FR") + " €", scSection);
    if (sc.tempsRetour !== null) addField(`${scSection} - Temps de retour`, sc.tempsRetour + " an(s)", scSection);
    if (sc.totalKwhEpM2 !== null) addField(`${scSection} - kWhEP/m².an après`, sc.totalKwhEpM2 + " kWhEP/m².an", scSection);
    if (sc.totalCo2KgM2 !== null) addField(`${scSection} - kgCO2/m² après`, sc.totalCo2KgM2 + " kgéqCO2/m².an", scSection);
    if (sc.totalDepenseAnnuelle !== null) addField(`${scSection} - Dépense annuelle après`, sc.totalDepenseAnnuelle.toLocaleString("fr-FR") + " €/an", scSection);
    if (sc.thceCepM2 !== null) addField(`${scSection} - CEP Th-C-E après`, sc.thceCepM2.toLocaleString("fr-FR") + " kWhEP/m².an", scSection);
    if (sc.thceGesKgM2 !== null) addField(`${scSection} - GES Th-C-E après`, sc.thceGesKgM2.toLocaleString("fr-FR") + " kgCO2/m².an", scSection);
    // CEF par scénario: total finale kWh/an ÷ surface habitable
    if (sc.cefKwhAn !== null) {
      const surfHabSc = surfaceHabitableMatch ? parseNum(surfaceHabitableMatch[1]) : null;
      if (surfHabSc !== null && surfHabSc > 0) {
        const cefM2Sc = sc.cefKwhAn / surfHabSc;
        addField(`${scSection} - CEF Th-C-E après`, cefM2Sc.toLocaleString("fr-FR", { maximumFractionDigits: 1 }) + " kWhef/m².an", scSection);
      }
    }
  }

  // ── 13. Compute final values
  const primaryEP = dpeConsomMatch ? parseNum(dpeConsomMatch[1]) : null;
  const gesValue = dpeGesMatch ? parseNum(dpeGesMatch[1]) : null;
  const surfaceHab = surfaceHabitableMatch ? parseNum(surfaceHabitableMatch[1]) : null;
  const surfaceShon = surfaceSHONMatch ? parseNum(surfaceSHONMatch[1]) : null;

  const dpeLabel = mapDpeLabel(primaryEP);

  const co2Tonnes = totalCo2TonnesMatch ? parseNum(totalCo2TonnesMatch[1]) : null;
  const totalCoutAnnuel = totalDepenseMatch ? parseNum(totalDepenseMatch[1]) : null;

  const windowSurface = surfaceVitreedMatch ? parseNum(surfaceVitreedMatch[1]) : null;

  const recommendations: ExtractedAuditData["recommendations"] = scenarios.map((sc, i) => ({
    category: `Scénario ${sc.code}`,
    description: sc.conseils,
    estimatedSaving:
      totalCoutAnnuel !== null && sc.totalDepenseAnnuelle !== null
        ? Math.round(totalCoutAnnuel - sc.totalDepenseAnnuelle)
        : null,
    estimatedCost: sc.investissement,
    priority: (i === 0 ? "high" : i === 1 ? "medium" : "low") as "high" | "medium" | "low",
    paybackPeriod: sc.tempsRetour,
  }));

  return {
    buildingName,
    buildingAddress: dept
      ? `Département ${dept}${stationMeteo ? ` — Station: ${stationMeteo}` : ""}${altitude ? `, alt. ${altitude}` : ""}`
      : null,
    buildingType: typeBatiment || null,
    constructionYear: anneeConstruction ? extractYear(anneeConstruction) : null,
    totalSurface: surfaceShon || surfaceHab,
    heatedSurface: surfaceHab,
    numberOfFloors: niveauxMatch ? parseInt(niveauxMatch[1], 10) : null,
    numberOfOccupants: null,
    climateZone: zoneClimatique || null,

    totalConsumption: consumptionTable?.TOTAL.finalKwhAn ?? null,
    electricityConsumption: consumptionTable?.REFROIDISSEMENT.finalKwhAn ?? null,
    gasConsumption: null,
    heatingConsumption: consumptionTable?.CHAUFFAGE.finalKwhAn ?? null,
    coolingConsumption: consumptionTable?.REFROIDISSEMENT.finalKwhAn ?? null,
    hotWaterConsumption: consumptionTable?.ECS.finalKwhAn ?? null,
    consumptionUnit: "kWh énergie finale / an",
    consumptionReferenceYear: null,

    totalCost: totalCoutAnnuel,
    electricityCost: null,
    gasCost: consumptionTable?.CHAUFFAGE.costEuros ?? null,
    currency: "EUR",
    costReferenceYear: null,

    totalCo2Emissions: co2Tonnes !== null ? co2Tonnes * 1000 : null,
    electricityCo2Emissions: null,
    gasCo2Emissions: null,
    co2Unit: "kg CO2éq/an",

    wallInsulation:
      murExtDescMatch
        ? `${murExtDescMatch[1].trim()}${wallUMatch ? ` (U=${wallUMatch[1]} W/m².°C)` : ""}`
        : null,
    roofInsulation:
      plafondDescMatch
        ? `${plafondDescMatch[1].trim()}${roofUMatch ? ` (U=${roofUMatch[1]} W/m².°C)` : ""}`
        : null,
    floorInsulation: plancherDescMatch ? plancherDescMatch[1].trim() : null,
    windowType: vitrageMatch ? vitrageMatch[0] : null,
    windowSurface,
    airTightness: null,
    thermalBridges: "Ponts thermiques présents (liaisons mur-plancher, balcons, refends)",

    heatingSystem:
      heatingSystemMatch
        ? heatingSystemMatch[1].trim()
        : generateurTypeMatch
        ? generateurTypeMatch[1].trim()
        : null,
    heatingEfficiency: null,
    coolingSystem: eerMatch ? `Pompe à chaleur air/air (EER=${eerMatch[1]})` : null,
    coolingEfficiency: eerMatch ? parseNum(eerMatch[1]) : null,
    ventilationType: ventilationTypeMatch ? ventilationTypeMatch[1].trim() : null,
    hotWaterSystem: ecsTypeMatch ? ecsTypeMatch[1].trim() : null,

    currentLabel: dpeLabel,
    primaryEnergyConsumption: primaryEP,
    referenceConsumption: null,
    energyIndex: gesValue,

    recommendations,
    rawFields,
    metadata,
    ubatParoisData: ubat.paroisRows.length > 0 ? ubat.paroisRows : null,
  };
}

// ─── Generic fallback parser ─────────────────────────────────────────────────

function parseGenericKeyValues(text: string): RawField[] {
  const rawFields: RawField[] = [];
  const lines = text.split(/\n/).map((l) => l.trim()).filter(Boolean);
  let currentSection: string | null = null;

  for (const line of lines) {
    if (isSectionHeader(line)) {
      currentSection = line;
      continue;
    }
    const colonIdx = line.indexOf(":");
    const equalIdx = line.indexOf("=");
    const tabIdx = line.indexOf("\t");

    let key: string | null = null;
    let value: string | null = null;

    if (colonIdx > 0 && colonIdx < line.length - 1) {
      key = line.substring(0, colonIdx).trim();
      value = line.substring(colonIdx + 1).trim();
    } else if (equalIdx > 0 && equalIdx < line.length - 1) {
      key = line.substring(0, equalIdx).trim();
      value = line.substring(equalIdx + 1).trim();
    } else if (tabIdx > 0) {
      key = line.substring(0, tabIdx).trim();
      value = line.substring(tabIdx + 1).trim();
    }

    if (key && value && key.length < 100 && key.length > 1) {
      rawFields.push({ key, value, section: currentSection });
    }
  }
  return rawFields;
}

const FIELD_MAPPINGS: Record<string, string[]> = {
  buildingName: ["nom du bâtiment", "building name", "dénomination", "nom bâtiment"],
  buildingAddress: ["adresse", "address", "localisation", "département"],
  buildingType: ["type de bâtiment", "building type", "usage", "destination", "affectation"],
  constructionYear: ["année de construction", "construction year", "date de construction"],
  totalSurface: ["surface totale", "surface shon", "shon", "surface plancher"],
  heatedSurface: ["surface habitable", "surface chauffée", "surface utile"],
  numberOfFloors: ["nombre de niveau", "nombre d'étages", "niveaux"],
  climateZone: ["zone climatique", "climate zone"],
  totalConsumption: ["consommation totale", "énergie finale", "total énergie finale"],
  totalCost: ["total dépense annuel", "total depense", "coût total", "dépense totale"],
  totalCo2Emissions: ["co2 total", "émissions co2", "ges total"],
  currentLabel: ["étiquette dpe", "classe énergétique", "label"],
  primaryEnergyConsumption: ["énergie primaire", "consommation dpe", "kwhep/m²"],
  ventilationType: ["type de ventilation"],
  hotWaterSystem: ["type d'ecs", "type ecs"],
};

function buildGenericExtracted(rawFields: RawField[]): ExtractedAuditData {
  const mapped: Record<string, string> = {};
  for (const field of rawFields) {
    const normalized = field.key.toLowerCase().trim();
    for (const [fieldName, variants] of Object.entries(FIELD_MAPPINGS)) {
      if (!mapped[fieldName]) {
        for (const variant of variants) {
          if (normalized.includes(variant) || variant.includes(normalized)) {
            mapped[fieldName] = field.value;
            break;
          }
        }
      }
    }
  }

  const primaryEP = mapped.primaryEnergyConsumption
    ? extractNumber(mapped.primaryEnergyConsumption)
    : null;

  return {
    buildingName: mapped.buildingName || null,
    buildingAddress: mapped.buildingAddress || null,
    buildingType: mapped.buildingType || null,
    constructionYear: mapped.constructionYear ? extractYear(mapped.constructionYear) : null,
    totalSurface: mapped.totalSurface ? extractNumber(mapped.totalSurface) : null,
    heatedSurface: mapped.heatedSurface ? extractNumber(mapped.heatedSurface) : null,
    numberOfFloors: mapped.numberOfFloors ? parseInt(mapped.numberOfFloors, 10) || null : null,
    numberOfOccupants: null,
    climateZone: mapped.climateZone || null,
    totalConsumption: mapped.totalConsumption ? extractNumber(mapped.totalConsumption) : null,
    electricityConsumption: null,
    gasConsumption: null,
    heatingConsumption: null,
    coolingConsumption: null,
    hotWaterConsumption: null,
    consumptionUnit: "kWh/an",
    consumptionReferenceYear: null,
    totalCost: mapped.totalCost ? extractNumber(mapped.totalCost) : null,
    electricityCost: null,
    gasCost: null,
    currency: "EUR",
    costReferenceYear: null,
    totalCo2Emissions: mapped.totalCo2Emissions ? extractNumber(mapped.totalCo2Emissions) : null,
    electricityCo2Emissions: null,
    gasCo2Emissions: null,
    co2Unit: "kg CO2éq/an",
    wallInsulation: null,
    roofInsulation: null,
    floorInsulation: null,
    windowType: null,
    windowSurface: null,
    airTightness: null,
    thermalBridges: null,
    heatingSystem: null,
    heatingEfficiency: null,
    coolingSystem: null,
    coolingEfficiency: null,
    ventilationType: mapped.ventilationType || null,
    hotWaterSystem: mapped.hotWaterSystem || null,
    currentLabel: mapped.currentLabel || mapDpeLabel(primaryEP),
    primaryEnergyConsumption: primaryEP,
    referenceConsumption: null,
    energyIndex: null,
    recommendations: [],
    rawFields,
  };
}

// ─── Format detection ────────────────────────────────────────────────────────

function detectFormat(text: string): "bao-evolution-sed" | "generic" {
  if (
    (text.includes("DONNEES TECHNIQUES") || text.includes("DONNÉES TECHNIQUES")) &&
    (text.includes("Zone climatique") || text.includes("ETIQUETTE DPE") || text.includes("Th-C-E"))
  ) {
    return "bao-evolution-sed";
  }
  return "generic";
}

// ─── Public API ─────────────────────────────────────────────────────────────

export async function extractFromDocx(buffer: Buffer): Promise<ExtractedAuditData> {
  const result = await mammoth.extractRawText({ buffer });
  const text = result.value;
  const format = detectFormat(text);
  if (format === "bao-evolution-sed") {
    return parseBaoEvolutionSed(text);
  }
  const rawFields = parseGenericKeyValues(text);
  return buildGenericExtracted(rawFields);
}

export async function extractFromCsv(buffer: Buffer): Promise<ExtractedAuditData> {
  const content = buffer.toString("utf-8");
  const rawFields: RawField[] = [];

  try {
    const records = csvParse(content, {
      relax_column_count: true,
      skip_empty_lines: true,
      trim: true,
    }) as string[][];

    let currentSection: string | null = null;
    for (const row of records) {
      if (!row || row.length === 0) continue;
      if (row.length === 1 && row[0] && isSectionHeader(row[0])) {
        currentSection = row[0];
        continue;
      }
      if (row.length >= 2 && row[0] && row[1]) {
        rawFields.push({ key: row[0].trim(), value: row[1].trim(), section: currentSection });
      }
    }
  } catch {
    const lines = content.split(/\r?\n/).filter(Boolean);
    let currentSection: string | null = null;
    for (const line of lines) {
      const parts = line.split(/[;,\t]/);
      if (parts.length >= 2 && parts[0] && parts[1]) {
        rawFields.push({ key: parts[0].trim(), value: parts[1].trim(), section: currentSection });
      } else if (parts.length === 1 && parts[0]) {
        currentSection = parts[0].trim();
      }
    }
  }

  return buildGenericExtracted(rawFields);
}
