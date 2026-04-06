import mammoth from "mammoth";
import { parse as csvParse } from "csv-parse/sync";

export interface RawField {
  key: string;
  value: string;
  section: string | null;
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
}

function parseNum(val: string | null | undefined): number | null {
  if (!val) return null;
  const cleaned = val.replace(/[^\d.,-]/g, "").replace(",", ".");
  const n = parseFloat(cleaned);
  return isNaN(n) ? null : n;
}

function parseYear(val: string | null | undefined): number | null {
  if (!val) return null;
  const match = val.match(/\b(19|20)\d{2}\b/);
  if (!match) return null;
  return parseInt(match[0], 10);
}

function extractEnergyLabel(val: string | null | undefined): string | null {
  if (!val) return null;
  const match = val.match(/\b([A-G][+]{0,3})\b/i);
  return match ? match[1].toUpperCase() : null;
}

function determinePriority(val: string | null | undefined): "high" | "medium" | "low" {
  if (!val) return "medium";
  const lower = val.toLowerCase();
  if (lower.includes("élevé") || lower.includes("haute") || lower.includes("high") || lower.includes("prioritaire")) return "high";
  if (lower.includes("faible") || lower.includes("basse") || lower.includes("low")) return "low";
  return "medium";
}

type KeyMapping = {
  [key: string]: Array<string>;
};

const FIELD_MAPPINGS: KeyMapping = {
  buildingName: ["nom du bâtiment", "building name", "dénomination", "appellation", "nom bâtiment"],
  buildingAddress: ["adresse", "address", "localisation", "situation"],
  buildingType: ["type de bâtiment", "building type", "type bâtiment", "usage", "destination", "affectation"],
  constructionYear: ["année de construction", "construction year", "date de construction", "année construction"],
  totalSurface: ["surface totale", "total surface", "superficie totale", "shon", "surface plancher"],
  heatedSurface: ["surface chauffée", "heated surface", "surface habitable", "surface utile", "sdp chauffée"],
  numberOfFloors: ["nombre d'étages", "number of floors", "nb étages", "niveaux"],
  numberOfOccupants: ["nombre d'occupants", "occupants", "effectif", "personnes"],
  climateZone: ["zone climatique", "climate zone", "zone", "région climatique"],

  totalConsumption: ["consommation totale", "total consumption", "conso totale", "énergie totale"],
  electricityConsumption: ["consommation électricité", "electricity consumption", "conso électrique", "électricité"],
  gasConsumption: ["consommation gaz", "gas consumption", "conso gaz", "gaz naturel"],
  heatingConsumption: ["consommation chauffage", "heating consumption", "conso chauffage", "chauffage"],
  coolingConsumption: ["consommation climatisation", "cooling consumption", "conso froid", "climatisation"],
  hotWaterConsumption: ["consommation eau chaude", "hot water consumption", "ecs", "eau chaude sanitaire"],
  consumptionUnit: ["unité consommation", "consumption unit", "unité", "kwh", "kwh/m²"],
  consumptionReferenceYear: ["année référence consommation", "reference year consumption", "année mesure"],

  totalCost: ["coût total", "total cost", "facture totale", "dépenses énergétiques totales"],
  electricityCost: ["coût électricité", "electricity cost", "facture électricité"],
  gasCost: ["coût gaz", "gas cost", "facture gaz"],
  currency: ["devise", "currency", "monnaie"],
  costReferenceYear: ["année référence coût", "reference year cost"],

  totalCo2Emissions: ["émissions co2 totales", "total co2 emissions", "co2 total", "ges total", "émissions ges"],
  electricityCo2Emissions: ["émissions co2 électricité", "electricity co2", "co2 électrique"],
  gasCo2Emissions: ["émissions co2 gaz", "gas co2", "co2 gaz"],
  co2Unit: ["unité co2", "co2 unit", "kg co2", "t co2"],

  wallInsulation: ["isolation murs", "wall insulation", "isolation des murs", "parois opaques"],
  roofInsulation: ["isolation toiture", "roof insulation", "isolation du toit", "toiture"],
  floorInsulation: ["isolation plancher", "floor insulation", "isolation sol", "plancher bas"],
  windowType: ["type de vitrage", "window type", "menuiseries", "fenêtres", "vitrage"],
  windowSurface: ["surface vitrée", "window surface", "surface fenêtres"],
  airTightness: ["étanchéité à l'air", "air tightness", "perméabilité", "n50"],
  thermalBridges: ["ponts thermiques", "thermal bridges", "liaisons"],

  heatingSystem: ["système de chauffage", "heating system", "installation chauffage", "chaudière"],
  heatingEfficiency: ["rendement chauffage", "heating efficiency", "cop chauffage", "scop"],
  coolingSystem: ["système de climatisation", "cooling system", "installation froid"],
  coolingEfficiency: ["rendement climatisation", "cooling efficiency", "cop froid", "eer"],
  ventilationType: ["type de ventilation", "ventilation type", "ventilation", "vmc"],
  hotWaterSystem: ["système eau chaude", "hot water system", "production ecs", "chauffe-eau"],

  currentLabel: ["label énergétique", "energy label", "classe énergétique", "peb", "dpe", "certificat", "classe"],
  primaryEnergyConsumption: ["énergie primaire", "primary energy", "ep", "cep"],
  referenceConsumption: ["consommation référence", "reference consumption", "cep ref", "valeur référence"],
  energyIndex: ["indice énergétique", "energy index", "facteur", "ratio"],
};

