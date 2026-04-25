import { Router, type IRouter } from "express";
import multer from "multer";
import { db, auditReportsTable, reportPhotosTable } from "@workspace/db";
import { eq, desc, sql } from "drizzle-orm";
import { extractFromDocx, extractFromCsv } from "../lib/fileExtractor.js";
import { extractFromVisitReportPdf } from "../lib/visitReportExtractor.js";
import { logger } from "../lib/logger.js";
import puppeteer from "puppeteer-core";

const router: IRouter = Router();

const storage = multer.memoryStorage();
const upload = multer({
  storage,
  limits: { fileSize: 50 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const allowed = [
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "application/msword",
      "text/csv",
      "application/csv",
      "text/plain",
      "application/pdf",
    ];
    const ext = file.originalname.toLowerCase();
    if (
      allowed.includes(file.mimetype) ||
      ext.endsWith(".docx") ||
      ext.endsWith(".doc") ||
      ext.endsWith(".csv") ||
      ext.endsWith(".pdf")
    ) {
      cb(null, true);
    } else {
      cb(new Error("Seuls les fichiers DOCX, CSV et PDF sont acceptés"));
    }
  },
});

router.post(
  "/audit/upload",
  upload.single("file"),
  async (req, res): Promise<void> => {
    if (!req.file) {
      res.status(400).json({ error: "Aucun fichier fourni" });
      return;
    }

    const file = req.file;
    const isDocx =
      file.mimetype.includes("word") ||
      file.originalname.toLowerCase().endsWith(".docx") ||
      file.originalname.toLowerCase().endsWith(".doc");
    const isCsv =
      file.mimetype.includes("csv") ||
      file.mimetype.includes("text") ||
      file.originalname.toLowerCase().endsWith(".csv");
    const isPdf =
      file.mimetype === "application/pdf" ||
      file.originalname.toLowerCase().endsWith(".pdf");

    if (!isDocx && !isCsv && !isPdf) {
      res.status(400).json({ error: "Format de fichier non supporté. Utilisez DOCX, CSV ou PDF." });
      return;
    }

    try {
      let extracted: Awaited<ReturnType<typeof extractFromVisitReportPdf>> | Awaited<ReturnType<typeof extractFromDocx>>;
      let fileType: string;

      if (isPdf) {
        extracted = await extractFromVisitReportPdf(file.buffer);
        fileType = "pdf";
      } else if (isDocx) {
        extracted = await extractFromDocx(file.buffer);
        fileType = "docx";
      } else {
        extracted = await extractFromCsv(file.buffer);
        fileType = "csv";
      }

      const visitReportData = (extracted as { visitReportData?: unknown }).visitReportData ?? null;
      const sectionCharacteristics = (extracted as { sectionCharacteristics?: unknown }).sectionCharacteristics ?? null;
      const ubatParoisData = (extracted as { ubatParoisData?: unknown }).ubatParoisData ?? null;
      const scenarioUbatData = extracted.scenarioUbatData ?? null;

      const [inserted] = await db
        .insert(auditReportsTable)
        .values({
          fileName: file.originalname,
          fileType,
          buildingName: extracted.buildingName,
          buildingAddress: extracted.buildingAddress,
          buildingType: extracted.buildingType,
          constructionYear: extracted.constructionYear,
          totalSurface: extracted.totalSurface,
          heatedSurface: extracted.heatedSurface,
          numberOfFloors: extracted.numberOfFloors,
          numberOfOccupants: extracted.numberOfOccupants,
          climateZone: extracted.climateZone,
          totalConsumption: extracted.totalConsumption,
          electricityConsumption: extracted.electricityConsumption,
          gasConsumption: extracted.gasConsumption,
          heatingConsumption: extracted.heatingConsumption,
          coolingConsumption: extracted.coolingConsumption,
          hotWaterConsumption: extracted.hotWaterConsumption,
          consumptionUnit: extracted.consumptionUnit,
          consumptionReferenceYear: extracted.consumptionReferenceYear,
          totalCost: extracted.totalCost,
          electricityCost: extracted.electricityCost,
          gasCost: extracted.gasCost,
          currency: extracted.currency,
          costReferenceYear: extracted.costReferenceYear,
          totalCo2Emissions: extracted.totalCo2Emissions,
          electricityCo2Emissions: extracted.electricityCo2Emissions,
          gasCo2Emissions: extracted.gasCo2Emissions,
          co2Unit: extracted.co2Unit,
          wallInsulation: extracted.wallInsulation,
          roofInsulation: extracted.roofInsulation,
          floorInsulation: extracted.floorInsulation,
          windowType: extracted.windowType,
          windowSurface: extracted.windowSurface,
          airTightness: extracted.airTightness,
          thermalBridges: extracted.thermalBridges,
          heatingSystem: extracted.heatingSystem,
          heatingEfficiency: extracted.heatingEfficiency,
          coolingSystem: extracted.coolingSystem,
          coolingEfficiency: extracted.coolingEfficiency,
          ventilationType: extracted.ventilationType,
          hotWaterSystem: extracted.hotWaterSystem,
          currentLabel: extracted.currentLabel,
          primaryEnergyConsumption: extracted.primaryEnergyConsumption,
          referenceConsumption: extracted.referenceConsumption,
          energyIndex: extracted.energyIndex,
          recommendations: extracted.recommendations,
          rawFields: extracted.rawFields,
          metadata: extracted.metadata ?? null,
          sectionCharacteristics: sectionCharacteristics as typeof auditReportsTable.$inferInsert["sectionCharacteristics"],
          visitReportData: visitReportData as typeof auditReportsTable.$inferInsert["visitReportData"],
          ubatParoisData: ubatParoisData as typeof auditReportsTable.$inferInsert["ubatParoisData"],
          scenarioUbatData: scenarioUbatData as typeof auditReportsTable.$inferInsert["scenarioUbatData"],
        })
        .returning();

      const report = mapToApiReport(inserted);
      res.status(200).json(report);
    } catch (err) {
      req.log.error({ err }, "Error processing audit file");
      res.status(500).json({ error: "Erreur lors du traitement du fichier" });
    }
  }
);

