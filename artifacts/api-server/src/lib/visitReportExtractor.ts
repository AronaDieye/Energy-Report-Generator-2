import type { ExtractedAuditData, RawField } from "./fileExtractor.js";

export interface VisitReportData {
  source: "visit_report";
  score?: string | null;
  preconisation?: string | null;
  preparePar?: string | null;
  telephone?: string | null;
  nombreLocataires?: number | null;
  formeBatiment?: string | null;
  orientationFacade?: string | null;
  nombreAppartements?: string | null;
  anneeGenerateur?: string | null;
  epaisseurMurs?: string | null;
  typeToiture?: string | null;
  surfaceToiture?: string | null;
  compositionMurNord?: string | null;
  isolationMurNord?: string | null;
  compositionMurSud?: string | null;
  isolationMurSud?: string | null;
  compositionMurEst?: string | null;
  isolationMurEst?: string | null;
  compositionMurOuest?: string | null;
  isolationMurOuest?: string | null;
  compositionPlancherBas?: string | null;
  isolationPlancherBas?: string | null;
  positionGenerateur?: string | null;
  dimensionsPieceGenerateur?: string | null;
  typeEcs?: string | null;
  apartments?: Array<{
    numero: number;
    etage: number | null;
    typologie: string | null;
    surface: number | null;
    chauffage: string | null;
    ecs: string | null;
    ventilation: string | null;
    hauteur: string | null;
  }>;
}

// ─── Helpers ───────────────────────────────────────────────────────────────────

function isJunkLine(line: string): boolean {
  if (!line.trim()) return true;
  if (/^Photo\s*\d/i.test(line)) return true;
  if (/Photo\s*\d+Photo\s*\d+/i.test(line)) return true;
  if (line.includes("safetyculture.com")) return true;
  // Unicode noise (checkmarks, symbols that are not real text)
  if (/^[┑☑✅ὪὐἲἮὢ\u0300-\u036f]+$/.test(line)) return true;
  return false;
}

function cleanLines(rawText: string): string[] {
  return rawText
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l.length > 0 && !isJunkLine(l));
}

/**
 * Search for a label (by partial, case-insensitive match) in the line array,
 * and return the next non-junk line value after it.
 * labelSearchStr can be a string (partial match) or a RegExp.
 */
function findValue(
  lines: string[],
  labelSearch: string | RegExp,
  startIdx = 0,
  endIdx?: number
): string | null {
  const limit = endIdx ?? lines.length;
  for (let i = startIdx; i < limit; i++) {
    const matched =
      typeof labelSearch === "string"
        ? lines[i].toLowerCase().includes(labelSearch.toLowerCase())
        : labelSearch.test(lines[i]);
    if (matched) {
      // Return next non-junk, non-label-looking line
      for (let j = i + 1; j < Math.min(i + 5, limit); j++) {
        const candidate = lines[j];
        if (candidate && !isJunkLine(candidate)) {
          return candidate;
        }
      }
    }
  }
  return null;
}

/**
 * Find which line index contains the label.
 */
function findLabelIdx(
  lines: string[],
  labelSearch: string | RegExp,
  startIdx = 0,
  endIdx?: number
): number {
  const limit = endIdx ?? lines.length;
  for (let i = startIdx; i < limit; i++) {
    const matched =
      typeof labelSearch === "string"
        ? lines[i].toLowerCase().includes(labelSearch.toLowerCase())
        : labelSearch.test(lines[i]);
    if (matched) return i;
  }
  return -1;
}

function extractNum(val: string | null | undefined): number | null {
  if (!val) return null;
  const normalized = val.replace(/,/g, ".").replace(/\s/g, "");
  const match = normalized.match(/([\d]+\.?\d*)/);
  if (!match) return null;
  const n = parseFloat(match[1]);
  return isNaN(n) ? null : n;
}

function extractYear(val: string | null | undefined): number | null {
  if (!val) return null;
  const match = val.match(/\b(19|20)\d{2}\b/);
  return match ? parseInt(match[0], 10) : null;
}

// ─── Apartment parser ─────────────────────────────────────────────────────────

