/**
 * Smeta PDF export (Phase 9) — real downloadable PDF via jsPDF.
 * Invoice-style layout: header, input summary, material table with the
 * user's custom prices, bold total row, and a footer disclaimer.
 * Filename: smeta_YYYY-MM-DD.pdf
 */
import { jsPDF } from 'jspdf';

export interface SmetaRow {
  material: string;
  quantity: string;
  unitPrice: string;
  subtotal: string;
}

export interface SmetaDoc {
  id: string;
  date: string;
  inputs: string[];
  rows: SmetaRow[];
  total: string;
}

export interface StagePdfDoc {
  id: string;
  date: string;
  inputs: string[];
  stages: {
    title: string;
    subtitle: string;
    duration: string;
    total: string;
    rows: { material: string; quantity: string; cost: string }[];
  }[];
  grandTotal: string;
}

export function smetaFilename(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `smeta_${y}-${m}-${d}.pdf`;
}

const MARGIN = 40;
const PAGE_W = 595.28;
const PAGE_H = 841.89;

/** Column x-offsets (material, quantity, unit price, subtotal). */
const COL = [MARGIN, 300, 400, 500];

export async function downloadSmeta(doc: SmetaDoc, filename = smetaFilename(new Date())): Promise<void> {
  // Let a loading toast render before the (synchronous) save.
  await new Promise((r) => setTimeout(r, 60));

  const pdf = new jsPDF({ unit: 'pt', format: 'a4' });

  // ---- Header ----
  pdf.setFillColor(37, 99, 235);
  pdf.roundedRect(MARGIN, 40, 14, 14, 3, 3, 'F');
  pdf.setTextColor(255, 255, 255);
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(10);
  pdf.text('U', MARGIN + 7, 50, { align: 'center' });

  pdf.setTextColor(30, 41, 59);
  pdf.setFontSize(13);
  pdf.text('UY LOYIHA STUDIO', MARGIN + 22, 47);

  pdf.setFontSize(20);
  pdf.text('Qurilish materiallari smetasi', MARGIN, 88);

  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(9);
  pdf.setTextColor(107, 114, 128);
  pdf.text(`Sana: ${doc.date}`, PAGE_W - MARGIN, 82, { align: 'right' });
  pdf.text(`Smeta №: ${doc.id}`, PAGE_W - MARGIN, 95, { align: 'right' });

  // ---- Input summary ----
  pdf.setDrawColor(226, 232, 240);
  pdf.setLineWidth(0.75);
  pdf.line(MARGIN, 108, PAGE_W - MARGIN, 108);
  pdf.setFontSize(9.5);
  pdf.setTextColor(51, 65, 85);
  doc.inputs.forEach((line, i) => pdf.text(line, MARGIN, 126 + i * 14));

  const summaryBottom = 126 + doc.inputs.length * 14 + 8;

  // ---- Table ----
  const headers = ['Material', 'Miqdor', 'Birlik narxi (UZS)', 'Jami (UZS)'];
  let y = summaryBottom;
  const rowH = 20;

  const drawRow = (cells: string[], isHeader: boolean, isTotal: boolean) => {
    if (isHeader) pdf.setFillColor(243, 244, 246);
    else if (isTotal) pdf.setFillColor(37, 99, 235);
    pdf.rect(MARGIN, y, PAGE_W - MARGIN * 2, rowH, 'F');

    if (isHeader) pdf.setFont('helvetica', 'bold');
    else pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(9.5);
    pdf.setTextColor(isTotal ? 255 : 51, isTotal ? 255 : 65, isTotal ? 255 : 85);

    cells.forEach((cell, i) => {
      const x = COL[i]! + 6;
      const align: 'left' | 'right' = i === 0 ? 'left' : 'right';
      pdf.text(cell, x, y + 13.5, { align });
    });

    if (!isHeader) {
      pdf.setDrawColor(226, 232, 240);
      pdf.setLineWidth(0.5);
      pdf.line(MARGIN, y + rowH, PAGE_W - MARGIN, y + rowH);
    }
    y += rowH;
  };

  drawRow(headers, true, false);
  doc.rows.forEach((r) => drawRow([r.material, r.quantity, r.unitPrice, r.subtotal], false, false));
  drawRow([`Umumiy summa: ${doc.total}`, '', '', ''], false, true);

  // ---- Footer disclaimer ----
  pdf.setFont('helvetica', 'italic');
  pdf.setFontSize(8);
  pdf.setTextColor(156, 163, 175);
  pdf.text(
    'Ushbu hisob taxminiy bo’lib, aniq smeta uchun mutaxassis bilan bog’laning',
    MARGIN,
    PAGE_H - 30,
  );

  try {
    pdf.save(filename);
  } catch {
    throw new Error('PDF generatsiya xatosi');
  }
}

/**
 * Phase-by-phase smeta PDF ("Bosqichlar bo'yicha PDF smeta").
 * Invoice-style layout listing each construction stage with its materials,
 * cost and duration, then the grand total across all phases.
 */
