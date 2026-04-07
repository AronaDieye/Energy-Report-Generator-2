import React, { useMemo } from "react";
import { useParams, Link } from "wouter";
import { useGetAuditReport } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  ArrowLeft,
  Printer,
  Building,
  Zap,
  Thermometer,
  Wind,
  DollarSign,
  Leaf,
  Wrench,
  TrendingDown,
  Sun,
  Cloud,
  ChevronDown,
  ChevronUp,
  Layers,
  PieChart,
  BarChart3,
} from "lucide-react";
import { EnergyLabel } from "../components/energy-label";
import { BatimentTab } from "../components/batiment-tab";
import { PrintReport } from "../components/print-report";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";

const fmt = (num: number | null | undefined, suffix = "", decimals = 0) => {
  if (num === null || num === undefined) return "—";
  return `${new Intl.NumberFormat("fr-FR", { maximumFractionDigits: decimals }).format(num)}${suffix ? " " + suffix : ""}`;
};

const DataRow = ({ label, value }: { label: string; value: React.ReactNode }) => (
  <div className="flex justify-between py-2 border-b last:border-0 border-border/50 gap-4">
    <span className="text-muted-foreground text-sm shrink-0">{label}</span>
    <span className="font-medium text-right text-sm">{value ?? "—"}</span>
  </div>
);

interface RawField {
  key: string;
  value: string;
  section: string | null;
}

function groupRawFieldsBySection(rawFields: RawField[]): Record<string, RawField[]> {
  const groups: Record<string, RawField[]> = {};
  for (const field of rawFields) {
    const section = field.section || "Général";
    if (!groups[section]) groups[section] = [];
    groups[section].push(field);
  }
  return groups;
}