router.get("/audit/reports", async (_req, res): Promise<void> => {
  const reports = await db
    .select()
    .from(auditReportsTable)
    .orderBy(desc(auditReportsTable.uploadedAt));

  const summaries = reports.map((r) => ({
    id: r.id,
    fileName: r.fileName,
    fileType: r.fileType,
    uploadedAt: r.uploadedAt.toISOString(),
    buildingName: r.buildingName,
    buildingType: r.buildingType,
    totalSurface: r.totalSurface,
    currentLabel: r.currentLabel,
    totalConsumption: r.totalConsumption,
  }));

  res.json(summaries);
});

router.get("/audit/reports/:id", async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(raw, 10);
  if (isNaN(id)) {
    res.status(400).json({ error: "ID invalide" });
    return;
  }

  const [report] = await db
    .select()
    .from(auditReportsTable)
    .where(eq(auditReportsTable.id, id));

  if (!report) {
    res.status(404).json({ error: "Rapport non trouvé" });
    return;
  }

  res.json(mapToApiReport(report));
});

// ── PDF generation endpoint ───────────────────────────────────────────────────
const CHROMIUM_PATH =
  process.env.REPLIT_PLAYWRIGHT_CHROMIUM_EXECUTABLE ??
  "/home/runner/.cache/puppeteer/chrome/linux-147.0.7727.57/chrome-linux64/chrome";

const FRONTEND_PORT = process.env.FRONTEND_PORT ?? "5173";

