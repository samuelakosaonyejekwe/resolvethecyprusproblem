/* Heavy calculations run here, off the page's own thread, so the page stays
   responsive on slow phones while they are worked out. */
importScripts('engine.js', 'live.js');
var C = null, stamp = null;
self.onmessage = function (e) {
  var d = e.data, E = self.Engine, out;
  try {
    if (d.job === 'read') { self.Live._inject(d.snap); self.postMessage({ id: d.id, out: self.Live._readAll(d.snap.top) }); return; }
    if (d.stamp !== stamp) { C = E.compile(d.model); stamp = d.stamp; }
    if (d.job === 'sens') out = E.sensitivity(C, d.state, d.pid, d.opt);
    else if (d.job === 'path') {
      var p = E.path(C, d.state, d.pid, d.opt), first = p.steps[0] ? p.steps[0].move.id : null;
      out = { p: p, dn: E.doNothing(C, d.state, d.pid, d.opt.horizon),
        mc: E.monteCarlo(C, d.state, d.pid, first, { horizon: d.opt.horizon, mode: d.opt.mode, runs: 240 }),
        mc0: E.monteCarlo(C, d.state, d.pid, d.pid + '.hold', { horizon: d.opt.horizon, mode: d.opt.mode, runs: 240, seed: 9, holdOnly: true }) };
    }
    self.postMessage({ id: d.id, out: out });
  } catch (err) { self.postMessage({ id: d.id, error: String(err && err.message || err) }); }
};
