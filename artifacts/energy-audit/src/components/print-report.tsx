import React, { useState, useEffect } from "react";
import {
  AreaChart, Area, BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend,
} from "recharts";

// ── Types ─────────────────────────────────────────────────────────────────────

interface RawField { key: string; value: string; section: string | null; }

function getRaw(rawFields: RawField[], key: string): string | null {
  return rawFields.find((f) => f.key === key)?.value ?? null;
}

function parseVal(v: string | undefined | null): number | null {
  if (!v) return null;
  const n = parseFloat(v.replace(",", ".").replace(/\s/g, ""));
  return isNaN(n) ? null : n;
}

function fmtNum(n: number | null | undefined, decimals = 0): string {
  if (n === null || n === undefined) return "—";
  return n.toLocaleString("fr-FR", { maximumFractionDigits: decimals });
}

const DPE_COLORS: Record<string, string> = {
  A: "#319834", B: "#33cc33", C: "#cccc00",
  D: "#fbaf08", E: "#f97316", F: "#dc2626", G: "#7f1d1d",
};

function DpeLabel({ label }: { label: string | null | undefined }) {
  if (!label) return <span className="print-dpe print-dpe-unknown">—</span>;
  const color = DPE_COLORS[label] ?? "#6b7280";
  return (
    <span
      style={{ backgroundColor: color, color: "#fff", fontWeight: 700, padding: "2px 10px", borderRadius: 4, fontSize: 13 }}
    >
      {label}
    </span>
  );
}

// ── Scenario helpers ──────────────────────────────────────────────────────────

function getScenarioCodes(rawFields: RawField[]): string[] {
  const codes = new Set<string>();
  for (const f of rawFields) {
    const m = f.key.match(/^SCÉNARIO (SC\d+)/);
    if (m) codes.add(m[1]);
  }
  return [...codes].sort();
}

function getScVal(rawFields: RawField[], code: string, suffix: string): string | null {
  return rawFields.find((f) => f.key === `SCÉNARIO ${code} - ${suffix}`)?.value ?? null;
}

const MONTHS_SHORT = ["Jan", "Fév", "Mar", "Avr", "Mai", "Jun", "Jul", "Aoû", "Sep", "Oct", "Nov", "Déc"];

interface MonthlyWeather {
  month: string;
  tMax: number;
  tMin: number;
  tMean: number;
  dju: number;
}

// ── Station coordinates lookup (subset, for static map in print) ──────────────
const PRINT_STATION_COORDS: Record<string, { lat: number; lon: number }> = {
  "NICE": { lat: 43.658, lon: 7.208 },
  "NICE COTE D'AZUR": { lat: 43.658, lon: 7.208 },
  "NICE-CÔTE D'AZUR": { lat: 43.658, lon: 7.208 },
  "PARIS": { lat: 48.853, lon: 2.349 },
  "PARIS-MONTSOURIS": { lat: 48.822, lon: 2.337 },
  "LYON": { lat: 45.748, lon: 4.843 },
  "LYON-BRON": { lat: 45.728, lon: 4.942 },
  "MARSEILLE": { lat: 43.296, lon: 5.381 },
  "MARSEILLE-MARIGNANE": { lat: 43.434, lon: 5.215 },
  "BORDEAUX": { lat: 44.837, lon: -0.579 },
  "BORDEAUX-MERIGNAC": { lat: 44.828, lon: -0.715 },
  "TOULOUSE": { lat: 43.600, lon: 1.446 },
  "TOULOUSE-BLAGNAC": { lat: 43.629, lon: 1.364 },
  "STRASBOURG": { lat: 48.574, lon: 7.752 },
  "STRASBOURG-ENTZHEIM": { lat: 48.538, lon: 7.628 },
  "NANTES": { lat: 47.218, lon: -1.553 },
  "NANTES-ATLANTIQUE": { lat: 47.153, lon: -1.608 },
  "MONTPELLIER": { lat: 43.611, lon: 3.877 },
  "MONTPELLIER-FREJORGUES": { lat: 43.576, lon: 3.963 },
  "LILLE": { lat: 50.629, lon: 3.057 },
  "LILLE-LESQUIN": { lat: 50.563, lon: 3.097 },
  "RENNES": { lat: 48.114, lon: -1.680 },
  "RENNES-SAINT-JACQUES": { lat: 48.069, lon: -1.732 },
  "GRENOBLE": { lat: 45.188, lon: 5.724 },
  "GRENOBLE-SAINT-GEOIRS": { lat: 45.363, lon: 5.329 },
  "DIJON": { lat: 47.322, lon: 5.041 },
  "DIJON-LONGVIC": { lat: 47.269, lon: 5.090 },
  "CLERMONT-FERRAND": { lat: 45.777, lon: 3.087 },
  "CLERMONT-FERRAND-AULNAT": { lat: 45.787, lon: 3.158 },
  "NIMES": { lat: 43.835, lon: 4.361 },
  "NIMES-COURBESSAC": { lat: 43.856, lon: 4.416 },
  "PERPIGNAN": { lat: 42.699, lon: 2.895 },
  "PERPIGNAN-RIVESALTES": { lat: 42.740, lon: 2.870 },
  "METZ": { lat: 49.120, lon: 6.176 },
  "NANCY": { lat: 48.692, lon: 6.184 },
  "REIMS": { lat: 49.258, lon: 4.032 },
  "AMIENS": { lat: 49.894, lon: 2.296 },
  "CAEN": { lat: 49.184, lon: -0.363 },
  "LE HAVRE": { lat: 49.493, lon: 0.108 },
  "ROUEN": { lat: 49.443, lon: 1.099 },
  "TOULON": { lat: 43.124, lon: 5.928 },
  "TOULON-HYERES": { lat: 43.098, lon: 6.147 },
  "AJACCIO": { lat: 41.919, lon: 8.738 },
  "BASTIA": { lat: 42.708, lon: 9.452 },
  "BREST": { lat: 48.390, lon: -4.486 },
  "BREST-GUIPAVAS": { lat: 48.447, lon: -4.419 },
  "POITIERS": { lat: 46.580, lon: 0.340 },
  "LIMOGES": { lat: 45.833, lon: 1.262 },
  "PAU": { lat: 43.299, lon: -0.369 },
  "TARBES": { lat: 43.228, lon: 0.006 },
  "BEZIERS": { lat: 43.345, lon: 3.215 },
  "VALENCE": { lat: 44.933, lon: 4.889 },
  "CHAMBERY": { lat: 45.571, lon: 5.880 },
  "ANNECY": { lat: 45.900, lon: 6.117 },
  "LA ROCHELLE": { lat: 46.160, lon: -1.151 },
  "TOURS": { lat: 47.394, lon: 0.688 },
  "ANGERS": { lat: 47.478, lon: -0.563 },
  "LE MANS": { lat: 47.996, lon: 0.192 },
  "LIEGE": { lat: 50.633, lon: 5.567 },
  "BRUXELLES": { lat: 50.846, lon: 4.352 },
  "BRUSSELS": { lat: 50.846, lon: 4.352 },
  "CHARLEROI": { lat: 50.411, lon: 4.444 },
  "NAMUR": { lat: 50.467, lon: 4.867 },
};

function resolveCoords(station: string | null): { lat: number; lon: number } | null {
  if (!station) return null;
  const upper = station.toUpperCase().trim();
  for (const [key, val] of Object.entries(PRINT_STATION_COORDS)) {
    if (upper === key || upper.startsWith(key) || key.startsWith(upper)) return val;
  }
  return null;
}

function staticMapUrl(lat: number, lon: number, zoom = 11): string {
  return `https://staticmap.openstreetmap.de/staticmap.php?center=${lat},${lon}&zoom=${zoom}&size=500x200&maptype=mapnik&markers=${lat},${lon},red-pushpin`;
}

// ── Section title ─────────────────────────────────────────────────────────────

function SectionTitle({ num, title, subtitle }: { num: string; title: string; subtitle?: string }) {
  return (
    <div style={{ borderBottom: "3px solid #1e3a5f", marginBottom: 16, paddingBottom: 6 }}>
      <div style={{ display: "flex", alignItems: "baseline", gap: 10 }}>
        <span style={{ background: "#1e3a5f", color: "#fff", borderRadius: 4, padding: "2px 8px", fontSize: 11, fontWeight: 700 }}>
          {num}
        </span>
        <h2 style={{ fontSize: 16, fontWeight: 700, margin: 0, color: "#1e3a5f" }}>{title}</h2>
      </div>
      {subtitle && <p style={{ fontSize: 10, color: "#64748b", margin: "4px 0 0 0" }}>{subtitle}</p>}
    </div>
  );
}

