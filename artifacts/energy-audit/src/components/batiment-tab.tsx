import React, { useState, useEffect, useCallback, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import {
  MapPin,
  Building2,
  Calendar,
  Layers,
  Users,
  Thermometer,
  Wind,
  CloudRain,
  Sun,
  Trash2,
  Upload,
  ImagePlus,
  Loader2,
  Edit2,
  Check,
  Info,
  Home,
  FlameKindling,
  Blinds,
  Fence,
  Droplets,
  Save,
} from "lucide-react";
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";

// ── Station coordinates lookup ────────────────────────────────────────────────

const STATION_COORDS: Record<string, { lat: number; lon: number; city: string }> = {
  "NICE": { lat: 43.658, lon: 7.208, city: "Nice" },
  "NICE COTE D'AZUR": { lat: 43.658, lon: 7.208, city: "Nice" },
  "NICE-CÔTE D'AZUR": { lat: 43.658, lon: 7.208, city: "Nice" },
  "MARSEILLE": { lat: 43.435, lon: 5.213, city: "Marseille" },
  "MARSEILLE MARIGNANE": { lat: 43.435, lon: 5.213, city: "Marseille" },
  "LYON": { lat: 45.724, lon: 5.081, city: "Lyon" },
  "LYON BRON": { lat: 45.724, lon: 5.081, city: "Lyon" },
  "PARIS": { lat: 48.853, lon: 2.349, city: "Paris" },
  "PARIS ORLY": { lat: 48.723, lon: 2.389, city: "Paris" },
  "PARIS LE BOURGET": { lat: 48.969, lon: 2.441, city: "Paris" },
  "BORDEAUX": { lat: 44.828, lon: -0.693, city: "Bordeaux" },
  "BORDEAUX MERIGNAC": { lat: 44.828, lon: -0.693, city: "Bordeaux" },
  "TOULOUSE": { lat: 43.621, lon: 1.378, city: "Toulouse" },
  "TOULOUSE BLAGNAC": { lat: 43.621, lon: 1.378, city: "Toulouse" },
  "NANTES": { lat: 47.157, lon: -1.607, city: "Nantes" },
  "NANTES ATLANTIQUE": { lat: 47.157, lon: -1.607, city: "Nantes" },
  "STRASBOURG": { lat: 48.547, lon: 7.628, city: "Strasbourg" },
  "STRASBOURG ENTZHEIM": { lat: 48.547, lon: 7.628, city: "Strasbourg" },
  "LILLE": { lat: 50.569, lon: 3.097, city: "Lille" },
  "LILLE LESQUIN": { lat: 50.569, lon: 3.097, city: "Lille" },
  "RENNES": { lat: 48.068, lon: -1.731, city: "Rennes" },
  "MONTPELLIER": { lat: 43.576, lon: 3.963, city: "Montpellier" },
  "GRENOBLE": { lat: 45.165, lon: 5.724, city: "Grenoble" },
  "CLERMONT-FERRAND": { lat: 45.795, lon: 3.151, city: "Clermont-Ferrand" },
  "TOURS": { lat: 47.443, lon: 0.727, city: "Tours" },
  "NANCY": { lat: 48.687, lon: 6.220, city: "Nancy" },
  "DIJON": { lat: 47.271, lon: 5.090, city: "Dijon" },
  "REIMS": { lat: 49.309, lon: 4.050, city: "Reims" },
  "BREST": { lat: 48.447, lon: -4.419, city: "Brest" },
  "PERPIGNAN": { lat: 42.740, lon: 2.870, city: "Perpignan" },
  "METZ": { lat: 49.072, lon: 6.132, city: "Metz" },
  "CAEN": { lat: 49.171, lon: -0.449, city: "Caen" },
  "LIMOGES": { lat: 45.863, lon: 1.179, city: "Limoges" },
  "POITIERS": { lat: 46.590, lon: 0.306, city: "Poitiers" },
  "AJACCIO": { lat: 41.919, lon: 8.797, city: "Ajaccio" },
};

function resolveStationCoords(stationRaw: string | null): { lat: number; lon: number; city: string } | null {
  if (!stationRaw) return null;
  const upper = stationRaw.toUpperCase().trim();
  for (const [key, val] of Object.entries(STATION_COORDS)) {
    if (upper.includes(key) || key.includes(upper)) return val;
  }
  return null;
}

// ── Types ─────────────────────────────────────────────────────────────────────

interface RawField { key: string; value: string; section: string | null; }

function getRaw(rawFields: RawField[], key: string): string | null {
  return rawFields.find((f) => f.key === key)?.value ?? null;
}

const MONTHS_SHORT = ["Jan", "Fév", "Mar", "Avr", "Mai", "Jun", "Jul", "Aoû", "Sep", "Oct", "Nov", "Déc"];

// ── Section definitions ───────────────────────────────────────────────────────

type CategoryKey = "facades" | "planchers" | "toitures" | "menuiseries" | "chauffage_ecs";

interface SectionDef {
  key: CategoryKey;
  label: string;
  icon: React.ElementType;
  color: string;
  charLabel: string;
  charPlaceholder: string;
  charHints: string[];
}

const SECTIONS: SectionDef[] = [
  {
    key: "facades",
    label: "Façades extérieures",
    icon: Home,
    color: "text-orange-600",
    charLabel: "Caractéristiques des murs extérieurs",
    charPlaceholder: "Décrivez les murs extérieurs...",
    charHints: ["Composition : béton, brique, pierre...", "Isolation : type, épaisseur (cm), λ (W/m.K)", "Coefficient U (W/m².K)", "État général, pathologies constatées"],
  },
  {
    key: "planchers",
    label: "Planchers bas",
    icon: Layers,
    color: "text-stone-600",
    charLabel: "Caractéristiques des planchers bas",
    charPlaceholder: "Décrivez les planchers bas...",
    charHints: ["Type : dalle béton, vide sanitaire, terre-plein...", "Isolation : présence, type, épaisseur (cm)", "Coefficient U (W/m².K)", "État et humidité"],
  },
  {
    key: "toitures",
    label: "Toitures",
    icon: Fence,
    color: "text-blue-600",
    charLabel: "Caractéristiques des toitures",
    charPlaceholder: "Décrivez les toitures...",
    charHints: ["Type : terrasse, combles, pente...", "Isolation : type, épaisseur (cm), λ (W/m.K)", "Coefficient U (W/m².K)", "Étanchéité, état de la couverture"],
  },
  {
    key: "menuiseries",
    label: "Menuiseries",
    icon: Blinds,
    color: "text-cyan-600",
    charLabel: "Caractéristiques des menuiseries",
    charPlaceholder: "Décrivez les menuiseries...",
    charHints: ["Matériau : PVC, aluminium, bois...", "Vitrage : simple, double, triple (Ug W/m².K)", "Coefficient Uw (W/m².K)", "Présence de coffre de volet roulant"],
  },
  {
    key: "chauffage_ecs",
    label: "Chauffage & ECS",
    icon: FlameKindling,
    color: "text-red-600",
    charLabel: "Caractéristiques des systèmes de chauffage et ECS",
    charPlaceholder: "Décrivez les équipements de chauffage et eau chaude sanitaire...",
    charHints: ["Chauffage : type, énergie, puissance (kW), rendement", "Régulation : thermostat, programmable, vannes TA", "ECS : type, volume ballon (L), énergie", "Âge des équipements, état général"],
  },
];

// ── Photo category section ────────────────────────────────────────────────────

interface Photo {
  id: number;
  fileName: string;
  mimeType: string;
  caption: string | null;
  category: string;
  url: string;
  uploadedAt: string;
}

interface PhotoSectionProps {
  section: SectionDef;
  reportId: number;
  photos: Photo[];
  characteristics: Record<string, string>;
  onPhotosChange: (photos: Photo[]) => void;
  onCharChange: (key: string, value: string) => void;
  onSaveChar: (key: string) => void;
  savingChar: string | null;
  apiBase: string;
}

function PhotoSection({
  section,
  reportId,
  photos,
  characteristics,
  onPhotosChange,
  onCharChange,
  onSaveChar,
  savingChar,
  apiBase,
}: PhotoSectionProps) {
  const [uploading, setUploading] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [editingCaption, setEditingCaption] = useState<number | null>(null);
  const [captionText, setCaptionText] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  const sectionPhotos = photos.filter((p) => p.category === section.key);
  const charValue = characteristics[section.key] ?? "";
  const Icon = section.icon;

  const uploadPhoto = async (file: File) => {
    setUploading(true);
    const form = new FormData();
    form.append("photo", file);
    form.append("category", section.key);
    try {
      const res = await fetch(`${apiBase}/api/audit/reports/${reportId}/photos`, { method: "POST", body: form });
      if (res.ok) {
        const newPhoto = await res.json();
        onPhotosChange([...photos, { ...newPhoto, url: `/api/audit/reports/${reportId}/photos/${newPhoto.id}/data` }]);
      }
    } finally { setUploading(false); }
  };

  const deletePhoto = async (id: number) => {
    await fetch(`${apiBase}/api/audit/reports/${reportId}/photos/${id}`, { method: "DELETE" });
    onPhotosChange(photos.filter((p) => p.id !== id));
  };

  return (
    <div className="border rounded-xl overflow-hidden">
      {/* Section header */}
      <div className="flex items-center gap-3 px-5 py-4 bg-muted/40 border-b">
        <Icon className={`h-5 w-5 ${section.color}`} />
        <h3 className="font-semibold text-sm">{section.label}</h3>
        {sectionPhotos.length > 0 && (
          <Badge variant="secondary" className="ml-auto">{sectionPhotos.length} photo{sectionPhotos.length > 1 ? "s" : ""}</Badge>
        )}
      </div>

      <div className="p-5 space-y-5">
        {/* Characteristics textarea */}
        <div className="space-y-2">
          <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
            {section.charLabel}
          </label>
          <div className="bg-muted/20 rounded-lg p-3 mb-2 space-y-1">
            {section.charHints.map((hint) => (
              <p key={hint} className="text-xs text-muted-foreground flex items-start gap-1.5">
                <span className="text-primary/60 mt-0.5">•</span> {hint}
              </p>
            ))}
          </div>
          <div className="flex gap-2">
            <Textarea
              className="flex-1 text-sm min-h-[100px] resize-none"
              placeholder={section.charPlaceholder}
              value={charValue}
              onChange={(e) => onCharChange(section.key, e.target.value)}
            />
          </div>
          <div className="flex justify-end">
            <Button
              size="sm"
              variant="outline"
              className="gap-1.5"
              onClick={() => onSaveChar(section.key)}
              disabled={savingChar === section.key}
            >
              {savingChar === section.key ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Save className="h-3.5 w-3.5" />
              )}
              Enregistrer
            </Button>
          </div>
        </div>

        {/* Upload + gallery */}
        <div className="space-y-3">
          <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
            Photos
          </label>

          {/* Drop zone */}
          <div
            className={`border-2 border-dashed rounded-lg p-4 text-center transition-all cursor-pointer
              ${isDragging ? "border-primary bg-primary/5" : "border-border hover:border-primary/40 hover:bg-muted/20"}
              ${uploading ? "opacity-50 pointer-events-none" : ""}`}
            onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={(e) => { e.preventDefault(); setIsDragging(false); const f = e.dataTransfer.files[0]; if (f?.type.startsWith("image/")) uploadPhoto(f); }}
            onClick={() => inputRef.current?.click()}
          >
            {uploading ? (
              <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" /> Chargement...
              </div>
            ) : (
              <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
                <Upload className="h-4 w-4" />
                Glisser-déposer ou cliquer pour ajouter une photo
              </div>
            )}
            <input ref={inputRef} type="file" accept="image/*" className="hidden"
              onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadPhoto(f); e.target.value = ""; }} />
          </div>

          {/* Photo grid */}
          {sectionPhotos.length > 0 && (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
              {sectionPhotos.map((photo) => (
                <div key={photo.id} className="group relative rounded-lg overflow-hidden border bg-muted aspect-[4/3]">
                  <img
                    src={`${apiBase}${photo.url}`}
                    alt={photo.caption || photo.fileName}
                    className="w-full h-full object-cover"
                  />
                  <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-all" />
                  <Button
                    size="icon" variant="destructive"
                    className="absolute top-2 right-2 h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity"
                    onClick={() => deletePhoto(photo.id)}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                  {editingCaption === photo.id ? (
                    <div className="absolute bottom-0 left-0 right-0 p-2 bg-black/70 flex gap-1">
                      <input
                        className="flex-1 text-xs text-white bg-transparent border-b border-white/50 outline-none"
                        value={captionText}
                        onChange={(e) => setCaptionText(e.target.value)}
                        onKeyDown={(e) => { if (e.key === "Enter" || e.key === "Escape") setEditingCaption(null); }}
                        autoFocus
                      />
                      <button onClick={() => setEditingCaption(null)} className="text-white/70 hover:text-white">
                        <Check className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ) : (
                    <div className="absolute bottom-0 left-0 right-0 p-2 bg-gradient-to-t from-black/60 to-transparent opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        className="text-xs text-white/90 hover:text-white flex items-center gap-1 truncate w-full"
                        onClick={() => { setEditingCaption(photo.id); setCaptionText(photo.caption || ""); }}
                      >
                        <Edit2 className="h-3 w-3 shrink-0" />
                        <span className="truncate">{photo.caption || "Ajouter une légende"}</span>
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {sectionPhotos.length === 0 && (
            <p className="text-xs text-muted-foreground text-center py-1">Aucune photo dans cette section</p>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Photo Gallery (all sections) ──────────────────────────────────────────────

function PhotoGallery({ reportId, report }: { reportId: number; report: { sectionCharacteristics?: Record<string, string> | null } }) {
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [loading, setLoading] = useState(true);
  const [characteristics, setCharacteristics] = useState<Record<string, string>>(
    (report.sectionCharacteristics as Record<string, string>) || {}
  );
  const [savingChar, setSavingChar] = useState<string | null>(null);

  const apiBase = import.meta.env.BASE_URL.replace(/\/$/, "");

  const fetchPhotos = useCallback(async () => {
    try {
      const res = await fetch(`${apiBase}/api/audit/reports/${reportId}/photos`);
      if (res.ok) setPhotos(await res.json());
    } finally { setLoading(false); }
  }, [reportId, apiBase]);

  useEffect(() => { fetchPhotos(); }, [fetchPhotos]);

  const handleCharChange = (key: string, value: string) => {
    setCharacteristics((prev) => ({ ...prev, [key]: value }));
  };

  const handleSaveChar = async (key: string) => {
    setSavingChar(key);
    try {
      await fetch(`${apiBase}/api/audit/reports/${reportId}/characteristics`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ [key]: characteristics[key] ?? "" }),
      });
    } finally { setSavingChar(null); }
  };

  const totalPhotos = photos.length;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center gap-3">
        <ImagePlus className="h-5 w-5 text-primary" />
        <h2 className="text-lg font-semibold">Photos & caractéristiques du bâtiment</h2>
        {totalPhotos > 0 && (
          <Badge variant="secondary">{totalPhotos} photo{totalPhotos > 1 ? "s" : ""} au total</Badge>
        )}
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-24 text-muted-foreground text-sm">
          <Loader2 className="h-4 w-4 animate-spin mr-2" /> Chargement...
        </div>
      ) : (
        <div className="space-y-4">
          {SECTIONS.map((section) => (
            <PhotoSection
              key={section.key}
              section={section}
              reportId={reportId}
              photos={photos}
              characteristics={characteristics}
              onPhotosChange={setPhotos}
              onCharChange={handleCharChange}
              onSaveChar={handleSaveChar}
              savingChar={savingChar}
              apiBase={apiBase}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ── Weather Chart ─────────────────────────────────────────────────────────────

interface MonthlyWeather {
  month: string;
  tMax: number;
  tMin: number;
  tMean: number;
  dju: number;
}

function WeatherAnalysis({ rawFields }: { rawFields: RawField[] }) {
  const [weather, setWeather] = useState<MonthlyWeather[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);

  const stationRaw = getRaw(rawFields, "Station météo");
  const coords = resolveStationCoords(stationRaw);
  const dju = getRaw(rawFields, "Degrés-jours base 18°C");
  const tempBase = getRaw(rawFields, "Température extérieure de base");
  const zoneClim = getRaw(rawFields, "Zone climatique");
  const altitude = getRaw(rawFields, "Altitude");

  useEffect(() => {
    if (!coords) return;
    setLoading(true);
    const year = new Date().getFullYear() - 1;
    const url = `https://archive-api.open-meteo.com/v1/archive?latitude=${coords.lat}&longitude=${coords.lon}`
      + `&start_date=${year}-01-01&end_date=${year}-12-31`
      + `&daily=temperature_2m_max,temperature_2m_min,temperature_2m_mean`
      + `&timezone=Europe%2FParis`;

    fetch(url)
      .then((r) => r.json())
      .then((data) => {
        if (!data.daily) { setError(true); return; }
        const { time, temperature_2m_max, temperature_2m_min, temperature_2m_mean } = data.daily;
        const byMonth: Record<number, { max: number[]; min: number[]; mean: number[] }> = {};
        time.forEach((d: string, i: number) => {
          const m = parseInt(d.slice(5, 7), 10) - 1;
          if (!byMonth[m]) byMonth[m] = { max: [], min: [], mean: [] };
          byMonth[m].max.push(temperature_2m_max[i]);
          byMonth[m].min.push(temperature_2m_min[i]);
          byMonth[m].mean.push(temperature_2m_mean[i]);
        });
        const avg = (arr: number[]) => arr.reduce((s, v) => s + v, 0) / arr.length;
        const result: MonthlyWeather[] = Array.from({ length: 12 }, (_, m) => {
          const tMean = byMonth[m] ? avg(byMonth[m].mean) : 0;
          const djuMonth = byMonth[m]
            ? byMonth[m].mean.reduce((s, t) => s + Math.max(0, 18 - t), 0) : 0;
          return {
            month: MONTHS_SHORT[m],
            tMax: byMonth[m] ? parseFloat(avg(byMonth[m].max).toFixed(1)) : 0,
            tMin: byMonth[m] ? parseFloat(avg(byMonth[m].min).toFixed(1)) : 0,
            tMean: parseFloat(tMean.toFixed(1)),
            dju: Math.round(djuMonth),
          };
        });
        setWeather(result);
      })
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, [coords?.lat, coords?.lon]);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <CloudRain className="h-5 w-5 text-blue-500" />
          Données météorologiques
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            { icon: MapPin, label: "Station", value: stationRaw },
            { icon: Wind, label: "Zone climatique", value: zoneClim },
            { icon: Thermometer, label: "T° extérieure de base", value: tempBase },
            { icon: Sun, label: "DJU (18°C)", value: dju },
            { icon: Layers, label: "Altitude", value: altitude },
          ].filter((r) => r.value).map(({ icon: Icon, label, value }) => (
            <div key={label} className="bg-muted/40 rounded-lg p-3">
              <div className="flex items-center gap-1.5 mb-1">
                <Icon className="h-3.5 w-3.5 text-muted-foreground" />
                <span className="text-xs text-muted-foreground">{label}</span>
              </div>
              <p className="text-sm font-semibold truncate">{value}</p>
            </div>
          ))}
        </div>

        {loading && (
          <div className="flex items-center justify-center h-40 text-muted-foreground text-sm">
            <Loader2 className="h-4 w-4 animate-spin mr-2" />
            Chargement des données météo pour {coords?.city}...
          </div>
        )}
        {!loading && !coords && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground bg-muted/30 rounded-lg p-3">
            <Info className="h-4 w-4 shrink-0" />
            Station météo non reconnue — graphiques non disponibles
          </div>
        )}
        {!loading && weather && (
          <div className="space-y-6">
            <div>
              <p className="text-sm font-medium mb-3 text-muted-foreground">
                Températures mensuelles — {stationRaw} ({new Date().getFullYear() - 1})
              </p>
              <ResponsiveContainer width="100%" height={220}>
                <AreaChart data={weather} margin={{ top: 5, right: 10, left: -10, bottom: 0 }}>
                  <defs>
                    <linearGradient id="tMax" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#f97316" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#f97316" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="tMin" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} unit="°C" />
                  <Tooltip formatter={(v: number) => `${v}°C`} />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  <Area type="monotone" dataKey="tMax" name="T° max" stroke="#f97316" fill="url(#tMax)" strokeWidth={2} dot={false} />
                  <Area type="monotone" dataKey="tMean" name="T° moyenne" stroke="#8b5cf6" fill="none" strokeWidth={1.5} strokeDasharray="4 2" dot={false} />
                  <Area type="monotone" dataKey="tMin" name="T° min" stroke="#3b82f6" fill="url(#tMin)" strokeWidth={2} dot={false} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
            <div>
              <p className="text-sm font-medium mb-3 text-muted-foreground">Degrés-Jours Unifiés mensuels (DJU 18°C)</p>
              <ResponsiveContainer width="100%" height={160}>
                <BarChart data={weather} margin={{ top: 0, right: 10, left: -10, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip formatter={(v: number) => `${v} DJU`} />
                  <Bar dataKey="dju" name="DJU" fill="#3b82f6" radius={[3, 3, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
              <p className="text-xs text-muted-foreground mt-1">
                Total annuel calculé : {weather.reduce((s, m) => s + m.dju, 0)} DJU
                {dju && ` — Document BAO : ${dju}`}
              </p>
            </div>
          </div>
        )}
        {!loading && error && (
          <div className="text-sm text-muted-foreground text-center py-4">
            Données météo indisponibles — vérifiez la connexion
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ── Location Map ──────────────────────────────────────────────────────────────

function LocalisationMap({ rawFields }: { rawFields: RawField[] }) {
  const station = getRaw(rawFields, "Station météo");
  const dept = getRaw(rawFields, "Département");
  const coords = resolveStationCoords(station);

  if (!coords) return null;

  const { lat, lon, city } = coords;
  const delta = 0.12;
  const mapUrl = `https://www.openstreetmap.org/export/embed.html`
    + `?bbox=${lon - delta},${lat - delta},${lon + delta},${lat + delta}`
    + `&layer=mapnik&marker=${lat},${lon}`;
  const linkUrl = `https://www.openstreetmap.org/?mlat=${lat}&mlon=${lon}&zoom=13`;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <MapPin className="h-5 w-5 text-primary" />
          Localisation
          {dept && <Badge variant="outline">{dept}</Badge>}
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <div className="relative">
          <iframe
            src={mapUrl}
            width="100%"
            height="280"
            style={{ border: 0, display: "block" }}
            title="Carte de localisation"
            loading="lazy"
          />
          <a
            href={linkUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="absolute bottom-2 right-2 bg-white/90 text-xs text-blue-600 hover:text-blue-800 px-2 py-1 rounded shadow"
          >
            Voir sur OpenStreetMap ↗
          </a>
        </div>
        <div className="px-4 py-2 text-xs text-muted-foreground flex items-center gap-1">
          <MapPin className="h-3 w-3" />
          Station météo : {station || city} — {lat.toFixed(3)}°N, {lon.toFixed(3)}°E
        </div>
      </CardContent>
    </Card>
  );
}

// ── Building Identity ─────────────────────────────────────────────────────────

function IdentiteBatiment({
  report,
  rawFields,
}: {
  report: {
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
  };
  rawFields: RawField[];
}) {
  const { buildingInfo: b } = report;
  const fmt = (n: number | null | undefined, u = "") =>
    n != null ? `${n.toLocaleString("fr-FR")}${u ? " " + u : ""}` : "—";

  const niveaux = getRaw(rawFields, "Nombre de niveaux");
  const hauteur = getRaw(rawFields, "Hauteur du bâtiment");
  const surfaceVitree = getRaw(rawFields, "Surface vitrée totale");
  const annee = getRaw(rawFields, "Année de construction");
  const dept = getRaw(rawFields, "Département");

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <Building2 className="h-5 w-5 text-primary" />
          Identité du bâtiment
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[
            { label: "Nom du bâtiment", value: b.name, icon: Building2 },
            { label: "Type de bâtiment", value: b.buildingType, icon: Building2 },
            { label: "Département", value: dept, icon: MapPin },
            { label: "Année de construction", value: annee || (b.constructionYear ? String(b.constructionYear) : null), icon: Calendar },
            { label: "Surface habitable", value: fmt(b.heatedSurface, "m²"), icon: Layers },
            { label: "Surface SHON", value: fmt(b.totalSurface, "m²"), icon: Layers },
            { label: "Nombre de niveaux", value: niveaux || (b.numberOfFloors ? String(b.numberOfFloors) : null), icon: Layers },
            { label: "Hauteur du bâtiment", value: hauteur, icon: Layers },
            { label: "Surface vitrée", value: surfaceVitree, icon: Sun },
            { label: "Nombre d'occupants", value: b.numberOfOccupants ? String(b.numberOfOccupants) : null, icon: Users },
            { label: "Zone climatique", value: b.climateZone, icon: Wind },
          ].filter((r) => r.value && r.value !== "—").map(({ label, value, icon: Icon }) => (
            <div key={label} className="flex flex-col gap-0.5 p-3 rounded-lg bg-muted/40">
              <span className="text-xs text-muted-foreground flex items-center gap-1">
                <Icon className="h-3 w-3" /> {label}
              </span>
              <span className="text-sm font-semibold">{value}</span>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

// ── Main BatimentTab export ───────────────────────────────────────────────────

export function BatimentTab({
  report,
  rawFields,
}: {
  report: {
    id: number;
    sectionCharacteristics?: Record<string, string> | null;
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
  };
  rawFields: RawField[];
}) {
  return (
    <div className="space-y-6">
      <IdentiteBatiment report={report} rawFields={rawFields} />
      <LocalisationMap rawFields={rawFields} />
      <WeatherAnalysis rawFields={rawFields} />
      <PhotoGallery reportId={report.id} report={report} />
    </div>
  );
}
