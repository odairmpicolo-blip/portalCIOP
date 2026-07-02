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

function pct(val) {
  const n = Number(val);
  if (!Number.isFinite(n)) return String(val ?? "");
  return n.toFixed(2) + "%";
}

export async function exportarPdfPontualidade({ meta, chartImageBase64, linhas, assets }) {
  if (!window.jspdf?.jsPDF) throw new Error("Biblioteca PDF indisponível.");

  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  if (typeof doc.autoTable !== "function") throw new Error("Plugin autoTable indisponível.");
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const margin = 8;

  try {
    const [ciop, tcgl] = await Promise.all([
      carregarImagemBase64(assets.logoCiop),
      carregarImagemBase64(assets.logoTcgl)
    ]);
    doc.addImage(ciop, "PNG", margin, 5, 30, 11);
    doc.addImage(tcgl, "PNG", pageW - margin - 34, 4, 34, 12);
  } catch (_) { /* logos opcionais */ }

  doc.setTextColor(6, 36, 92);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.text("PONTUALIDADE IPV", pageW / 2, 11, { align: "center" });

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(102, 112, 133);
  doc.text("Portal CIOP · TCGL", pageW / 2, 16, { align: "center" });
  doc.text(meta.cenario || "Realidade 2 / 6", pageW / 2, 20, { align: "center" });
  doc.text(`Seleção: ${meta.selecao}`, pageW / 2, 24, { align: "center" });
  doc.text(`Gerado em: ${meta.geradoEm}`, pageW - margin, 24, { align: "right" });

  let startY = 28;

  if (chartImageBase64) {
    const imgW = pageW - margin * 2;
    const imgH = 88;
    doc.setFontSize(8);
    doc.setTextColor(6, 36, 92);
    doc.setFont("helvetica", "bold");
    doc.text(meta.tituloGrafico || "Evolução de Pontualidade", margin, startY);
    startY += 4;
    doc.addImage(chartImageBase64, "PNG", margin, startY, imgW, imgH);
    startY += imgH + 5;
  }

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
      0: { halign: "left", cellWidth: 52 },
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