export async function downloadStagesPdf(doc: StagePdfDoc, filename = smetaFilename(new Date())): Promise<void> {
  await new Promise((r) => setTimeout(r, 60));

  const pdf = new jsPDF({ unit: 'pt', format: 'a4' });

  // ---- Header ----
  pdf.setFillColor(37, 99, 235);
  pdf.roundedRect(MARGIN, 40, 14, 14, 3, 3, 'F');
  pdf.setTextColor(255, 255, 255);
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(10);
  pdf.text('U', MARGIN + 7, 50, { align: 'center' });

  pdf.setTextColor(30, 41, 59);
  pdf.setFontSize(13);
  pdf.text('UY LOYIHA STUDIO', MARGIN + 22, 47);

  pdf.setFontSize(20);
  pdf.text('Qurilish bosqichlari smetasi', MARGIN, 88);

  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(9);
  pdf.setTextColor(107, 114, 128);
  pdf.text(`Sana: ${doc.date}`, PAGE_W - MARGIN, 82, { align: 'right' });
  pdf.text(`Smeta №: ${doc.id}`, PAGE_W - MARGIN, 95, { align: 'right' });

  // ---- Input summary ----
  pdf.setDrawColor(226, 232, 240);
  pdf.setLineWidth(0.75);
  pdf.line(MARGIN, 108, PAGE_W - MARGIN, 108);
  pdf.setFontSize(9.5);
  pdf.setTextColor(51, 65, 85);
  doc.inputs.forEach((line, i) => pdf.text(line, MARGIN, 126 + i * 14));

  let y = 126 + doc.inputs.length * 14 + 16;
  const rowH = 20;

  const newPageIfNeeded = (needed: number) => {
    if (y + needed > PAGE_H - 60) {
      pdf.addPage();
      y = 60;
    }
  };

  doc.stages.forEach((stage) => {
    newPageIfNeeded(70);
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(11);
    pdf.setTextColor(30, 41, 59);
    pdf.text(stage.title, MARGIN, y + 4);

    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(9);
    pdf.setTextColor(107, 114, 128);
    pdf.text(`${stage.subtitle} · ${stage.duration}`, MARGIN + 110, y + 4);
    y += 10;

    // stage header row
    pdf.setFillColor(243, 244, 246);
    pdf.rect(MARGIN, y, PAGE_W - MARGIN * 2, rowH, 'F');
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(9.5);
    pdf.setTextColor(51, 65, 85);
    pdf.text('Material', MARGIN + 6, y + 13.5);
    pdf.text('Miqdor', 300 + 6, y + 13.5);
    pdf.text('Baholangan qiymat (UZS)', 400 + 6, y + 13.5, { align: 'right' });
    y += rowH;

    pdf.setFont('helvetica', 'normal');
    stage.rows.forEach((row) => {
      newPageIfNeeded(rowH + 4);
      pdf.setTextColor(51, 65, 85);
      pdf.text(row.material, MARGIN + 6, y + 13.5);
      pdf.text(row.quantity, 300 + 6, y + 13.5);
      pdf.text(row.cost, 400 + 6, y + 13.5, { align: 'right' });
      pdf.setDrawColor(226, 232, 240);
      pdf.setLineWidth(0.5);
      pdf.line(MARGIN, y + rowH, PAGE_W - MARGIN, y + rowH);
      y += rowH;
    });

    // stage total
    newPageIfNeeded(rowH);
    pdf.setFillColor(241, 245, 249);
    pdf.rect(MARGIN, y, PAGE_W - MARGIN * 2, rowH, 'F');
    pdf.setFont('helvetica', 'bold');
    pdf.setTextColor(51, 65, 85);
    pdf.text(`Jami: ${stage.total}`, MARGIN + 6, y + 13.5);
    y += rowH + 12;
  });

  // ---- Grand total ----
  newPageIfNeeded(rowH + 20);
  pdf.setFillColor(37, 99, 235);
  pdf.rect(MARGIN, y, PAGE_W - MARGIN * 2, rowH, 'F');
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(11);
  pdf.setTextColor(255, 255, 255);
  pdf.text(`UMUMIY SMETA: ${doc.grandTotal}`, MARGIN + 6, y + 13.5);
  pdf.setFontSize(8.5);
  pdf.text(`Qurilish muddati: taxminan ${doc.inputs[2] ?? ''}`, PAGE_W - MARGIN - 6, y + 13.5, { align: 'right' });
  y += rowH;

  // ---- Footer disclaimer ----
  pdf.setFont('helvetica', 'italic');
  pdf.setFontSize(8);
  pdf.setTextColor(156, 163, 175);
  pdf.text(
    'Ushbu hisob taxminiy bo’lib, ichki ishlar smetasi umumiy summaning foizli bahosi asosida hisoblandi. Aniq smeta uchun mutaxassis bilan bog’laning.',
    MARGIN,
    PAGE_H - 30,
  );

  try {
    pdf.save(filename);
  } catch {
    throw new Error('PDF generatsiya xatosi');
  }
}
