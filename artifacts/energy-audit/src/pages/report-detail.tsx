import React from "react";
import { useParams, Link } from "wouter";
import { useGetAuditReport } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Printer, Building, Zap, Flame, Thermometer, Wind, DollarSign, Leaf, Wrench } from "lucide-react";
import { EnergyLabel } from "../components/energy-label";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";

const formatNumber = (num: number | null | undefined, suffix = "") => {
  if (num === null || num === undefined) return "Non renseigné";
  return `${new Intl.NumberFormat("fr-FR").format(num)} ${suffix}`.trim();
};

const DataRow = ({ label, value }: { label: string; value: React.ReactNode }) => (
  <div className="flex justify-between py-2 border-b last:border-0 border-border/50">
    <span className="text-muted-foreground">{label}</span>
    <span className="font-medium text-right">{value || "Non renseigné"}</span>
  </div>
);

export function ReportDetail() {
  const { id } = useParams();
  const { data: report, isLoading } = useGetAuditReport(Number(id), { query: { enabled: !!id } });

  const handlePrint = () => {
    window.print();
  };

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

  return (
    <div className="space-y-8 pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <Link href="/" className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground mb-4">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Retour
          </Link>
          <h1 className="text-3xl font-bold tracking-tight">Rapport d'audit</h1>
          <p className="text-muted-foreground">{report.fileName}</p>
        </div>
        <Button onClick={handlePrint} className="print:hidden">
          <Printer className="h-4 w-4 mr-2" />
          Imprimer le rapport
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Top left: Key metrics */}
        <Card className="lg:col-span-2 bg-slate-900 text-slate-50 dark:bg-card dark:text-card-foreground border-transparent">
          <CardContent className="p-6">
            <div className="flex flex-col md:flex-row justify-between items-center gap-8">
              <div>
                <h2 className="text-2xl font-bold mb-1">{report.buildingInfo.name || "Bâtiment sans nom"}</h2>
                <p className="text-slate-400 dark:text-muted-foreground mb-6">{report.buildingInfo.address || "Adresse non renseignée"}</p>
                <div className="flex gap-6">
                  <div>
                    <p className="text-sm text-slate-400 dark:text-muted-foreground">Surface chauffée</p>
                    <p className="text-2xl font-bold">{formatNumber(report.buildingInfo.heatedSurface, "m²")}</p>
                  </div>
                  <div>
                    <p className="text-sm text-slate-400 dark:text-muted-foreground">Année de construction</p>
                    <p className="text-2xl font-bold">{report.buildingInfo.constructionYear || "—"}</p>
                  </div>
                </div>
              </div>
              <div className="flex flex-col items-center p-6 bg-slate-800 dark:bg-muted rounded-xl">
                <span className="text-sm text-slate-400 dark:text-muted-foreground mb-2">Diagnostic de Performance</span>
                <EnergyLabel label={report.energyLabel.currentLabel} className="h-20 w-20 text-4xl mb-2" />
                <span className="text-lg font-bold">{formatNumber(report.energyLabel.primaryEnergyConsumption, "kWh/m².an")}</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Top right: Costs & CO2 */}
        <div className="flex flex-col gap-6">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-lg flex items-center">
                <DollarSign className="h-5 w-5 mr-2 text-primary" />
                Coûts énergétiques
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-primary">
                {formatNumber(report.energyCost.totalCost, report.energyCost.currency || "€")}
              </div>
              <p className="text-sm text-muted-foreground">Coût annuel total estimé</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-lg flex items-center">
                <Leaf className="h-5 w-5 mr-2 text-green-600" />
                Émissions CO2
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-green-600">
                {formatNumber(report.co2Emissions.totalEmissions, report.co2Emissions.unit || "kgCO2/m².an")}
              </div>
              <p className="text-sm text-muted-foreground">Émissions totales</p>
            </CardContent>
          </Card>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Consommation */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center text-lg">
              <Zap className="h-5 w-5 mr-2 text-primary" />
              Consommations ({report.energyConsumption.unit || "kWh"})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-1">
              <DataRow label="Total" value={formatNumber(report.energyConsumption.totalConsumption)} />
              <DataRow label="Électricité" value={formatNumber(report.energyConsumption.electricityConsumption)} />
              <DataRow label="Gaz" value={formatNumber(report.energyConsumption.gasConsumption)} />
              <DataRow label="Chauffage" value={formatNumber(report.energyConsumption.heatingConsumption)} />
              <DataRow label="Refroidissement" value={formatNumber(report.energyConsumption.coolingConsumption)} />
              <DataRow label="Eau Chaude Sanitaire" value={formatNumber(report.energyConsumption.hotWaterConsumption)} />
            </div>
          </CardContent>
        </Card>

        {/* Enveloppe */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center text-lg">
              <Building className="h-5 w-5 mr-2 text-primary" />
              Enveloppe thermique
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-1">
              <DataRow label="Isolation murs" value={report.envelopeData.wallInsulation} />
              <DataRow label="Isolation toiture" value={report.envelopeData.roofInsulation} />
              <DataRow label="Isolation plancher" value={report.envelopeData.floorInsulation} />
              <DataRow label="Type de menuiseries" value={report.envelopeData.windowType} />
              <DataRow label="Surface vitrée" value={formatNumber(report.envelopeData.windowSurface, "m²")} />
              <DataRow label="Étanchéité à l'air" value={report.envelopeData.airTightness} />
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
            <div className="space-y-1">
              <DataRow label="Système de chauffage" value={report.hvacSystem.heatingSystem} />
              <DataRow label="Rendement chauffage" value={formatNumber(report.hvacSystem.heatingEfficiency, "%")} />
              <DataRow label="Système de refroidissement" value={report.hvacSystem.coolingSystem} />
              <DataRow label="Rendement refroidissement" value={formatNumber(report.hvacSystem.coolingEfficiency, "%")} />
              <DataRow label="Type de ventilation" value={report.hvacSystem.ventilationType} />
              <DataRow label="Système ECS" value={report.hvacSystem.hotWaterSystem} />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Recommendations */}
      {report.recommendations && report.recommendations.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center text-lg">
              <Wrench className="h-5 w-5 mr-2 text-primary" />
              Recommandations d'amélioration
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-6">
              {report.recommendations.map((rec, i) => (
                <div key={i} className="flex flex-col md:flex-row gap-4 p-4 border rounded-lg bg-muted/30">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <Badge variant={rec.priority === "high" ? "destructive" : rec.priority === "medium" ? "default" : "secondary"}>
                        Priorité {rec.priority === "high" ? "Haute" : rec.priority === "medium" ? "Moyenne" : "Basse"}
                      </Badge>
                      <span className="font-semibold">{rec.category}</span>
                    </div>
                    <p className="text-sm text-muted-foreground">{rec.description}</p>
                  </div>
                  <div className="flex md:flex-col justify-between gap-4 md:gap-1 text-sm md:min-w-[150px] md:text-right bg-card p-3 rounded-md border">
                    <div>
                      <span className="text-muted-foreground block text-xs">Économie est.</span>
                      <span className="font-bold text-green-600">{formatNumber(rec.estimatedSaving, "€/an")}</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground block text-xs">Coût est.</span>
                      <span className="font-bold">{formatNumber(rec.estimatedCost, "€")}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Raw Data Table (Collapsible or just standard table) */}
      <Card className="print:hidden">
        <CardHeader>
          <CardTitle className="text-lg">Données brutes extraites</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto rounded-md border">
            <table className="w-full text-sm text-left">
              <thead className="bg-muted text-muted-foreground">
                <tr>
                  <th className="px-4 py-2 font-medium">Clé</th>
                  <th className="px-4 py-2 font-medium">Valeur</th>
                  <th className="px-4 py-2 font-medium">Section</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {report.rawFields?.map((field, i) => (
                  <tr key={i} className="hover:bg-muted/50">
                    <td className="px-4 py-2 font-mono text-xs">{field.key}</td>
                    <td className="px-4 py-2">{field.value}</td>
                    <td className="px-4 py-2 text-muted-foreground">{field.section || "—"}</td>
                  </tr>
                ))}
                {(!report.rawFields || report.rawFields.length === 0) && (
                  <tr>
                    <td colSpan={3} className="px-4 py-8 text-center text-muted-foreground">
                      Aucune donnée brute disponible
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
