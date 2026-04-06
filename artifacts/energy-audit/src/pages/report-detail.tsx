import React, { useMemo } from "react";
import { useParams, Link } from "wouter";
import { useGetAuditReport } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
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
} from "lucide-react";
import { EnergyLabel } from "../components/energy-label";
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

function ScenarioComparison({
  rawFields,
  initialCost,
  initialEP,
  initialGes,
}: {
  rawFields: RawField[];
  initialCost: number | null;
  initialEP: number | null;
  initialGes: number | null;
}) {
  // Extract scenario data from rawFields
  const scenarioCodes = useMemo(() => {
    const codes = new Set<string>();
    for (const f of rawFields) {
      const match = f.section?.match(/^SCÉNARIO (\w+)$/);
      if (match) codes.add(match[1]);
    }
    return Array.from(codes);
  }, [rawFields]);

  if (scenarioCodes.length === 0) return null;

  const getScenarioValue = (code: string, suffix: string): string | null => {
    const key = `SCÉNARIO ${code} - ${suffix}`;
    return rawFields.find((f) => f.key === key)?.value ?? null;
  };

  const parseVal = (s: string | null): number | null => {
    if (!s) return null;
    const n = parseFloat(s.replace(/\s/g, "").replace(",", ".").replace(/[^\d.-]/g, ""));
    return isNaN(n) ? null : n;
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center text-lg">
          <TrendingDown className="h-5 w-5 mr-2 text-green-600" />
          Comparaison des scénarios d'amélioration
        </CardTitle>
      </CardHeader>
      <CardContent className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b">
              <th className="text-left py-2 pr-4 font-medium text-muted-foreground">Indicateur</th>
              <th className="text-right py-2 px-3 font-medium bg-muted/30 rounded-tl">
                État initial
              </th>
              {scenarioCodes.map((code) => (
                <th key={code} className="text-right py-2 px-3 font-medium">
                  {code}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-border/50">
            <tr>
              <td className="py-2 pr-4 text-muted-foreground">Consommation (kWhEP/m².an)</td>
              <td className="py-2 px-3 text-right font-mono bg-muted/30 font-semibold">
                {initialEP !== null ? initialEP.toLocaleString("fr-FR", { maximumFractionDigits: 1 }) : "—"}
              </td>
              {scenarioCodes.map((code) => {
                const val = parseVal(getScenarioValue(code, "kWhEP/m².an après"));
                const delta = val !== null && initialEP !== null ? val - initialEP : null;
                return (
                  <td key={code} className="py-2 px-3 text-right font-mono">
                    <div className="font-semibold">
                      {val !== null ? val.toLocaleString("fr-FR", { maximumFractionDigits: 1 }) : "—"}
                    </div>
                    {delta !== null && (
                      <div className={`text-xs ${delta < 0 ? "text-green-600" : "text-red-500"}`}>
                        {delta > 0 ? "+" : ""}{delta.toLocaleString("fr-FR", { maximumFractionDigits: 1 })}
                      </div>
                    )}
                  </td>
                );
              })}
            </tr>
            <tr>
              <td className="py-2 pr-4 text-muted-foreground">Étiquette DPE</td>
              <td className="py-2 px-3 text-right bg-muted/30">
                <EnergyLabel
                  label={initialEP !== null ? dpeFromEP(initialEP) : null}
                  className="h-7 w-7 text-sm inline-flex"
                />
              </td>
              {scenarioCodes.map((code) => {
                const val = parseVal(getScenarioValue(code, "kWhEP/m².an après"));
                return (
                  <td key={code} className="py-2 px-3 text-right">
                    <EnergyLabel
                      label={val !== null ? dpeFromEP(val) : null}
                      className="h-7 w-7 text-sm inline-flex"
                    />
                  </td>
                );
              })}
            </tr>
            <tr>
              <td className="py-2 pr-4 text-muted-foreground">Émissions GES (kgCO2/m².an)</td>
              <td className="py-2 px-3 text-right font-mono bg-muted/30 font-semibold">
                {initialGes !== null ? initialGes.toLocaleString("fr-FR", { maximumFractionDigits: 1 }) : "—"}
              </td>
              {scenarioCodes.map((code) => {
                const val = parseVal(getScenarioValue(code, "kgCO2/m² après"));
                const delta = val !== null && initialGes !== null ? val - initialGes : null;
                return (
                  <td key={code} className="py-2 px-3 text-right font-mono">
                    <div className="font-semibold">
                      {val !== null ? val.toLocaleString("fr-FR", { maximumFractionDigits: 1 }) : "—"}
                    </div>
                    {delta !== null && (
                      <div className={`text-xs ${delta < 0 ? "text-green-600" : "text-red-500"}`}>
                        {delta > 0 ? "+" : ""}{delta.toLocaleString("fr-FR", { maximumFractionDigits: 1 })}
                      </div>
                    )}
                  </td>
                );
              })}
            </tr>
            <tr>
              <td className="py-2 pr-4 text-muted-foreground">Dépense annuelle (€/an)</td>
              <td className="py-2 px-3 text-right font-mono bg-muted/30 font-semibold">
                {initialCost !== null
                  ? initialCost.toLocaleString("fr-FR", { maximumFractionDigits: 0 })
                  : "—"}
              </td>
              {scenarioCodes.map((code) => {
                const val = parseVal(getScenarioValue(code, "Dépense annuelle après"));
                const saving = val !== null && initialCost !== null ? initialCost - val : null;
                return (
                  <td key={code} className="py-2 px-3 text-right font-mono">
                    <div className="font-semibold">
                      {val !== null ? val.toLocaleString("fr-FR", { maximumFractionDigits: 0 }) : "—"}
                    </div>
                    {saving !== null && saving !== 0 && (
                      <div className={`text-xs ${saving > 0 ? "text-green-600" : "text-red-500"}`}>
                        {saving > 0 ? "−" : "+"}
                        {Math.abs(saving).toLocaleString("fr-FR", { maximumFractionDigits: 0 })} €/an
                      </div>
                    )}
                  </td>
                );
              })}
            </tr>
            <tr>
              <td className="py-2 pr-4 text-muted-foreground">Investissement (€)</td>
              <td className="py-2 px-3 text-right bg-muted/30 text-muted-foreground">—</td>
              {scenarioCodes.map((code) => {
                const val = parseVal(getScenarioValue(code, "Investissement"));
                return (
                  <td key={code} className="py-2 px-3 text-right font-mono font-semibold">
                    {val !== null ? val.toLocaleString("fr-FR", { maximumFractionDigits: 0 }) + " €" : "—"}
                  </td>
                );
              })}
            </tr>
            <tr>
              <td className="py-2 pr-4 text-muted-foreground">Temps de retour (ans)</td>
              <td className="py-2 px-3 text-right bg-muted/30 text-muted-foreground">—</td>
              {scenarioCodes.map((code) => {
                const val = getScenarioValue(code, "Temps de retour");
                return (
                  <td key={code} className="py-2 px-3 text-right font-mono font-semibold">
                    {val || "—"}
                  </td>
                );
              })}
            </tr>
          </tbody>
        </table>
      </CardContent>
    </Card>
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

      {/* Consumption breakdown */}
      <ConsumptionBreakdown rawFields={rawFields} />

      {/* UBAT & Répartition déperditions */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <UbatBilan rawFields={rawFields} />
        <DeperditionsRepartition rawFields={rawFields} />
      </div>

      {/* Scenario comparison */}
      <ScenarioComparison
        rawFields={rawFields}
        initialCost={initialCost ?? null}
        initialEP={initialEP ?? null}
        initialGes={initialGes ?? null}
      />

      {/* Recommendations */}
      {report.recommendations && report.recommendations.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center text-lg">
              <Wrench className="h-5 w-5 mr-2 text-primary" />
              Préconisations de travaux
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {report.recommendations.map((rec, i) => (
                <div
                  key={i}
                  className="p-4 border rounded-lg bg-muted/30 space-y-2"
                >
                  <div className="flex items-center gap-2">
                    <Badge
                      variant={
                        rec.priority === "high"
                          ? "destructive"
                          : rec.priority === "medium"
                          ? "default"
                          : "secondary"
                      }
                    >
                      {rec.category}
                    </Badge>
                  </div>
                  <p className="text-sm">{rec.description}</p>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm pt-1">
                    <div>
                      <span className="block text-xs text-muted-foreground">Investissement</span>
                      <span className="font-bold">
                        {rec.estimatedCost !== null && rec.estimatedCost !== undefined
                          ? rec.estimatedCost.toLocaleString("fr-FR") + " €"
                          : "—"}
                      </span>
                    </div>
                    <div>
                      <span className="block text-xs text-muted-foreground">Économie estimée</span>
                      <span className="font-bold text-green-600">
                        {rec.estimatedSaving !== null && rec.estimatedSaving !== undefined
                          ? rec.estimatedSaving.toLocaleString("fr-FR") + " €/an"
                          : "—"}
                      </span>
                    </div>
                    <div>
                      <span className="block text-xs text-muted-foreground">Temps de retour</span>
                      <span className="font-bold">
                        {rec.paybackPeriod !== null && rec.paybackPeriod !== undefined
                          ? rec.paybackPeriod + " an(s)"
                          : "—"}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Climate context */}
        <ClimateContext rawFields={rawFields} />

        {/* Envelope */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center text-lg">
              <Building className="h-5 w-5 mr-2 text-primary" />
              Enveloppe thermique
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-0">
              <DataRow label="Isolation murs" value={report.envelopeData.wallInsulation} />
              <DataRow label="Isolation toiture" value={report.envelopeData.roofInsulation} />
              <DataRow label="Isolation plancher" value={report.envelopeData.floorInsulation} />
              <DataRow label="Menuiseries" value={report.envelopeData.windowType} />
              <DataRow
                label="Surface vitrée"
                value={fmt(report.envelopeData.windowSurface, "m²")}
              />
              <DataRow label="Ponts thermiques" value={report.envelopeData.thermalBridges} />
            </div>
          </CardContent>
        </Card>

        {/* CVC */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center text-lg">
              <Thermometer className="h-5 w-5 mr-2 text-primary" />
              Systèmes CVC
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-0">
              <DataRow label="Chauffage" value={report.hvacSystem.heatingSystem} />
              <DataRow label="Refroidissement" value={report.hvacSystem.coolingSystem} />
              <DataRow label="Ventilation" value={report.hvacSystem.ventilationType} />
              <DataRow label="ECS" value={report.hvacSystem.hotWaterSystem} />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Raw data collapsible */}
      <RawFieldsSection rawFields={rawFields} />
    </div>
  );
}
