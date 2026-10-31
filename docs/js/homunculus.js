// Homunculus growth math for pre-renewal Hercules.
//
// Source references (Hercules-stable/):
//   db/pre-re/homunculus_db.conf      base / growth / evolution tables
//   db/pre-re/exp_group_db.conf       "Homunculus" EXP group
//   src/map/homunculus.c              homunculus_levelup, homunculus_evolve
//   src/map/status.c                  status_calc_homunculus_, status_calc_misc
//   src/map/battle.c                  battle_calc_base_damage (min/max ATK clamp)
//   conf/map/battle/battle.conf       enable_critical / enable_perfect_flee defaults

export const STATS = ['str', 'agi', 'vit', 'int', 'dex', 'luk'];
export const STAT_LABELS = { str: 'STR', agi: 'AGI', vit: 'VIT', int: 'INT', dex: 'DEX', luk: 'LUK', hp: 'Max HP', sp: 'Max SP' };

// growth: HP/SP in whole points, the six stats in tenths of a point.
// evolution: all whole points (the server multiplies stat rolls by 10 internally).
// priority: stat groups in build order; HP/SP ride along with the stat whose role they share.
// skill: the passive that changes base stats in status_calc_homunculus_.
export const HOMUNCULI = {
  lif: {
    key: 'lif', name: 'Lif', maxLevel: 99, baseAspd: 700,
    base: { hp: 150, sp: 40, str: 17, agi: 20, vit: 15, int: 35, dex: 24, luk: 12 },
    growth: {
      hp: [60, 100], sp: [4, 9],
      str: [5, 19], agi: [5, 19], vit: [5, 19], int: [4, 20], dex: [6, 20], luk: [6, 20],
    },
    evolution: {
      hp: [1, 10], sp: [10, 20],
      str: [1, 5], agi: [1, 4], vit: [1, 5], int: [4, 10], dex: [1, 10], luk: [1, 3],
    },
    priority: [['int', 'sp'], ['agi'], ['vit', 'hp'], ['dex'], ['str'], ['luk']],
    skill: { id: 'HLIF_BRAIN', name: 'Brain Surgery' },
    defaultTarget: 115,
  },
  amistr: {
    key: 'amistr', name: 'Amistr', maxLevel: 99, baseAspd: 700,
    base: { hp: 320, sp: 10, str: 20, agi: 17, vit: 35, int: 11, dex: 24, luk: 12 },
    growth: {
      hp: [80, 130], sp: [1, 4],
      str: [8, 20], agi: [4, 20], vit: [4, 20], int: [1, 10], dex: [3, 19], luk: [3, 19],
    },
    evolution: {
      hp: [10, 20], sp: [1, 10],
      str: [1, 10], agi: [1, 5], vit: [4, 10], int: [1, 3], dex: [1, 4], luk: [1, 5],
    },
    priority: [['vit', 'hp'], ['agi'], ['str'], ['dex'], ['int', 'sp'], ['luk']],
    skill: { id: 'HAMI_SKIN', name: 'Adamantium Skin' },
    defaultTarget: 115,
  },
  filir: {
    key: 'filir', name: 'Filir', maxLevel: 99, baseAspd: 700,
    base: { hp: 90, sp: 25, str: 29, agi: 35, vit: 9, int: 8, dex: 30, luk: 9 },
    growth: {
      hp: [45, 75], sp: [3, 6],
      str: [4, 20], agi: [8, 20], vit: [1, 10], int: [3, 19], dex: [4, 20], luk: [3, 19],
    },
    evolution: {
      hp: [5, 15], sp: [5, 15],
      str: [4, 10], agi: [1, 10], vit: [1, 3], int: [1, 4], dex: [1, 5], luk: [1, 5],
    },
    priority: [['agi'], ['str'], ['dex'], ['vit', 'hp'], ['int', 'sp'], ['luk']],
    skill: null,
    defaultTarget: 135,
  },
  vanilmirth: {
    key: 'vanilmirth', name: 'Vanilmirth', maxLevel: 99, baseAspd: 700,
    base: { hp: 80, sp: 11, str: 11, agi: 11, vit: 11, int: 11, dex: 11, luk: 11 },
    growth: {
      hp: [30, 150], sp: [0, 7],
      str: [1, 30], agi: [1, 30], vit: [1, 30], int: [1, 30], dex: [1, 30], luk: [1, 30],
    },
    evolution: {
      hp: [1, 30], sp: [1, 30],
      str: [1, 10], agi: [1, 10], vit: [1, 10], int: [1, 10], dex: [1, 10], luk: [1, 10],
    },
    priority: [['int', 'sp'], ['vit', 'hp'], ['agi'], ['dex'], ['str'], ['luk']],
    skill: { id: 'HVAN_INSTRUCT', name: 'Change Instruction' },
    defaultTarget: 140,
  },
};

