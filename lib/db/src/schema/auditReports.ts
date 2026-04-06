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
});

export const insertAuditReportSchema = createInsertSchema(
  auditReportsTable
).omit({ id: true, uploadedAt: true });

export type InsertAuditReport = z.infer<typeof insertAuditReportSchema>;
export type AuditReport = typeof auditReportsTable.$inferSelect;