router.get("/audit/reports/:id/pdf", async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(raw, 10);
  if (isNaN(id)) { res.status(400).json({ error: "ID invalide" }); return; }

  const [report] = await db
    .select({ id: auditReportsTable.id, buildingName: auditReportsTable.buildingName })
    .from(auditReportsTable)
    .where(eq(auditReportsTable.id, id));

  if (!report) { res.status(404).json({ error: "Rapport non trouvé" }); return; }

  let browser;
  try {
    browser = await puppeteer.launch({
      executablePath: CHROMIUM_PATH,
      headless: true,
      args: [
        "--no-sandbox",
        "--disable-setuid-sandbox",
        "--disable-dev-shm-usage",
        "--disable-gpu",
        "--font-render-hinting=none",
      ],
    });

    const page = await browser.newPage();
    await page.setViewport({ width: 1200, height: 1754 });

    // Switch to print media so .print-only elements are visible
    await page.emulateMediaType("print");

    const url = `http://localhost:${FRONTEND_PORT}/reports/${id}`;
    await page.goto(url, { waitUntil: "networkidle0", timeout: 30000 });

    // Wait for the print report root element (always in DOM once React renders)
    await page.waitForSelector(".print-only", { timeout: 20000 });

    // Wait for images and async content to settle
    await new Promise(r => setTimeout(r, 2500));

    // Restructure the DOM: move .print-only to body root so the invisible React UI
    // content doesn't create phantom blank pages in the print layout.
    await page.evaluate(() => {
      const printDiv = document.querySelector(".print-only") as HTMLElement | null;
      if (!printDiv) return;
      document.body.innerHTML = "";
      document.body.style.margin = "0";
      document.body.style.padding = "0";
      document.body.appendChild(printDiv);
      printDiv.style.position = "static";
      printDiv.style.top = "";
      printDiv.style.left = "";
      printDiv.style.display = "block";
      printDiv.style.visibility = "visible";
      printDiv.style.width = "100%";
    });

    const buildingName = (report.buildingName ?? "")
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

    const pdfBuffer = await page.pdf({
      format: "A4",
      printBackground: true,
      displayHeaderFooter: true,
      headerTemplate: "<div></div>",
      footerTemplate: `
        <div style="width:100%;box-sizing:border-box;padding:3px 12mm 0;display:flex;justify-content:space-between;font-size:7.5pt;color:#94a3b8;font-family:'Segoe UI',Arial,sans-serif;border-top:1px solid #e2e8f0;">
          <span>AuditTech Pro — Rapport d'audit énergétique</span>
          <span>${buildingName}</span>
          <span>Page <span class="pageNumber"></span></span>
        </div>`,
      margin: { top: "12mm", right: "12mm", bottom: "12mm", left: "12mm" },
    });

    const safeName = (report.buildingName ?? "rapport")
      .replace(/[^a-z0-9_\- ]/gi, "_")
      .trim();
    const filename = `audit-${safeName}.pdf`;

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    res.setHeader("Content-Length", pdfBuffer.length);
    res.send(Buffer.from(pdfBuffer));
  } catch (err) {
    req.log.error({ err }, "PDF generation failed");
    res.status(500).json({ error: "Erreur lors de la génération du PDF" });
  } finally {
    if (browser) await browser.close();
  }
});

router.delete("/audit/reports/:id", async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(raw, 10);
  if (isNaN(id)) {
    res.status(400).json({ error: "ID invalide" });
    return;
  }

  const [deleted] = await db
    .delete(auditReportsTable)
    .where(eq(auditReportsTable.id, id))
    .returning();

  if (!deleted) {
    res.status(404).json({ error: "Rapport non trouvé" });
    return;
  }

  res.json({ success: true });
});

router.get("/audit/stats", async (_req, res): Promise<void> => {
  const reports = await db.select().from(auditReportsTable);

  const totalReports = reports.length;
  const withConsumption = reports.filter((r) => r.totalConsumption != null);
  const withSurface = reports.filter((r) => r.totalSurface != null);

  const averageConsumption =
    withConsumption.length > 0
      ? withConsumption.reduce((sum, r) => sum + (r.totalConsumption ?? 0), 0) /
        withConsumption.length
      : null;

  const averageSurface =
    withSurface.length > 0
      ? withSurface.reduce((sum, r) => sum + (r.totalSurface ?? 0), 0) /
        withSurface.length
      : null;

  const labelDistribution: Record<string, number> = {};
  const buildingTypeDistribution: Record<string, number> = {};

  for (const report of reports) {
    if (report.currentLabel) {
      labelDistribution[report.currentLabel] =
        (labelDistribution[report.currentLabel] ?? 0) + 1;
    }
    if (report.buildingType) {
      const bt = report.buildingType;
      buildingTypeDistribution[bt] = (buildingTypeDistribution[bt] ?? 0) + 1;
    }
  }

  const totalCO2Saved = reports.reduce(
    (sum, r) => sum + (r.totalCo2Emissions ?? 0),
    0
  );

  res.json({
    totalReports,
    averageConsumption,
    averageSurface,
    labelDistribution,
    buildingTypeDistribution,
    totalCO2Saved: totalCO2Saved > 0 ? totalCO2Saved : null,
  });
});