export const VANILMIRTH = HOMUNCULI.vanilmirth;

/** Stat keys in priority order, HP/SP placed right after their partner stat. */
export function priorityOrder(homun) {
  return homun.priority.flat();
}

/** Priority rank (1 = most important) of every key, including HP/SP. */
export function priorityRank(homun) {
  const rank = {};
  homun.priority.forEach((group, i) => group.forEach((k) => { rank[k] = i + 1; }));
  return rank;
}

// EXP needed to go from level i+1 to level i+2 (98 entries, Lv1->2 ... Lv98->99).
export const HOMUN_EXP = [
  50, 110, 180, 260, 350, 630, 950, 1310, 1710, 2150,
  3180, 4300, 5510, 6810, 8200, 10800, 13560, 16480, 19560, 22800,
  28090, 33630, 39420, 45460, 51750, 61500, 70910, 81030, 91510, 102350,
  117580, 133300, 149510, 166210, 183400, 206480, 230200, 254560, 279560, 305200,
  338450, 372510, 407380, 443060, 479550, 525590, 572630, 620670, 669710, 719750,
  781500, 844460, 908630, 974010, 1040600, 1121280, 1203400, 1286960, 1371960, 1458400,
  1561530, 1666350, 1772860, 1881060, 1990950, 2120350, 2251710, 2385030, 2520310, 2657550,
  2817340, 2979380, 3143670, 3310210, 3479000, 3673600, 3870760, 4070480, 4272760, 4477600,
  4711730, 4948750, 5188660, 5431460, 5677150, 5955830, 6237750, 6522910, 6811310, 7102950,
  7431500, 7763660, 8099430, 8438810, 8781800, 9165840, 9553880, 9945920,
];

/** Total EXP to go from level `from` to level `to`. */
export function expBetween(from, to) {
  let total = 0;
  for (let l = from; l < to; l++) total += HOMUN_EXP[l - 1];
  return total;
}

// ---------------------------------------------------------------------------
// Discrete distributions: { min, p } where p[i] = P(X = min + i)
// ---------------------------------------------------------------------------

export function pointDist(value) {
  return { min: value, p: Float64Array.of(1) };
}

export function uniformDist(lo, hi) {
  const n = hi - lo + 1;
  return { min: lo, p: new Float64Array(n).fill(1 / n), uniform: true };
}

/**
 * Per-level growth of one stat, in whole points. The server rolls
 * rnd->value(min, max) in tenths and discards the remainder (homunculus_levelup).
 */
export function statGrowthDist([lo, hi]) {
  const minPts = Math.floor(lo / 10);
  const p = new Float64Array(Math.floor(hi / 10) - minPts + 1);
  const n = hi - lo + 1;
  for (let v = lo; v <= hi; v++) p[Math.floor(v / 10) - minPts] += 1 / n;
  return { min: minPts, p };
}

export function growthDist(key, homun = VANILMIRTH) {
  const range = homun.growth[key];
  return key === 'hp' || key === 'sp' ? uniformDist(range[0], range[1]) : statGrowthDist(range);
}

export function evolutionDist(key, homun = VANILMIRTH) {
  const [lo, hi] = homun.evolution[key];
  return uniformDist(lo, hi);
}

export function convolve(a, b) {
  const out = new Float64Array(a.p.length + b.p.length - 1);
  if (b.uniform) {
    // Sliding-window sum keeps HP (121-wide kernel) cheap.
    const w = b.p.length, q = b.p[0];
    let window = 0;
    for (let i = 0; i < out.length; i++) {
      if (i < a.p.length) window += a.p[i];
      if (i - w >= 0) window -= a.p[i - w];
      out[i] = window * q;
    }
  } else {
    for (let i = 0; i < a.p.length; i++) {
      const ai = a.p[i];
      if (ai === 0) continue;
      for (let j = 0; j < b.p.length; j++) out[i + j] += ai * b.p[j];
    }
  }
  return { min: a.min + b.min, p: out };
}

/** Distribution of `start` plus `n` independent draws from `step`. */
export function addSteps(start, step, n) {
  let d = start;
  for (let i = 0; i < n; i++) d = convolve(d, step);
  return d;
}

export function distMax(d) {
  return d.min + d.p.length - 1;
}