function matchKey(rawKey: string): string | null {
  const normalized = rawKey.toLowerCase().trim();
  for (const [fieldName, variants] of Object.entries(FIELD_MAPPINGS)) {
    for (const variant of variants) {
      if (normalized.includes(variant) || variant.includes(normalized)) {
        return fieldName;
      }
    }
  }
  return null;
}

function buildExtractedData(rawFields: RawField[]): ExtractedAuditData {
  const mapped: Record<string, string> = {};

  for (const field of rawFields) {
    const fieldName = matchKey(field.key);
    if (fieldName && !mapped[fieldName]) {
      mapped[fieldName] = field.value;
    }
  }

  const recommendations: ExtractedAuditData["recommendations"] = [];

  const recFields = rawFields.filter(
    (f) =>
      f.section?.toLowerCase().includes("recommandation") ||
      f.section?.toLowerCase().includes("préconisation") ||
      f.section?.toLowerCase().includes("action") ||
      f.key.toLowerCase().includes("recommandation") ||
      f.key.toLowerCase().includes("préconisation") ||
      f.key.toLowerCase().includes("mesure")
  );

  for (let i = 0; i < recFields.length; i += 2) {
    const field = recFields[i];
    recommendations.push({
      category: field.section || "Général",
      description: `${field.key}: ${field.value}`,
      estimatedSaving: null,
      estimatedCost: null,
      priority: determinePriority(field.section),
      paybackPeriod: null,
    });
  }

  return {
    buildingName: mapped.buildingName || null,
    buildingAddress: mapped.buildingAddress || null,
    buildingType: mapped.buildingType || null,
    constructionYear: parseYear(mapped.constructionYear),
    totalSurface: parseNum(mapped.totalSurface),
    heatedSurface: parseNum(mapped.heatedSurface),
    numberOfFloors: mapped.numberOfFloors ? Math.round(parseNum(mapped.numberOfFloors) ?? 0) || null : null,
    numberOfOccupants: mapped.numberOfOccupants ? Math.round(parseNum(mapped.numberOfOccupants) ?? 0) || null : null,
    climateZone: mapped.climateZone || null,

    totalConsumption: parseNum(mapped.totalConsumption),
    electricityConsumption: parseNum(mapped.electricityConsumption),
    gasConsumption: parseNum(mapped.gasConsumption),
    heatingConsumption: parseNum(mapped.heatingConsumption),
    coolingConsumption: parseNum(mapped.coolingConsumption),
    hotWaterConsumption: parseNum(mapped.hotWaterConsumption),
    consumptionUnit: mapped.consumptionUnit || null,
    consumptionReferenceYear: parseYear(mapped.consumptionReferenceYear),

    totalCost: parseNum(mapped.totalCost),
    electricityCost: parseNum(mapped.electricityCost),
    gasCost: parseNum(mapped.gasCost),
    currency: mapped.currency || null,
    costReferenceYear: parseYear(mapped.costReferenceYear),

    totalCo2Emissions: parseNum(mapped.totalCo2Emissions),
    electricityCo2Emissions: parseNum(mapped.electricityCo2Emissions),
    gasCo2Emissions: parseNum(mapped.gasCo2Emissions),
    co2Unit: mapped.co2Unit || null,

    wallInsulation: mapped.wallInsulation || null,
    roofInsulation: mapped.roofInsulation || null,
    floorInsulation: mapped.floorInsulation || null,
    windowType: mapped.windowType || null,
    windowSurface: parseNum(mapped.windowSurface),
    airTightness: parseNum(mapped.airTightness),
    thermalBridges: mapped.thermalBridges || null,

    heatingSystem: mapped.heatingSystem || null,
    heatingEfficiency: parseNum(mapped.heatingEfficiency),
    coolingSystem: mapped.coolingSystem || null,
    coolingEfficiency: parseNum(mapped.coolingEfficiency),
    ventilationType: mapped.ventilationType || null,
    hotWaterSystem: mapped.hotWaterSystem || null,

    currentLabel: extractEnergyLabel(mapped.currentLabel),
    primaryEnergyConsumption: parseNum(mapped.primaryEnergyConsumption),
    referenceConsumption: parseNum(mapped.referenceConsumption),
    energyIndex: parseNum(mapped.energyIndex),

    recommendations,
    rawFields,
  };
}