function mapToApiReport(r: typeof auditReportsTable.$inferSelect) {
  return {
    id: r.id,
    fileName: r.fileName,
    fileType: r.fileType,
    uploadedAt: r.uploadedAt.toISOString(),
    buildingInfo: {
      name: r.buildingName,
      address: r.buildingAddress,
      buildingType: r.buildingType,
      constructionYear: r.constructionYear,
      totalSurface: r.totalSurface,
      heatedSurface: r.heatedSurface,
      numberOfFloors: r.numberOfFloors,
      numberOfOccupants: r.numberOfOccupants,
      climateZone: r.climateZone,
    },
    energyConsumption: {
      totalConsumption: r.totalConsumption,
      electricityConsumption: r.electricityConsumption,
      gasConsumption: r.gasConsumption,
      heatingConsumption: r.heatingConsumption,
      coolingConsumption: r.coolingConsumption,
      hotWaterConsumption: r.hotWaterConsumption,
      unit: r.consumptionUnit,
      referenceYear: r.consumptionReferenceYear,
    },
    energyCost: {
      totalCost: r.totalCost,
      electricityCost: r.electricityCost,
      gasCost: r.gasCost,
      currency: r.currency,
      referenceYear: r.costReferenceYear,
    },
    co2Emissions: {
      totalEmissions: r.totalCo2Emissions,
      electricityEmissions: r.electricityCo2Emissions,
      gasEmissions: r.gasCo2Emissions,
      unit: r.co2Unit,
    },
    envelopeData: {
      wallInsulation: r.wallInsulation,
      roofInsulation: r.roofInsulation,
      floorInsulation: r.floorInsulation,
      windowType: r.windowType,
      windowSurface: r.windowSurface,
      airTightness: r.airTightness,
      thermalBridges: r.thermalBridges,
    },
    hvacSystem: {
      heatingSystem: r.heatingSystem,
      heatingEfficiency: r.heatingEfficiency,
      coolingSystem: r.coolingSystem,
      coolingEfficiency: r.coolingEfficiency,
      ventilationType: r.ventilationType,
      hotWaterSystem: r.hotWaterSystem,
    },
    energyLabel: {
      currentLabel: r.currentLabel,
      primaryEnergyConsumption: r.primaryEnergyConsumption,
      referenceConsumption: r.referenceConsumption,
      energyIndex: r.energyIndex,
    },
    recommendations: r.recommendations ?? [],
    rawFields: r.rawFields ?? [],
    sectionCharacteristics: r.sectionCharacteristics ?? {},
    metadata: r.metadata ?? null,
    visitReportData: r.visitReportData ?? null,
    ubatParoisData: r.ubatParoisData ?? null,
    scenarioUbatData: r.scenarioUbatData ?? null,
  };
}

// ── Photos endpoints ──────────────────────────────────────────────────────────

const photoUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (file.mimetype.startsWith("image/")) cb(null, true);
    else cb(new Error("Seuls les fichiers image sont acceptés"));
  },
});

router.post(
  "/audit/reports/:id/photos",
  photoUpload.single("photo"),
  async (req, res): Promise<void> => {
    const reportId = parseInt(req.params.id, 10);
    if (isNaN(reportId)) { res.status(400).json({ error: "ID invalide" }); return; }

    const [report] = await db.select({ id: auditReportsTable.id })
      .from(auditReportsTable).where(eq(auditReportsTable.id, reportId));
    if (!report) { res.status(404).json({ error: "Rapport introuvable" }); return; }

    if (!req.file) { res.status(400).json({ error: "Aucun fichier fourni" }); return; }

    const dataBase64 = req.file.buffer.toString("base64");
    const caption = typeof req.body.caption === "string" ? req.body.caption : null;
    const category = typeof req.body.category === "string" ? req.body.category : "general";

    const [inserted] = await db.insert(reportPhotosTable).values({
      reportId,
      fileName: req.file.originalname,
      mimeType: req.file.mimetype,
      dataBase64,
      caption,
      category,
    }).returning();

    res.json({ id: inserted.id, fileName: inserted.fileName, caption: inserted.caption, category: inserted.category });
  }
);

