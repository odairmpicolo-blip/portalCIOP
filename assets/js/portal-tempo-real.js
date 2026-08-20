(function () {
  window.portalPaginaVisivel = function () {
    return typeof document === "undefined" || !document.hidden;
  };

  window.portalPollQuandoVisivel = function (tick, ms) {
    var id = null;
    function loop() {
      if (document.hidden) return;
      try { tick(); } catch (_) {}
    }
    function start() {
      if (id != null) return;
      id = window.setInterval(loop, ms);
    }
    function stop() {
      if (id == null) return;
      window.clearInterval(id);
      id = null;
    }
    document.addEventListener("visibilitychange", function () {
      if (document.hidden) stop();
      else {
        loop();
        start();
      }
    });
    start();
    return { start: start, stop: stop };
  };
})();
