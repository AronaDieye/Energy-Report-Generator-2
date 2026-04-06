import React, { useState } from "react";
import { useListAuditReports, useGetAuditStats, useDeleteAuditReport, getListAuditReportsQueryKey, getGetAuditStatsQueryKey } from "@workspace/api-client-react";
import { UploadZone } from "../components/upload-zone";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Building2, FileText, Trash2, Zap, ArrowUpRight, PlusCircle, FolderOpen } from "lucide-react";
import { Link } from "wouter";
import { EnergyLabel } from "../components/energy-label";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "@/hooks/use-toast";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";

export function Home() {
  const [activeTab, setActiveTab] = useState("reports");
  const { data: stats, isLoading: statsLoading } = useGetAuditStats();
  const { data: reports, isLoading: reportsLoading } = useListAuditReports();
  const deleteMutation = useDeleteAuditReport();
  const queryClient = useQueryClient();

  const handleDelete = async (id: number) => {
    if (!confirm("Voulez-vous vraiment supprimer ce rapport ?")) return;

    try {
      await deleteMutation.mutateAsync({ id });
      queryClient.invalidateQueries({ queryKey: getListAuditReportsQueryKey() });
      queryClient.invalidateQueries({ queryKey: getGetAuditStatsQueryKey() });
      toast({ title: "Rapport supprimé" });
    } catch (e) {
      toast({ title: "Erreur lors de la suppression", variant: "destructive" });
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-foreground">Audits énergétiques</h1>
        <p className="text-muted-foreground mt-1">Importez et consultez vos rapports BAO Evolution SED.</p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full max-w-sm grid-cols-2">
          <TabsTrigger value="reports" className="flex items-center gap-2">
            <FolderOpen className="h-4 w-4" />
            Mes rapports
            {!statsLoading && stats?.totalReports ? (
              <Badge variant="secondary" className="ml-1 h-5 px-1.5 text-xs">
                {stats.totalReports}
              </Badge>
            ) : null}
          </TabsTrigger>
          <TabsTrigger value="new" className="flex items-center gap-2">
            <PlusCircle className="h-4 w-4" />
            Nouveau rapport
          </TabsTrigger>
        </TabsList>

        {/* ── Onglet Mes rapports ── */}
        <TabsContent value="reports" className="space-y-6 mt-6">
          {/* Stats */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Total audits</CardTitle>
                <FileText className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                {statsLoading ? (
                  <Skeleton className="h-8 w-16" />
                ) : (
                  <div className="text-3xl font-bold">{stats?.totalReports || 0}</div>
                )}
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Surface moyenne</CardTitle>
                <Building2 className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                {statsLoading ? (
                  <Skeleton className="h-8 w-24" />
                ) : (
                  <div className="text-3xl font-bold">
                    {stats?.averageSurface
                      ? `${new Intl.NumberFormat("fr-FR").format(Math.round(stats.averageSurface))} m²`
                      : "—"}
                  </div>
                )}
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Consommation moyenne</CardTitle>
                <Zap className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                {statsLoading ? (
                  <Skeleton className="h-8 w-24" />
                ) : (
                  <div className="text-3xl font-bold">
                    {stats?.averageConsumption
                      ? stats.averageConsumption >= 1000000
                        ? `${new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 0 }).format(stats.averageConsumption / 1000)} MWh`
                        : `${new Intl.NumberFormat("fr-FR").format(Math.round(stats.averageConsumption))} kWh`
                      : "—"}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Liste des rapports */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Rapports récents</CardTitle>
                <CardDescription>Cliquez sur un rapport pour afficher l'analyse complète.</CardDescription>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setActiveTab("new")}
                className="shrink-0"
              >
                <PlusCircle className="h-4 w-4 mr-2" />
                Importer
              </Button>
            </CardHeader>
            <CardContent>
              {reportsLoading ? (
                <div className="space-y-3">
                  <Skeleton className="h-12 w-full" />
                  <Skeleton className="h-12 w-full" />
                  <Skeleton className="h-12 w-full" />
                </div>
              ) : !reports?.length ? (
                <div className="text-center py-16 space-y-4">
                  <div className="flex justify-center">
                    <div className="rounded-full bg-muted p-6">
                      <FileText className="h-10 w-10 text-muted-foreground" />
                    </div>
                  </div>
                  <div>
                    <p className="font-medium text-foreground">Aucun rapport pour l'instant</p>
                    <p className="text-sm text-muted-foreground mt-1">
                      Importez un fichier DOCX ou CSV pour générer votre premier rapport.
                    </p>
                  </div>
                  <Button onClick={() => setActiveTab("new")}>
                    <PlusCircle className="h-4 w-4 mr-2" />
                    Importer un audit
                  </Button>
                </div>
              ) : (
                <div className="rounded-md border overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-muted/50">
                        <TableHead>Bâtiment</TableHead>
                        <TableHead>Date d'import</TableHead>
                        <TableHead>Surface</TableHead>
                        <TableHead className="text-center">DPE</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {reports.map((report) => (
                        <TableRow key={report.id} className="hover:bg-muted/30 cursor-pointer">
                          <TableCell className="font-medium">
                            <div className="flex flex-col">
                              <span>{report.buildingName || "Bâtiment non renseigné"}</span>
                              <span className="text-xs text-muted-foreground font-normal truncate max-w-xs">
                                {report.fileName}
                              </span>
                            </div>
                          </TableCell>
                          <TableCell className="text-muted-foreground text-sm">
                            {format(new Date(report.uploadedAt), "d MMM yyyy", { locale: fr })}
                          </TableCell>
                          <TableCell className="text-sm">
                            {report.totalSurface
                              ? `${new Intl.NumberFormat("fr-FR").format(report.totalSurface)} m²`
                              : "—"}
                          </TableCell>
                          <TableCell className="text-center">
                            <EnergyLabel label={report.currentLabel} className="h-8 w-8 text-sm" />
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex justify-end gap-1">
                              <Link href={`/reports/${report.id}`}>
                                <Button variant="ghost" size="icon" title="Voir le rapport">
                                  <ArrowUpRight className="h-4 w-4" />
                                </Button>
                              </Link>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                                onClick={() => handleDelete(report.id)}
                                disabled={deleteMutation.isPending}
                                title="Supprimer"
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Onglet Nouveau rapport ── */}
        <TabsContent value="new" className="mt-6">
          <div className="max-w-2xl">
            <div className="mb-6">
              <h2 className="text-xl font-semibold">Importer un fichier d'audit</h2>
              <p className="text-muted-foreground text-sm mt-1">
                Glissez-déposez ou sélectionnez un export DOCX ou CSV de BAO Evolution SED.
                Les données du bâtiment, les consommations, le DPE et les scénarios seront extraits automatiquement.
              </p>
            </div>
            <UploadZone />
            <div className="mt-6 rounded-lg bg-muted/50 border p-4">
              <p className="text-sm font-medium text-foreground mb-2">Données extraites automatiquement :</p>
              <div className="grid grid-cols-2 gap-1 text-sm text-muted-foreground">
                <span>• Informations du bâtiment</span>
                <span>• Étiquette DPE (3CL-2021)</span>
                <span>• Consommations par poste</span>
                <span>• Coûts et émissions CO₂</span>
                <span>• Enveloppe thermique</span>
                <span>• Systèmes CVC</span>
                <span>• Scénarios d'amélioration</span>
                <span>• Contexte climatique</span>
              </div>
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
