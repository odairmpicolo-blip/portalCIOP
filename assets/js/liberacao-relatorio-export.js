/** Exportação CSV / Excel / PDF — Relatório Acompanhamento da Liberação */

export function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function csvValue(value) {
  return `"${String(value ?? "").replace(/"/g, '""')}"`;
}

function xmlText(value) {
  return String(value ?? "").replace(/[&<>"']/g, (c) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&apos;"
  }[c]));
}

function columnName(index) {
  let name = "";
  let n = index + 1;
  while (n > 0) {
    const mod = (n - 1) % 26;
    name = String.fromCharCode(65 + mod) + name;
    n = Math.floor((n - mod) / 26);
  }
  return name;
}

function crc32(bytes) {
  let crc = -1;
  for (const byte of bytes) {
    crc ^= byte;
    for (let i = 0; i < 8; i += 1) crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
  }
  return (crc ^ -1) >>> 0;
}

function uint16(v) { return [v & 255, (v >>> 8) & 255]; }
function uint32(v) { return [v & 255, (v >>> 8) & 255, (v >>> 16) & 255, (v >>> 24) & 255]; }

function createZip(files) {
  const encoder = new TextEncoder();
  const chunks = [];
  const central = [];
  let offset = 0;
  files.forEach((file) => {
    const name = encoder.encode(file.name);
    const data = encoder.encode(file.content);
    const crc = crc32(data);
    const localHeader = new Uint8Array([
      ...uint32(0x04034b50), ...uint16(20), ...uint16(0), ...uint16(0), ...uint16(0), ...uint16(0),
      ...uint32(crc), ...uint32(data.length), ...uint32(data.length), ...uint16(name.length), ...uint16(0),
      ...name
    ]);
    chunks.push(localHeader, data);
    central.push({ file, name, data, crc, offset });
    offset += localHeader.length + data.length;
  });
  const centralOffset = offset;
  central.forEach((item) => {
    const entry = new Uint8Array([
      ...uint32(0x02014b50), ...uint16(20), ...uint16(20), ...uint16(0), ...uint16(0), ...uint16(0), ...uint16(0),
      ...uint32(item.crc), ...uint32(item.data.length), ...uint32(item.data.length), ...uint16(item.name.length),
      ...uint16(0), ...uint16(0), ...uint16(0), ...uint16(0), ...uint32(0), ...uint32(item.offset), ...item.name
    ]);
    chunks.push(entry);
    offset += entry.length;
  });
  const end = new Uint8Array([
    ...uint32(0x06054b50), ...uint16(0), ...uint16(0), ...uint16(central.length), ...uint16(central.length),
    ...uint32(offset - centralOffset), ...uint32(centralOffset), ...uint16(0)
  ]);
  chunks.push(end);
  return new Blob(chunks, { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
}

export function exportarCsv(colunas, linhas, meta) {
  const header = colunas.map((c) => c.rotulo);
  const body = linhas.map((row) => colunas.map((c) => row[c.chave] ?? ""));
  const lines = [
    `"Relatório: ${meta.titulo}"`,
    `"Período: ${meta.periodo}"`,
    `"Gerado em: ${meta.geradoEm}"`,
    `"Portal CIOP · TCGL"`,
    "",
    header.map(csvValue).join(";"),
    ...body.map((r) => r.map(csvValue).join(";"))
  ];
  const bom = "\uFEFF";
  downloadBlob(new Blob([bom + lines.join("\n")], { type: "text/csv;charset=utf-8" }), meta.arquivoBase + ".csv");
}

export function exportarExcel(colunas, linhas, meta) {
  const sheetName = "Liberação";
  const metaRows = [
    ["Relatório", meta.titulo],
    ["Período", meta.periodo],
    ["Gerado em", meta.geradoEm],
    ["", "Portal CIOP · TCGL"],
    []
  ];
  const header = colunas.map((c) => c.rotulo);
  const rows = metaRows.concat([header]).concat(linhas.map((row) => colunas.map((c) => row[c.chave] ?? "")));
  const widths = colunas.map((c) => Math.max(10, Math.round((c.largura || 80) / 7)));
  const cols = widths.map((w, i) => `<col min="${i + 1}" max="${i + 1}" width="${w}" customWidth="1"/>`).join("");
  const metaCount = metaRows.length;
  const sheetRows = rows.map((row, rowIndex) => {
    const isHeader = rowIndex === metaCount;
    const ht = isHeader ? 28 : (rowIndex < metaCount ? 20 : 22);
    return `<row r="${rowIndex + 1}" ht="${ht}" customHeight="1">` +
      row.map((cell, colIndex) => {
        const ref = columnName(colIndex) + (rowIndex + 1);
        let style = 3;
        if (rowIndex < metaCount) style = 4;
        else if (isHeader) style = 1;
        else if (colIndex <= 2) style = 2;
        return `<c r="${ref}" t="inlineStr" s="${style}"><is><t>${xmlText(cell)}</t></is></c>`;
      }).join("") + "</row>";
  }).join("");
  const sheet = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    `<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">` +
    `<sheetViews><sheetView workbookViewId="0"><pane ySplit="${metaCount + 1}" topLeftCell="A${metaCount + 2}" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews>` +
    `<sheetFormatPr defaultRowHeight="22"/><cols>${cols}</cols><sheetData>${sheetRows}</sheetData>` +
    `<pageMargins left="0.25" right="0.25" top="0.35" bottom="0.35"/><pageSetup orientation="landscape"/>` +
    "</worksheet>";
  const styles = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    '<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">' +
    '<fonts count="3">' +
    '<font><sz val="11"/><color rgb="FF1F2937"/><name val="Arial"/></font>' +
    '<font><b/><sz val="11"/><color rgb="FF06245C"/><name val="Arial"/></font>' +
    '<font><b/><sz val="11"/><color rgb="FF475467"/><name val="Arial"/></font>' +
    "</fonts>" +
    '<fills count="3"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill>' +
    '<fill><patternFill patternType="solid"><fgColor rgb="FFF1F5F9"/><bgColor indexed="64"/></patternFill></fill></fills>' +
    '<borders count="2"><border><left/><right/><top/><bottom/><diagonal/></border>' +
    '<border><left style="thin"><color rgb="FFDFE5EF"/></left><right style="thin"><color rgb="FFDFE5EF"/></right>' +
    '<top style="thin"><color rgb="FFDFE5EF"/></top><bottom style="thin"><color rgb="FFDFE5EF"/></bottom><diagonal/></border></borders>' +
    '<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>' +
    '<cellXfs count="5">' +
    '<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>' +
    '<xf numFmtId="49" fontId="1" fillId="2" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="center" vertical="center" wrapText="1"/></xf>' +
    '<xf numFmtId="49" fontId="0" fillId="0" borderId="1" xfId="0" applyBorder="1" applyAlignment="1"><alignment horizontal="center" vertical="top" wrapText="1"/></xf>' +
    '<xf numFmtId="49" fontId="0" fillId="0" borderId="1" xfId="0" applyBorder="1" applyAlignment="1"><alignment horizontal="left" vertical="top" wrapText="1"/></xf>' +
    '<xf numFmtId="49" fontId="2" fillId="0" borderId="0" xfId="0" applyFont="1" applyAlignment="1"><alignment horizontal="left" vertical="center"/></xf>' +
    '</cellXfs><cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>';
  const files = [
    { name: "[Content_Types].xml", content: '<?xml version="1.0" encoding="UTF-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/></Types>' },
    { name: "_rels/.rels", content: '<?xml version="1.0"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>' },
    { name: "xl/workbook.xml", content: `<?xml version="1.0"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="${xmlText(sheetName)}" sheetId="1" r:id="rId1"/></sheets></workbook>` },
    { name: "xl/_rels/workbook.xml.rels", content: '<?xml version="1.0"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>' },
    { name: "xl/styles.xml", content: styles },
    { name: "xl/worksheets/sheet1.xml", content: sheet }
  ];
  downloadBlob(createZip(files), meta.arquivoBase + ".xlsx");
}

async function carregarImagemBase64(url) {
  const res = await fetch(url);
  const blob = await res.blob();
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

function estiloDivergenciaPdf(chave, valor) {
  const v = String(valor ?? "").trim().toUpperCase();
  if (chave === "saiu_no_horario" && v === "NÃO") return { fillColor: [254, 226, 226], textColor: [185, 28, 28], fontStyle: "bold" };
  if (chave === "inicio_no_horario" && v === "ATRASADO") return { fillColor: [254, 226, 226], textColor: [185, 28, 28], fontStyle: "bold" };
  if (chave === "inicio_no_horario" && v === "ADIANTADO") return { fillColor: [254, 243, 199], textColor: [180, 83, 9], fontStyle: "bold" };
  if (chave === "trajeto_ocioso_correto" && v === "NÃO") return { fillColor: [254, 226, 226], textColor: [185, 28, 28], fontStyle: "bold" };
  return null;
}

export async function exportarPdf(colunas, linhas, meta, assets) {
  if (!window.jspdf?.jsPDF) throw new Error("Biblioteca PDF indisponível.");
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
  const pageW = doc.internal.pageSize.getWidth();
  const margin = 8;

  try {
    const [ciop, tcgl] = await Promise.all([
      carregarImagemBase64(assets.logoCiop),
      carregarImagemBase64(assets.logoTcgl)
    ]);
    doc.addImage(ciop, "PNG", margin, 6, 28, 10);
    doc.addImage(tcgl, "PNG", pageW - margin - 32, 5, 32, 11);
  } catch (_) { /* logos opcionais */ }

  doc.setTextColor(6, 36, 92);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  doc.text("ACOMPANHAMENTO DA LIBERAÇÃO", pageW / 2, 12, { align: "center" });
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(102, 112, 133);
  doc.text("Portal CIOP · TCGL", pageW / 2, 17, { align: "center" });
  doc.text(`Período: ${meta.periodo}`, pageW / 2, 21.5, { align: "center" });
  doc.text(`Gerado em: ${meta.geradoEm}`, pageW - margin, 21.5, { align: "right" });

  const head = [colunas.map((c) => c.rotulo)];
  const body = linhas.map((row) => colunas.map((c) => String(row[c.chave] ?? "")));

  if (typeof doc.autoTable !== "function") throw new Error("Plugin autoTable indisponível.");

  doc.autoTable({
    head,
    body,
    startY: 26,
    margin: { left: margin, right: margin },
    styles: {
      font: "helvetica",
      fontSize: 6.5,
      cellPadding: 1.8,
      overflow: "linebreak",
      valign: "middle",
      textColor: [16, 24, 40]
    },
    headStyles: {
      fillColor: [6, 36, 92],
      textColor: [255, 255, 255],
      fontStyle: "bold",
      halign: "center",
      fontSize: 6.2
    },
    alternateRowStyles: { fillColor: [248, 250, 252] },
    columnStyles: Object.fromEntries(colunas.map((c, i) => [i, {
      cellWidth: c.pdfWidth || "auto",
      halign: c.chave === "observacoes" || c.chave === "local_inicio" ? "left" : "center"
    }])),
    didParseCell: (data) => {
      if (data.section !== "body") return;
      const col = colunas[data.column.index];
      if (!col) return;
      const estilo = estiloDivergenciaPdf(col.chave, data.cell.raw);
      if (estilo) Object.assign(data.cell.styles, estilo);
    },
    didDrawPage: (data) => {
      const pg = doc.internal.getNumberOfPages();
      doc.setFontSize(8);
      doc.setTextColor(148, 163, 184);
      doc.text(`Página ${data.pageNumber} de ${pg}`, pageW / 2, doc.internal.pageSize.getHeight() - 4, { align: "center" });
    }
  });

  doc.save(meta.arquivoBase + ".pdf");
}