function parseApartments(
  lines: string[]
): VisitReportData["apartments"] {
  const apartments: NonNullable<VisitReportData["apartments"]> = [];

  // Find all "Appartement N" line indices
  const aptIndices: number[] = [];
  for (let i = 0; i < lines.length; i++) {
    if (/^Appartement\s+\d+$/.test(lines[i])) {
      aptIndices.push(i);
    }
  }

  for (let a = 0; a < aptIndices.length; a++) {
    const start = aptIndices[a];
    const end = a + 1 < aptIndices.length ? aptIndices[a + 1] : lines.length;
    const numMatch = lines[start].match(/\d+/);
    if (!numMatch) continue;
    const num = parseInt(numMatch[0], 10);

    const etageRaw = findValue(lines, /numéro de l.étage/i, start, end);
    const typologieRaw = findValue(lines, /typologie de l.appartement/i, start, end);
    const surfaceRaw = findValue(lines, /^Surface en m2$/i, start, end);
    const chauffageRaw = findValue(lines, /^Chauffage$/i, start, end);
    const ecsRaw = findValue(lines, /système de production d.ecs/i, start, end);
    const ventilationRaw = findValue(lines, /système de ventilation/i, start, end);
    const hauteurRaw = findValue(lines, /^Hauteur$/i, start, end);

    apartments.push({
      numero: num,
      etage: etageRaw ? extractNum(etageRaw) : null,
      typologie: typologieRaw,
      surface: surfaceRaw ? extractNum(surfaceRaw) : null,
      chauffage: chauffageRaw,
      ecs: ecsRaw,
      ventilation: ventilationRaw,
      hauteur: hauteurRaw,
    });
  }
  return apartments.length > 0 ? apartments : undefined;
}

// ─── Wall isolation parser ─────────────────────────────────────────────────────

function extractWallInsulation(lines: string[]): string | null {
  const isolations: string[] = [];
  const wallLabels = ["Mur Nord", "Mur Sud", "Mur Est", "Mur Ouest"];
  for (const wl of wallLabels) {
    const isoVal = findValue(lines, `${wl}`);
    const isoTypeLine = findValue(lines, /type.*isolation/i);
    if (isoVal) isolations.push(isoVal);
    if (isoTypeLine) isolations.push(isoTypeLine);
  }
  if (isolations.length === 0) return null;
  if (isolations.every((v) => /non\s*isol/i.test(v))) return "Non isolé";
  return isolations.find((v) => !/non\s*isol/i.test(v)) ?? isolations[0];
}

// ─── Main extractor ───────────────────────────────────────────────────────────