export function probAtLeast(d, x) {
  let s = 0;
  for (let i = Math.max(0, x - d.min); i < d.p.length; i++) s += d.p[i];
  return Math.min(1, s);
}

export function probAt(d, x) {
  const i = x - d.min;
  return i >= 0 && i < d.p.length ? d.p[i] : 0;
}

/** Mid-rank percentile: share of outcomes below x, counting ties as half. */
export function percentileOf(d, x) {
  return 1 - probAtLeast(d, x) + probAt(d, x) / 2;
}

export function mean(d) {
  let m = 0;
  for (let i = 0; i < d.p.length; i++) m += (d.min + i) * d.p[i];
  return m;
}

/** Smallest x with P(X <= x) >= q. */
export function quantile(d, q) {
  let c = 0;
  for (let i = 0; i < d.p.length; i++) {
    c += d.p[i];
    if (c >= q - 1e-12) return d.min + i;
  }
  return distMax(d);
}

// ---------------------------------------------------------------------------
// Growth analysis
// ---------------------------------------------------------------------------

/**
 * Distribution of a stat for a homunculus at `level` (straight from the embryo).
 * `evolved` adds the one-time evolution bonus.
 */
export function peerDist(key, level, { evolved = false, homun = VANILMIRTH } = {}) {
  let d = addSteps(pointDist(homun.base[key]), growthDist(key, homun), level - 1);
  if (evolved) d = convolve(d, evolutionDist(key, homun));
  return d;
}

/** Distribution of a stat at max level, starting from its current value. */
export function finalDist(key, level, value, { addEvolution = false, homun = VANILMIRTH } = {}) {
  let d = addSteps(pointDist(value), growthDist(key, homun), homun.maxLevel - level);
  if (addEvolution) d = convolve(d, evolutionDist(key, homun));
  return d;
}

/** 10th / 50th / 90th percentile of a stat at every level, for charting. */
export function levelBands(key, { evolved = false, homun = VANILMIRTH } = {}) {
  const step = growthDist(key, homun);
  const evo = evolved ? evolutionDist(key, homun) : null;
  const bands = [];
  let d = pointDist(homun.base[key]);
  for (let L = 1; L <= homun.maxLevel; L++) {
    const shown = evo ? convolve(d, evo) : d;
    bands.push({ level: L, p10: quantile(shown, 0.1), p50: quantile(shown, 0.5), p90: quantile(shown, 0.9) });
    d = convolve(d, step);
  }
  return bands;
}

export function gradeFromPercentile(pct) {
  if (pct >= 0.9) return { letter: 'S', label: 'Excellent' };
  if (pct >= 0.7) return { letter: 'A', label: 'Good' };
  if (pct >= 0.3) return { letter: 'B', label: 'Average' };
  if (pct >= 0.1) return { letter: 'C', label: 'Below average' };
  return { letter: 'D', label: 'Poor' };
}

/** Returns null if the value is reachable, otherwise a message. */
export function checkReachable(key, level, value, { evolved = false, homun = VANILMIRTH } = {}) {
  const d = peerDist(key, level, { evolved, homun });
  if (value < d.min || value > distMax(d)) {
    return `${STAT_LABELS[key]} ${value} is impossible at level ${level} (valid range ${d.min}–${distMax(d)}).`;
  }
  return null;
}

/** Weight of each of the six stats in the build score: #1 priority counts 6x, #6 counts 1x. */
export function buildWeights(homun) {
  const order = priorityOrder(homun).filter((k) => STATS.includes(k));
  return Object.fromEntries(order.map((k, i) => [k, order.length - i]));
}

/** Distribution of sum(weight * stat), stats being independent. */
function weightedSumDist(dists, weights) {
  let acc = pointDist(0);
  for (const [key, d] of Object.entries(dists)) {
    const w = weights[key];
    const out = new Float64Array(acc.p.length + (d.p.length - 1) * w);
    for (let i = 0; i < acc.p.length; i++) {
      const a = acc.p[i];
      if (a === 0) continue;
      for (let j = 0; j < d.p.length; j++) out[i + j * w] += a * d.p[j];
    }
    acc = { min: acc.min + d.min * w, p: out };
  }
  return acc;
}

