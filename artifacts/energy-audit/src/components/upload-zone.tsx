import React, { useCallback, useState } from "react";
import { UploadCloud, File, AlertCircle, Loader2 } from "lucide-react";
import { useUploadAuditFile } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { getListAuditReportsQueryKey, getGetAuditStatsQueryKey } from "@workspace/api-client-react";
import { Card } from "@/components/ui/card";
import { toast } from "@/hooks/use-toast";

export function UploadZone() {
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const uploadMutation = useUploadAuditFile();

  const handleDragOver = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  }, []);

  const processFile = async (file: File) => {
    if (!file.name.endsWith(".docx") && !file.name.endsWith(".csv")) {
      toast({
        title: "Format non supporté",
        description: "Veuillez importer un fichier DOCX ou CSV.",
        variant: "destructive",
      });
      return;
    }

    setIsUploading(true);
    try {
      const report = await uploadMutation.mutateAsync({ data: { file } });
      
      queryClient.invalidateQueries({ queryKey: getListAuditReportsQueryKey() });
      queryClient.invalidateQueries({ queryKey: getGetAuditStatsQueryKey() });
      
      toast({
        title: "Import réussi",
        description: "Le rapport a été généré avec succès.",
      });
      
      setLocation(`/reports/${report.id}`);
    } catch (error) {
      console.error(error);
      toast({
        title: "Erreur d'importation",
        description: "Une erreur est survenue lors de l'analyse du fichier.",
        variant: "destructive",
      });
    } finally {
      setIsUploading(false);
    }
  };

  const handleDrop = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      processFile(e.dataTransfer.files[0]);
    }
  }, []);

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      processFile(e.target.files[0]);
    }
  };

  return (
    <Card
      className={`border-2 border-dashed transition-all duration-200 ${
        isDragging ? "border-primary bg-primary/5" : "border-border bg-card"
      } ${isUploading ? "opacity-50 pointer-events-none" : "cursor-pointer hover:bg-muted/50"}`}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      onClick={() => !isUploading && document.getElementById("file-upload")?.click()}
    >
      <div className="p-12 flex flex-col items-center justify-center text-center">
        {isUploading ? (
          <div className="flex flex-col items-center space-y-4">
            <Loader2 className="h-12 w-12 text-primary animate-spin" />
            <div>
              <p className="text-lg font-medium">Analyse en cours...</p>
              <p className="text-sm text-muted-foreground">Extraction des données du bâtiment</p>
            </div>
          </div>
        ) : (
          <>
            <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center mb-6">
              <UploadCloud className="h-8 w-8 text-primary" />
            </div>
            <h3 className="text-xl font-semibold mb-2">Importer un audit</h3>
            <p className="text-muted-foreground max-w-sm mx-auto mb-6">
              Glissez-déposez un fichier d'audit énergétique ou cliquez pour parcourir.
            </p>
            <div className="flex items-center gap-4 text-sm text-muted-foreground bg-muted px-4 py-2 rounded-md">
              <span className="flex items-center"><File className="h-4 w-4 mr-2" /> DOCX</span>
              <span className="flex items-center"><File className="h-4 w-4 mr-2" /> CSV</span>
            </div>
          </>
        )}
      </div>
      <input
        id="file-upload"
        type="file"
        className="hidden"
        accept=".docx,.csv"
        onChange={handleFileInput}
      />
    </Card>
  );
}