function RawFieldsSection({ rawFields }: { rawFields: RawField[] }) {
  const [expanded, setExpanded] = React.useState(false);
  const groups = useMemo(() => groupRawFieldsBySection(rawFields), [rawFields]);
  const sections = Object.keys(groups);

  if (!rawFields || rawFields.length === 0) return null;

  return (
    <Card className="print:hidden">
      <CardHeader
        className="cursor-pointer select-none"
        onClick={() => setExpanded((v) => !v)}
      >
        <CardTitle className="text-base flex items-center justify-between">
          <span>Données brutes extraites ({rawFields.length} champs)</span>
          {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </CardTitle>
      </CardHeader>
      {expanded && (
        <CardContent>
          <div className="space-y-6">
            {sections.map((section) => (
              <div key={section}>
                <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2 border-b pb-1">
                  {section}
                </h4>
                <div className="space-y-0">
                  {groups[section].map((field, i) => (
                    <DataRow key={i} label={field.key} value={field.value} />
                  ))}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      )}
    </Card>
  );
}

const parseVal = (s: string | null | undefined): number | null => {
  if (!s) return null;
  const n = parseFloat(s.replace(/\s/g, "").replace(",", ".").replace(/[^\d.-]/g, ""));
  return isNaN(n) ? null : n;
};

function useScenarioCodes(rawFields: RawField[]) {
  return useMemo(() => {
    const codes: string[] = [];
    const seen = new Set<string>();
    for (const f of rawFields) {
      const match = f.section?.match(/^SCÉNARIO (\w+)$/);
      if (match && !seen.has(match[1])) {
        seen.add(match[1]);
        codes.push(match[1]);
      }
    }
    return codes;
  }, [rawFields]);
}

function getScVal(rawFields: RawField[], code: string, suffix: string): string | null {
  return rawFields.find((f) => f.key === `SCÉNARIO ${code} - ${suffix}`)?.value ?? null;
}

// ─── SyntheseGlobale ────────────────────────────────────────────────────────

function SyntheseGlobale({
  rawFields,
  initialCost,
}: {
  rawFields: RawField[];
  initialCost: number | null;
}) {
  const scenarioCodes = useScenarioCodes(rawFields);
  if (scenarioCodes.length === 0) return null;

  const thceInitial = parseVal(rawFields.find((f) => f.key === "Total énergie primaire (Th-C-E)")?.value);
  const cefInitial = parseVal(rawFields.find((f) => f.key === "CEF initial (Th-C-E)")?.value);
  const gesInitial = parseVal(rawFields.find((f) => f.key === "CO2 par m² (kg CO2éq/m²/an)")?.value);

  const scColors = ["bg-green-50 border-green-200", "bg-blue-50 border-blue-200", "bg-purple-50 border-purple-200"];
  const scHeaderColors = ["bg-green-600", "bg-blue-600", "bg-purple-600"];
  const scTextColors = ["text-green-700", "text-blue-700", "text-purple-700"];

  const rows = scenarioCodes.map((code, i) => {
    const thce = parseVal(getScVal(rawFields, code, "CEP Th-C-E après"));
    const cef = parseVal(getScVal(rawFields, code, "CEF Th-C-E après"));
    const ges = parseVal(getScVal(rawFields, code, "GES Th-C-E après"));
    const cost = parseVal(getScVal(rawFields, code, "Dépense annuelle après"));
    const invest = parseVal(getScVal(rawFields, code, "Investissement"));
    const tempsRetour = getScVal(rawFields, code, "Temps de retour");
    const gainEco = cost !== null && initialCost !== null ? initialCost - cost : null;
    const gainPct = thce !== null && thceInitial !== null && thceInitial > 0
      ? ((thceInitial - thce) / thceInitial) * 100 : null;
    return { code, thce, cef, ges, cost, invest, tempsRetour, gainEco, gainPct, i };
  });

  return (
    <Card className="overflow-hidden">
      <CardHeader className="bg-slate-900 text-white py-4">
        <CardTitle className="flex items-center text-lg text-white">
          <TrendingDown className="h-5 w-5 mr-2 text-green-400" />
          Synthèse audit énergétique globale
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0 overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr>
              <th className="text-left py-3 px-4 font-medium text-muted-foreground bg-muted/20 border-b min-w-[160px]">
                Indicateur
              </th>
              <th className="py-3 px-4 text-center font-semibold bg-slate-700 text-white border-b min-w-[130px]">
                État initial
              </th>
              {rows.map(({ code, i }) => (
                <th key={code} className={`py-3 px-4 text-center font-semibold text-white border-b min-w-[130px] ${scHeaderColors[i] || "bg-slate-600"}`}>
                  {code}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            <tr className="border-b">
              <td className="py-3 px-4 text-muted-foreground font-medium">Étiquette DPE</td>
              <td className="py-3 px-4 text-center bg-slate-50">
                {thceInitial !== null ? (
                  <EnergyLabel label={dpeFromEP(thceInitial)} className="h-9 w-9 text-base mx-auto" />
                ) : "—"}
              </td>
              {rows.map(({ code, thce, i }) => (
                <td key={code} className={`py-3 px-4 text-center ${scColors[i] || ""}`}>
                  {thce !== null ? (
                    <EnergyLabel label={dpeFromEP(thce)} className="h-9 w-9 text-base mx-auto" />
                  ) : "—"}
                </td>
              ))}
            </tr>
            <tr className="border-b">
              <td className="py-3 px-4 text-muted-foreground">
                <div className="font-medium">CEP (kWhEP/m².an)</div>
                <div className="text-xs text-muted-foreground/70">5 usages — Th-C-E</div>
              </td>
              <td className="py-3 px-4 text-center font-mono font-bold bg-slate-50">
                {thceInitial !== null ? thceInitial.toLocaleString("fr-FR", { maximumFractionDigits: 1 }) : "—"}
              </td>
              {rows.map(({ code, thce, i }) => (
                <td key={code} className={`py-3 px-4 text-center font-mono font-bold ${scColors[i] || ""} ${scTextColors[i] || ""}`}>
                  {thce !== null ? thce.toLocaleString("fr-FR", { maximumFractionDigits: 1 }) : "—"}
                </td>
              ))}
            </tr>
            {(cefInitial !== null || rows.some((r) => r.cef !== null)) && (
              <tr className="border-b">
                <td className="py-3 px-4 text-muted-foreground">
                  <div className="font-medium">CEF (kWhef/m².an)</div>
                  <div className="text-xs text-muted-foreground/70">5 usages — Th-C-E</div>
                </td>
                <td className="py-3 px-4 text-center font-mono bg-slate-50">
                  {cefInitial !== null ? cefInitial.toLocaleString("fr-FR", { maximumFractionDigits: 1 }) : "—"}
                </td>
                {rows.map(({ code, cef, i }) => (
                  <td key={code} className={`py-3 px-4 text-center font-mono ${scColors[i] || ""} ${scTextColors[i] || ""}`}>
                    {cef !== null ? cef.toLocaleString("fr-FR", { maximumFractionDigits: 1 }) : "—"}
                  </td>
                ))}
              </tr>
            )}
            <tr className="border-b">
              <td className="py-3 px-4 text-muted-foreground">
                <div className="font-medium">GES (kgCO₂/m².an)</div>
              </td>
              <td className="py-3 px-4 text-center font-mono bg-slate-50">
                {gesInitial !== null ? gesInitial.toLocaleString("fr-FR", { maximumFractionDigits: 1 }) : "—"}
              </td>
              {rows.map(({ code, ges, i }) => (
                <td key={code} className={`py-3 px-4 text-center font-mono ${scColors[i] || ""} ${scTextColors[i] || ""}`}>
                  {ges !== null ? ges.toLocaleString("fr-FR", { maximumFractionDigits: 1 }) : "—"}
                </td>
              ))}
            </tr>
            <tr className="border-b">
              <td className="py-3 px-4 text-muted-foreground">
                <div className="font-medium">Gain économique</div>
                <div className="text-xs text-muted-foreground/70">€/an</div>
              </td>
              <td className="py-3 px-4 text-center text-muted-foreground bg-slate-50">—</td>
              {rows.map(({ code, gainEco, i }) => (
                <td key={code} className={`py-3 px-4 text-center font-semibold ${scColors[i] || ""} ${scTextColors[i] || ""}`}>
                  {gainEco !== null
                    ? `${gainEco > 0 ? "" : "−"}${Math.abs(gainEco).toLocaleString("fr-FR", { maximumFractionDigits: 0 })} €/an`
                    : "—"}
                </td>
              ))}
            </tr>
            <tr className="border-b">
              <td className="py-3 px-4 text-muted-foreground">
                <div className="font-medium">Gain énergétique</div>
                <div className="text-xs text-muted-foreground/70">% CEP Th-C-E</div>
              </td>
              <td className="py-3 px-4 text-center text-muted-foreground bg-slate-50">—</td>
              {rows.map(({ code, gainPct, i }) => (
                <td key={code} className={`py-3 px-4 text-center ${scColors[i] || ""}`}>
                  {gainPct !== null ? (
                    <span className={`font-bold text-base ${scTextColors[i] || ""}`}>
                      {gainPct.toLocaleString("fr-FR", { maximumFractionDigits: 1 })} %
                    </span>
                  ) : "—"}
                </td>
              ))}
            </tr>
            <tr className="border-b">
              <td className="py-3 px-4 text-muted-foreground font-medium">Investissement</td>
              <td className="py-3 px-4 text-center text-muted-foreground bg-slate-50">—</td>
              {rows.map(({ code, invest, i }) => (
                <td key={code} className={`py-3 px-4 text-center font-mono ${scColors[i] || ""}`}>
                  {invest !== null ? invest.toLocaleString("fr-FR", { maximumFractionDigits: 0 }) + " €" : "—"}
                </td>
              ))}
            </tr>
            <tr>
              <td className="py-3 px-4 text-muted-foreground font-medium">Temps de retour</td>
              <td className="py-3 px-4 text-center text-muted-foreground bg-slate-50">—</td>
              {rows.map(({ code, tempsRetour, i }) => (
                <td key={code} className={`py-3 px-4 text-center font-mono ${scColors[i] || ""}`}>
                  {tempsRetour || "—"}
                </td>
              ))}
            </tr>
          </tbody>
        </table>
      </CardContent>
    </Card>
  );
}

// ─── ScenarioCards ────────────────────────────────────────────────────────────

function ScenarioCards({
  rawFields,
  initialCost,
}: {
  rawFields: RawField[];
  initialCost: number | null;
}) {
  const scenarioCodes = useScenarioCodes(rawFields);
  if (scenarioCodes.length === 0) return null;

  const thceInitial = parseVal(rawFields.find((f) => f.key === "Total énergie primaire (Th-C-E)")?.value);
  const gesInitial = parseVal(rawFields.find((f) => f.key === "CO2 par m² (kg CO2éq/m²/an)")?.value);

  const scBorderColors = ["border-green-400", "border-blue-400", "border-purple-400"];
  const scBadgeColors = ["bg-green-600", "bg-blue-600", "bg-purple-600"];

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold flex items-center">
        <Wrench className="h-5 w-5 mr-2 text-primary" />
        Scénarios d'amélioration — Détails
      </h3>
      {scenarioCodes.map((code, i) => {
        const thce = parseVal(getScVal(rawFields, code, "CEP Th-C-E après"));
        const dpe3cl = parseVal(getScVal(rawFields, code, "kWhEP/m².an après"));
        const ges = parseVal(getScVal(rawFields, code, "GES Th-C-E après"));
        const cost = parseVal(getScVal(rawFields, code, "Dépense annuelle après"));
        const invest = parseVal(getScVal(rawFields, code, "Investissement"));
        const tempsRetour = getScVal(rawFields, code, "Temps de retour");
        const conseils = getScVal(rawFields, code, "Conseils") || "";
        const gainPct = thce !== null && thceInitial !== null && thceInitial > 0
          ? ((thceInitial - thce) / thceInitial) * 100 : null;
        const gainEco = cost !== null && initialCost !== null ? initialCost - cost : null;

        const travaux = conseils.split(/\s*\/\s*/).map(t => t.trim()).filter(t => t.length > 2);

        return (
          <Card key={code} className={`border-l-4 ${scBorderColors[i] || "border-slate-400"}`}>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base flex items-center gap-2">
                  <span className={`inline-flex items-center px-3 py-1 rounded-full text-white text-sm font-bold ${scBadgeColors[i] || "bg-slate-600"}`}>
                    {code}
                  </span>
                  Détails du projet
                </CardTitle>
                {gainPct !== null && (
                  <div className="text-right">
                    <div className="text-2xl font-bold text-green-600">−{gainPct.toLocaleString("fr-FR", { maximumFractionDigits: 1 })} %</div>
                    <div className="text-xs text-muted-foreground">gain énergétique</div>
                  </div>
                )}
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* DPE comparison */}
              <div className="grid grid-cols-3 gap-4 p-4 bg-muted/20 rounded-lg">
                <div className="text-center">
                  <p className="text-xs text-muted-foreground mb-2 font-medium">ÉTAT INITIAL</p>
                  {thceInitial !== null ? (
                    <EnergyLabel label={dpeFromEP(thceInitial)} className="h-12 w-12 text-xl mx-auto mb-1" />
                  ) : <div className="h-12 w-12 mx-auto" />}
                  <p className="text-xs font-mono font-semibold">
                    {thceInitial !== null ? thceInitial.toLocaleString("fr-FR", { maximumFractionDigits: 1 }) : "—"} kWhEP/m².an
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {gesInitial !== null ? gesInitial.toLocaleString("fr-FR", { maximumFractionDigits: 1 }) : "—"} kgCO₂/m².an
                  </p>
                  {initialCost !== null && (
                    <p className="text-xs font-semibold mt-1">{initialCost.toLocaleString("fr-FR", { maximumFractionDigits: 0 })} €/an</p>
                  )}
                </div>
                <div className="flex flex-col items-center justify-center">
                  <div className="text-3xl text-green-500">→</div>
                  {gainPct !== null && (
                    <div className="text-sm font-bold text-green-600 text-center">
                      {gainPct.toLocaleString("fr-FR", { maximumFractionDigits: 1 })} %
                    </div>
                  )}
                  <div className="text-xs text-muted-foreground text-center">Th-C-E</div>
                </div>
                <div className="text-center">
                  <p className="text-xs text-muted-foreground mb-2 font-medium">{code}</p>
                  {thce !== null ? (
                    <EnergyLabel label={dpeFromEP(thce)} className="h-12 w-12 text-xl mx-auto mb-1" />
                  ) : dpe3cl !== null ? (
                    <EnergyLabel label={dpeFromEP(dpe3cl)} className="h-12 w-12 text-xl mx-auto mb-1" />
                  ) : <div className="h-12 w-12 mx-auto" />}
                  <p className="text-xs font-mono font-semibold">
                    {thce !== null ? thce.toLocaleString("fr-FR", { maximumFractionDigits: 1 }) : "—"} kWhEP/m².an
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {ges !== null ? ges.toLocaleString("fr-FR", { maximumFractionDigits: 1 }) : "—"} kgCO₂/m².an
                  </p>
                  {cost !== null && (
                    <p className="text-xs font-semibold mt-1">{cost.toLocaleString("fr-FR", { maximumFractionDigits: 0 })} €/an</p>
                  )}
                </div>
              </div>

              {/* Financials */}
              <div className="grid grid-cols-3 gap-3 text-sm">
                <div className="p-3 bg-green-50 dark:bg-green-950/20 rounded-lg text-center border border-green-100">
                  <p className="text-xs text-muted-foreground">Gain économique</p>
                  <p className="font-bold text-green-700">
                    {gainEco !== null
                      ? `${gainEco > 0 ? "+" : ""}${gainEco.toLocaleString("fr-FR", { maximumFractionDigits: 0 })} €/an`
                      : "—"}
                  </p>
                </div>
                <div className="p-3 bg-muted/20 rounded-lg text-center border border-border">
                  <p className="text-xs text-muted-foreground">Investissement</p>
                  <p className="font-bold">
                    {invest !== null ? invest.toLocaleString("fr-FR", { maximumFractionDigits: 0 }) + " €" : "—"}
                  </p>
                </div>
                <div className="p-3 bg-muted/20 rounded-lg text-center border border-border">
                  <p className="text-xs text-muted-foreground">Temps de retour</p>
                  <p className="font-bold">{tempsRetour || "—"}</p>
                </div>
              </div>

              {/* Travaux */}
              {travaux.length > 0 && (
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">Travaux préconisés</p>
                  <ul className="space-y-1">
                    {travaux.map((t, j) => (
                      <li key={j} className="flex items-start gap-2 text-sm">
                        <span className="text-primary mt-0.5 shrink-0">▪</span>
                        <span>{t}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}

function dpeFromEP(ep: number): string {
  if (ep <= 70) return "A";
  if (ep <= 110) return "B";
  if (ep <= 180) return "C";
  if (ep <= 250) return "D";
  if (ep <= 330) return "E";
  if (ep <= 420) return "F";
  return "G";
}

function ConsumptionBreakdown({ rawFields }: { rawFields: RawField[] }) {
  const posts = [
    { prefix: "Chauffage", label: "Chauffage", color: "text-orange-600", dot: "bg-orange-500" },
    { prefix: "Refroidissement", label: "Refroidissement", color: "text-blue-500", dot: "bg-blue-500" },
    { prefix: "ECS", label: "Eau Chaude Sanitaire", color: "text-cyan-600", dot: "bg-cyan-500" },
    { prefix: "Éclairage", label: "Éclairage", color: "text-yellow-600", dot: "bg-yellow-500" },
    { prefix: "Auxiliaires", label: "Auxiliaires", color: "text-purple-500", dot: "bg-purple-500" },
  ];

  const getFieldValue = (key: string): string | null =>
    rawFields.find((f) => f.key === key)?.value ?? null;

  const hasData = posts.some((p) => getFieldValue(`${p.prefix} - Énergie finale`) !== null);
  if (!hasData) return null;

  const activeRows = posts.filter((p) => getFieldValue(`${p.prefix} - Énergie finale`) !== null);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center text-lg">
          <Zap className="h-5 w-5 mr-2 text-primary" />
          Consommations par poste — État initial
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/40">
                <th className="text-left py-2 px-4 font-medium text-muted-foreground">Poste</th>
                <th className="text-left py-2 px-4 font-medium text-muted-foreground">Source d'énergie</th>
                <th className="text-right py-2 px-4 font-medium text-muted-foreground">Énergie finale (kWh/an)</th>
                <th className="text-right py-2 px-4 font-medium text-muted-foreground">Énergie primaire (kWhEP/m².an)</th>
              </tr>
            </thead>
            <tbody>
              {activeRows.map(({ prefix, label, color, dot }) => {
                const finale = getFieldValue(`${prefix} - Énergie finale`);
                const primaire = getFieldValue(`${prefix} - Énergie primaire`);
                const source = getFieldValue(`${prefix} - Source d'énergie`);
                return (
                  <tr key={prefix} className="border-b last:border-0 hover:bg-muted/20 transition-colors">
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-2">
                        <span className={`h-2.5 w-2.5 rounded-full shrink-0 ${dot}`} />
                        <span className={`font-medium ${color}`}>{label}</span>
                      </div>
                    </td>
                    <td className="py-3 px-4 text-muted-foreground">
                      {source ?? <span className="text-muted-foreground/50">—</span>}
                    </td>
                    <td className="py-3 px-4 text-right font-mono font-semibold">
                      {finale ?? "—"}
                    </td>
                    <td className="py-3 px-4 text-right font-mono text-muted-foreground">
                      {primaire ?? <span className="text-muted-foreground/40">—</span>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}

function UbatBilan({ rawFields }: { rawFields: RawField[] }) {
  const get = (key: string) => rawFields.find((f) => f.key === key)?.value ?? null;
  const coef = get("UBAT - Coefficient");
  if (!coef) return null;

  const rows = [
    { label: "Coefficient UBAT", value: coef, highlight: true },
    { label: "HT — Déperditions enveloppe", value: get("UBAT - HT enveloppe") },
    { label: "AT — Surface déperditive", value: get("UBAT - AT surface déperditive") },
    { label: "GV — Total général", value: get("UBAT - GV total") },
    { label: "Déperditions totales (sans maj.)", value: get("UBAT - Déperditions totales") },
  ];

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center text-lg">
          <Layers className="h-5 w-5 mr-2 text-indigo-500" />
          Bilan thermique UBAT — État initial
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-0">
          {rows.map(({ label, value, highlight }) =>
            value ? (
              <div key={label} className="flex justify-between py-2 border-b last:border-0 border-border/50 gap-4">
                <span className="text-muted-foreground text-sm shrink-0">{label}</span>
                <span className={`font-mono text-sm font-semibold ${highlight ? "text-indigo-600 text-base" : ""}`}>
                  {value}
                </span>
              </div>
            ) : null
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function DeperditionsRepartition({ rawFields }: { rawFields: RawField[] }) {
  const get = (key: string) => rawFields.find((f) => f.key === key)?.value ?? null;
  const parseVal = (v: string | null) => {
    if (!v) return null;
    const n = parseFloat(v.replace(/\s/g, "").replace(",", ".").replace(/[^\d.-]/g, ""));
    return isNaN(n) ? null : n;
  };

  const gv = parseVal(get("UBAT - GV total"));

  const categories = [
    {
      key: "Déperditions - HD parois ext.",
      label: "Parois extérieures (HD)",
      color: "bg-orange-500",
      textColor: "text-orange-600",
      subItems: [
        { key: "Ubat - Murs extérieurs (total)", label: "Murs extérieurs", color: "bg-orange-300" },
        { key: "Ubat - Vitrages (total)", label: "Vitrages / baies", color: "bg-amber-300" },
        { key: "Ubat - Ponts thermiques (total)", label: "Ponts thermiques", color: "bg-yellow-400" },
        { key: "Ubat - Portes (total)", label: "Portes", color: "bg-orange-200" },
        { key: "Ubat - Autres parois (total)", label: "Autres parois", color: "bg-orange-100" },
      ],
    },
    { key: "Déperditions - HU parois int.", label: "Parois intérieures (HU)", color: "bg-blue-400", textColor: "text-blue-600", subItems: [] },
    { key: "Déperditions - HS sol", label: "Sol (HS)", color: "bg-stone-400", textColor: "text-stone-600", subItems: [] },
    { key: "Déperditions - Ventilation", label: "Ventilation", color: "bg-sky-500", textColor: "text-sky-600", subItems: [] },
    { key: "Déperditions - Infiltrations", label: "Infiltrations", color: "bg-teal-400", textColor: "text-teal-600", subItems: [] },
  ];

  const hasData = categories.some((c) => get(c.key) !== null);
  if (!hasData || !gv) return null;

  const fmtFR = (n: number, dec = 0) =>
    new Intl.NumberFormat("fr-FR", { maximumFractionDigits: dec }).format(n);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center text-lg">
          <PieChart className="h-5 w-5 mr-2 text-primary" />
          Répartition des déperditions — État initial (W/°C)
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {categories.map(({ key, label, color, textColor, subItems }) => {
          const val = parseVal(get(key));
          if (val === null) return null;
          const pct = gv > 0 ? (val / gv) * 100 : 0;

          return (
            <div key={key}>
              <div className="flex items-center gap-3 mb-1">
                <div className={`h-3 w-3 rounded-sm shrink-0 ${color}`} />
                <span className={`text-sm font-medium flex-1 ${textColor}`}>{label}</span>
                <span className="font-mono text-sm font-semibold w-36 text-right">
                  {fmtFR(val, 0)} W/°C
                </span>
                <span className="text-xs text-muted-foreground w-12 text-right">
                  {fmtFR(pct, 1)} %
                </span>
              </div>
              {/* Progress bar */}
              <div className="ml-6 h-2 bg-muted rounded-full overflow-hidden mb-1">
                <div
                  className={`h-full rounded-full transition-all ${color}`}
                  style={{ width: `${Math.min(pct, 100)}%` }}
                />
              </div>
              {/* Sub-items (detail by element type) */}
              {subItems.map(({ key: subKey, label: subLabel, color: subColor }) => {
                const subVal = parseVal(get(subKey));
                if (subVal === null || subVal === 0) return null;
                const subPct = gv > 0 ? (subVal / gv) * 100 : 0;
                return (
                  <div key={subKey} className="ml-8 flex items-center gap-3 mb-0.5">
                    <div className={`h-2 w-2 rounded-sm shrink-0 ${subColor}`} />
                    <span className="text-xs text-muted-foreground flex-1">{subLabel}</span>
                    <span className="font-mono text-xs w-36 text-right text-muted-foreground">
                      {fmtFR(subVal, 0)} W/°C
                    </span>
                    <span className="text-xs text-muted-foreground/60 w-12 text-right">
                      {fmtFR(subPct, 1)} %
                    </span>
                  </div>
                );
              })}
            </div>
          );
        })}

        <div className="pt-2 border-t flex justify-between items-center">
          <span className="text-sm font-semibold">Total GV</span>
          <span className="font-mono font-bold">{fmtFR(gv, 0)} W/°C</span>
        </div>
      </CardContent>
    </Card>
  );
}

function ClimateContext({ rawFields }: { rawFields: RawField[] }) {
  const fields = [
    "Zone climatique",
    "Station météo",
    "Température extérieure de base",
    "Degrés-jours base 18°C",
    "Altitude",
    "Bordure de mer",
    "Département",
  ];
  const getFieldValue = (key: string): string | null =>
    rawFields.find((f) => f.key === key)?.value ?? null;

  const hasData = fields.some((f) => getFieldValue(f) !== null);
  if (!hasData) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center text-lg">
          <Cloud className="h-5 w-5 mr-2 text-sky-500" />
          Contexte climatique
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-0">
          {fields.map((f) => {
            const v = getFieldValue(f);
            if (!v) return null;
            return <DataRow key={f} label={f} value={v} />;
          })}
        </div>
      </CardContent>
    </Card>
  );
}

export function ReportDetail() {
  const { id } = useParams();
  const { data: report, isLoading } = useGetAuditReport(Number(id), {
    query: { enabled: !!id },
  });

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <Skeleton className="h-10 w-32" />
          <Skeleton className="h-10 w-32" />
        </div>
        <Skeleton className="h-[200px] w-full" />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Skeleton className="h-[300px] w-full" />
          <Skeleton className="h-[300px] w-full" />
        </div>
      </div>
    );
  }

  if (!report) {
    return (
      <div className="text-center py-20">
        <h2 className="text-2xl font-bold mb-4">Rapport introuvable</h2>
        <Link href="/">
          <Button>Retour au tableau de bord</Button>
        </Link>
      </div>
    );
  }

  const rawFields: RawField[] = report.rawFields || [];
  const initialEP = report.energyLabel.primaryEnergyConsumption;
  const initialGes = report.energyLabel.energyIndex;
  const initialCost = report.energyCost.totalCost;

  return (
    <div className="space-y-8 pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <Link
            href="/"
            className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground mb-4"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Retour
          </Link>
          <h1 className="text-3xl font-bold tracking-tight">Rapport d'audit énergétique</h1>
          <p className="text-muted-foreground">{report.fileName}</p>
        </div>
        <Button onClick={() => window.print()} className="print:hidden">
          <Printer className="h-4 w-4 mr-2" />
          Imprimer
        </Button>
      </div>

      {/* Hero card + DPE + cost + CO2 */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2 bg-slate-900 text-slate-50 dark:bg-card dark:text-card-foreground border-transparent">
          <CardContent className="p-6">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-8">
              <div className="flex-1">
                <h2 className="text-2xl font-bold mb-1">
                  {report.buildingInfo.name || "Bâtiment sans nom"}
                </h2>
                <p className="text-slate-400 dark:text-muted-foreground mb-6 text-sm">
                  {report.buildingInfo.address || "Adresse non renseignée"}
                </p>
                <div className="grid grid-cols-2 gap-x-8 gap-y-3">
                  <div>
                    <p className="text-xs text-slate-400 dark:text-muted-foreground">Surface habitable</p>
                    <p className="text-xl font-bold">{fmt(report.buildingInfo.heatedSurface, "m²")}</p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-400 dark:text-muted-foreground">Surface SHON</p>
                    <p className="text-xl font-bold">{fmt(report.buildingInfo.totalSurface, "m²")}</p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-400 dark:text-muted-foreground">Type de bâtiment</p>
                    <p className="text-sm font-semibold">{report.buildingInfo.buildingType || "—"}</p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-400 dark:text-muted-foreground">Année de construction</p>
                    <p className="text-sm font-semibold">{report.buildingInfo.constructionYear || "—"}</p>
                  </div>
                  {report.buildingInfo.numberOfFloors && (
                    <div>
                      <p className="text-xs text-slate-400 dark:text-muted-foreground">Niveaux</p>
                      <p className="text-sm font-semibold">{report.buildingInfo.numberOfFloors}</p>
                    </div>
                  )}
                  {report.buildingInfo.climateZone && (
                    <div>
                      <p className="text-xs text-slate-400 dark:text-muted-foreground">Zone climatique</p>
                      <p className="text-sm font-semibold">{report.buildingInfo.climateZone}</p>
                    </div>
                  )}
                </div>
              </div>
              <div className="flex flex-col items-center p-5 bg-slate-800 dark:bg-muted rounded-xl min-w-[160px]">
                <span className="text-xs text-slate-400 dark:text-muted-foreground mb-1 text-center">
                  Étiquette DPE (3CL-2021)
                </span>
                <EnergyLabel
                  label={report.energyLabel.currentLabel}
                  className="h-20 w-20 text-4xl mb-2"
                />
                <span className="text-base font-bold">
                  {initialEP !== null && initialEP !== undefined
                    ? `${initialEP.toLocaleString("fr-FR", { maximumFractionDigits: 1 })} kWhEP/m².an`
                    : "—"}
                </span>
                {initialGes !== null && initialGes !== undefined && (
                  <span className="text-xs text-slate-400 dark:text-muted-foreground mt-1">
                    {initialGes.toLocaleString("fr-FR", { maximumFractionDigits: 1 })} kgCO₂/m².an
                  </span>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="flex flex-col gap-6">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center">
                <DollarSign className="h-4 w-4 mr-2 text-primary" />
                Dépense annuelle
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-primary">
                {fmt(initialCost, "€/an")}
              </div>
              <p className="text-xs text-muted-foreground mt-1">Abonnements inclus</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center">
                <Leaf className="h-4 w-4 mr-2 text-green-600" />
                Bilan CO2
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-green-600">
                {report.co2Emissions.totalEmissions !== null &&
                report.co2Emissions.totalEmissions !== undefined
                  ? `${(report.co2Emissions.totalEmissions / 1000).toLocaleString("fr-FR", {
                      maximumFractionDigits: 1,
                    })} t`
                  : "—"}
              </div>
              <p className="text-xs text-muted-foreground mt-1">tonnes CO₂éq/an (Th-C-E)</p>
              {rawFields.find((f) => f.key === "CO2 par m² (kg CO2éq/m²/an)") && (
                <p className="text-sm font-semibold mt-1">
                  {rawFields.find((f) => f.key === "CO2 par m² (kg CO2éq/m²/an)")?.value} kg/m²/an
                </p>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Tabbed content */}
      <Tabs defaultValue="synthese" className="w-full">
        <TabsList className="grid w-full grid-cols-3 mb-6">
          <TabsTrigger value="synthese" className="flex items-center gap-2">
            <TrendingDown className="h-4 w-4" />
            Synthèse
          </TabsTrigger>
          <TabsTrigger value="consommations" className="flex items-center gap-2">
            <BarChart3 className="h-4 w-4" />
            Consommations
          </TabsTrigger>
          <TabsTrigger value="batiment" className="flex items-center gap-2">
            <Building className="h-4 w-4" />
            Bâtiment
          </TabsTrigger>
        </TabsList>

        {/* ── Onglet Synthèse ───────────────────────────────────────────── */}
        <TabsContent value="synthese" className="space-y-6 mt-0">
          <SyntheseGlobale rawFields={rawFields} initialCost={initialCost ?? null} />
          <ScenarioCards rawFields={rawFields} initialCost={initialCost ?? null} />
        </TabsContent>

        {/* ── Onglet Consommations ─────────────────────────────────────── */}
        <TabsContent value="consommations" className="space-y-6 mt-0">
          <ConsumptionBreakdown rawFields={rawFields} />
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <UbatBilan rawFields={rawFields} />
            <DeperditionsRepartition rawFields={rawFields} />
          </div>
        </TabsContent>

        {/* ── Onglet Bâtiment ──────────────────────────────────────────── */}
        <TabsContent value="batiment" className="mt-0">
          <BatimentTab
            report={{
              ...report,
              sectionCharacteristics: (report as unknown as { sectionCharacteristics?: Record<string, string> }).sectionCharacteristics ?? {},
            }}
            rawFields={rawFields}
          />
        </TabsContent>
      </Tabs>

      {/* ── Vue impression (cachée à l'écran, affichée à l'impression) ─ */}
      <PrintReport
        report={{
          ...report,
          sectionCharacteristics: (report as unknown as { sectionCharacteristics?: Record<string, string> }).sectionCharacteristics ?? {},
        }}
      />
    </div>
  );
}
