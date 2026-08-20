/**
 * Uma linha JSON por request — CloudWatch / terminal local.
 * O uid só existe depois do auth; por isso o log é no `finish`.
 */
export function requestLog(req, res, next) {
  const t0 = Date.now();
  res.on("finish", () => {
    console.log(
      JSON.stringify({
        ts: new Date().toISOString(),
        level: "info",
        method: req.method,
        path: req.path,
        status: res.statusCode,
        ms: Date.now() - t0,
        uid: req.user?.uid || null
      })
    );
  });
  next();
}