router.get("/audit/reports/:id/photos", async (req, res): Promise<void> => {
  const reportId = parseInt(req.params.id, 10);
  if (isNaN(reportId)) { res.status(400).json({ error: "ID invalide" }); return; }

  const photos = await db.select({
    id: reportPhotosTable.id,
    fileName: reportPhotosTable.fileName,
    mimeType: reportPhotosTable.mimeType,
    caption: reportPhotosTable.caption,
    category: reportPhotosTable.category,
    uploadedAt: reportPhotosTable.uploadedAt,
  }).from(reportPhotosTable)
    .where(eq(reportPhotosTable.reportId, reportId))
    .orderBy(reportPhotosTable.uploadedAt);

  res.json(photos.map((p) => ({ ...p, url: `/api/audit/reports/${reportId}/photos/${p.id}/data` })));
});

router.patch("/audit/reports/:id/cover", async (req, res): Promise<void> => {
  const reportId = parseInt(req.params.id, 10);
  if (isNaN(reportId)) { res.status(400).json({ error: "ID invalide" }); return; }

  const [existing] = await db.select().from(auditReportsTable).where(eq(auditReportsTable.id, reportId));
  if (!existing) { res.status(404).json({ error: "Rapport introuvable" }); return; }

  const {
    buildingName, buildingAddress,
    bureauEtudes, bureauAdresse, bureauEmail, bureauTelephone, siret, qualification,
    maitreDoeuvre, beneficiaire, adresseClient, dateVisite, dateRealisation, dateRestitution, reference,
    coverPhotoId,
  } = req.body;

  const metaPatch: Record<string, unknown> = {};
  for (const [k, v] of Object.entries({
    bureauEtudes, bureauAdresse, bureauEmail, bureauTelephone, siret, qualification,
    maitreDoeuvre, beneficiaire, adresseClient, dateVisite, dateRealisation, dateRestitution, reference,
  })) {
    if (v !== undefined) metaPatch[k] = v === "" ? null : v;
  }
  if (coverPhotoId !== undefined) {
    metaPatch.coverPhotoId = coverPhotoId === null ? null : Number(coverPhotoId);
  }

  const mergedMeta = { ...(existing.metadata ?? {}), ...metaPatch };
  const updateData: Record<string, unknown> = { metadata: mergedMeta };
  if (buildingName !== undefined) updateData.buildingName = buildingName === "" ? null : buildingName;
  if (buildingAddress !== undefined) updateData.buildingAddress = buildingAddress === "" ? null : buildingAddress;

  const [updated] = await db.update(auditReportsTable)
    .set(updateData)
    .where(eq(auditReportsTable.id, reportId))
    .returning({ id: auditReportsTable.id });

  res.json({ ok: true, id: updated.id });
});

router.patch("/audit/reports/:id/characteristics", async (req, res): Promise<void> => {
  const reportId = parseInt(req.params.id, 10);
  if (isNaN(reportId)) { res.status(400).json({ error: "ID invalide" }); return; }

  const [report] = await db.select({ id: auditReportsTable.id, chars: auditReportsTable.sectionCharacteristics })
    .from(auditReportsTable).where(eq(auditReportsTable.id, reportId));
  if (!report) { res.status(404).json({ error: "Rapport introuvable" }); return; }

  const existing = report.chars || {};
  const merged = { ...existing, ...req.body };

  const [updated] = await db.update(auditReportsTable)
    .set({ sectionCharacteristics: merged })
    .where(eq(auditReportsTable.id, reportId))
    .returning({ sectionCharacteristics: auditReportsTable.sectionCharacteristics });

  res.json(updated.sectionCharacteristics);
});

router.get("/audit/reports/:id/photos/:photoId/data", async (req, res): Promise<void> => {
  const photoId = parseInt(req.params.photoId, 10);
  if (isNaN(photoId)) { res.status(400).json({ error: "ID invalide" }); return; }

  const [photo] = await db.select().from(reportPhotosTable).where(eq(reportPhotosTable.id, photoId));
  if (!photo) { res.status(404).json({ error: "Photo introuvable" }); return; }

  const buffer = Buffer.from(photo.dataBase64, "base64");
  res.set("Content-Type", photo.mimeType);
  res.set("Cache-Control", "public, max-age=86400");
  res.send(buffer);
});

router.delete("/audit/reports/:id/photos/:photoId", async (req, res): Promise<void> => {
  const photoId = parseInt(req.params.photoId, 10);
  if (isNaN(photoId)) { res.status(400).json({ error: "ID invalide" }); return; }

  await db.delete(reportPhotosTable).where(eq(reportPhotosTable.id, photoId));
  res.json({ success: true });
});

export default router;