/** Percentile + grade for each stat, plus a priority-weighted build score. */
export function gradeStats(stats, level, { evolved = false, homun = VANILMIRTH } = {}) {
  const rows = [];
  const dists = {};
  for (const key of priorityOrder(homun)) {
    const d = peerDist(key, level, { evolved, homun });
    if (STATS.includes(key)) dists[key] = d;
    const value = stats[key];
    const pct = percentileOf(d, value);
    rows.push({
      key, value, pct,
      expected: mean(d),
      low: quantile(d, 0.1),
      high: quantile(d, 0.9),
      grade: gradeFromPercentile(pct),
      error: value < d.min || value > distMax(d)
        ? `impossible at this level (range ${d.min}–${distMax(d)})` : null,
    });
  }

  const weights = buildWeights(homun);
  const total = weightedSumDist(dists, weights);
  const score = STATS.reduce((s, k) => s + weights[k] * stats[k], 0);
  const pct = percentileOf(total, score);

  return { rows, overall: { value: score, weights, pct, expected: mean(total), grade: gradeFromPercentile(pct) } };
}

// ---------------------------------------------------------------------------
// Keep-or-restart decision
//
// Goal: end with a max-level homunculus whose focus stat >= target, spending as
// little EXP as possible. At any level you may restart (paying `overhead` EXP-
// equivalent plus the expected cost of a fresh attempt, C). C is the fixed point
// of C = cost-to-finish(fresh embryo | restart cost = overhead + C).
// ---------------------------------------------------------------------------

function terminalSuccess(target, evo) {
  // Returns s(x) = P(x + evoBonus >= target).
  if (!evo) return (x) => (x >= target ? 1 : 0);
  return (x) => probAtLeast(evo, target - x);
}

/**
 * Backward induction from max level down to `fromLevel`.
 * Returns per-level arrays of continuation cost, indexed by stat value - xMin.
 */
function solvePolicy({ step, success, restartCost, fromLevel, xMin, maxLevel }) {
  // Arrays are indexed by (stat value - xMin).
  const maxStep = step.min + step.p.length - 1;
  const width = maxStep * (maxLevel - fromLevel) + 1;
  let V = new Float64Array(width);
  for (let i = 0; i < width; i++) V[i] = restartCost * (1 - success(xMin + i));

  const cont = new Array(maxLevel + 1);
  for (let L = maxLevel - 1; L >= fromLevel; L--) {
    const w = maxStep * (L - fromLevel) + 1;
    const c = new Float64Array(w);
    const nv = new Float64Array(w);
    const cost = HOMUN_EXP[L - 1];
    for (let i = 0; i < w; i++) {
      let e = cost;
      for (let k = 0; k < step.p.length; k++) e += step.p[k] * V[i + step.min + k];
      c[i] = e;
      nv[i] = Math.min(e, restartCost);
    }
    cont[L] = c;
    V = nv;
  }
  return cont;
}

/**
 * Analyse a single-stat goal.
 * @param {object} opts
 *   key          focus stat (e.g. 'int')
 *   target       desired value at max level (after evolution if counted)
 *   overhead     EXP-equivalent cost of a restart (embryos, time)
 *   evolution    'plan' | 'evolved' | 'ignore'
 *   level, value current state (optional)
 */
export function analyseGoal({ key = 'int', target, overhead = 0, evolution = 'plan', level, value, homun = VANILMIRTH }) {
  const step = growthDist(key, homun);
  const evo = evolution === 'ignore' ? null : evolutionDist(key, homun);
  const maxLevel = homun.maxLevel;
  const base = homun.base[key];
  const totalExp = expBetween(1, maxLevel);

  const freshFinal = finalDist(key, 1, base, { addEvolution: !!evo, homun });
  const freshChance = probAtLeast(freshFinal, target);

  const result = { key, target, overhead, evolution, freshChance, totalExp, freshFinal };
  if (freshChance <= 0) {
    result.impossible = true;
    return result;
  }

  const freshSuccess = terminalSuccess(target, evo);
  const freshCost = (C) =>
    solvePolicy({ step, success: freshSuccess, restartCost: overhead + C, fromLevel: 1, xMin: base, maxLevel })[1][0];

  // f(C) = freshCost(C) - C is strictly decreasing; bisect in log space.
  let lo = totalExp;
  let hi = (totalExp + overhead) / freshChance + totalExp;
  for (let i = 0; i < 200 && hi / lo > 1 + 1e-10; i++) {
    const mid = Math.sqrt(lo * hi);
    if (freshCost(mid) < mid) hi = mid; else lo = mid;
  }
  const C = hi;
  const restartCost = overhead + C;
  result.expectedCost = C;
  result.restartCost = restartCost;

  // Keep thresholds. An already-evolved homunculus has the bonus baked into its stats.
  const pendingEvo = evolution === 'plan' ? evo : null;
  const xMin = evolution === 'evolved' ? base + evo.min : base;
  const cont = solvePolicy({
    step, success: terminalSuccess(target, pendingEvo), restartCost, fromLevel: 1, xMin, maxLevel,
  });
  const thresholds = [];
  for (let L = 2; L < maxLevel; L++) {
    const c = cont[L];
    let t = null;
    for (let i = 0; i < c.length; i++) if (c[i] < restartCost) { t = xMin + i; break; }
    thresholds.push({ level: L, minKeep: t });
  }
  result.thresholds = thresholds;

  if (level != null && value != null) {
    const fin = finalDist(key, level, value, { addEvolution: !!pendingEvo, homun });
    const state = { level, value, chance: probAtLeast(fin, target), final: fin };
    if (level >= maxLevel) {
      state.keepCost = restartCost * (1 - state.chance);
      state.decision = state.chance >= 1 ? 'done' : state.chance > 0 ? 'evolve' : 'restart';
    } else {
      const userCont = solvePolicy({
        step, success: terminalSuccess(target, pendingEvo), restartCost, fromLevel: level, xMin: value, maxLevel,
      });
      state.keepCost = userCont[level][0];
      state.decision = state.chance <= 0 ? 'restart' : state.keepCost < restartCost ? 'keep' : 'restart';
    }
    state.remainingExp = expBetween(level, maxLevel);
    result.state = state;
  }
  return result;
}

