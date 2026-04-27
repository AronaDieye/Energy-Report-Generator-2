import { pgTable, serial, integer, text, timestamp } from "drizzle-orm/pg-core";
import { auditReportsTable } from "./auditReports";

export const PHOTO_CATEGORIES = [
  "facades",
  "planchers",
  "toitures",
  "menuiseries",
  "chauffage_ecs",
  "generateur_chauffage",
  "emetteurs_chauffage",
  "ecs",
  "ventilation",
  "climatisation",
  "compteurs",
  "eclairage",
  "bureau_logo",
  "certifications",
  "general",
] as const;

export type PhotoCategory = (typeof PHOTO_CATEGORIES)[number];

export const reportPhotosTable = pgTable("report_photos", {
  id: serial("id").primaryKey(),
  reportId: integer("report_id")
    .notNull()
    .references(() => auditReportsTable.id, { onDelete: "cascade" }),
  fileName: text("file_name").notNull(),
  mimeType: text("mime_type").notNull(),
  dataBase64: text("data_base64").notNull(),
  caption: text("caption"),
  category: text("category").notNull().default("general"),
  uploadedAt: timestamp("uploaded_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export type ReportPhoto = typeof reportPhotosTable.$inferSelect;