// ── Photo grid for print ──────────────────────────────────────────────────────

interface Photo { id: number; fileName: string; mimeType: string; caption: string | null; category: string; url: string; }

const SECTION_LABELS: Record<string, string> = {
  facades: "Façades extérieures",
  planchers: "Planchers bas",
  toitures: "Toitures",
  menuiseries: "Menuiseries",
  chauffage_ecs: "Chauffage & ECS",
  ventilation: "Ventilation",
  climatisation: "Climatisation",
  compteurs: "Compteurs & abonnements",
  eclairage: "Éclairage",
};

const SECTION_ORDER = ["facades", "planchers", "toitures", "menuiseries", "chauffage_ecs", "ventilation", "climatisation", "compteurs", "eclairage"];

// ── Main PrintReport ──────────────────────────────────────────────────────────

interface BaoScenarioMeta {
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
}

interface BaoMetadata {
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
  scenarios?: BaoScenarioMeta[];
}

interface ReportData {
  id: number;
  fileName: string;
  uploadedAt: string;
  buildingInfo: {
    name?: string | null;
    address?: string | null;
    buildingType?: string | null;
    constructionYear?: number | null;
    totalSurface?: number | null;
    heatedSurface?: number | null;
    numberOfFloors?: number | null;
    numberOfOccupants?: number | null;
    climateZone?: string | null;
  };
  energyLabel: {
    currentLabel?: string | null;
    primaryEnergyConsumption?: number | null;
    energyIndex?: number | null;
  };
  energyCost: { totalCost?: number | null };
  co2Emissions: { totalEmissions?: number | null };
  rawFields: RawField[];
  sectionCharacteristics?: Record<string, string> | null;
  metadata?: BaoMetadata | null;
}

