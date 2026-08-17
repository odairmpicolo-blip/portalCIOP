import { Router } from "express";

const router = Router();
const MOBILIBUS = "https://mobilibus.com/api";

router.get("/*", async (req, res) => {
  const path = req.path.replace(/^\//, "");
  const qs = new URLSearchParams(req.query).toString();
  const url = `${MOBILIBUS}/${path}${qs ? `?${qs}` : ""}`;

  try {
    const upstream = await fetch(url, {
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(25000)
    });
    const body = await upstream.text();
    res.status(upstream.status);
    res.setHeader("Content-Type", upstream.headers.get("content-type") || "application/json");
    res.setHeader("Cache-Control", "no-store");
    res.send(body);
  } catch (err) {
    res.status(502).json({ ok: false, erro: err.message || "Falha ao consultar Bus2" });
  }
});

export default router;
