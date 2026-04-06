import { pgTable, serial, integer, text, timestamp } from "drizzle-orm/pg-core";
import { auditReportsTable } from "./auditReports";

export const reportPhotosTable = pgTable("report_photos", {
  id: serial("id").primaryKey(),
  reportId: integer("report_id")
    .notNull()
    .references(() => auditReportsTable.id, { onDelete: "cascade" }),
  fileName: text("file_name").notNull(),
  mimeType: text("mime_type").notNull(),
  dataBase64: text("data_base64").notNull(),
  caption: text("caption"),
  uploadedAt: timestamp("uploaded_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export type ReportPhoto = typeof reportPhotosTable.$inferSelect;
