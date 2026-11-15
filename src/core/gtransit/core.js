// VENDORED from the team's G-TRANSIT v1.1 (gtransit_panel_src/core.js). Only change: the UMD wrapper
// was replaced by an ES module export so Vite/Vitest can import it. Do not edit the maths here.
/* G-TRANSIT computation core: Blueprint v1.0 sections 4–6 and 12, with the v1.1 changes.
   Follows the same flow as the Python reference (ori_core.py). Constants come from CONFIG.
   v1.1: no-data level, continuous persistence counter, personal (relative) LLA by default, posture gate,
   internal slope over a steady-posture window, override and early warning from the TTS confidence bound, EVA (suit) mode. */
const GT = (function () {
  'use strict';
  const MMHG = 133.322;
  const clip = (x, a = 0, b = 1) => Math.max(a, Math.min(b, x));
  const has = (v) => v !== null && v !== undefined && !(typeof v === 'number' && Number.isNaN(v));

  /* ------- Default configuration (Blueprint 7.3 + documented additions) ------- */
  const DEFAULT_CONFIG = {
    physics: { rho: 1060, h_heart_brain_m: 0.30, h_heart_foot_m: 1.20, g: { earth: 9.80665, mars: 3.721, moon: 1.62 } },
    perfusion: { lla_ref_heart_1g: 65.0, k_heat_mmHg_per_C: 3.0, margin_full_mmHg: 30.0, slope_window_s: 120, min_r2: 0.3 },
    thermal: { tcore_max: 39.5, grad_hi: 4.0, grad_lo: 1.0 },
    volume: { pv_full: 0.20, default_pv_deficit: { short_lt_30d: 0.10, long_ge_30d: 0.15 } },
    cardio: { hr_max_ref: 180, w_hr: 0.6, w_hrv: 0.4 },
    cerebral: { dtsi_full: 10.0 },
    weights: { T: 0.15, V: 0.15, H: 0.15, C: 0.20, P: 0.25, S: 0.10 },
    levels: { yellow: 30, orange: 60, red: 80, hysteresis: 5, persist_s: 10 },
    override: { margin_red: 5, margin_crit: 0, tts_crit_min: 3, tcore_crit: 40.0, persist_s: 5 },
    personal: { k_min: 0.7, k_max: 1.3 },
    /* --- Additions not in the Blueprint, marked explicitly --- */
    quality: { sqi_min: 0.5 },                                  // ASSUMPTION: section 2/F6 gives no threshold
    tts: { stable_min: 30 },                                    // section 4.3: > 30 min means "stable"
    recommend: { cool_t: 0.4, cool_v: 0.5, fluid_h: 0.5, oig_ori: 60, recline_ori: 80, recline_margin: 5,
                 delay_ori: 60, slow_stand_lo: 30, slow_stand_hi: 59 },   // section 8.1 table
    alarm: { snooze_s: { yellow: 600, orange: 120 } },          // section 6.5
    lla_mode: 'relative',                                       // v1.1: 'relative' = personal (baseline MAP × lla_frac); 'population' when there is no baseline
    lla_frac: 0.75,
    lla_baseline_s: 120,
    /* --- v1.1 additions (PRCP validation: Blueprint v1.1 change note) --- */
    posture_gate: { enabled: true, min_tilt_deg: 30, cap: 59 },  // lying down, G-TRANSIT gives no orange/red
    slope: { source: 'auto', stable_deg: 5, settle_s: 15, min_s: 30, max_s: 120, r2_short: 0.7 },
    tts_rules: { crit_use_upper: true, warn_up_min: 5, warn_ori: 60 },
    eva: { gate_btuh: 700, effort_correction: true }
  };

  function deepMerge(a, b) {
    if (b === null || typeof b !== 'object' || Array.isArray(b)) return b === undefined ? a : b;
    const out = Array.isArray(a) ? a.slice() : Object.assign({}, a);
    for (const k of Object.keys(b)) out[k] = (a && typeof a[k] === 'object' && a[k] !== null && typeof b[k] === 'object' && !Array.isArray(b[k])) ? deepMerge(a[k], b[k]) : b[k];
    return out;
  }

  const hydro = (cfg, g, h, cosT = 1) => cfg.physics.rho * g * h * cosT / MMHG;

  /* Sections 4.1–4.2, 6.1. s: current sample, base: personal baseline. Returns {c, x} */
  function components(s, base, cfg) {
    const th = cfg.thermal, cd = cfg.cardio, pf = cfg.perfusion;
    const h = cfg.physics.h_heart_brain_m, gE = cfg.physics.g.earth;
    const c = {}, x = {};
    if (has(s.tcore) && has(base.tcore0)) c.T = clip((s.tcore - base.tcore0) / (th.tcore_max - base.tcore0));
    if (has(s.tcore) && has(s.tskin)) c.V = clip((th.grad_hi - (s.tcore - s.tskin)) / (th.grad_hi - th.grad_lo));
    if (has(s.pv_deficit)) c.H = clip(s.pv_deficit / cfg.volume.pv_full);
    const ev = cfg.eva || {};
    const effort = has(s.met_btuh) && has(base.beta1) && base.beta1 > 0 && ev.effort_correction;
    if (has(s.met_btuh) && has(ev.gate_btuh) && s.met_btuh > ev.gate_btuh) {
      x.c_excluded = 'effort';                                   // v1.1: at high effort heart rate is not an orthostatic sign
    } else if (has(s.hr) && has(base.hr0)) {
      if (effort) {                                            // v1.1 EVA: the expected heart-rate rise from effort is subtracted
        const hrExp = base.hr0 + Math.max(0, s.met_btuh - (has(base.met_rest) ? base.met_rest : 0)) / base.beta1;
        c.C = clip((s.hr - hrExp) / (cd.hr_max_ref - hrExp));  // HRV falls normally during effort: not used
        x.hr_expected = hrExp;
      } else {
        const hr = clip((s.hr - base.hr0) / (cd.hr_max_ref - base.hr0));
        if (has(s.rmssd) && base.rmssd0) c.C = cd.w_hr * hr + cd.w_hrv * clip(1 - s.rmssd / base.rmssd0);
        else c.C = hr;
      }
    }
    if (has(s.map_heart)) {
      const kHeat = pf.k_heat_mmHg_per_C * Math.max(0, (has(s.tcore) ? s.tcore : 37.0) - 37.0);
      const llaRef = (cfg.lla_mode !== 'population' && has(base.lla_ref)) ? base.lla_ref : pf.lla_ref_heart_1g;
      x.lla_source = llaRef === pf.lla_ref_heart_1g && !(cfg.lla_mode !== 'population' && has(base.lla_ref)) ? 'population' : 'personal';
      const llaB = llaRef - hydro(cfg, gE, h) + kHeat;
      const mapB = s.map_heart - hydro(cfg, has(s.g) ? s.g : gE, h, has(s.cos_theta) ? s.cos_theta : 1.0);
      const m = mapB - llaB;
      c.P = clip(1 - m / pf.margin_full_mmHg);
      x.map_brain = mapB; x.lla_brain = llaB; x.margin = m;
    }
    if (has(s.dtsi)) c.S = clip(-s.dtsi / cfg.cerebral.dtsi_full);
    return { c, x };
  }

  function oriOf(c, cfg, kI = 1.0) {
    const w = cfg.weights; let den = 0, num = 0;
    for (const k of Object.keys(c)) { den += w[k]; num += w[k] * c[k]; }
    if (den === 0) return null;
    return Math.min(100.0, 100.0 * kI * num / den);
  }

  /* Section 4.3 */
  function tts(margin, slope, se) {
    if (!has(margin) || !has(slope)) return { t: null, lo: null, up: null };
    if (margin <= 0) return { t: 0, lo: 0, up: 0 };
    if (slope >= 0) return { t: Infinity, lo: Infinity, up: Infinity };
    const t = margin / -slope;
    if (!has(se) || !se) return { t, lo: null, up: null };
    const lo = margin / (-slope + 1.96 * se);
    const den = -slope - 1.96 * se;
    return { t, lo, up: den > 1e-6 ? margin / den : Infinity };
  }

  /* Section 6.2 */
  function applyOverrides(o, margin, ttsMin, tcore, cfg) {
    const ov = cfg.override;
    if (o === null) return { o, why: null };
    if ((has(margin) && margin <= ov.margin_crit) || (has(ttsMin) && ttsMin < ov.tts_crit_min) || (has(tcore) && tcore >= ov.tcore_crit))
      return { o: Math.max(o, 90.0), why: 'critical' };
    if (has(margin) && margin < ov.margin_red) return { o: Math.max(o, 80.0), why: 'margin<5' };
    return { o, why: null };
  }

  function levelOf(o, cfg) {
    if (o === null) return 'nodata';
    const L = cfg.levels;
    return o >= L.red ? 'red' : o >= L.orange ? 'orange' : o >= L.yellow ? 'yellow' : 'green';
  }
  const LEVEL_NAME = { green: 'normal', yellow: 'caution', orange: 'high', red: 'critical', nodata: 'nodata' };
  const ORDER = { nodata: -1, green: 0, yellow: 1, orange: 2, red: 3 };

  /* Section 6.5: hysteresis + persistence, 1 Hz */
  /* v1.1: the escalation counter is kept for "at least this level"; a value moving between orange and red
     does not reset the counter (v1.0 reset it, so escalation could never happen). */
  class AlarmState {
    constructor(cfg) { this.cfg = cfg; this.level = 'green'; this.cnt = { yellow: 0, orange: 0, red: 0 }; }
    step(o, override) {
      const L = this.cfg.levels, raw = levelOf(o, this.cfg);
      if (raw === 'nodata') return this.level;
      for (const k of ['yellow', 'orange', 'red']) this.cnt[k] = ORDER[raw] >= ORDER[k] ? this.cnt[k] + 1 : 0;
      if (override) { this.level = raw; return this.level; }
      if (ORDER[raw] > ORDER[this.level]) {
        for (const k of ['red', 'orange', 'yellow']) if (ORDER[k] > ORDER[this.level] && this.cnt[k] >= L.persist_s) { this.level = k; break; }
      } else if (ORDER[raw] < ORDER[this.level]) {
        const thr = { red: L.red, orange: L.orange, yellow: L.yellow }[this.level];
        if (o < thr - L.hysteresis) this.level = raw;
      }
      return this.level;
    }
  }

  /* Section 8.1: a suggestion, not an automatic command */
  function recommend(c, o, margin, phase, cfg) {
    const r = cfg.recommend, out = [];
    const T = c.T, V = c.V, H = c.H;
    if (phase === 'eva') {                                      // v1.1: suggestions that can be done inside the suit
      if (o !== null && o >= r.recline_ori) out.push('SIT_PARTNER', 'END_EVA');
      else if (o !== null && o >= r.oig_ori) out.push('REST_5MIN');
      if ((has(T) && T >= r.cool_t) || (has(V) && V >= r.cool_v)) out.push('LCG_MAX');
      if (has(H) && H >= r.fluid_h) out.push('DRINK_BAG');
      return out;
    }
    if (o !== null && (o >= r.recline_ori || (has(margin) && margin < r.recline_margin))) out.push('RECLINE');
    if ((has(T) && T >= r.cool_t) || (has(V) && V >= r.cool_v)) out.push('COOL_UP');
    if (o !== null && o >= r.oig_ori) out.push('OIG_STAGE2');
    if (has(H) && H >= r.fluid_h && phase !== 'entry') out.push('FLUID_IF_ABLE');
    // "landing/egress" = landing | egress (Blueprint 7.1 phase values); the unclear point is left configurable
    if (o !== null && o >= r.delay_ori && (phase === 'landing' || phase === 'egress')) out.push('DELAY_EGRESS');
    if (phase === 'surface' && o !== null && o >= r.slow_stand_lo && o <= r.slow_stand_hi) out.push('SLOW_STAND');
    return out;
  }

  /* Moran PSI (Blueprint 1.2) */
  function psiOf(s, base, cfg) {
    if (!has(s.tcore) || !has(base.tcore0) || !has(s.hr) || !has(base.hr0)) return null;
    return 5 * (s.tcore - base.tcore0) / (cfg.thermal.tcore_max - base.tcore0) + 5 * (s.hr - base.hr0) / (cfg.cardio.hr_max_ref - base.hr0);
  }

  /* F6: an input with low SQI is left out of the calculation. */
  function applyQuality(s, cfg) {
    const q = s.sqi || {}, min = cfg.quality.sqi_min, out = Object.assign({}, s), why = {};
    const low = (v) => has(v) && v < min;
    if (low(q.thermal)) { out.tcore = null; out.tskin = null; why.thermal = 'sqi'; }
    if (low(q.cardio)) { out.hr = null; out.rmssd = null; why.cardio = 'sqi'; }
    if (low(q.bp)) { out.map_heart = null; out.map_slope = null; why.bp = 'sqi'; }
    if (low(q.cerebral)) { out.dtsi = null; why.cerebral = 'sqi'; }
    return { s: out, why };
  }

  /* v1.1: MAP_brain slope (mmHg/min), SE and R² over a steady-posture window. */
  function fitSlope(ts, ys) {
    const n = ts.length; if (n < 20) return null;
    let mt = 0, my = 0; for (let k = 0; k < n; k++) { mt += ts[k] / 60; my += ys[k]; } mt /= n; my /= n;
    let sxx = 0, sxy = 0, syy = 0;
    for (let k = 0; k < n; k++) { const dt = ts[k] / 60 - mt, dy = ys[k] - my; sxx += dt * dt; sxy += dt * dy; syy += dy * dy; }
    if (sxx <= 0) return null;
    const b = sxy / sxx, rss = Math.max(0, syy - b * sxy);
    return { slope: b, se: Math.sqrt(rss / Math.max(1, n - 2) / sxx), r2: syy > 0 ? 1 - rss / syy : 0 };
  }
  const angleOf = (sm) => has(sm.tilt_deg) ? sm.tilt_deg : (has(sm.cos_theta) ? Math.asin(clip(sm.cos_theta, -1, 1)) * 180 / Math.PI : null);

  /* Stream engine: step(sample) is called every second. */
  class Engine {
    constructor(cfgIn, base, opts = {}) {
      this.cfg = cfgIn; this.base = Object.assign({}, base); this.opts = opts;
      this.alarm = new AlarmState(cfgIn); this.ovRun = 0; this.i = 0;
      this.hist = [];                                             // {i, a, mb}: for the internal slope
    }
    internalSlope(a) {
      const sc = this.cfg.slope, h = this.hist; if (!h.length || a === null) return null;
      let j = h.length - 1;                                       // oldest sample whose angle stayed within ±stable_deg
      while (j > 0 && Math.abs(h[j - 1].a - a) <= sc.stable_deg && this.i - h[j - 1].i <= sc.max_s + sc.settle_s) j--;
      const stableSince = (j > 0 || Math.abs(h[0].a - a) > sc.stable_deg) ? h[j].i : -Infinity;
      const w = Math.min(sc.max_s, this.i - stableSince - sc.settle_s);
      if (!(w >= sc.min_s)) return null;
      const ts = [], ys = [];
      for (let k = h.length - 1; k >= 0 && h[k].i >= this.i - w; k--) if (has(h[k].mb)) { ts.push(h[k].i); ys.push(h[k].mb); }
      if (ts.length < 0.6 * w) return null;
      const f = fitSlope(ts, ys); if (!f) return null;
      f.short = w < sc.max_s; f.w = w; return f;
    }
    step(sample) {
      const cfg = this.cfg;
      const qa = applyQuality(sample, cfg);
      const s = qa.s;
      const cosT = has(sample.cos_theta) ? sample.cos_theta : (has(sample.tilt_deg) ? Math.sin(sample.tilt_deg * Math.PI / 180) : 1.0);
      const gEff = has(sample.g) ? sample.g : cfg.physics.g.earth;
      const ang = angleOf(sample);
      const st = { tcore: s.tcore, tskin: s.tskin, pv_deficit: s.pv_deficit, hr: s.hr, rmssd: s.rmssd, map_heart: s.map_heart, dtsi: s.dtsi,
                   g: gEff, cos_theta: cosT, met_btuh: sample.met_btuh };
      const { c, x } = components(st, this.base, cfg);
      const kI = this.base.k_i || 1.0;
      const o = oriOf(c, cfg, kI);
      const notes = [];
      // slope: external (feature file / scenario) or the v1.1 internal estimate (steady-posture window)
      const sc = cfg.slope;
      let slope = null, se = null, r2 = null, slopeNote = null, slopeSrc = null;
      const ext = has(s.map_slope) && sc.source !== 'internal';
      if (ext) { slope = s.map_slope; se = has(sample.map_slope_se) ? sample.map_slope_se : null; r2 = has(sample.map_slope_r2) ? sample.map_slope_r2 : null; slopeSrc = 'harici';
        if (r2 !== null && r2 < cfg.perfusion.min_r2) { slope = null; slopeNote = 'belirsiz (R² < ' + cfg.perfusion.min_r2 + ')'; } }
      else if (sc.source !== 'external') {
        const f = this.internalSlope(ang);
        if (f) { const rmin = f.short ? sc.r2_short : cfg.perfusion.min_r2;
          if (f.r2 >= rmin) { slope = f.slope; se = f.se; r2 = f.r2; slopeSrc = 'internal (' + f.w + ' s)'; }
          else slopeNote = 'belirsiz (R² ' + f.r2.toFixed(2) + ' < ' + rmin + ')'; }
        else if (has(x.margin)) slopeNote = 'posture not steady / window too short';
      }
      if (has(x.map_brain) || ang !== null) this.hist.push({ i: this.i, a: ang === null ? 90 : ang, mb: has(x.map_brain) ? x.map_brain : null });
      if (this.hist.length > sc.max_s + sc.settle_s + 5) this.hist.shift();
      const T = tts(x.margin, slope, se);
      const tr = cfg.tts_rules;
      const tCrit = (tr.crit_use_upper && has(T.up)) ? T.up : T.t;   // v1.1: for critical, the optimistic bound must also be under 3 min
      let { o: o2, why } = applyOverrides(o, x.margin, tCrit, s.tcore, cfg);
      this.ovRun = why ? this.ovRun + 1 : 0;
      const need = this.opts.snapshot ? 0 : cfg.override.persist_s;
      if (why && this.ovRun < need) { o2 = o; why = null; }
      let ttsWarn = false;
      if (!why && o2 !== null && has(T.up) && T.up < tr.warn_up_min) { o2 = Math.max(o2, tr.warn_ori); ttsWarn = true; }
      // v1.1 posture gate: no orthostatic alarm while lying down; low blood pressure is caught by the main panel limit
      const pg = cfg.posture_gate; let gated = false;
      if (pg && pg.enabled && ang !== null && ang < pg.min_tilt_deg && o2 !== null && !(has(s.tcore) && s.tcore >= cfg.override.tcore_crit)) {
        if (o2 > pg.cap || why) { gated = true; notes.push('Lying down: orthostatic alarm off; low blood pressure is watched by the main panel limit.'); }
        o2 = Math.min(o2, pg.cap); why = null;
      }
      let level;
      if (o2 === null) level = 'nodata';                          // v1.1: no data is never shown as green
      else if (this.opts.snapshot) level = levelOf(o2, cfg);
      else level = this.alarm.step(o2, why);
      const excluded = Object.keys(cfg.weights).filter((k) => !(k in c));
      const reasons = {};
      for (const k of excluded) {
        if ((k === 'T' || k === 'V') && qa.why.thermal) reasons[k] = 'low SQI';
        else if (k === 'C' && x.c_excluded === 'effort') reasons[k] = 'high effort';
        else if (k === 'C' && qa.why.cardio) reasons[k] = 'low SQI';
        else if (k === 'P' && qa.why.bp) reasons[k] = 'low SQI';
        else if (k === 'S' && qa.why.cerebral) reasons[k] = 'low SQI';
        else reasons[k] = 'veri yok';
      }
      const rec = recommend(c, o2, x.margin, sample.phase, cfg);
      if (!has(s.tcore) && has(x.margin)) notes.push('No Tcore: heat correction (k_heat) not applied; the perfusion margin may be optimistic.');
      if (x.lla_source === 'population' && has(x.margin)) notes.push('No personal LLA: population value (65 mmHg) used; false alarms are more likely.');
      if (!has(x.margin) && sample.phase === 'eva') notes.push('Suit mode: no blood pressure; perfusion margin and time to faint are not calculated.');
      if (ttsWarn) notes.push('TTS upper bound < ' + tr.warn_up_min + ' min: early warning.');
      const cov = Object.keys(c).reduce((a2, k) => a2 + cfg.weights[k], 0) / Object.values(cfg.weights).reduce((a2, v) => a2 + v, 0);
      this.i++;
      return {
        t: sample.t || null,
        ori: o2, ori_raw: o, level: LEVEL_NAME[level], level_color: level, override: why,
        components: c, map_brain: has(x.map_brain) ? x.map_brain : null, lla_brain: has(x.lla_brain) ? x.lla_brain : null,
        margin: has(x.margin) ? x.margin : null, lla_source: x.lla_source || null, hr_expected: has(x.hr_expected) ? x.hr_expected : null,
        tts_min: T.t, tts_ci: [T.lo, T.up], tts_note: slopeNote, tts_warn: ttsWarn, slope, slope_src: slopeSrc, psi: psiOf(s, this.base, cfg),
        recommendations: rec, posture_gated: gated,
        data_quality: { excluded: excluded.map((k) => k), reasons, sqi_low: qa.why, notes, coverage: cov },
        inputs: { s, st, cosT }
      };
    }
  }

  /* Baseline: section 3 last row + 6.3. In a real record, the median of the first lla_baseline_s seconds (lying down). */
  function median(a) {
    const v = a.filter(has).sort((p, q) => p - q);
    if (!v.length) return null;
    const m = v.length >> 1;
    return v.length % 2 ? v[m] : (v[m - 1] + v[m]) / 2;
  }
  function baselineFromRecord(rec, cfg) {
    // v1.1: baseline = the last lla_baseline_s seconds (lying down) before the first tilt-up (tilt > 30°); without a tilt-up, the start of the record
    let i0 = rec.tilt ? rec.tilt.findIndex((a) => has(a) && a > 30) : -1; if (i0 < 30) i0 = Math.min(cfg.lla_baseline_s, rec.n);
    const a0 = Math.max(0, i0 - cfg.lla_baseline_s), sl = (arr) => arr.slice(a0, i0);
    const b = { hr0: median(sl(rec.hr)), rmssd0: median(sl(rec.rmssd)), tcore0: null, k_i: 1.0 };
    const w = sl(rec.map).filter(has);
    if (w.length >= 30) { b.map0 = median(w); b.lla_ref = cfg.lla_frac * b.map0; }   // v1.1: personal LLA (supine baseline MAP × lla_frac)
    return b;
  }

  /* Input sample at second i of a record (close to the section 7.1 format) */
  function sampleFromRecord(rec, i, gEff, phase) {
    return {
      t: i, phase: phase || 'surface', g: gEff, tilt_deg: rec.tilt[i],
      hr: rec.hr[i], rmssd: rec.rmssd[i], map_heart: rec.map[i], map_slope: null,   // v1.1: slope computed in the core (steady-posture window)
      map_slope_se: null, map_slope_r2: null, tcore: null, tskin: null, pv_deficit: null, dtsi: null,
      sqi: { cardio: rec.sqi_e[i], bp: rec.sqi_a[i], thermal: null, cerebral: null }
    };
  }

  return { DEFAULT_CONFIG, deepMerge, components, oriOf, tts, applyOverrides, levelOf, AlarmState, Engine, recommend, psiOf,
           baselineFromRecord, sampleFromRecord, hydro, clip, has, LEVEL_NAME, fitSlope };
})();
export default GT;