export async function extractFromVisitReportPdf(
  buffer: Buffer
): Promise<ExtractedAuditData & { visitReportData: VisitReportData }> {
  // Dynamic import for ESM/CJS compat
  const pdfParse = (await import("pdf-parse")).default;
  const data = await pdfParse(buffer);
  const rawText = data.text;

  const lines = cleanLines(rawText);

  // ── Raw fields (for display/debugging) ───────────────────────────────────
  const rawFields: RawField[] = [];
  for (let i = 0; i + 1 < lines.length; i++) {
    if (!isJunkLine(lines[i + 1])) {
      rawFields.push({ key: lines[i], value: lines[i + 1], section: null });
    }
  }

  // ── Score ─────────────────────────────────────────────────────────────────
  const scoreRaw = rawText.match(/(\d+\s*\/\s*\d+\s*\(\d+\.?\d*%\))/)?.[1] ?? null;

  // ── Section header: Information Générales ─────────────────────────────────
  const buildingName =
    findValue(lines, /nom et pr[eé]nom client/i) ??
    findValue(lines, /nom du client/i);
  const cabinetEtudes = findValue(lines, /cabinet d.[eé]tudes/i);
  const adresse = findValue(lines, /adresse.*code postale/i);
  const dateVisite =
    findValue(lines, /date de pr[eé]visite/i) ??
    findValue(lines, /date de visite/i);
  const preparePar = findValue(lines, /préparé par/i);
  const telephone = findValue(lines, /numéro de téléphone/i);
  const preconisation = findValue(lines, /^Préconisation$/i);

  // Locataires: question may read "Combien y'a t il de locataire"
  const locatairesRaw = findValue(lines, /locataire/i);

  // ── Type de bâtiment ──────────────────────────────────────────────────────
  const buildingType = findValue(lines, /type de b[aâ]timent/i);

  // ── Surface ───────────────────────────────────────────────────────────────
  const surfaceRaw = findValue(lines, /surface habitable/i);
  // "X niveaux" comment following the "Nombre de niveau" question
  const niveauxComment = lines.find((l) => /^\d+\s*niveaux?$/i.test(l));
  const nbNiveauxRaw = findValue(lines, /nombre de niveau/i);

  // Nombre d'appartements: the checkbox "0" is a SafetyCulture artifact, real value is in comment
  const nbAppartsComment = (() => {
    const idx = findLabelIdx(lines, /nombre d.appartements/i);
    if (idx < 0) return null;
    // Look a few lines ahead for the comment that has the real value
    for (let j = idx + 1; j < Math.min(idx + 8, lines.length); j++) {
      if (/appartement|commerce/i.test(lines[j])) return lines[j];
    }
    return findValue(lines, /nombre d.appartements/i);
  })();

  const formeBatiment = findValue(lines, /forme du logement/i);

  // Orientation: label may span two lines
  const orientationFacade = (() => {
    const idx = findLabelIdx(lines, /orientation.*façade/i);
    if (idx < 0) return null;
    // Value comes after "FACADE" continuation line if present
    for (let j = idx + 1; j < Math.min(idx + 5, lines.length); j++) {
      const l = lines[j];
      if (!isJunkLine(l) && !/fa[çc]ade/i.test(l) && !/photo/i.test(l.toLowerCase())) {
        return l;
      }
    }
    return null;
  })();

  const anneeConstRaw =
    findValue(lines, /année de construction/i) ??
    findValue(lines, /ann[eé]e de construction/i);

  // ── Toiture ───────────────────────────────────────────────────────────────
  const typeToiture = (() => {
    if (/toit\s+terrasse/i.test(rawText)) return "Toit terrasse";
    if (/combles?\s+perdus/i.test(rawText)) return "Combles perdus";
    if (/combles?\s+amén/i.test(rawText)) return "Combles aménagés";
    return null;
  })();

  const surfaceToiture = (() => {
    const m = rawText.match(/(\d+(?:[,.]\d+)?\s*[lL]\s*x\s*\d+(?:[,.]\d+)?\s*[lL])/);
    if (m) return m[1].trim();
    return null;
  })();

  // ── Équipements ───────────────────────────────────────────────────────────
  const systemeChauffage = findValue(lines, /système de chauffage/i);
  const typeChauffage =
    findValue(lines, /type de chauffage/i) ??
    findValue(lines, /type du chauffage/i);

  const anneeGenerateur =
    findValue(lines, /année du g[eé]n[eé]rateur/i) ??
    findValue(lines, /ann[eé]e g[eé]n[eé]rateur/i);

  const positionGenerateur =
    findValue(lines, /position du g[eé]n[eé]rateur/i) ??
    findValue(lines, /emplacement de la chaudiere/i);

  // ECS: "Individuelle" or "Collective" from the ECS block
  const typeEcs = (() => {
    const ecsIdx = findLabelIdx(lines, /type.*d.ecs|photos.*d.ecs/i);
    if (ecsIdx >= 0) {
      for (let j = ecsIdx + 1; j < Math.min(ecsIdx + 5, lines.length); j++) {
        const l = lines[j];
        if (!isJunkLine(l) && /individuelle|collective|ballon|cumulex|cumulus|instantan/i.test(l)) {
          return l;
        }
        if (!isJunkLine(l) && l.length < 80) return l;
      }
    }
    // fallback: search in the "ECS en place" block
    const ecsPlace = findValue(lines, /type.*ecs en place/i);
    if (ecsPlace) return ecsPlace;
    // Last resort: look at the standalone "Individuelle" or "Collective" near ECS mentions
    const m = rawText.match(/ECS[^\n]{0,50}\n([^\n]+)/i);
    return m ? m[1].trim() : null;
  })();

  // Dimensions chaufferie: H x L x l
  const hautGen = findValue(lines, /pièce du générateur HAUTEUR/i);
  const longGen = findValue(lines, /pièce du générateur LONGUEUR/i);
  const largGen = findValue(lines, /pièce du générateur LARGEUR/i);
  const dimensionsPieceGenerateur =
    hautGen && longGen && largGen
      ? `${hautGen} H × ${longGen} L × ${largGen} l`
      : null;

  // Epaisseur murs
  const epaisseurMurs = findValue(lines, /épaisseur des murs/i);

  // Wall composition / isolation per direction
  function wallData(dir: string) {
    const comp = findValue(lines, new RegExp(`mur\\s+${dir}.*composition`, "i")) ??
      findValue(lines, new RegExp(`composition.*mur\\s+${dir}`, "i"));
    const iso = findValue(lines, new RegExp(`mur\\s+${dir}.*isolation`, "i")) ??
      findValue(lines, new RegExp(`isolation.*mur\\s+${dir}`, "i")) ??
      findValue(lines, new RegExp(`type.*isolation.*${dir}`, "i"));
    return { comp, iso };
  }
  const nord = wallData("nord");
  const sud = wallData("sud");
  const est = wallData("est");
  const ouest = wallData("ouest");

  // Wall insulation summary
  const wallInsulation = (() => {
    const allWallVals = [nord.iso, sud.iso, est.iso, ouest.iso].filter(Boolean) as string[];
    if (allWallVals.length === 0) {
      // Check if explicit "Non isolé" in text
      if (/non\s*isol[eé]/i.test(rawText)) return "Non isolé";
      return null;
    }
    if (allWallVals.every((v) => /non\s*isol/i.test(v))) return "Non isolé";
    return allWallVals[0];
  })();

  const compPlancherBas = findValue(lines, /composition.*plafond.*sous.sol/i) ??
    findValue(lines, /composition.*plancher.*bas/i);
  const isoPlancherBas = findValue(lines, /isolation.*plancher.*bas/i) ??
    findValue(lines, /sous sol.*isol/i);

  // Window type from façade sections
  const windowType = findValue(lines, /type de vitrage/i) ??
    findValue(lines, /^Vitre$/i);

  // Ventilation (most common in apartments)
  const ventilation = findValue(lines, /système de ventilation/i);

  // ── Appartements ──────────────────────────────────────────────────────────
  const apartments = parseApartments(lines);

  // ── Heating system string ─────────────────────────────────────────────────
  const heatingParts = [systemeChauffage, typeChauffage].filter(Boolean);
  const heatingSystem = heatingParts.length > 0 ? heatingParts.join(" – ") : null;

  // ── Number of floors ──────────────────────────────────────────────────────
  const floorsFromComment = niveauxComment ? parseInt(niveauxComment.match(/\d+/)![0], 10) : null;
  const numberOfFloors = floorsFromComment ?? (nbNiveauxRaw ? extractNum(nbNiveauxRaw) : null);

  // ── visitReportData ───────────────────────────────────────────────────────
  const visitReportData: VisitReportData = {
    source: "visit_report",
    score: scoreRaw,
    preconisation,
    preparePar,
    telephone,
    nombreLocataires: locatairesRaw ? extractNum(locatairesRaw) : null,
    formeBatiment,
    orientationFacade,
    nombreAppartements: nbAppartsComment,
    anneeGenerateur,
    epaisseurMurs,
    typeToiture,
    surfaceToiture,
    compositionMurNord: nord.comp,
    isolationMurNord: nord.iso,
    compositionMurSud: sud.comp,
    isolationMurSud: sud.iso,
    compositionMurEst: est.comp,
    isolationMurEst: est.iso,
    compositionMurOuest: ouest.comp,
    isolationMurOuest: ouest.iso,
    compositionPlancherBas: compPlancherBas,
    isolationPlancherBas: isoPlancherBas,
    positionGenerateur,
    dimensionsPieceGenerateur,
    typeEcs,
    apartments,
  };

  // ── sectionCharacteristics ────────────────────────────────────────────────
  const sectionCharacteristics: Record<string, string> = {};
  if (wallInsulation) sectionCharacteristics.facades = wallInsulation;
  if (isoPlancherBas) sectionCharacteristics.planchers = isoPlancherBas;
  if (typeToiture) sectionCharacteristics.toitures = typeToiture;
  if (windowType) sectionCharacteristics.menuiseries = windowType;
  if (heatingSystem) sectionCharacteristics.generateur_chauffage = heatingSystem;
  if (typeEcs) sectionCharacteristics.ecs = typeEcs;
  if (heatingSystem || typeEcs) {
    sectionCharacteristics.chauffage_ecs = [
      heatingSystem,
      typeEcs ? `ECS: ${typeEcs}` : null,
    ]
      .filter(Boolean)
      .join(" | ");
  }
  if (ventilation) sectionCharacteristics.ventilation = ventilation;

  return {
    buildingName,
    buildingAddress: adresse,
    buildingType,
    constructionYear: extractYear(anneeConstRaw),
    totalSurface: surfaceRaw ? extractNum(surfaceRaw) : null,
    heatedSurface: null,
    numberOfFloors,
    numberOfOccupants: locatairesRaw ? extractNum(locatairesRaw) : null,
    climateZone: null,
    totalConsumption: null,
    electricityConsumption: null,
    gasConsumption: null,
    heatingConsumption: null,
    coolingConsumption: null,
    hotWaterConsumption: null,
    consumptionUnit: null,
    consumptionReferenceYear: null,
    totalCost: null,
    electricityCost: null,
    gasCost: null,
    currency: null,
    costReferenceYear: null,
    totalCo2Emissions: null,
    electricityCo2Emissions: null,
    gasCo2Emissions: null,
    co2Unit: null,
    wallInsulation,
    roofInsulation: null,
    floorInsulation: isoPlancherBas ?? null,
    windowType,
    windowSurface: null,
    airTightness: null,
    thermalBridges: null,
    heatingSystem,
    heatingEfficiency: null,
    coolingSystem: null,
    coolingEfficiency: null,
    ventilationType: ventilation,
    hotWaterSystem: typeEcs,
    currentLabel: null,
    primaryEnergyConsumption: null,
    referenceConsumption: null,
    energyIndex: null,
    recommendations: [],
    rawFields,
    metadata: {
      bureauEtudes: cabinetEtudes,
      beneficiaire: buildingName,
      adresseClient: adresse,
      dateVisite,
    },
    sectionCharacteristics,
    visitReportData,
  } as ExtractedAuditData & {
    visitReportData: VisitReportData;
    sectionCharacteristics: Record<string, string>;
  };
}