export function PrintReport({ report, mode = "print" }: { report: ReportData; mode?: "print" | "preview" }) {
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [monthlyWeather, setMonthlyWeather] = useState<MonthlyWeather[] | null>(null);
  const apiBase = import.meta.env.BASE_URL.replace(/\/$/, "");
  const isPreview = mode === "preview";

  useEffect(() => {
    fetch(`${apiBase}/api/audit/reports/${report.id}/photos`)
      .then((r) => r.ok ? r.json() : [])
      .then(setPhotos)
      .catch(() => {});
  }, [report.id, apiBase]);

  // Fetch weather data from open-meteo.com for the report's station
  useEffect(() => {
    const stRaw = report.rawFields?.find(f => f.key === "Station météo")?.value ?? null;
    const coords = resolveCoords(stRaw);
    if (!coords) return;
    const year = new Date().getFullYear() - 1;
    const url = `https://archive-api.open-meteo.com/v1/archive?latitude=${coords.lat}&longitude=${coords.lon}`
      + `&start_date=${year}-01-01&end_date=${year}-12-31`
      + `&daily=temperature_2m_max,temperature_2m_min,temperature_2m_mean`
      + `&timezone=Europe%2FParis`;
    fetch(url)
      .then(r => r.json())
      .then(data => {
        if (!data.daily) return;
        const { time, temperature_2m_max, temperature_2m_min, temperature_2m_mean } = data.daily;
        const byMonth: Record<number, { max: number[]; min: number[]; mean: number[] }> = {};
        (time as string[]).forEach((d, i) => {
          const m = parseInt(d.slice(5, 7), 10) - 1;
          if (!byMonth[m]) byMonth[m] = { max: [], min: [], mean: [] };
          byMonth[m].max.push(temperature_2m_max[i]);
          byMonth[m].min.push(temperature_2m_min[i]);
          byMonth[m].mean.push(temperature_2m_mean[i]);
        });
        const avg = (arr: number[]) => arr.reduce((s, v) => s + v, 0) / arr.length;
        const result: MonthlyWeather[] = Array.from({ length: 12 }, (_, m) => {
          const tMean = byMonth[m] ? avg(byMonth[m].mean) : 0;
          return {
            month: MONTHS_SHORT[m],
            tMax: byMonth[m] ? parseFloat(avg(byMonth[m].max).toFixed(1)) : 0,
            tMin: byMonth[m] ? parseFloat(avg(byMonth[m].min).toFixed(1)) : 0,
            tMean: parseFloat(tMean.toFixed(1)),
            dju: byMonth[m] ? Math.round(byMonth[m].mean.reduce((s, t) => s + Math.max(0, 18 - t), 0)) : 0,
          };
        });
        setMonthlyWeather(result);
      })
      .catch(() => {});
  }, [report.rawFields]);

  const rawFields = report.rawFields || [];
  const b = report.buildingInfo;
  const chars = (report.sectionCharacteristics ?? {}) as Record<string, string>;
  const meta = report.metadata ?? null;
  const scenarioCodes = getScenarioCodes(rawFields);

  const initialEP = report.energyLabel.primaryEnergyConsumption;
  const initialGes = report.energyLabel.energyIndex;
  const initialCost = report.energyCost.totalCost;
  const totalCo2 = report.co2Emissions.totalEmissions;

  const thceInitial = parseVal(rawFields.find((f) => f.key === "Total énergie primaire (Th-C-E)")?.value);
  const cefInitial = parseVal(rawFields.find((f) => f.key === "CEF initial (Th-C-E)")?.value);
  const gesInitial = parseVal(rawFields.find((f) => f.key === "CO2 par m² (kg CO2éq/m²/an)")?.value)
    ?? meta?.gesInitialKgCo2M2 ?? null;

  const stationRaw = getRaw(rawFields, "Station météo");
  const dept = getRaw(rawFields, "Département");
  const altitude = getRaw(rawFields, "Altitude");
  const zoneClim = getRaw(rawFields, "Zone climatique");
  const dju = getRaw(rawFields, "Degrés-jours base 18°C");

  // Group photos by category
  const photosByCategory: Record<string, Photo[]> = {};
  for (const cat of SECTION_ORDER) {
    const catPhotos = photos.filter((p) => p.category === cat);
    if (catPhotos.length > 0) photosByCategory[cat] = catPhotos;
  }

  const printDate = new Date().toLocaleDateString("fr-FR", { year: "numeric", month: "long", day: "numeric" });
  const uploadDate = new Date(report.uploadedAt).toLocaleDateString("fr-FR", { year: "numeric", month: "long", day: "numeric" });

  // Columns for synthèse table
  const tableCols = [
    { key: "initial", label: "État initial", color: "#374151" },
    ...scenarioCodes.map((code, i) => ({
      key: code,
      label: code,
      color: ["#16a34a", "#2563eb", "#7c3aed", "#dc2626", "#ea580c"][i] ?? "#374151",
    })),
  ];

  const scData = scenarioCodes.map((code, idx) => {
    const metaSc = meta?.scenarios?.[idx] ?? null;
    return {
      code,
      label: getScVal(rawFields, code, "Libellé") || code,
      thce: parseVal(getScVal(rawFields, code, "CEP Th-C-E après")) ?? metaSc?.cep5KwhEpM2 ?? null,
      cef: parseVal(getScVal(rawFields, code, "CEF Th-C-E après")) ?? metaSc?.cef5KwhEfM2 ?? null,
      cep3: metaSc?.cep3KwhEpM2 ?? null,
      cef3: metaSc?.cef3KwhEfM2 ?? null,
      ges: parseVal(getScVal(rawFields, code, "GES Th-C-E après")) ?? metaSc?.gesCo2KgM2 ?? null,
      cost: parseVal(getScVal(rawFields, code, "Dépense annuelle après")) ?? metaSc?.totalDepenseAnnuelle ?? null,
      dpeLabel: getScVal(rawFields, code, "Étiquette DPE après") ?? metaSc?.labelDpe ?? null,
      invest: parseVal(getScVal(rawFields, code, "Investissement")) ?? null,
      payback: parseVal(getScVal(rawFields, code, "Temps de retour")) ?? null,
      gainPct: parseVal(getScVal(rawFields, code, "Gain sur CEP")) ?? metaSc?.gainEnergetiquePct ?? null,
      gainEconomiqueEur: metaSc?.gainEconomiqueEur ?? null,
      tauxEnrRPct: metaSc?.tauxEnrRPct ?? null,
      primeBarTh145Euros: metaSc?.primeBarTh145Euros ?? null,
      travaux: metaSc?.travaux ?? [],
      isolationToitures: metaSc?.isolationToitures ?? null,
      isolationMurs: metaSc?.isolationMurs ?? null,
      isolationPlancherBas: metaSc?.isolationPlancherBas ?? null,
      energieChauffagePrincipal: metaSc?.energieChauffagePrincipal ?? null,
    };
  });

  // Rows for envelope table from rawFields
  const envelopeRows = [
    { label: "Isolation murs extérieurs", key: "Isolation murs" },
    { label: "Isolation toiture / plafond", key: "Isolation toiture" },
    { label: "Isolation plancher bas", key: "Isolation plancher" },
    { label: "Type de menuiserie", key: "Type de menuiserie" },
    { label: "Surface vitrée totale", key: "Surface vitrée totale" },
    { label: "Ponts thermiques", key: "Ponts thermiques" },
    { label: "UBAT initial", key: "UBAT initial" },
  ].filter((r) => getRaw(rawFields, r.key));

  const systemRows = [
    { label: "Chauffage", key: "Système de chauffage" },
    { label: "Type ECS", key: "Type d'ECS" },
    { label: "Ventilation", key: "Type de ventilation" },
    { label: "COP nominal", key: "COP nominal" },
    { label: "EER nominal", key: "EER nominal (PAC)" },
  ].filter((r) => getRaw(rawFields, r.key));

  // Consumption rows — keys match fileExtractor output (title-case labels)
  const consumPostes = [
    { poste: "CHAUFFAGE", prefix: "Chauffage" },
    { poste: "REFROIDISSEMENT", prefix: "Refroidissement" },
    { poste: "ECS", prefix: "ECS" },
    { poste: "ECLAIRAGE", prefix: "Éclairage" },
    { poste: "AUXILIAIRES", prefix: "Auxiliaires" },
  ].map(({ poste, prefix }) => {
    const source = rawFields.find((f) => f.key === `${prefix} - Source d'énergie`)?.value ?? null;
    const finalRaw = rawFields.find((f) => f.key === `${prefix} - Énergie finale`)?.value ?? null;
    const primRaw = rawFields.find((f) => f.key === `${prefix} - Énergie primaire`)?.value ?? null;
    const kwhAn = parseVal(finalRaw);
    const kwhEP = parseVal(primRaw);
    return { poste, prefix, label: prefix, source, kwhAn, kwhEP, finalRaw, primRaw };
  }).filter((r) => r.finalRaw !== null || r.primRaw !== null);

  // UBAT rows
  const ubatRows = [
    { label: "Coefficient UBAT (W/m².°C)", key: "UBAT - Coefficient" },
    { label: "HT — Déperditions enveloppe (W/°C)", key: "UBAT - HT enveloppe" },
    { label: "AT — Surface déperditive (m²)", key: "UBAT - AT surface déperditive" },
    { label: "GV — Total général (W/°C)", key: "UBAT - GV total" },
    { label: "Déperditions totales (kW)", key: "UBAT - Déperditions totales" },
  ].filter((r) => getRaw(rawFields, r.key));

  const containerStyle: React.CSSProperties = isPreview
    ? { fontFamily: "'Segoe UI', Arial, sans-serif", fontSize: 11, color: "#1e293b", padding: "32px 0" }
    : { fontFamily: "'Segoe UI', Arial, sans-serif", fontSize: 11, color: "#1e293b" };

  const pageStyle: React.CSSProperties = isPreview
    ? {
        width: 794, minHeight: 1123, margin: "0 auto 28px", background: "#fff",
        boxShadow: "0 4px 20px rgba(0,0,0,0.25)", borderRadius: 2,
        padding: "56px 60px 48px", display: "flex", flexDirection: "column", position: "relative", boxSizing: "border-box",
      }
    : { minHeight: "277mm", display: "flex", flexDirection: "column", position: "relative" };

  return (
    <div className={isPreview ? undefined : "print-only"} style={containerStyle}>

      {/* ══ PAGE DE GARDE ════════════════════════════════════════════════════ */}
      <div
        className={isPreview ? undefined : "print-page"}
        style={{
          ...(isPreview
            ? { width: 794, minHeight: 1123, margin: "0 auto 28px", background: "#fff", boxShadow: "0 4px 20px rgba(0,0,0,0.25)", borderRadius: 2, boxSizing: "border-box" as const }
            : { minHeight: "277mm" }),
          display: "flex", flexDirection: "column", position: "relative", overflow: "hidden",
        }}
      >
        {/* ── BANDE SUPÉRIEURE BLEUE ── */}
        <div style={{
          background: "linear-gradient(135deg, #0f172a 0%, #1e3a5f 55%, #1d4ed8 100%)",
          color: "#fff",
          padding: "40px 56px 36px",
          flexShrink: 0,
        }}>
          {/* Logo / Entreprise */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 32 }}>
            <div>
              {meta?.bureauEtudes ? (
                <>
                  <div style={{ fontSize: 9, letterSpacing: 2, textTransform: "uppercase", opacity: 0.65, marginBottom: 3 }}>Bureau d'études</div>
                  <div style={{ fontSize: 16, fontWeight: 800, letterSpacing: 0.5 }}>{meta.bureauEtudes}</div>
                  {meta.bureauAdresse && <div style={{ fontSize: 9, opacity: 0.6, marginTop: 2 }}>{meta.bureauAdresse}</div>}
                  {meta.siret && <div style={{ fontSize: 8, opacity: 0.5, marginTop: 1 }}>SIRET {meta.siret}</div>}
                </>
              ) : (
                <>
                  <div style={{ fontSize: 9, letterSpacing: 2, textTransform: "uppercase", opacity: 0.65, marginBottom: 3 }}>Plateforme</div>
                  <div style={{ fontSize: 16, fontWeight: 800, letterSpacing: 0.5 }}>AuditTech Pro</div>
                </>
              )}
            </div>
            <div style={{ textAlign: "right", fontSize: 8, opacity: 0.6 }}>
              <div>Édité le {printDate}</div>
              {meta?.reference && <div style={{ marginTop: 2 }}>Réf. {meta.reference}</div>}
            </div>
          </div>

          {/* Titre principal */}
          <div style={{ borderLeft: "4px solid #60a5fa", paddingLeft: 18, marginBottom: 4 }}>
            <div style={{ fontSize: 9, letterSpacing: 3, textTransform: "uppercase", opacity: 0.7, marginBottom: 6 }}>
              Rapport d'Audit Énergétique Réglementaire
            </div>
            <div style={{ fontSize: 30, fontWeight: 900, lineHeight: 1.15, letterSpacing: -0.5 }}>
              {b.name || "Bâtiment"}
            </div>
          </div>

          {b.address && (
            <div style={{ fontSize: 11, opacity: 0.75, marginTop: 8, paddingLeft: 22 }}>
              📍 {b.address}
              {dept && <span style={{ opacity: 0.6 }}> — {dept}</span>}
            </div>
          )}
        </div>

        {/* ── BANDE ACCENT ── */}
        <div style={{ height: 5, background: "linear-gradient(90deg, #1d4ed8 0%, #0ea5e9 50%, #10b981 100%)" }} />

        {/* ── CORPS DE PAGE ── */}
        <div style={{ flex: 1, display: "flex", flexDirection: "column", padding: "28px 56px 0" }}>

          {/* Ligne 1 : Bâtiment (gauche) + DPE (droite) */}
          <div style={{ display: "flex", gap: 20, marginBottom: 22 }}>

            {/* Infos bâtiment */}
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 8, fontWeight: 700, color: "#1d4ed8", textTransform: "uppercase", letterSpacing: 1, marginBottom: 10, display: "flex", alignItems: "center", gap: 6 }}>
                <span style={{ display: "inline-block", width: 16, height: 2, background: "#1d4ed8", borderRadius: 1 }} />
                Caractéristiques du bâtiment
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                {[
                  { l: "Type de bâtiment", v: b.buildingType || getRaw(rawFields, "Type de bâtiment") },
                  { l: "Année de construction", v: b.constructionYear || getRaw(rawFields, "Année de construction") },
                  { l: "Surface habitable", v: b.heatedSurface ? `${fmtNum(b.heatedSurface)} m²` : getRaw(rawFields, "Surface habitable") },
                  { l: "Surface SHON", v: b.totalSurface ? `${fmtNum(b.totalSurface)} m²` : getRaw(rawFields, "Surface SHON") },
                  { l: "Niveaux", v: b.numberOfFloors || getRaw(rawFields, "Nombre de niveaux") },
                  { l: "Zone climatique", v: b.climateZone || zoneClim },
                  { l: "Station météo", v: stationRaw },
                  { l: "Altitude", v: altitude },
                ].filter(r => r.v).map(({ l, v }) => (
                  <div key={l} style={{ display: "flex", alignItems: "baseline", gap: 6, borderBottom: "1px solid #f1f5f9", paddingBottom: 5, paddingTop: 2 }}>
                    <span style={{ fontSize: 8, color: "#94a3b8", minWidth: 110, flexShrink: 0 }}>{l}</span>
                    <span style={{ fontSize: 10, fontWeight: 700, color: "#1e3a5f" }}>{String(v)}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* DPE + Énergie */}
            <div style={{ display: "flex", flexDirection: "column", gap: 10, minWidth: 195 }}>
              {/* DPE Badge */}
              <div style={{
                background: "#0f172a",
                borderRadius: 10,
                padding: "18px 20px",
                textAlign: "center",
                color: "#fff",
                flex: 1,
                display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
              }}>
                <div style={{ fontSize: 8, opacity: 0.5, textTransform: "uppercase", letterSpacing: 1.5, marginBottom: 6 }}>Étiquette DPE actuelle</div>
                <div style={{ fontSize: 8, opacity: 0.4, marginBottom: 10 }}>Méthode 3CL-2021</div>
                {/* DPE letter big */}
                <div style={{
                  width: 72, height: 72, borderRadius: "50%",
                  background: DPE_COLORS[report.energyLabel.currentLabel ?? "G"] ?? "#7f1d1d",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: 36, fontWeight: 900, color: "#fff",
                  boxShadow: `0 0 0 4px ${(DPE_COLORS[report.energyLabel.currentLabel ?? "G"] ?? "#7f1d1d")}40`,
                  marginBottom: 10,
                }}>
                  {report.energyLabel.currentLabel ?? "—"}
                </div>
                <div style={{ fontSize: 15, fontWeight: 800 }}>
                  {fmtNum(initialEP, 1)} <span style={{ fontSize: 9, fontWeight: 400, opacity: 0.7 }}>kWhEP/m².an</span>
                </div>
                {(gesInitial || initialGes) && (
                  <div style={{ fontSize: 10, opacity: 0.6, marginTop: 4 }}>
                    {fmtNum(gesInitial ?? initialGes, 1)} kgCO₂/m².an
                  </div>
                )}
                <div style={{ marginTop: 10, borderTop: "1px solid rgba(255,255,255,0.1)", paddingTop: 8, width: "100%", textAlign: "center" }}>
                  <div style={{ fontSize: 8, opacity: 0.4, textTransform: "uppercase", letterSpacing: 1 }}>Objectif après travaux</div>
                  <div style={{ display: "flex", justifyContent: "center", gap: 6, marginTop: 5 }}>
                    {scData.filter(sc => sc.dpeLabel).slice(0, 3).map(sc => (
                      <div key={sc.code} style={{
                        background: DPE_COLORS[sc.dpeLabel!] ?? "#374151",
                        color: "#fff", borderRadius: 4, padding: "3px 8px",
                        fontSize: 11, fontWeight: 800,
                      }}>
                        {sc.dpeLabel}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Ligne 2 : Indicateurs clés */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12, marginBottom: 22 }}>
            {[
              {
                label: "Dépense annuelle", value: initialCost ? `${fmtNum(initialCost)} €` : "—",
                sub: "Abonnements inclus", icon: "💰", color: "#1d4ed8", bg: "#eff6ff",
              },
              {
                label: "Bilan CO₂ annuel", value: totalCo2 ? `${fmtNum(totalCo2 / 1000, 1)} t CO₂éq` : "—",
                sub: gesInitial ? `${fmtNum(gesInitial, 1)} kgCO₂/m².an` : "", icon: "🌿", color: "#15803d", bg: "#f0fdf4",
              },
              {
                label: "CEP initial (5 usages)", value: thceInitial ? `${fmtNum(thceInitial, 1)} kWhEP/m².an` : (initialEP ? `${fmtNum(initialEP, 1)} kWhEP/m².an` : "—"),
                sub: "Th-C-E", icon: "⚡", color: "#b45309", bg: "#fffbeb",
              },
            ].map(({ label, value, sub, icon, color, bg }) => (
              <div key={label} style={{
                background: bg, border: `1.5px solid ${color}30`,
                borderRadius: 8, padding: "12px 14px",
                display: "flex", flexDirection: "column",
              }}>
                <div style={{ fontSize: 18, marginBottom: 4 }}>{icon}</div>
                <div style={{ fontSize: 8, color: "#64748b", textTransform: "uppercase", letterSpacing: 0.5 }}>{label}</div>
                <div style={{ fontSize: 17, fontWeight: 800, color, marginTop: 3, lineHeight: 1.2 }}>{value}</div>
                {sub && <div style={{ fontSize: 8, color: "#94a3b8", marginTop: 2 }}>{sub}</div>}
              </div>
            ))}
          </div>

          {/* Ligne 3 : Mission + Bureau */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginBottom: 20 }}>

            {/* Mission */}
            <div style={{ border: "1px solid #e2e8f0", borderRadius: 8, overflow: "hidden" }}>
              <div style={{ background: "#1e3a5f", color: "#fff", padding: "6px 12px", fontSize: 8, fontWeight: 700, textTransform: "uppercase", letterSpacing: 1 }}>
                Informations mission
              </div>
              <div style={{ padding: "10px 12px", display: "grid", gridTemplateColumns: "1fr 1fr", gap: "6px 12px" }}>
                {meta && [
                  { l: "Bénéficiaire", v: meta.beneficiaire },
                  { l: "Maître d'œuvre", v: meta.maitreDoeuvre },
                  { l: "Date de visite", v: meta.dateVisite },
                  { l: "Date de réalisation", v: meta.dateRealisation },
                  { l: "Date de restitution", v: meta.dateRestitution },
                  { l: "Référence dossier", v: meta.reference },
                ].filter(r => r.v).map(({ l, v }) => (
                  <div key={l}>
                    <div style={{ fontSize: 7, color: "#94a3b8", textTransform: "uppercase" }}>{l}</div>
                    <div style={{ fontSize: 9, fontWeight: 600, color: "#1e3a5f" }}>{v}</div>
                  </div>
                ))}
                {!meta && (
                  <div style={{ fontSize: 9, color: "#94a3b8", gridColumn: "span 2" }}>
                    Données de mission non renseignées
                  </div>
                )}
              </div>
            </div>

            {/* Bureau d'études */}
            <div style={{ border: "1px solid #e2e8f0", borderRadius: 8, overflow: "hidden" }}>
              <div style={{ background: "#1d4ed8", color: "#fff", padding: "6px 12px", fontSize: 8, fontWeight: 700, textTransform: "uppercase", letterSpacing: 1 }}>
                Bureau d'études
              </div>
              <div style={{ padding: "10px 12px" }}>
                {meta?.bureauEtudes ? (
                  <>
                    <div style={{ fontSize: 12, fontWeight: 800, color: "#1e3a5f", marginBottom: 4 }}>{meta.bureauEtudes}</div>
                    {meta.bureauAdresse && <div style={{ fontSize: 9, color: "#64748b" }}>{meta.bureauAdresse}</div>}
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "4px 12px", marginTop: 6 }}>
                      {[
                        { l: "Email", v: meta.bureauEmail },
                        { l: "Téléphone", v: meta.bureauTelephone },
                        { l: "SIRET", v: meta.siret },
                        { l: "Qualification", v: meta.qualification },
                      ].filter(r => r.v).map(({ l, v }) => (
                        <div key={l}>
                          <div style={{ fontSize: 7, color: "#94a3b8", textTransform: "uppercase" }}>{l}</div>
                          <div style={{ fontSize: 8, fontWeight: 600, color: "#374151" }}>{v}</div>
                        </div>
                      ))}
                    </div>
                  </>
                ) : (
                  <div style={{ fontSize: 9, color: "#94a3b8" }}>Bureau d'études non renseigné</div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* ── PIED DE PAGE ── */}
        <div style={{
          background: "#0f172a",
          color: "#fff",
          padding: "10px 56px",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          fontSize: 8,
          flexShrink: 0,
          marginTop: "auto",
        }}>
          <span style={{ opacity: 0.5 }}>
            {meta?.bureauEtudes ?? "AuditTech Pro"} — Rapport d'Audit Énergétique
          </span>
          <span style={{ opacity: 0.4 }}>Confidentiel</span>
          <span style={{ opacity: 0.5 }}>Page de garde</span>
        </div>
      </div>

      {/* ══ PAGE 2 — SYNTHÈSE GLOBALE ════════════════════════════════════════ */}
      {!isPreview && <div className="print-page-break" />}
      <div className={isPreview ? undefined : "print-page"} style={pageStyle}>
        <SectionTitle num="1" title="Synthèse audit énergétique globale" subtitle="Comparaison des indicateurs entre l'état initial et les scénarios de travaux" />

        {/* Comparison table */}
        <table style={{ width: "100%", borderCollapse: "collapse", marginBottom: 20, fontSize: 10 }}>
          <thead>
            <tr style={{ background: "#1e3a5f" }}>
              <th style={{ ...thStyle, textAlign: "left", width: "30%" }}>Indicateur</th>
              {tableCols.map((col) => (
                <th key={col.key} style={{ ...thStyle, background: col.color, width: `${70 / tableCols.length}%` }}>
                  {col.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {/* DPE label */}
            <tr style={rowEven}>
              <td style={tdLeft}>Étiquette DPE</td>
              <td style={td}><DpeLabel label={report.energyLabel.currentLabel} /></td>
              {scData.map((sc) => (
                <td key={sc.code} style={td}><DpeLabel label={sc.dpeLabel} /></td>
              ))}
            </tr>
            {/* CEP */}
            <tr style={rowOdd}>
              <td style={tdLeft}>CEP (kWhEP/m².an)<br /><span style={{ color: "#94a3b8", fontSize: 9 }}>5 usages — Th-C-E</span></td>
              <td style={td}>{fmtNum(thceInitial, 1)}</td>
              {scData.map((sc) => (
                <td key={sc.code} style={{ ...td, color: "#16a34a", fontWeight: 700 }}>{fmtNum(sc.thce, 1)}</td>
              ))}
            </tr>
            {/* CEF */}
            <tr style={rowEven}>
              <td style={tdLeft}>CEF (kWhef/m².an)<br /><span style={{ color: "#94a3b8", fontSize: 9 }}>Th-C-E</span></td>
              <td style={td}>{fmtNum(cefInitial, 1)}</td>
              {scData.map((sc) => (
                <td key={sc.code} style={{ ...td, color: "#2563eb", fontWeight: 700 }}>{fmtNum(sc.cef, 1)}</td>
              ))}
            </tr>
            {/* GES */}
            <tr style={rowOdd}>
              <td style={tdLeft}>GES (kgCO₂/m².an)</td>
              <td style={td}>{fmtNum(gesInitial, 1)}</td>
              {scData.map((sc) => (
                <td key={sc.code} style={{ ...td, color: "#16a34a", fontWeight: 700 }}>{fmtNum(sc.ges, 1)}</td>
              ))}
            </tr>
            {/* Cost */}
            <tr style={rowEven}>
              <td style={tdLeft}>Coût annuel (€/an)</td>
              <td style={td}>{fmtNum(initialCost)}</td>
              {scData.map((sc) => (
                <td key={sc.code} style={{ ...td, color: "#1d4ed8", fontWeight: 700 }}>{fmtNum(sc.cost)}</td>
              ))}
            </tr>
            {/* CEP 3 usages */}
            {(meta?.cep3UsagesInitial !== null && meta?.cep3UsagesInitial !== undefined) && (
              <tr style={rowEven}>
                <td style={tdLeft}>CEP (kWhEP/m².an)<br /><span style={{ color: "#94a3b8", fontSize: 9 }}>3 usages</span></td>
                <td style={td}>{fmtNum(meta.cep3UsagesInitial, 1)}</td>
                {scData.map((sc) => (
                  <td key={sc.code} style={{ ...td, color: "#16a34a", fontWeight: 700 }}>{fmtNum(sc.cep3, 1)}</td>
                ))}
              </tr>
            )}
            {/* Gain */}
            {scData.some((sc) => sc.gainPct !== null) && (
              <tr style={rowOdd}>
                <td style={tdLeft}>Gain énergétique (%)</td>
                <td style={td}>—</td>
                {scData.map((sc) => (
                  <td key={sc.code} style={{ ...td, color: "#16a34a", fontWeight: 700 }}>
                    {sc.gainPct !== null ? `${fmtNum(sc.gainPct, 1)} %` : "—"}
                  </td>
                ))}
              </tr>
            )}
            {/* Gain économique */}
            {scData.some((sc) => sc.gainEconomiqueEur !== null) && (
              <tr style={rowEven}>
                <td style={tdLeft}>Gain économique (€/an)</td>
                <td style={td}>—</td>
                {scData.map((sc) => (
                  <td key={sc.code} style={{ ...td, color: "#2563eb", fontWeight: 700 }}>
                    {sc.gainEconomiqueEur !== null ? `${fmtNum(sc.gainEconomiqueEur)} €` : "—"}
                  </td>
                ))}
              </tr>
            )}
            {/* Taux ENR&R */}
            {scData.some((sc) => sc.tauxEnrRPct !== null) && (
              <tr style={rowOdd}>
                <td style={tdLeft}>Taux ENR&R (%)</td>
                <td style={td}>—</td>
                {scData.map((sc) => (
                  <td key={sc.code} style={{ ...td, color: "#7c3aed", fontWeight: 700 }}>
                    {sc.tauxEnrRPct !== null ? `${fmtNum(sc.tauxEnrRPct, 2)} %` : "—"}
                  </td>
                ))}
              </tr>
            )}
            {/* Prime BAR-TH-145 */}
            {scData.some((sc) => sc.primeBarTh145Euros !== null) && (
              <tr style={rowEven}>
                <td style={tdLeft}>Prime BAR-TH-145 (€)</td>
                <td style={td}>—</td>
                {scData.map((sc) => (
                  <td key={sc.code} style={{ ...td, color: "#dc2626", fontWeight: 700 }}>
                    {sc.primeBarTh145Euros !== null ? `${fmtNum(sc.primeBarTh145Euros)} €` : "—"}
                  </td>
                ))}
              </tr>
            )}
          </tbody>
        </table>

        {/* Scenario cards */}
        {scData.length > 0 && (
          <>
            <SectionTitle num="2" title="Détail des scénarios de travaux" />
            <div style={{ display: "grid", gridTemplateColumns: `repeat(${Math.min(scData.length, 3)}, 1fr)`, gap: 12 }}>
              {scData.map((sc, i) => {
                const palette = ["#16a34a", "#2563eb", "#7c3aed", "#dc2626", "#ea580c"][i] ?? "#374151";
                const descKey = `SCÉNARIO ${sc.code} - Description`;
                const desc = rawFields.find((f) => f.key === descKey)?.value
                  || rawFields.find((f) => f.key.startsWith(`SCÉNARIO ${sc.code}`) && f.key.includes("Description"))?.value;
                return (
                  <div key={sc.code} style={{ border: `2px solid ${palette}`, borderRadius: 6, padding: 12, pageBreakInside: "avoid" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                      <span style={{ fontWeight: 800, color: palette, fontSize: 13 }}>{sc.code}</span>
                      {sc.dpeLabel && <DpeLabel label={sc.dpeLabel} />}
                    </div>
                    {sc.label && sc.label !== sc.code && (
                      <div style={{ fontSize: 10, fontWeight: 600, marginBottom: 4, color: "#374151" }}>{sc.label}</div>
                    )}
                    {desc && (
                      <div style={{ fontSize: 9, color: "#64748b", marginBottom: 6, lineHeight: 1.4 }}>{desc}</div>
                    )}

                    {/* Travaux list from BAO metadata */}
                    {sc.travaux.length > 0 && (
                      <div style={{ marginBottom: 8 }}>
                        <div style={{ fontSize: 8, fontWeight: 700, color: palette, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 4 }}>Travaux préconisés</div>
                        <ul style={{ margin: 0, paddingLeft: 14, fontSize: 8.5, color: "#374151", lineHeight: 1.5 }}>
                          {sc.travaux.map((t, ti) => <li key={ti}>{t}</li>)}
                        </ul>
                      </div>
                    )}

                    {/* Isolation / CVC states */}
                    {(sc.isolationToitures || sc.isolationMurs || sc.isolationPlancherBas || sc.energieChauffagePrincipal) && (
                      <div style={{ marginBottom: 8, background: "#f8fafc", borderRadius: 4, padding: "4px 6px" }}>
                        <div style={{ fontSize: 8, fontWeight: 700, color: "#64748b", marginBottom: 3 }}>ÉTAT APRÈS TRAVAUX</div>
                        {[
                          { l: "Isolation toitures", v: sc.isolationToitures },
                          { l: "Isolation murs", v: sc.isolationMurs },
                          { l: "Isolation plancher bas", v: sc.isolationPlancherBas },
                          { l: "Énergie principale", v: sc.energieChauffagePrincipal },
                        ].filter((r) => r.v).map(({ l, v }) => (
                          <div key={l} style={{ display: "flex", gap: 4, fontSize: 8, marginBottom: 1 }}>
                            <span style={{ color: "#94a3b8", minWidth: 100 }}>{l} :</span>
                            <span style={{ fontWeight: 600 }}>{v}</span>
                          </div>
                        ))}
                      </div>
                    )}

                    <table style={{ width: "100%", fontSize: 9, borderCollapse: "collapse" }}>
                      <tbody>
                        {[
                          { l: "Investissement TTC", v: sc.invest !== null ? `${fmtNum(sc.invest)} €` : null },
                          { l: "Temps de retour simple", v: sc.payback !== null ? `${fmtNum(sc.payback, 1)} ans` : null },
                          { l: "Gain énergétique", v: sc.gainPct !== null ? `${fmtNum(sc.gainPct, 1)} %` : null },
                          { l: "Gain économique", v: sc.gainEconomiqueEur !== null ? `${fmtNum(sc.gainEconomiqueEur)} €/an` : null },
                          { l: "Dépense annuelle", v: sc.cost !== null ? `${fmtNum(sc.cost)} €/an` : null },
                          { l: "CEP 5 usages (kWhEP/m².an)", v: sc.thce !== null ? fmtNum(sc.thce, 1) : null },
                          { l: "CEP 3 usages (kWhEP/m².an)", v: sc.cep3 !== null ? fmtNum(sc.cep3, 1) : null },
                          { l: "GES (kgCO₂/m².an)", v: sc.ges !== null ? fmtNum(sc.ges, 1) : null },
                          { l: "Taux ENR&R", v: sc.tauxEnrRPct !== null ? `${fmtNum(sc.tauxEnrRPct, 2)} %` : null },
                          { l: "Prime BAR-TH-145", v: sc.primeBarTh145Euros !== null ? `${fmtNum(sc.primeBarTh145Euros)} €` : null },
                        ].filter((r) => r.v !== null).map(({ l, v }) => (
                          <tr key={l}>
                            <td style={{ padding: "2px 4px", color: "#64748b", borderBottom: "1px solid #f1f5f9" }}>{l}</td>
                            <td style={{ padding: "2px 4px", fontWeight: 600, textAlign: "right", borderBottom: "1px solid #f1f5f9" }}>{v}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                );
              })}
            </div>
          </>
        )}

        <PrintFooter page={2} building={b.name} />
      </div>

      {/* ══ PAGE 3 — CONSOMMATIONS ═══════════════════════════════════════════ */}
      {!isPreview && <div className="print-page-break" />}
      <div className={isPreview ? undefined : "print-page"} style={pageStyle}>
        <SectionTitle num="3" title="Consommations énergétiques par usage" subtitle="État initial — répartition par poste (méthode Th-C-E)" />

        {consumPostes.length > 0 ? (
          <>
            <table style={{ width: "100%", borderCollapse: "collapse", marginBottom: 16, fontSize: 10 }}>
              <thead>
                <tr style={{ background: "#1e3a5f", color: "#fff" }}>
                  <th style={{ ...thStyle, textAlign: "left", width: "22%" }}>Poste</th>
                  <th style={{ ...thStyle, textAlign: "left", width: "18%" }}>Source d'énergie</th>
                  <th style={thStyle}>Énergie finale</th>
                  <th style={thStyle}>Énergie primaire</th>
                </tr>
              </thead>
              <tbody>
                {consumPostes.map((r, i) => (
                  <tr key={r.poste} style={i % 2 === 0 ? rowEven : rowOdd}>
                    <td style={{ ...tdLeft, fontWeight: 600 }}>{POSTE_LABELS[r.poste] ?? r.label}</td>
                    <td style={{ ...tdLeft, color: "#64748b" }}>{r.source ?? "—"}</td>
                    <td style={td}>{r.finalRaw ?? "—"}</td>
                    <td style={td}>{r.primRaw ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            {/* Bar chart — energie primaire */}
            {consumPostes.some((r) => r.kwhEP !== null) && (
              <div style={{ marginBottom: 16 }}>
                <div style={{ fontSize: 10, fontWeight: 600, color: "#64748b", marginBottom: 8 }}>Répartition graphique — Énergie primaire (kWhEP/m².an)</div>
                {consumPostes.filter((r) => r.kwhEP !== null).map((r) => {
                  const maxEp = Math.max(...consumPostes.map((p) => p.kwhEP ?? 0));
                  const pct = maxEp > 0 ? ((r.kwhEP ?? 0) / maxEp) * 100 : 0;
                  const color = POSTE_COLORS[r.poste] ?? "#6b7280";
                  return (
                    <div key={r.poste} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 5 }}>
                      <div style={{ width: 110, fontSize: 9, color: "#374151", textAlign: "right", flexShrink: 0 }}>
                        {POSTE_LABELS[r.poste] ?? r.label}
                      </div>
                      <div style={{ flex: 1, background: "#f1f5f9", borderRadius: 3, height: 16, overflow: "hidden" }}>
                        <div style={{ width: `${pct}%`, background: color, height: "100%", borderRadius: 3 }} />
                      </div>
                      <div style={{ width: 90, fontSize: 9, color: "#64748b", textAlign: "right" }}>
                        {r.primRaw ?? "—"}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </>
        ) : (
          <div style={{ padding: "20px", textAlign: "center", color: "#94a3b8", fontSize: 10, border: "1px dashed #e2e8f0", borderRadius: 6, marginBottom: 16 }}>
            Données de consommation par poste non disponibles dans ce fichier BAO.
          </div>
        )}

        {/* UBAT — bilan thermique */}
        {ubatRows.length > 0 && (
          <>
            <SectionTitle num="3b" title="Bilan thermique — UBAT" subtitle="Déperditions de l'enveloppe — état initial" />
            <table style={{ width: "100%", borderCollapse: "collapse", marginBottom: 16, fontSize: 10 }}>
              <thead>
                <tr style={{ background: "#4338ca", color: "#fff" }}>
                  <th style={{ ...thStyle, textAlign: "left", width: "60%" }}>Indicateur</th>
                  <th style={{ ...thStyle, textAlign: "right" }}>Valeur</th>
                </tr>
              </thead>
              <tbody>
                {ubatRows.map(({ label, key }, i) => (
                  <tr key={key} style={i % 2 === 0 ? rowEven : rowOdd}>
                    <td style={{ ...tdLeft, fontWeight: i === 0 ? 700 : 400, color: i === 0 ? "#4338ca" : "#374151" }}>{label}</td>
                    <td style={{ ...td, fontWeight: i === 0 ? 700 : 600, color: i === 0 ? "#4338ca" : "#1e293b", textAlign: "right" }}>
                      {getRaw(rawFields, key)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </>
        )}

        <PrintFooter page={3} building={b.name} />
      </div>

      {/* ══ PAGE 4 — BÂTIMENT & DONNÉES TECHNIQUES ═══════════════════════════ */}
      {!isPreview && <div className="print-page-break" />}
      <div className={isPreview ? undefined : "print-page"} style={pageStyle}>
        <SectionTitle num="4" title="Données bâtiment" subtitle="Caractéristiques générales, climatiques et de l'enveloppe" />

        {/* — Données générales bâtiment — */}
        {(() => {
          const batRows = [
            { label: "Type de bâtiment", key: "Type de bâtiment" },
            { label: "Année de construction", key: "Année de construction" },
            { label: "Nombre de niveaux", key: "Nombre de niveaux" },
            { label: "Hauteur du bâtiment", key: "Hauteur du bâtiment" },
            { label: "Surface habitable", key: "Surface habitable" },
            { label: "Surface SHON", key: "Surface SHON" },
            { label: "Surface vitrée totale", key: "Surface vitrée totale" },
            { label: "Département", key: "Département" },
            { label: "Bordure de mer", key: "Bordure de mer" },
          ].filter(r => getRaw(rawFields, r.key));
          if (batRows.length === 0) return null;
          return (
            <table style={{ width: "100%", borderCollapse: "collapse", marginBottom: 16, fontSize: 10 }}>
              <thead>
                <tr style={{ background: "#0f766e", color: "#fff" }}>
                  <th style={{ ...thStyle, textAlign: "left", width: "40%" }}>Caractéristique</th>
                  <th style={{ ...thStyle, textAlign: "left" }}>Valeur</th>
                </tr>
              </thead>
              <tbody>
                {batRows.map(({ label, key }, i) => (
                  <tr key={key} style={i % 2 === 0 ? rowEven : rowOdd}>
                    <td style={{ ...tdLeft, fontWeight: 600 }}>{label}</td>
                    <td style={tdLeft}>{getRaw(rawFields, key)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          );
        })()}

        {/* — Localisation & Données météorologiques — */}
        {(() => {
          const station   = getRaw(rawFields, "Station météo");
          const dept      = getRaw(rawFields, "Département");
          const zone      = getRaw(rawFields, "Zone climatique");
          const tBase     = getRaw(rawFields, "Température extérieure de base");
          const dju       = getRaw(rawFields, "Degrés-jours base 18°C");
          const altitude  = getRaw(rawFields, "Altitude");
          const bordure   = getRaw(rawFields, "Bordure de mer");
          const coords    = resolveCoords(station);
          const hasClim   = station || zone || tBase || dju || altitude;
          if (!hasClim) return null;

          const meteoRows = [
            { icon: "📍", label: "Département", val: dept },
            { icon: "🌡️", label: "Station météo", val: station },
            { icon: "🗺️", label: "Zone climatique", val: zone },
            { icon: "❄️", label: "Température extérieure de base", val: tBase },
            { icon: "📊", label: "Degrés-jours unifiés (base 18°C)", val: dju ? `${dju} DJU` : null },
            { icon: "⛰️", label: "Altitude", val: altitude },
            { icon: "🌊", label: "Bordure de mer", val: bordure },
          ].filter(r => r.val);

          return (
            <div style={{ marginBottom: 18 }}>
              {/* Header */}
              <div style={{
                background: "#1d4ed8",
                color: "#fff",
                borderRadius: "6px 6px 0 0",
                padding: "6px 12px",
                fontSize: 10,
                fontWeight: 700,
                textTransform: "uppercase",
                letterSpacing: 0.8,
                display: "flex",
                alignItems: "center",
                gap: 6,
              }}>
                <span>🌍</span>
                <span>Localisation &amp; Données météorologiques</span>
              </div>

              {/* Body: map left + table right */}
              <div style={{
                border: "1px solid #bfdbfe",
                borderTop: "none",
                borderRadius: "0 0 6px 6px",
                display: "flex",
                gap: 0,
                overflow: "hidden",
              }}>
                {/* Static map */}
                {coords && (
                  <div
                    data-map-container="1"
                    style={{
                      width: 220,
                      flexShrink: 0,
                      position: "relative",
                      borderRight: "1px solid #bfdbfe",
                      background: "#dbeafe",
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <img
                      src={staticMapUrl(coords.lat, coords.lon, 11)}
                      alt={`Carte localisation ${station ?? ""}`}
                      style={{ width: "100%", height: "100%", objectFit: "cover", display: "block", position: "absolute", top: 0, left: 0 }}
                      crossOrigin="anonymous"
                      onError={(e) => {
                        (e.currentTarget as HTMLImageElement).style.display = "none";
                      }}
                    />
                    {/* Coordinate badge (always visible under map or as fallback) */}
                    <div style={{
                      position: "relative",
                      zIndex: 1,
                      textAlign: "center",
                      padding: 12,
                    }}>
                      <div style={{ fontSize: 28, marginBottom: 6 }}>📍</div>
                      <div style={{ fontSize: 9, fontWeight: 700, color: "#1e3a5f" }}>
                        {coords.lat.toFixed(4)}°N
                      </div>
                      <div style={{ fontSize: 9, fontWeight: 700, color: "#1e3a5f" }}>
                        {Math.abs(coords.lon).toFixed(4)}°{coords.lon >= 0 ? "E" : "O"}
                      </div>
                      {station && (
                        <div style={{ fontSize: 8, color: "#475569", marginTop: 4, fontStyle: "italic" }}>
                          {station}
                        </div>
                      )}
                    </div>
                    {/* Coordinates badge overlaid on map */}
                    <div style={{
                      position: "absolute",
                      bottom: 4,
                      left: 4,
                      background: "rgba(30,58,95,0.85)",
                      color: "#fff",
                      borderRadius: 3,
                      padding: "2px 5px",
                      fontSize: 7,
                      fontFamily: "monospace",
                      zIndex: 2,
                    }}>
                      {coords.lat.toFixed(3)}°N {Math.abs(coords.lon).toFixed(3)}°{coords.lon >= 0 ? "E" : "O"}
                    </div>
                  </div>
                )}

                {/* Meteorological data table */}
                <div style={{ flex: 1 }}>
                  <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 9.5 }}>
                    <tbody>
                      {meteoRows.map(({ icon, label, val }, i) => (
                        <tr key={label} style={i % 2 === 0
                          ? { background: "#eff6ff" }
                          : { background: "#fff" }
                        }>
                          <td style={{ padding: "5px 8px", color: "#64748b", fontWeight: 600, width: "55%", borderBottom: "1px solid #e2e8f0" }}>
                            <span style={{ marginRight: 4 }}>{icon}</span>{label}
                          </td>
                          <td style={{ padding: "5px 8px", fontWeight: 700, color: "#1e3a5f", borderBottom: "1px solid #e2e8f0" }}>
                            {val}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {/* DJU highlight */}
                  {dju && (
                    <div style={{
                      background: "#1d4ed8",
                      color: "#fff",
                      padding: "6px 12px",
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      fontSize: 9,
                    }}>
                      <span style={{ textTransform: "uppercase", letterSpacing: 0.5 }}>Rigueur climatique (DJU base 18°C)</span>
                      <span style={{ fontSize: 14, fontWeight: 800 }}>{dju} DJU</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })()}

        {/* — Diagrammes météo : températures + DJU — */}
        {monthlyWeather && (
          <div style={{ marginBottom: 18 }}>
            {/* Header */}
            <div style={{
              background: "#0369a1",
              color: "#fff",
              borderRadius: "6px 6px 0 0",
              padding: "6px 12px",
              fontSize: 10,
              fontWeight: 700,
              textTransform: "uppercase",
              letterSpacing: 0.8,
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
            }}>
              <span>📈 Températures mensuelles — {stationRaw} ({new Date().getFullYear() - 1})</span>
              <span style={{ fontSize: 9, opacity: 0.85 }}>Source : Open-Meteo Archives</span>
            </div>
            <div style={{ border: "1px solid #bae6fd", borderTop: "none", borderRadius: "0 0 6px 6px", padding: "10px 8px 4px 0", background: "#fff" }}>
              <AreaChart width={660} height={190} data={monthlyWeather} margin={{ top: 5, right: 10, left: -10, bottom: 0 }}>
                <defs>
                  <linearGradient id="prtMax" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#f97316" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#f97316" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="prtMin" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.25} />
                    <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis dataKey="month" tick={{ fontSize: 10 }} />
                <YAxis tick={{ fontSize: 10 }} unit="°C" width={38} />
                <Tooltip formatter={(v: number) => `${v}°C`} />
                <Legend wrapperStyle={{ fontSize: 10, paddingTop: 4 }} />
                <Area type="monotone" dataKey="tMax" name="T° max" stroke="#f97316" fill="url(#prtMax)" strokeWidth={2} dot={false} />
                <Area type="monotone" dataKey="tMean" name="T° moy." stroke="#8b5cf6" fill="none" strokeWidth={1.5} strokeDasharray="4 2" dot={false} />
                <Area type="monotone" dataKey="tMin" name="T° min" stroke="#3b82f6" fill="url(#prtMin)" strokeWidth={2} dot={false} />
              </AreaChart>
            </div>

            {/* DJU chart */}
            <div style={{ marginTop: 10 }}>
              <div style={{
                background: "#1d4ed8",
                color: "#fff",
                borderRadius: "6px 6px 0 0",
                padding: "6px 12px",
                fontSize: 10,
                fontWeight: 700,
                textTransform: "uppercase",
                letterSpacing: 0.8,
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
              }}>
                <span>📊 Degrés-Jours Unifiés mensuels (DJU base 18°C)</span>
                <span style={{ fontSize: 9, opacity: 0.85, fontWeight: 600 }}>
                  Total calculé : {monthlyWeather.reduce((s, m) => s + m.dju, 0)} DJU
                  {dju && ` — BAO : ${dju}`}
                </span>
              </div>
              <div style={{ border: "1px solid #bfdbfe", borderTop: "none", borderRadius: "0 0 6px 6px", padding: "8px 8px 4px 0", background: "#fff" }}>
                <BarChart width={660} height={140} data={monthlyWeather} margin={{ top: 5, right: 10, left: -10, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis dataKey="month" tick={{ fontSize: 10 }} />
                  <YAxis tick={{ fontSize: 10 }} width={38} />
                  <Tooltip formatter={(v: number) => `${v} DJU`} />
                  <Bar dataKey="dju" name="DJU" fill="#3b82f6" radius={[3, 3, 0, 0]} />
                </BarChart>
              </div>
            </div>
          </div>
        )}

        {/* — Enveloppe thermique — */}
        {envelopeRows.length > 0 && (
          <div style={{ marginBottom: 16 }}>
            <div style={{ fontSize: 9, fontWeight: 700, color: "#1e3a5f", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 6 }}>Enveloppe thermique</div>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 10 }}>
              <thead>
                <tr style={{ background: "#1e3a5f", color: "#fff" }}>
                  <th style={{ ...thStyle, textAlign: "left", width: "35%" }}>Élément</th>
                  <th style={{ ...thStyle, textAlign: "left" }}>Description</th>
                </tr>
              </thead>
              <tbody>
                {envelopeRows.map(({ label, key }, i) => (
                  <tr key={key} style={i % 2 === 0 ? rowEven : rowOdd}>
                    <td style={{ ...tdLeft, fontWeight: 600 }}>{label}</td>
                    <td style={tdLeft}>{getRaw(rawFields, key)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* — Section characteristics (observations saisies) — */}
        {SECTION_ORDER.some(cat => chars[cat]) && (
          <div style={{ marginBottom: 16 }}>
            <div style={{ fontSize: 9, fontWeight: 700, color: "#1e3a5f", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 6 }}>Observations par catégorie</div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              {SECTION_ORDER.map((cat) => {
                const text = chars[cat];
                if (!text) return null;
                return (
                  <div key={cat} style={{ border: "1px solid #e2e8f0", borderRadius: 6, padding: 8, pageBreakInside: "avoid" }}>
                    <div style={{ fontWeight: 700, fontSize: 9, color: "#1e3a5f", marginBottom: 4, borderBottom: "1px solid #e2e8f0", paddingBottom: 3 }}>
                      {SECTION_LABELS[cat]}
                    </div>
                    <div style={{ fontSize: 8.5, color: "#374151", lineHeight: 1.5, whiteSpace: "pre-wrap" }}>{text}</div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        <PrintFooter page={4} building={b.name} />
      </div>

      {/* ══ PAGE 5 — SYSTÈMES TECHNIQUES ════════════════════════════════════════ */}
      {!isPreview && <div className="print-page-break" />}
      <div className={isPreview ? undefined : "print-page"} style={pageStyle}>
        <SectionTitle num="5" title="Systèmes techniques" subtitle="Chauffage, ECS, ventilation, climatisation — état initial" />

        {systemRows.length > 0 ? (
          <table style={{ width: "100%", borderCollapse: "collapse", marginBottom: 20, fontSize: 10 }}>
            <thead>
              <tr style={{ background: "#7c3aed", color: "#fff" }}>
                <th style={{ ...thStyle, textAlign: "left", width: "35%" }}>Système</th>
                <th style={{ ...thStyle, textAlign: "left" }}>Description / valeur</th>
              </tr>
            </thead>
            <tbody>
              {systemRows.map(({ label, key }, i) => (
                <tr key={key} style={i % 2 === 0 ? rowEven : rowOdd}>
                  <td style={{ ...tdLeft, fontWeight: 600 }}>{label}</td>
                  <td style={tdLeft}>{getRaw(rawFields, key)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <div style={{ padding: 16, color: "#94a3b8", fontSize: 10, border: "1px dashed #e2e8f0", borderRadius: 6, marginBottom: 16 }}>
            Données systèmes CVC non disponibles dans ce fichier.
          </div>
        )}

        {/* — Répartition des déperditions — */}
        {(() => {
          const deperdRows = [
            { label: "Murs extérieurs", key: "Déperditions murs" },
            { label: "Planchers bas", key: "Déperditions planchers" },
            { label: "Toitures / plafonds", key: "Déperditions toitures" },
            { label: "Menuiseries", key: "Déperditions menuiseries" },
            { label: "Renouvellement d'air", key: "Déperditions renouvellement air" },
            { label: "Ponts thermiques", key: "Déperditions ponts thermiques" },
          ].filter(r => getRaw(rawFields, r.key));

          // Try getting all RÉPARTITION DÉPERDITIONS section fields dynamically
          const depSection = rawFields.filter(f => f.section === "RÉPARTITION DÉPERDITIONS");

          if (depSection.length === 0 && deperdRows.length === 0) return null;

          const rows = depSection.length > 0 ? depSection : deperdRows.map(r => ({ key: r.label, value: getRaw(rawFields, r.key) ?? "—" }));

          return (
            <div style={{ marginBottom: 16 }}>
              <div style={{ fontSize: 9, fontWeight: 700, color: "#7c3aed", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 6 }}>Répartition des déperditions</div>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 10 }}>
                <thead>
                  <tr style={{ background: "#7c3aed", color: "#fff" }}>
                    <th style={{ ...thStyle, textAlign: "left", width: "55%" }}>Poste</th>
                    <th style={{ ...thStyle, textAlign: "right" }}>Valeur</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r, i) => (
                    <tr key={r.key} style={i % 2 === 0 ? rowEven : rowOdd}>
                      <td style={tdLeft}>{r.key}</td>
                      <td style={{ ...td, textAlign: "right", fontWeight: 600 }}>{r.value}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          );
        })()}

        <PrintFooter page={5} building={b.name} />
      </div>

      {/* ══ PAGE 5+ — PHOTOS ════════════════════════════════════════════════ */}
      {Object.keys(photosByCategory).length > 0 && (
        <>
          {!isPreview && <div className="print-page-break" />}
          <div className={isPreview ? undefined : "print-page"} style={pageStyle}>
            <SectionTitle num="6" title="Photos du bâtiment" subtitle="Relevé photographique par catégorie" />
            {SECTION_ORDER.map((cat) => {
              const catPhotos = photosByCategory[cat];
              if (!catPhotos) return null;
              return (
                <div key={cat} style={{ marginBottom: 20, pageBreakInside: "avoid" }}>
                  <div style={{ fontWeight: 700, fontSize: 10, color: "#1e3a5f", background: "#f8fafc", border: "1px solid #e2e8f0", padding: "5px 10px", borderRadius: 4, marginBottom: 8 }}>
                    {SECTION_LABELS[cat] ?? cat}
                  </div>
                  {chars[cat] && (
                    <div style={{ fontSize: 9, color: "#64748b", marginBottom: 8, lineHeight: 1.4, padding: "6px 10px", background: "#f8fafc", borderRadius: 4 }}>
                      {chars[cat]}
                    </div>
                  )}
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8 }}>
                    {catPhotos.map((photo) => (
                      <div key={photo.id} style={{ pageBreakInside: "avoid" }}>
                        <img
                          src={`${apiBase}${photo.url}`}
                          alt={photo.caption || photo.fileName}
                          style={{ width: "100%", height: 120, objectFit: "cover", borderRadius: 4, border: "1px solid #e2e8f0", display: "block" }}
                        />
                        {photo.caption && (
                          <div style={{ fontSize: 8, color: "#64748b", textAlign: "center", marginTop: 3 }}>{photo.caption}</div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
            <PrintFooter page={6} building={b.name} />
          </div>
        </>
      )}
    </div>
  );
}

// ── Footer ────────────────────────────────────────────────────────────────────

function PrintFooter({ page, building }: { page: number; building?: string | null }) {
  return (
    <div style={{ borderTop: "1px solid #e2e8f0", paddingTop: 6, display: "flex", justifyContent: "space-between", fontSize: 8, color: "#94a3b8", marginTop: 20 }}>
      <span>AuditTech Pro — Rapport d'audit énergétique</span>
      <span>{building}</span>
      <span>Page {page}</span>
    </div>
  );
}

// ── Style constants ───────────────────────────────────────────────────────────

const thStyle: React.CSSProperties = {
  color: "#fff", padding: "6px 10px", textAlign: "center", fontSize: 10, fontWeight: 700,
};
const td: React.CSSProperties = {
  padding: "5px 10px", textAlign: "center", fontSize: 10, borderBottom: "1px solid #f1f5f9",
};
const tdLeft: React.CSSProperties = {
  ...td, textAlign: "left",
};
const rowEven: React.CSSProperties = { background: "#ffffff" };
const rowOdd: React.CSSProperties = { background: "#f8fafc" };

const POSTE_LABELS: Record<string, string> = {
  CHAUFFAGE: "Chauffage",
  REFROIDISSEMENT: "Refroidissement",
  ECS: "Eau Chaude Sanitaire",
  ECLAIRAGE: "Éclairage",
  AUXILIAIRES: "Auxiliaires",
};

const POSTE_COLORS: Record<string, string> = {
  CHAUFFAGE: "#ef4444",
  REFROIDISSEMENT: "#3b82f6",
  ECS: "#f97316",
  ECLAIRAGE: "#eab308",
  AUXILIAIRES: "#8b5cf6",
};