export async function extractFromDocx(buffer: Buffer): Promise<ExtractedAuditData> {
  const result = await mammoth.extractRawText({ buffer });
  const text = result.value;
  const lines = text.split(/\n/).map((l) => l.trim()).filter(Boolean);

  const rawFields: RawField[] = [];
  let currentSection: string | null = null;

  for (const line of lines) {
    if (line.length < 100 && !line.includes(":") && !line.includes("=") && line.length > 3) {
      const lowerLine = line.toLowerCase();
      if (
        lowerLine.includes("bâtiment") ||
        lowerLine.includes("consommation") ||
        lowerLine.includes("coût") ||
        lowerLine.includes("émission") ||
        lowerLine.includes("enveloppe") ||
        lowerLine.includes("système") ||
        lowerLine.includes("chauffage") ||
        lowerLine.includes("recommandation") ||
        lowerLine.includes("ventilation") ||
        lowerLine.includes("label") ||
        lowerLine.includes("peb") ||
        lowerLine.includes("dpe") ||
        lowerLine.includes("isolation")
      ) {
        currentSection = line;
        continue;
      }
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

  return buildExtractedData(rawFields);
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

      if (row.length === 1 && row[0] && row[0].length > 3) {
        const lowerVal = row[0].toLowerCase();
        if (
          lowerVal.includes("bâtiment") ||
          lowerVal.includes("consommation") ||
          lowerVal.includes("coût") ||
          lowerVal.includes("émission") ||
          lowerVal.includes("enveloppe") ||
          lowerVal.includes("système") ||
          lowerVal.includes("chauffage") ||
          lowerVal.includes("recommandation") ||
          lowerVal.includes("ventilation") ||
          lowerVal.includes("label") ||
          lowerVal.includes("peb") ||
          lowerVal.includes("dpe") ||
          lowerVal.includes("isolation")
        ) {
          currentSection = row[0];
          continue;
        }
      }

      if (row.length >= 2 && row[0] && row[1]) {
        rawFields.push({
          key: row[0].trim(),
          value: row[1].trim(),
          section: currentSection,
        });
      } else if (row.length >= 3 && row[0] && row[2]) {
        rawFields.push({
          key: row[0].trim(),
          value: row[2].trim(),
          section: row[1]?.trim() || currentSection,
        });
      }
    }
  } catch {
    const lines = content.split(/\r?\n/).filter(Boolean);
    let currentSection: string | null = null;
    for (const line of lines) {
      const parts = line.split(/[;,\t]/);
      if (parts.length >= 2 && parts[0] && parts[1]) {
        rawFields.push({
          key: parts[0].trim(),
          value: parts[1].trim(),
          section: currentSection,
        });
      } else if (parts.length === 1 && parts[0]) {
        currentSection = parts[0].trim();
      }
    }
  }

  return buildExtractedData(rawFields);
}
