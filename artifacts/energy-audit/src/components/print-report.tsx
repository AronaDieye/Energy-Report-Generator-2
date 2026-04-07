import React, { useState, useEffect } from "react";

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
  const apiBase = import.meta.env.BASE_URL.replace(/\/$/, "");
  const isPreview = mode === "preview";

  useEffect(() => {
    fetch(`${apiBase}/api/audit/reports/${report.id}/photos`)
      .then((r) => r.ok ? r.json() : [])
      .then(setPhotos)
      .catch(() => {});
  }, [report.id, apiBase]);

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

  // Consumption rows
  const consumPostes = [
    "CHAUFFAGE", "REFROIDISSEMENT", "ECS", "ECLAIRAGE", "AUXILIAIRES",
  ].map((poste) => {
    const kwhEP = parseVal(rawFields.find((f) => f.key === `${poste} - kWhEP/m²/an`)?.value);
    const kwhAn = parseVal(rawFields.find((f) => f.key === `${poste} - kWh/an`)?.value);
    const euros = parseVal(rawFields.find((f) => f.key === `${poste} - €/an`)?.value);
    return { poste, kwhEP, kwhAn, euros };
  }).filter((r) => r.kwhEP !== null || r.kwhAn !== null);

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

      {/* ══ PAGE 1 — COUVERTURE ══════════════════════════════════════════════ */}
      <div className={isPreview ? undefined : "print-page"} style={pageStyle}>

        {/* Header band */}
        <div style={{ background: "#1e3a5f", color: "#fff", padding: "16px 24px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <div style={{ fontSize: 10, opacity: 0.7, letterSpacing: 1, textTransform: "uppercase" }}>AuditTech Pro</div>
            <div style={{ fontSize: 18, fontWeight: 700 }}>Rapport d'Audit Énergétique</div>
          </div>
          <div style={{ textAlign: "right", fontSize: 9, opacity: 0.8 }}>
            <div>Généré le {printDate}</div>
            <div>Fichier : {report.fileName.slice(0, 60)}</div>
          </div>
        </div>

        {/* Building identity card */}
        <div style={{ background: "#f8fafc", border: "1px solid #e2e8f0", margin: "20px 0 16px", padding: 20, borderRadius: 6 }}>
          <div style={{ display: "flex", gap: 24, alignItems: "flex-start" }}>
            {/* Left: building info */}
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 22, fontWeight: 800, color: "#1e3a5f", marginBottom: 4 }}>
                {b.name || "Bâtiment"}
              </div>
              {b.address && (
                <div style={{ fontSize: 11, color: "#64748b", marginBottom: 12 }}>{b.address}</div>
              )}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 }}>
                {[
                  { l: "Type", v: b.buildingType },
                  { l: "Année de construction", v: b.constructionYear },
                  { l: "Zone climatique", v: b.climateZone || zoneClim },
                  { l: "Surface habitable", v: b.heatedSurface ? `${fmtNum(b.heatedSurface)} m²` : null },
                  { l: "Surface SHON", v: b.totalSurface ? `${fmtNum(b.totalSurface)} m²` : null },
                  { l: "Nombre de niveaux", v: b.numberOfFloors || getRaw(rawFields, "Nombre de niveaux") },
                  { l: "Station météo", v: stationRaw },
                  { l: "Département", v: dept },
                  { l: "Altitude", v: altitude },
                ].filter((r) => r.v).map(({ l, v }) => (
                  <div key={l} style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 4, padding: "6px 10px" }}>
                    <div style={{ fontSize: 8, color: "#94a3b8", textTransform: "uppercase", letterSpacing: 0.5 }}>{l}</div>
                    <div style={{ fontSize: 11, fontWeight: 600, marginTop: 2 }}>{String(v)}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Right: DPE */}
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", background: "#1e3a5f", color: "#fff", borderRadius: 8, padding: "16px 20px", minWidth: 150, textAlign: "center" }}>
              <div style={{ fontSize: 9, opacity: 0.7, marginBottom: 6, textTransform: "uppercase", letterSpacing: 1 }}>Étiquette DPE</div>
              <div style={{ fontSize: 9, opacity: 0.6, marginBottom: 4 }}>Méthode 3CL-2021</div>
              <div style={{
                width: 60, height: 60, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: 28, fontWeight: 800,
                background: DPE_COLORS[report.energyLabel.currentLabel ?? "G"] ?? "#7f1d1d",
                marginBottom: 8,
              }}>
                {report.energyLabel.currentLabel ?? "—"}
              </div>
              <div style={{ fontSize: 13, fontWeight: 700 }}>
                {fmtNum(initialEP, 1)} <span style={{ fontSize: 9, fontWeight: 400 }}>kWhEP/m².an</span>
              </div>
              {initialGes && (
                <div style={{ fontSize: 9, opacity: 0.7, marginTop: 4 }}>{fmtNum(initialGes, 1)} kgCO₂/m².an</div>
              )}
            </div>
          </div>
        </div>

        {/* Key metrics row */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 12, marginBottom: 20 }}>
          {[
            { label: "Dépense énergétique annuelle", value: initialCost ? `${fmtNum(initialCost)} €/an` : "—", sub: "Abonnements inclus", color: "#1d4ed8" },
            { label: "Bilan CO₂ annuel", value: totalCo2 ? `${fmtNum(totalCo2 / 1000, 0)} t CO₂éq/an` : "—", sub: gesInitial ? `${fmtNum(gesInitial, 1)} kg/m².an` : "", color: "#15803d" },
            { label: "CEP initial (Th-C-E)", value: thceInitial ? `${fmtNum(thceInitial, 1)} kWhEP/m².an` : "—", sub: "5 usages", color: "#92400e" },
            { label: "DJU (base 18°C)", value: dju ?? "—", sub: stationRaw ?? "", color: "#0f766e" },
          ].map(({ label, value, sub, color }) => (
            <div key={label} style={{ border: `2px solid ${color}20`, background: `${color}08`, borderRadius: 6, padding: "10px 12px" }}>
              <div style={{ fontSize: 8, color: "#64748b", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 4 }}>{label}</div>
              <div style={{ fontSize: 16, fontWeight: 700, color }}>{value}</div>
              {sub && <div style={{ fontSize: 9, color: "#94a3b8", marginTop: 2 }}>{sub}</div>}
            </div>
          ))}
        </div>

        {/* Scenarios summary */}
        {scData.length > 0 && (
          <div style={{ background: "#f0fdf4", border: "1px solid #bbf7d0", borderRadius: 6, padding: "12px 16px", marginBottom: 20 }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: "#166534", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 8 }}>
              Scénarios de travaux proposés
            </div>
            <div style={{ display: "grid", gridTemplateColumns: `repeat(${scData.length}, 1fr)`, gap: 10 }}>
              {scData.map((sc) => (
                <div key={sc.code} style={{ background: "#fff", border: "1px solid #bbf7d0", borderRadius: 4, padding: "8px 10px" }}>
                  <div style={{ fontWeight: 700, fontSize: 11, color: "#166534", marginBottom: 4 }}>{sc.code}</div>
                  {sc.dpeLabel && (
                    <div style={{ marginBottom: 4 }}>
                      <DpeLabel label={sc.dpeLabel} />
                      <span style={{ marginLeft: 6, fontSize: 10, color: "#374151" }}>
                        {sc.thce !== null ? `${fmtNum(sc.thce, 1)} kWhEP/m².an` : ""}
                      </span>
                    </div>
                  )}
                  {sc.invest !== null && (
                    <div style={{ fontSize: 10, color: "#374151" }}>Investissement : <b>{fmtNum(sc.invest)} €</b></div>
                  )}
                  {sc.gainPct !== null && (
                    <div style={{ fontSize: 10, color: "#16a34a" }}>Gain CEP : <b>{fmtNum(sc.gainPct, 1)} %</b></div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Bureau d'études & mission info */}
        {meta && (meta.bureauEtudes || meta.maitreDoeuvre || meta.dateVisite || meta.reference) && (
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 16 }}>
            {/* Bureau d'études */}
            {(meta.bureauEtudes || meta.siret || meta.qualification || meta.bureauEmail) && (
              <div style={{ border: "1px solid #dbeafe", borderRadius: 6, padding: "10px 12px", background: "#eff6ff" }}>
                <div style={{ fontSize: 8, fontWeight: 700, color: "#1e40af", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 6 }}>Bureau d'études</div>
                {meta.bureauEtudes && <div style={{ fontSize: 11, fontWeight: 700, color: "#1e3a5f" }}>{meta.bureauEtudes}</div>}
                {meta.bureauAdresse && <div style={{ fontSize: 9, color: "#64748b", marginTop: 2 }}>{meta.bureauAdresse}</div>}
                {meta.bureauEmail && <div style={{ fontSize: 9, color: "#64748b" }}>{meta.bureauEmail}</div>}
                {meta.bureauTelephone && <div style={{ fontSize: 9, color: "#64748b" }}>{meta.bureauTelephone}</div>}
                {meta.siret && <div style={{ fontSize: 8, color: "#94a3b8", marginTop: 3 }}>SIRET : {meta.siret}</div>}
                {meta.qualification && <div style={{ fontSize: 8, color: "#94a3b8" }}>{meta.qualification}</div>}
              </div>
            )}

            {/* Mission */}
            <div style={{ border: "1px solid #d1fae5", borderRadius: 6, padding: "10px 12px", background: "#f0fdf4" }}>
              <div style={{ fontSize: 8, fontWeight: 700, color: "#166534", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 6 }}>Informations mission</div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 4 }}>
                {[
                  { l: "Maître d'œuvre", v: meta.maitreDoeuvre },
                  { l: "Client / Bénéficiaire", v: meta.beneficiaire },
                  { l: "Date de visite", v: meta.dateVisite },
                  { l: "Date de réalisation", v: meta.dateRealisation },
                  { l: "Date de restitution", v: meta.dateRestitution },
                  { l: "Référence dossier", v: meta.reference },
                  { l: "T° ext. de base", v: meta.tExtBase },
                  { l: "Rendement initial", v: meta.rendementInitial },
                ].filter((r) => r.v).map(({ l, v }) => (
                  <div key={l}>
                    <div style={{ fontSize: 7, color: "#94a3b8", textTransform: "uppercase" }}>{l}</div>
                    <div style={{ fontSize: 9, fontWeight: 600, color: "#374151" }}>{v}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Footer */}
        <div style={{ marginTop: "auto", borderTop: "1px solid #e2e8f0", paddingTop: 8, display: "flex", justifyContent: "space-between", fontSize: 8, color: "#94a3b8" }}>
          <span>AuditTech Pro — Rapport d'audit énergétique — {b.name || "Bâtiment"}</span>
          <span>Importé le {uploadDate}</span>
          <span>Page 1</span>
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
      {consumPostes.length > 0 && (
        <>
          {!isPreview && <div className="print-page-break" />}
          <div className={isPreview ? undefined : "print-page"} style={pageStyle}>
            <SectionTitle num="3" title="Consommations énergétiques par usage" subtitle="État initial — répartition par poste" />

            <table style={{ width: "100%", borderCollapse: "collapse", marginBottom: 20, fontSize: 10 }}>
              <thead>
                <tr style={{ background: "#1e3a5f", color: "#fff" }}>
                  <th style={{ ...thStyle, textAlign: "left", width: "30%" }}>Poste</th>
                  <th style={thStyle}>kWh/an</th>
                  <th style={thStyle}>kWhEP/m².an</th>
                  <th style={thStyle}>€/an</th>
                </tr>
              </thead>
              <tbody>
                {consumPostes.map((r, i) => (
                  <tr key={r.poste} style={i % 2 === 0 ? rowEven : rowOdd}>
                    <td style={{ ...tdLeft, fontWeight: 600 }}>{POSTE_LABELS[r.poste] ?? r.poste}</td>
                    <td style={td}>{fmtNum(r.kwhAn)}</td>
                    <td style={td}>{fmtNum(r.kwhEP, 1)}</td>
                    <td style={td}>{r.euros !== null ? `${fmtNum(r.euros)} €` : "—"}</td>
                  </tr>
                ))}
                {/* Total */}
                {(() => {
                  const totalKwh = consumPostes.reduce((s, r) => s + (r.kwhAn ?? 0), 0);
                  const totalEp = consumPostes.reduce((s, r) => s + (r.kwhEP ?? 0), 0);
                  const totalEur = consumPostes.reduce((s, r) => s + (r.euros ?? 0), 0);
                  return (
                    <tr style={{ background: "#1e3a5f", color: "#fff", fontWeight: 700 }}>
                      <td style={{ ...tdLeft, color: "#fff" }}>TOTAL</td>
                      <td style={{ ...td, color: "#fff" }}>{fmtNum(totalKwh)}</td>
                      <td style={{ ...td, color: "#fff" }}>{fmtNum(totalEp, 1)}</td>
                      <td style={{ ...td, color: "#fff" }}>{fmtNum(totalEur)} €</td>
                    </tr>
                  );
                })()}
              </tbody>
            </table>

            {/* Bar chart substitute: horizontal bars */}
            <div style={{ marginBottom: 16 }}>
              <div style={{ fontSize: 10, fontWeight: 600, color: "#64748b", marginBottom: 8 }}>Répartition graphique (kWhEP/m².an)</div>
              {consumPostes.map((r) => {
                const maxEp = Math.max(...consumPostes.map((p) => p.kwhEP ?? 0));
                const pct = maxEp > 0 ? ((r.kwhEP ?? 0) / maxEp) * 100 : 0;
                const color = POSTE_COLORS[r.poste] ?? "#6b7280";
                return (
                  <div key={r.poste} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 5 }}>
                    <div style={{ width: 100, fontSize: 9, color: "#374151", textAlign: "right", flexShrink: 0 }}>
                      {POSTE_LABELS[r.poste] ?? r.poste}
                    </div>
                    <div style={{ flex: 1, background: "#f1f5f9", borderRadius: 3, height: 16, overflow: "hidden" }}>
                      <div style={{ width: `${pct}%`, background: color, height: "100%", borderRadius: 3 }} />
                    </div>
                    <div style={{ width: 60, fontSize: 9, color: "#64748b" }}>
                      {fmtNum(r.kwhEP, 1)} kWhEP
                    </div>
                  </div>
                );
              })}
            </div>

            <PrintFooter page={3} building={b.name} />
          </div>
        </>
      )}

      {/* ══ PAGE 4 — ENVELOPPE & SYSTÈMES TECHNIQUES ════════════════════════ */}
      {!isPreview && <div className="print-page-break" />}
      <div className={isPreview ? undefined : "print-page"} style={pageStyle}>
        <SectionTitle num="4" title="Enveloppe thermique" subtitle="Caractéristiques des parois et menuiseries" />

        {envelopeRows.length > 0 && (
          <table style={{ width: "100%", borderCollapse: "collapse", marginBottom: 20, fontSize: 10 }}>
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
                  <td style={{ ...tdLeft, fontWeight: 400 }}>{getRaw(rawFields, key)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        {/* Section characteristics text blocks */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 20 }}>
          {["facades", "planchers", "toitures", "menuiseries"].map((cat) => {
            const text = chars[cat];
            if (!text) return null;
            return (
              <div key={cat} style={{ border: "1px solid #e2e8f0", borderRadius: 6, padding: 10, pageBreakInside: "avoid" }}>
                <div style={{ fontWeight: 700, fontSize: 10, color: "#1e3a5f", marginBottom: 6, borderBottom: "1px solid #e2e8f0", paddingBottom: 4 }}>
                  {SECTION_LABELS[cat]}
                </div>
                <div style={{ fontSize: 9, color: "#374151", lineHeight: 1.5, whiteSpace: "pre-wrap" }}>{text}</div>
              </div>
            );
          })}
        </div>

        <SectionTitle num="5" title="Systèmes techniques" subtitle="Chauffage, ECS, ventilation, climatisation" />

        {systemRows.length > 0 && (
          <table style={{ width: "100%", borderCollapse: "collapse", marginBottom: 16, fontSize: 10 }}>
            <thead>
              <tr style={{ background: "#1e3a5f", color: "#fff" }}>
                <th style={{ ...thStyle, textAlign: "left", width: "35%" }}>Système</th>
                <th style={{ ...thStyle, textAlign: "left" }}>Description</th>
              </tr>
            </thead>
            <tbody>
              {systemRows.map(({ label, key }, i) => (
                <tr key={key} style={i % 2 === 0 ? rowEven : rowOdd}>
                  <td style={{ ...tdLeft, fontWeight: 600 }}>{label}</td>
                  <td style={{ ...tdLeft, fontWeight: 400 }}>{getRaw(rawFields, key)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          {["chauffage_ecs", "ventilation", "climatisation", "compteurs", "eclairage"].map((cat) => {
            const text = chars[cat];
            if (!text) return null;
            return (
              <div key={cat} style={{ border: "1px solid #e2e8f0", borderRadius: 6, padding: 10, pageBreakInside: "avoid" }}>
                <div style={{ fontWeight: 700, fontSize: 10, color: "#1e3a5f", marginBottom: 6, borderBottom: "1px solid #e2e8f0", paddingBottom: 4 }}>
                  {SECTION_LABELS[cat]}
                </div>
                <div style={{ fontSize: 9, color: "#374151", lineHeight: 1.5, whiteSpace: "pre-wrap" }}>{text}</div>
              </div>
            );
          })}
        </div>

        <PrintFooter page={4} building={b.name} />
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
            <PrintFooter page={5} building={b.name} />
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
