/** Exportação PDF — Pontualidade IPV (gráfico + tabela filtrada). */

async function carregarImagemBase64(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error("Imagem não encontrada: " + url);
  const blob = await res.blob();
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error("Falha ao ler imagem"));
    reader.readAsDataURL(blob);
  });
}

function medirImagemBase64(dataUrl) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve({ width: img.naturalWidth || img.width, height: img.naturalHeight || img.height });
    img.onerror = () => reject(new Error("Falha ao medir imagem"));
    img.src = dataUrl;
  });
}

function pct(val) {
  const n = Number(val);
  if (!Number.isFinite(n)) return String(val ?? "");
  return n.toFixed(2) + "%";
}

function desenharCabecalhoPdf(doc, pageW, margin, meta, logos, tituloPontualidade) {
  const topoY = 5;

  if (logos.ciop) doc.addImage(logos.ciop, "PNG", margin, topoY, 30, 11);
  if (logos.tcgl) doc.addImage(logos.tcgl, "PNG", pageW - margin - 34, topoY - 1, 34, 12);

  let abaixoTitulo = 18;

  if (tituloPontualidade) {
    const tituloW = Math.min(128, pageW - margin * 2 - 72);
    const tituloH = tituloW * (116 / 1470);
    const tituloX = (pageW - tituloW) / 2;
    doc.addImage(tituloPontualidade, "PNG", tituloX, topoY + 1, tituloW, tituloH);
    abaixoTitulo = topoY + tituloH + 6;
  }

  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.setTextColor(6, 36, 92);
  doc.text(meta.subtitulo || meta.cenario || "Pontualidade IPV", pageW / 2, abaixoTitulo, { align: "center" });

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(102, 112, 133);
  doc.text(`Gerado em: ${meta.geradoEm}`, pageW - margin, abaixoTitulo, { align: "right" });

  return abaixoTitulo + 5;
}

async function desenharGraficoPdf(doc, pageW, margin, startY, chartImageBase64, tituloGrafico) {
  if (!chartImageBase64) return startY;

  const dims = await medirImagemBase64(chartImageBase64);
  const ratio = dims.width / Math.max(dims.height, 1);

  const maxW = pageW - margin * 2;
  const maxH = 58;
  let imgW = maxW * 0.92;
  let imgH = imgW / ratio;
  if (imgH > maxH) {
    imgH = maxH;
    imgW = imgH * ratio;
  }

  if (tituloGrafico) {
    doc.setFontSize(8);
    doc.setTextColor(6, 36, 92);
    doc.setFont("helvetica", "bold");
    doc.text(tituloGrafico, margin, startY);
    startY += 4;
  }

  const imgX = (pageW - imgW) / 2;
  doc.addImage(chartImageBase64, "PNG", imgX, startY, imgW, imgH);
  return startY + imgH + 6;
}

export async function exportarPdfPontualidade({ meta, chartImageBase64, linhas, assets }) {
  if (!window.jspdf?.jsPDF) throw new Error("Biblioteca PDF indisponível.");

  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  if (typeof doc.autoTable !== "function") throw new Error("Plugin autoTable indisponível.");

  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const margin = 10;

  const logos = {};
  let tituloPontualidade = null;
  try {
    const [ciop, tcgl, titulo] = await Promise.all([
      carregarImagemBase64(assets.logoCiop),
      carregarImagemBase64(assets.logoTcgl),
      assets.tituloPontualidade ? carregarImagemBase64(assets.tituloPontualidade) : Promise.resolve(null)
    ]);
    logos.ciop = ciop;
    logos.tcgl = tcgl;
    tituloPontualidade = titulo;
  } catch (_) { /* logos opcionais */ }

  let startY = desenharCabecalhoPdf(doc, pageW, margin, meta, logos, tituloPontualidade);
  startY = await desenharGraficoPdf(doc, pageW, margin, startY, chartImageBase64, null);

  const colPeriodo = meta.colunaPeriodo || "Período";
  const head = [[colPeriodo, "No Horário", "Adiantado", "Atrasado"]];
  const body = (linhas || []).map((row) => [
    row.periodo,
    pct(row.no_horario),
    pct(row.adiantado),
    pct(row.atrasado)
  ]);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.setTextColor(6, 36, 92);
  doc.text(meta.tituloTabela || "Detalhamento", margin, startY);
  startY += 4;

  doc.autoTable({
    head,
    body,
    startY,
    margin: { left: margin, right: margin, bottom: 10 },
    styles: {
      font: "helvetica",
      fontSize: 8,
      cellPadding: 2.2,
      valign: "middle",
      textColor: [16, 24, 40]
    },
    headStyles: {
      fillColor: [6, 36, 92],
      textColor: [255, 255, 255],
      fontStyle: "bold",
      halign: "center"
    },
    alternateRowStyles: { fillColor: [248, 250, 252] },
    columnStyles: {
      0: { halign: "left", cellWidth: 40 },
      1: { halign: "center", textColor: [37, 99, 235] },
      2: { halign: "center", textColor: [222, 27, 27] },
      3: { halign: "center", textColor: [180, 130, 10] }
    },
    didDrawPage: (data) => {
      const pg = doc.internal.getNumberOfPages();
      doc.setFontSize(8);
      doc.setTextColor(148, 163, 184);
      doc.text(
        `Página ${data.pageNumber} de ${pg}`,
        pageW / 2,
        pageH - 4,
        { align: "center" }
      );
    }
  });

  doc.save(meta.arquivoBase + ".pdf");
}