// ---------------------------------------------------------------------------
// Combat stats (pre-renewal status_calc_homunculus_ + status_calc_misc)
// ---------------------------------------------------------------------------

/** Change Instruction (HVAN_INSTRUCT) bonuses, status.c. */
export function changeInstructionBonus(lv) {
  if (lv <= 0) return { str: 0, int: 0 };
  return {
    int: 1 + Math.floor(lv / 2) + Math.floor(lv / 4) + Math.floor(lv / 5),
    str: 1 + Math.floor(lv / 3) + Math.floor(lv / 3) + Math.floor(lv / 4),
  };
}

/** Stat changes from a homunculus's passive skill (status_calc_homunculus_). */
export function skillBonus(homun, lv) {
  const b = { str: 0, int: 0, def: 0, hpPct: 0, spPct: 0 };
  if (!homun.skill || lv <= 0) return b;
  const fl = Math.floor;
  switch (homun.skill.id) {
    case 'HVAN_INSTRUCT': Object.assign(b, changeInstructionBonus(lv)); break;
    case 'HAMI_SKIN': b.def = lv * 4; b.hpPct = lv * 2; break;
    case 'HLIF_BRAIN': b.spPct = 1 + fl(lv / 2) - fl(lv / 4) + fl(lv / 5); break;
  }
  return b;
}

export function combatStats(stats, level, { skillLevel = 0, homun = VANILMIRTH, maxAspd = 190 } = {}) {
  const bonus = skillBonus(homun, skillLevel);
  const str = stats.str + bonus.str;
  const int = stats.int + bonus.int;
  const { agi, vit, dex, luk } = stats;
  const fl = Math.floor;

  // Hard DEF/MDEF are computed before skill bonuses, so they use base INT.
  const defHard = Math.min(99, fl(level / 10) + fl(vit / 5)) + bonus.def;
  const mdefHard = Math.min(99, fl(level / 10) + fl(stats.int / 5));

  const batk = str + fl(str / 10) ** 2;
  const weaponMax = str + level;
  const weaponMin = Math.min(dex, weaponMax);

  let amotion = fl(((1000 - 4 * agi - dex) * homun.baseAspd) / 1000);
  amotion = Math.min(2000, Math.max(amotion, 2000 - maxAspd * 10));

  return {
    bonus,
    maxHp: stats.hp + fl((bonus.hpPct * stats.hp) / 100),
    maxSp: stats.sp + fl((bonus.spPct * stats.sp) / 100),
    atkMin: batk + weaponMin,
    atkMax: batk + weaponMax,
    matkMin: int + fl(int / 7) ** 2,
    matkMax: int + fl(int / 5) ** 2,
    defHard, defSoft: vit,
    mdefHard, mdefSoft: int + (vit >> 1),
    hit: level + dex,
    flee: level + agi,
    // battle.conf defaults: enable_critical 17 (PC|MER), enable_perfect_flee 1 (PC).
    crit: 0,
    critIfEnabled: fl((10 + fl((luk * 10) / 3)) / 10),
    aspd: fl((2000 - amotion) / 10),
  };
}
