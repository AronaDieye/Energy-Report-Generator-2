import React, { useMemo, useState, useCallback } from "react";
import { useParams, Link } from "wouter";
import { useGetAuditReport } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
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
  FileText,
  X,
  Download,
  Edit,
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
  scenarios,
}: {
  rawFields: RawField[];
  initialCost: number | null;
  scenarios?: Array<{ tauxEnrRPct?: number | null }>;
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
    const cefKwhAn = parseVal(getScVal(rawFields, code, "CEF kWh/an"));
    const ges = parseVal(getScVal(rawFields, code, "GES Th-C-E après"));
    const cost = parseVal(getScVal(rawFields, code, "Dépense annuelle après"));
    const invest = parseVal(getScVal(rawFields, code, "Investissement"));
    const tempsRetour = getScVal(rawFields, code, "Temps de retour");
    const gainEco = cost !== null && initialCost !== null ? initialCost - cost : null;
    const gainPct = thce !== null && thceInitial !== null && thceInitial > 0
      ? ((thceInitial - thce) / thceInitial) * 100 : null;
    const gainCep = thce !== null && thceInitial !== null ? thceInitial - thce : null;
    const tauxEnrR = scenarios?.[i]?.tauxEnrRPct ?? null;
    const conseils = getScVal(rawFields, code, "Conseils") ?? "";
    const travaux = conseils.split(/\s*\/\s*/).map(t => t.trim()).filter(t => t.length > 2);
    return { code, thce, cef, cefKwhAn, ges, cost, invest, tempsRetour, gainEco, gainPct, gainCep, tauxEnrR, travaux, i };
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
            {rows.some(r => r.gainCep !== null) && (
              <tr className="border-b">
                <td className="py-3 px-4 text-muted-foreground">
                  <div className="font-medium">Gain Énergétique</div>
                  <div className="text-xs text-muted-foreground/70">kWhEP/m².an économisés</div>
                </td>
                <td className="py-3 px-4 text-center text-muted-foreground bg-slate-50">—</td>
                {rows.map(({ code, gainCep, i }) => (
                  <td key={code} className={`py-3 px-4 text-center ${scColors[i] || ""}`}>
                    {gainCep !== null ? (
                      <span className={`font-bold text-base ${scTextColors[i] || ""}`}>
                        {gainCep.toLocaleString("fr-FR", { maximumFractionDigits: 1 })} kWhEP/m².an
                      </span>
                    ) : "—"}
                  </td>
                ))}
              </tr>
            )}
            {rows.some(r => r.gainPct !== null) && (
              <tr className="border-b">
                <td className="py-3 px-4 text-muted-foreground">
                  <div className="font-medium">Gain Énergétique (%)</div>
                  <div className="text-xs text-muted-foreground/70">% de réduction du CEP Th-C-E</div>
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
            )}
            {rows.some(r => r.tauxEnrR !== null) && (
              <tr className="border-b">
                <td className="py-3 px-4 text-muted-foreground">
                  <div className="font-medium">Taux ENR &amp; R</div>
                  <div className="text-xs text-muted-foreground/70">Énergies renouvelables et récupération</div>
                </td>
                <td className="py-3 px-4 text-center text-muted-foreground bg-slate-50">—</td>
                {rows.map(({ code, tauxEnrR, i }) => (
                  <td key={code} className={`py-3 px-4 text-center ${scColors[i] || ""}`}>
                    {tauxEnrR !== null ? (
                      <span className={`font-bold text-base ${scTextColors[i] || ""}`}>
                        {tauxEnrR.toLocaleString("fr-FR", { maximumFractionDigits: 2 })} %
                      </span>
                    ) : "—"}
                  </td>
                ))}
              </tr>
            )}
            <tr className="border-b">
              <td className="py-3 px-4 text-muted-foreground font-medium">Investissement</td>
              <td className="py-3 px-4 text-center text-muted-foreground bg-slate-50">—</td>
              {rows.map(({ code, invest, i }) => (
                <td key={code} className={`py-3 px-4 text-center font-mono ${scColors[i] || ""}`}>
                  {invest !== null ? invest.toLocaleString("fr-FR", { maximumFractionDigits: 0 }) + " €" : "—"}
                </td>
              ))}
            </tr>
            <tr className="border-b">
              <td className="py-3 px-4 text-muted-foreground font-medium">Temps de retour</td>
              <td className="py-3 px-4 text-center text-muted-foreground bg-slate-50">—</td>
              {rows.map(({ code, tempsRetour, i }) => (
                <td key={code} className={`py-3 px-4 text-center font-mono ${scColors[i] || ""}`}>
                  {tempsRetour || "—"}
                </td>
              ))}
            </tr>
            {rows.some(r => r.travaux.length > 0) && (
              <tr className="align-top">
                <td className="py-3 px-4 text-muted-foreground font-medium whitespace-nowrap">Travaux préconisés</td>
                <td className="py-3 px-4 bg-slate-50 text-center text-muted-foreground text-xs">—</td>
                {rows.map(({ code, travaux, i }) => (
                  <td key={code} className={`py-3 px-4 ${scColors[i] || ""}`}>
                    {travaux.length > 0 ? (
                      <ul className="space-y-1">
                        {travaux.map((t, j) => (
                          <li key={j} className={`flex items-start gap-1.5 text-xs ${scTextColors[i] || "text-slate-700"}`}>
                            <span className="shrink-0 mt-0.5 font-bold">▸</span>
                            <span className="font-medium">{t}</span>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <span className="text-muted-foreground text-xs">—</span>
                    )}
                  </td>
                ))}
              </tr>
            )}
          </tbody>
        </table>

        {/* ── Tableau détail consommations par usage ── */}
        {(() => {
          const postes = [
            { key: "Chauffage", label: "CHAUFFAGE" },
            { key: "ECS", label: "ECS" },
            { key: "Refroidissement", label: "REFROIDISSEMENT" },
            { key: "Éclairage", label: "ÉCLAIRAGE" },
            { key: "Auxiliaires", label: "AUXILIAIRES" },
          ];
          const getF = (k: string) => rawFields.find((f) => f.key === k)?.value ?? null;
          const hasAny = postes.some((p) => getF(`${p.key} - Énergie finale`) !== null);
          if (!hasAny) return null;

          const totalFinale = postes.reduce((sum, p) => {
            const v = parseVal(getF(`${p.key} - Énergie finale`));
            return v !== null ? sum + v : sum;
          }, 0);

          return (
            <div className="border-t mt-0">
              <div className="bg-slate-800 text-white px-4 py-2 text-sm font-semibold flex items-center gap-2">
                <span>⚡</span> Détail des consommations par usage — Énergie finale (kWh/an)
              </div>
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/20">
                    <th className="text-left py-2 px-4 font-medium text-muted-foreground min-w-[180px]">Poste / Source d'énergie</th>
                    <th className="py-2 px-4 text-center font-semibold bg-slate-700 text-white min-w-[130px]">État initial</th>
                    {rows.map(({ code, i }) => (
                      <th key={code} className={`py-2 px-4 text-center font-semibold text-white min-w-[120px] ${scHeaderColors[i] || "bg-slate-600"}`}>{code}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {postes.map(({ key, label }) => {
                    const finale = getF(`${key} - Énergie finale`);
                    const source = getF(`${key} - Source d'énergie`);
                    if (finale === null && source === null) return null;
                    return (
                      <tr key={key} className="border-b hover:bg-muted/10">
                        <td className="py-2 px-4">
                          <div className="font-semibold text-slate-800 text-xs uppercase tracking-wide">{label}</div>
                          {source && <div className="text-xs text-muted-foreground mt-0.5 pl-1">↳ {source}</div>}
                        </td>
                        <td className="py-2 px-4 text-center font-mono font-bold text-slate-800 bg-slate-50">
                          {finale ? parseVal(finale)?.toLocaleString("fr-FR", { maximumFractionDigits: 0 }) + " kWh" : "—"}
                        </td>
                        {rows.map(({ code, i: ri }) => {
                          const scFinale = getF(`SCÉNARIO ${code} - ${key} - Énergie finale`);
                          const scVal = scFinale ? parseVal(scFinale) : null;
                          return (
                            <td key={code} className={`py-2 px-4 text-center font-mono text-xs ${scColors[ri] || ""}`}>
                              {scVal !== null ? (
                                <span className={scTextColors[ri] || ""}>{scVal.toLocaleString("fr-FR", { maximumFractionDigits: 0 })} kWh</span>
                              ) : <span className="text-muted-foreground">—</span>}
                            </td>
                          );
                        })}
                      </tr>
                    );
                  })}
                  {totalFinale > 0 && (
                    <tr className="bg-slate-100 font-bold border-t-2 border-slate-300">
                      <td className="py-2 px-4 text-slate-900 uppercase text-xs tracking-wide">TOTAL</td>
                      <td className="py-2 px-4 text-center font-mono text-slate-900">
                        {totalFinale.toLocaleString("fr-FR", { maximumFractionDigits: 0 })} kWh
                      </td>
                      {rows.map(({ code, cef, cefKwhAn, i }) => (
                        <td key={code} className={`py-2 px-4 text-center font-mono text-xs ${scColors[i] || ""}`}>
                          {cefKwhAn !== null ? (
                            <span className={scTextColors[i] || ""}>{cefKwhAn.toLocaleString("fr-FR", { maximumFractionDigits: 0 })} kWh</span>
                          ) : cef !== null ? (
                            <span className={scTextColors[i] || ""}>{cef.toLocaleString("fr-FR", { maximumFractionDigits: 1 })} kWhEF/m².an</span>
                          ) : "—"}
                        </td>
                      ))}
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          );
        })()}
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

// ── Cover page editor dialog ─────────────────────────────────────────────────

interface CoverForm {
  buildingName: string;
  buildingAddress: string;
  bureauEtudes: string;
  bureauAdresse: string;
  bureauEmail: string;
  bureauTelephone: string;
  siret: string;
  qualification: string;
  beneficiaire: string;
  maitreDoeuvre: string;
  dateVisite: string;
  dateRealisation: string;
  dateRestitution: string;
  reference: string;
  coverPhotoId: number | null;
}

interface EditorPhoto {
  id: number;
  fileName: string;
  caption: string | null;
  category: string;
  url: string;
}

// Stable component defined OUTSIDE CoverPageEditor to avoid remount on each keystroke
function CoverField({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  placeholder?: string;
}) {
  return (
    <div className="space-y-1">
      <Label className="text-xs text-muted-foreground">{label}</Label>
      <Input
        value={value}
        onChange={onChange}
        placeholder={placeholder ?? label}
        className="h-8 text-sm"
      />
    </div>
  );
}

const SECTION_COLORS: Record<string, { text: string; line: string }> = {
  blue:   { text: "#1d4ed8", line: "#bfdbfe" },
  indigo: { text: "#4338ca", line: "#c7d2fe" },
  green:  { text: "#15803d", line: "#bbf7d0" },
  purple: { text: "#7e22ce", line: "#e9d5ff" },
};

function SectionDivider({ label, color }: { label: string; color: string }) {
  const c = SECTION_COLORS[color] ?? SECTION_COLORS.blue;
  return (
    <div style={{ color: c.text }} className="text-xs font-bold uppercase tracking-wider mb-3 flex items-center gap-2">
      <span style={{ background: c.line }} className="h-px flex-1" />
      {label}
      <span style={{ background: c.line }} className="h-px flex-1" />
    </div>
  );
}

function CoverPageEditor({
  reportId,
  initial,
  onClose,
  onSaved,
}: {
  reportId: number;
  initial: CoverForm;
  onClose: () => void;
  onSaved: () => void;
}) {
  const apiBase = import.meta.env.BASE_URL.replace(/\/$/, "");
  const [form, setForm] = useState<CoverForm>(initial);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [photos, setPhotos] = useState<EditorPhoto[]>([]);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  // Fetch existing photos on open
  React.useEffect(() => {
    fetch(`${apiBase}/api/audit/reports/${reportId}/photos`)
      .then(r => r.ok ? r.json() : [])
      .then((ps: EditorPhoto[]) => setPhotos(ps))
      .catch(() => {});
  }, [reportId, apiBase]);

  const handleChange = useCallback((key: keyof CoverForm) => (e: React.ChangeEvent<HTMLInputElement>) => {
    setForm(f => ({ ...f, [key]: e.target.value }));
  }, []);

  const handlePhotoSelect = useCallback((id: number) => {
    setForm(f => ({ ...f, coverPhotoId: f.coverPhotoId === id ? null : id }));
  }, []);

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingPhoto(true);
    try {
      const fd = new FormData();
      fd.append("photo", file);
      fd.append("category", "facades");
      fd.append("caption", "Photo du bâtiment");
      const res = await fetch(`${apiBase}/api/audit/reports/${reportId}/photos`, { method: "POST", body: fd });
      if (!res.ok) throw new Error("Upload échoué");
      const newPhoto = await res.json();
      // Refresh photo list
      const listRes = await fetch(`${apiBase}/api/audit/reports/${reportId}/photos`);
      const ps: EditorPhoto[] = listRes.ok ? await listRes.json() : photos;
      setPhotos(ps);
      // Auto-select newly uploaded photo
      setForm(f => ({ ...f, coverPhotoId: newPhoto.id }));
    } catch {
      setError("Erreur lors de l'envoi de la photo");
    } finally {
      setUploadingPhoto(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`${apiBase}/api/audit/reports/${reportId}/cover`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      if (!res.ok) throw new Error(`Erreur ${res.status}`);
      onSaved();
      onClose();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Erreur de sauvegarde");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open onOpenChange={open => !open && onClose()}>
      <DialogContent className="max-w-2xl p-0 gap-0" aria-describedby={undefined}>
        <DialogHeader className="px-6 pt-5 pb-3 border-b">
          <DialogTitle className="flex items-center gap-2">
            <Edit className="h-4 w-4 text-primary" />
            Éditer la page de garde
          </DialogTitle>
        </DialogHeader>

        <ScrollArea className="max-h-[75vh]">
          <div className="px-6 py-4 space-y-6">

            {/* Photo de couverture */}
            <div>
              <SectionDivider label="Photo du bâtiment" color="purple" />
              <div className="space-y-3">
                {photos.length === 0 && !uploadingPhoto && (
                  <p className="text-xs text-muted-foreground">Aucune photo importée. Ajoutez-en une ci-dessous.</p>
                )}
                {photos.length > 0 && (
                  <div className="grid grid-cols-4 gap-2">
                    {photos.map(p => {
                      const selected = form.coverPhotoId === p.id;
                      return (
                        <button
                          key={p.id}
                          type="button"
                          onClick={() => handlePhotoSelect(p.id)}
                          className={`relative rounded-md overflow-hidden border-2 transition-all focus:outline-none ${
                            selected
                              ? "border-primary ring-2 ring-primary/30"
                              : "border-transparent hover:border-muted-foreground/40"
                          }`}
                          style={{ aspectRatio: "4/3" }}
                        >
                          <img
                            src={`${apiBase}${p.url}`}
                            alt={p.caption || p.fileName}
                            className="w-full h-full object-cover"
                          />
                          {selected && (
                            <div className="absolute inset-0 bg-primary/20 flex items-center justify-center">
                              <div className="bg-primary text-primary-foreground rounded-full w-6 h-6 flex items-center justify-center text-xs font-bold">✓</div>
                            </div>
                          )}
                          {p.caption && (
                            <div className="absolute bottom-0 left-0 right-0 bg-black/50 text-white text-[9px] px-1 py-0.5 truncate">
                              {p.caption}
                            </div>
                          )}
                        </button>
                      );
                    })}
                  </div>
                )}
                <div className="flex items-center gap-3">
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={handlePhotoUpload}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={uploadingPhoto}
                    onClick={() => fileInputRef.current?.click()}
                  >
                    {uploadingPhoto ? "Envoi en cours…" : "Importer une photo"}
                  </Button>
                  {form.coverPhotoId && (
                    <button
                      type="button"
                      onClick={() => setForm(f => ({ ...f, coverPhotoId: null }))}
                      className="text-xs text-muted-foreground hover:text-destructive underline"
                    >
                      Retirer la photo de couverture
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* Bâtiment */}
            <div>
              <SectionDivider label="Bâtiment" color="blue" />
              <div className="grid grid-cols-1 gap-3">
                <CoverField label="Nom du bâtiment / Résidence" value={form.buildingName} onChange={handleChange("buildingName")} />
                <CoverField label="Adresse" value={form.buildingAddress} onChange={handleChange("buildingAddress")} />
              </div>
            </div>

            {/* Bureau d'études */}
            <div>
              <SectionDivider label="Bureau d'études" color="indigo" />
              <div className="grid grid-cols-2 gap-3">
                <CoverField label="Nom du bureau d'études" value={form.bureauEtudes} onChange={handleChange("bureauEtudes")} />
                <CoverField label="Adresse" value={form.bureauAdresse} onChange={handleChange("bureauAdresse")} />
                <CoverField label="Email" value={form.bureauEmail} onChange={handleChange("bureauEmail")} placeholder="contact@bureau.fr" />
                <CoverField label="Téléphone" value={form.bureauTelephone} onChange={handleChange("bureauTelephone")} placeholder="01 23 45 67 89" />
                <CoverField label="N° SIRET" value={form.siret} onChange={handleChange("siret")} placeholder="123 456 789 00012" />
                <CoverField label="Qualification / Certification" value={form.qualification} onChange={handleChange("qualification")} placeholder="RGE, OPQIBI..." />
              </div>
            </div>

            {/* Mission */}
            <div>
              <SectionDivider label="Informations mission" color="green" />
              <div className="grid grid-cols-2 gap-3">
                <CoverField label="Bénéficiaire / Client" value={form.beneficiaire} onChange={handleChange("beneficiaire")} />
                <CoverField label="Maître d'œuvre / Donneur d'ordre" value={form.maitreDoeuvre} onChange={handleChange("maitreDoeuvre")} />
                <CoverField label="Date de visite" value={form.dateVisite} onChange={handleChange("dateVisite")} placeholder="JJ/MM/AAAA" />
                <CoverField label="Date de réalisation" value={form.dateRealisation} onChange={handleChange("dateRealisation")} placeholder="JJ/MM/AAAA" />
                <CoverField label="Date de restitution" value={form.dateRestitution} onChange={handleChange("dateRestitution")} placeholder="JJ/MM/AAAA" />
                <CoverField label="Référence dossier" value={form.reference} onChange={handleChange("reference")} placeholder="REF-2025-001" />
              </div>
            </div>

          </div>
        </ScrollArea>

        {error && (
          <div className="px-6 py-2 text-sm text-red-600 bg-red-50 border-t">{error}</div>
        )}

        <DialogFooter className="px-6 py-3 border-t gap-2">
          <Button variant="outline" onClick={onClose} disabled={saving}>Annuler</Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? "Enregistrement…" : "Enregistrer"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function ReportDetail() {
  const { id } = useParams();
  const { data: report, isLoading, refetch } = useGetAuditReport(Number(id), {
    query: { enabled: !!id },
  });
  const [showPdfPreview, setShowPdfPreview] = useState(false);
  const [showCoverEditor, setShowCoverEditor] = useState(false);

  const handleDownloadPdf = useCallback(() => {
    setShowPdfPreview(false);
    setTimeout(() => window.print(), 150);
  }, []);

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
        <div className="flex gap-2 print:hidden">
          <Button variant="outline" onClick={() => setShowCoverEditor(true)}>
            <Edit className="h-4 w-4 mr-2" />
            Éditer la page de garde
          </Button>
          <Button variant="outline" onClick={() => setShowPdfPreview(true)}>
            <FileText className="h-4 w-4 mr-2" />
            Aperçu PDF
          </Button>
          <Button onClick={() => window.print()}>
            <Printer className="h-4 w-4 mr-2" />
            Imprimer
          </Button>
        </div>
      </div>

      {/* Cover page editor dialog */}
      {showCoverEditor && (
        <CoverPageEditor
          reportId={Number(id)}
          initial={{
            buildingName: report.buildingInfo.name ?? "",
            buildingAddress: report.buildingInfo.address ?? "",
            bureauEtudes: report.metadata?.bureauEtudes ?? "",
            bureauAdresse: report.metadata?.bureauAdresse ?? "",
            bureauEmail: report.metadata?.bureauEmail ?? "",
            bureauTelephone: report.metadata?.bureauTelephone ?? "",
            siret: report.metadata?.siret ?? "",
            qualification: report.metadata?.qualification ?? "",
            beneficiaire: report.metadata?.beneficiaire ?? "",
            maitreDoeuvre: report.metadata?.maitreDoeuvre ?? "",
            dateVisite: report.metadata?.dateVisite ?? "",
            dateRealisation: report.metadata?.dateRealisation ?? "",
            dateRestitution: report.metadata?.dateRestitution ?? "",
            reference: report.metadata?.reference ?? "",
            coverPhotoId: (report.metadata as Record<string, unknown>)?.coverPhotoId as number | null ?? null,
          }}
          onClose={() => setShowCoverEditor(false)}
          onSaved={() => refetch()}
        />
      )}

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
          <SyntheseGlobale rawFields={rawFields} initialCost={initialCost ?? null} scenarios={(report as unknown as { metadata?: { scenarios?: Array<{ tauxEnrRPct?: number | null }> } }).metadata?.scenarios} />
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
              visitReportData: (report as unknown as { visitReportData?: Record<string, unknown> | null }).visitReportData ?? null,
            }}
            rawFields={rawFields}
          />
        </TabsContent>
      </Tabs>

      {/* ── Vue impression (cachée à l'écran, affichée à l'impression) ─ */}
      <PrintReport
        mode="print"
        report={{
          ...report,
          sectionCharacteristics: (report as unknown as { sectionCharacteristics?: Record<string, string> }).sectionCharacteristics ?? {},
          metadata: (report as unknown as { metadata?: Record<string, unknown> | null }).metadata ?? null,
          ubatParoisData: (report as unknown as { ubatParoisData?: unknown[] | null }).ubatParoisData ?? null,
        }}
      />

      {/* ── Modale d'aperçu PDF ───────────────────────────────────────── */}
      {showPdfPreview && (
        <div
          className="print:hidden"
          style={{
            position: "fixed", inset: 0, zIndex: 1000,
            display: "flex", flexDirection: "column",
            background: "#374151",
          }}
        >
          {/* Toolbar */}
          <div style={{
            background: "#1e293b", padding: "10px 20px",
            display: "flex", alignItems: "center", justifyContent: "space-between",
            flexShrink: 0, boxShadow: "0 2px 8px rgba(0,0,0,0.4)",
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <FileText style={{ color: "#94a3b8", width: 18, height: 18 }} />
              <span style={{ color: "#f1f5f9", fontWeight: 600, fontSize: 14 }}>
                Aperçu PDF — {report.buildingInfo.name || "Rapport"}
              </span>
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <button
                onClick={handleDownloadPdf}
                style={{
                  display: "flex", alignItems: "center", gap: 6,
                  background: "#2563eb", color: "#fff", border: "none",
                  borderRadius: 6, padding: "7px 14px", fontSize: 13, fontWeight: 600,
                  cursor: "pointer",
                }}
              >
                <Download style={{ width: 14, height: 14 }} />
                Télécharger PDF
              </button>
              <button
                onClick={() => setShowPdfPreview(false)}
                style={{
                  display: "flex", alignItems: "center", gap: 6,
                  background: "#374151", color: "#d1d5db", border: "1px solid #4b5563",
                  borderRadius: 6, padding: "7px 12px", fontSize: 13, fontWeight: 500,
                  cursor: "pointer",
                }}
              >
                <X style={{ width: 14, height: 14 }} />
                Fermer
              </button>
            </div>
          </div>

          {/* Scrollable PDF content */}
          <div style={{ flex: 1, overflowY: "auto", padding: "32px 24px" }}>
            <PrintReport
              mode="preview"
              report={{
                ...report,
                sectionCharacteristics: (report as unknown as { sectionCharacteristics?: Record<string, string> }).sectionCharacteristics ?? {},
                metadata: (report as unknown as { metadata?: Record<string, unknown> | null }).metadata ?? null,
                ubatParoisData: (report as unknown as { ubatParoisData?: unknown[] | null }).ubatParoisData ?? null,
              }}
            />
          </div>
        </div>
      )}
    </div>
  );
}
