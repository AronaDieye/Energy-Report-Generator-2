import {
  pgTable,
  serial,
  text,
  integer,
  real,
  timestamp,
  jsonb,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const auditReportsTable = pgTable("audit_reports", {
  id: serial("id").primaryKey(),
  fileName: text("file_name").notNull(),
  fileType: text("file_type").notNull(),
  uploadedAt: timestamp("uploaded_at", { withTimezone: true })
    .notNull()
    .defaultNow(),

  buildingName: text("building_name"),
  buildingAddress: text("building_address"),
  buildingType: text("building_type"),
  constructionYear: integer("construction_year"),
  totalSurface: real("total_surface"),
  heatedSurface: real("heated_surface"),
  numberOfFloors: integer("number_of_floors"),
  numberOfOccupants: integer("number_of_occupants"),
  climateZone: text("climate_zone"),

  totalConsumption: real("total_consumption"),
  electricityConsumption: real("electricity_consumption"),
  gasConsumption: real("gas_consumption"),
  heatingConsumption: real("heating_consumption"),
  coolingConsumption: real("cooling_consumption"),
  hotWaterConsumption: real("hot_water_consumption"),
  consumptionUnit: text("consumption_unit"),
  consumptionReferenceYear: integer("consumption_reference_year"),

  totalCost: real("total_cost"),
  electricityCost: real("electricity_cost"),
  gasCost: real("gas_cost"),
  currency: text("currency"),
  costReferenceYear: integer("cost_reference_year"),

  totalCo2Emissions: real("total_co2_emissions"),
  electricityCo2Emissions: real("electricity_co2_emissions"),
  gasCo2Emissions: real("gas_co2_emissions"),
  co2Unit: text("co2_unit"),

  wallInsulation: text("wall_insulation"),
  roofInsulation: text("roof_insulation"),
  floorInsulation: text("floor_insulation"),
  windowType: text("window_type"),
  windowSurface: real("window_surface"),
  airTightness: real("air_tightness"),
  thermalBridges: text("thermal_bridges"),

  heatingSystem: text("heating_system"),
  heatingEfficiency: real("heating_efficiency"),
  coolingSystem: text("cooling_system"),
  coolingEfficiency: real("cooling_efficiency"),
  ventilationType: text("ventilation_type"),
  hotWaterSystem: text("hot_water_system"),

  currentLabel: text("current_label"),
  primaryEnergyConsumption: real("primary_energy_consumption"),
  referenceConsumption: real("reference_consumption"),
  energyIndex: real("energy_index"),

  recommendations: jsonb("recommendations").$type<
    Array<{
      category: string;
      description: string;
      estimatedSaving: number | null;
      estimatedCost: number | null;
      priority: "high" | "medium" | "low";
      paybackPeriod: number | null;
    }>
  >(),

  rawFields: jsonb("raw_fields").$type<
    Array<{
      key: string;
      value: string;
      section: string | null;
    }>
  >(),

  sectionCharacteristics: jsonb("section_characteristics").$type<{
    facades?: string;
    planchers?: string;
    toitures?: string;
    menuiseries?: string;
    chauffage_ecs?: string;
    ventilation?: string;
    climatisation?: string;
    compteurs?: string;
    eclairage?: string;
  }>(),

  visitReportData: jsonb("visit_report_data").$type<{
    source?: string | null;
    score?: string | null;
    preconisation?: string | null;
    preparePar?: string | null;
    telephone?: string | null;
    nombreLocataires?: number | null;
    formeBatiment?: string | null;
    orientationFacade?: string | null;
    nombreAppartements?: string | null;
    anneeGenerateur?: string | null;
    epaisseurMurs?: string | null;
    typeToiture?: string | null;
    surfaceToiture?: string | null;
    compositionMurNord?: string | null;
    isolationMurNord?: string | null;
    compositionMurSud?: string | null;
    isolationMurSud?: string | null;
    compositionMurEst?: string | null;
    isolationMurEst?: string | null;
    compositionMurOuest?: string | null;
    isolationMurOuest?: string | null;
    compositionPlancherBas?: string | null;
    isolationPlancherBas?: string | null;
    positionGenerateur?: string | null;
    dimensionsPieceGenerateur?: string | null;
    typeEcs?: string | null;
    apartments?: Array<{
      numero: number;
      etage: number | null;
      typologie: string | null;
      surface: number | null;
      chauffage: string | null;
      ecs: string | null;
      ventilation: string | null;
      hauteur: string | null;
    }>;
  }>(),

  metadata: jsonb("metadata").$type<{
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
    scenarios?: Array<{
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
    }>;
  }>(),
});

export const insertAuditReportSchema = createInsertSchema(
  auditReportsTable
).omit({ id: true, uploadedAt: true });

export type InsertAuditReport = z.infer<typeof insertAuditReportSchema>;
export type AuditReport = typeof auditReportsTable.$inferSelect;
