import React from "react";
import { useListAuditReports, useGetAuditStats, useDeleteAuditReport, getListAuditReportsQueryKey, getGetAuditStatsQueryKey } from "@workspace/api-client-react";
import { UploadZone } from "../components/upload-zone";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Building2, FileText, Trash2, ChevronRight, Zap, ArrowUpRight } from "lucide-react";
import { Link } from "wouter";
import { EnergyLabel } from "../components/energy-label";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "@/hooks/use-toast";
import { Skeleton } from "@/components/ui/skeleton";

export function Home() {
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
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-foreground">Tableau de bord</h1>
        <p className="text-muted-foreground mt-1">Gérez et analysez vos audits énergétiques.</p>
      </div>

      {/* Upload Zone */}
      <UploadZone />

      {/* Stats Overview */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Audits</CardTitle>
            <FileText className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {statsLoading ? <Skeleton className="h-8 w-20" /> : (
              <div className="text-3xl font-bold">{stats?.totalReports || 0}</div>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Surface Moyenne</CardTitle>
            <Building2 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {statsLoading ? <Skeleton className="h-8 w-20" /> : (
              <div className="text-3xl font-bold">
                {stats?.averageSurface ? `${Math.round(stats.averageSurface)} m²` : "—"}
              </div>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Consommation Moyenne</CardTitle>
            <Zap className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {statsLoading ? <Skeleton className="h-8 w-20" /> : (
              <div className="text-3xl font-bold">
                {stats?.averageConsumption ? `${Math.round(stats.averageConsumption)} kWh` : "—"}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Recent Reports */}
      <Card>
        <CardHeader>
          <CardTitle>Rapports récents</CardTitle>
          <CardDescription>Liste des audits analysés récemment.</CardDescription>
        </CardHeader>
        <CardContent>
          {reportsLoading ? (
            <div className="space-y-4">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
            </div>
          ) : !reports?.length ? (
            <div className="text-center py-12 text-muted-foreground">
              Aucun rapport trouvé. Importez un fichier pour commencer.
            </div>
          ) : (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Bâtiment</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Surface</TableHead>
                    <TableHead className="text-center">DPE</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {reports.map((report) => (
                    <TableRow key={report.id}>
                      <TableCell className="font-medium">
                        <div className="flex flex-col">
                          <span>{report.buildingName || "Non renseigné"}</span>
                          <span className="text-xs text-muted-foreground font-normal">{report.fileName}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        {format(new Date(report.uploadedAt), "d MMM yyyy", { locale: fr })}
                      </TableCell>
                      <TableCell>
                        {report.totalSurface ? `${report.totalSurface} m²` : "—"}
                      </TableCell>
                      <TableCell className="text-center">
                        <EnergyLabel label={report.currentLabel} className="h-8 w-8 text-sm" />
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Link href={`/reports/${report.id}`} className="inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 hover:bg-accent hover:text-accent-foreground h-9 w-9">
                            <ArrowUpRight className="h-4 w-4" />
                          </Link>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                            onClick={() => handleDelete(report.id)}
                            disabled={deleteMutation.isPending}
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
    </div>
  );
}
