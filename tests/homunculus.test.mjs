import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  VANILMIRTH, HOMUNCULI, HOMUN_EXP, statGrowthDist, peerDist, finalDist, probAtLeast, mean,
  analyseGoal, changeInstructionBonus, combatStats, expBetween, gradeStats, priorityOrder, STATS,
} from '../docs/js/homunculus.js';

const close = (a, b, tol, msg) => assert.ok(Math.abs(a - b) <= tol, `${msg ?? ''} expected ${b} ± ${tol}, got ${a}`);

// Deterministic PRNG so simulations are reproducible.
function rng(seed) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Mirrors homunculus_levelup: rnd->value(1,30) in tenths, remainder discarded.
const serverGrowth = (rand) => {
  const v = 1 + Math.floor(rand() * 30);
  return (v - (v % 10)) / 10;
};

test('stat growth matches the server roll', () => {
  const d = statGrowthDist(VANILMIRTH.growth.int);
  assert.equal(d.min, 0);
  [9, 10, 10, 1].forEach((n, i) => close(d.p[i], n / 30, 1e-12));
  close(mean(d), 1.1, 1e-12);
});

test('EXP table has one entry per level-up', () => {
  assert.equal(HOMUN_EXP.length, 98);
  assert.equal(expBetween(1, 99), 203562890);
});

test('exact distribution agrees with a simulation of the server', () => {
  const rand = rng(42);
  const N = 200000;
  let hits130 = 0, sum = 0;
  for (let n = 0; n < N; n++) {
    let x = 11;
    for (let l = 1; l < 99; l++) x += serverGrowth(rand);
    sum += x;
    if (x >= 130) hits130++;
  }
  const d = peerDist('int', 99);
  close(sum / N, mean(d), 0.05, 'mean INT at 99');
  close(mean(d), 11 + 98 * 1.1, 1e-9);
  close(hits130 / N, probAtLeast(d, 130), 0.003, 'P(INT>=130)');
});

test('140 INT is far rarer than the old calculator claimed', () => {
  const d = finalDist('int', 1, 11);
  close(probAtLeast(d, 140), 0.008208, 1e-5);
});

test('HP growth uses whole-point uniform rolls', () => {
  const d = peerDist('hp', 99);
  close(mean(d), 80 + 98 * 90, 1e-6);
  close(d.p.reduce((a, b) => a + b, 0), 1, 1e-9);
});

test('optimal restart policy matches the reference prototype', () => {
  const r = analyseGoal({ key: 'int', target: 140, overhead: 0, evolution: 'ignore' });
  close(r.expectedCost / r.totalExp, 1.674, 0.01, 'runs');
  const t = Object.fromEntries(r.thresholds.map((x) => [x.level, x.minKeep]));
  assert.deepEqual([t[2], t[10], t[50], t[90], t[98]], [13, 27, 82, 127, 137]);
});

test('following the policy costs what the solver predicts', () => {
  const target = 130, overhead = 200000;
  const r = analyseGoal({ key: 'int', target, overhead, evolution: 'ignore' });
  const keep = new Map(r.thresholds.map((x) => [x.level, x.minKeep]));
  const rand = rng(7);
  const successes = 400;
  let spent = 0;
  for (let s = 0; s < successes; s++) {
    for (;;) {
      let x = 11, failed = false;
      for (let L = 1; L < 99; L++) {
        spent += HOMUN_EXP[L - 1];
        x += serverGrowth(rand);
        const t = keep.get(L + 1);
        if (L + 1 < 99 && (t == null || x < t)) { failed = true; break; }
      }
      if (!failed && x >= target) break;
      spent += overhead;
    }
  }
  close(spent / successes / r.expectedCost, 1, 0.1, 'simulated / predicted cost');
});

test('current-state decision', () => {
  const good = analyseGoal({ key: 'int', target: 130, overhead: 0, evolution: 'ignore', level: 50, value: 85 });
  assert.equal(good.state.decision, 'keep');
  const bad = analyseGoal({ key: 'int', target: 130, overhead: 0, evolution: 'ignore', level: 50, value: 66 });
  assert.equal(bad.state.decision, 'restart');
  const hopeless = analyseGoal({ key: 'int', target: 140, evolution: 'ignore', level: 98, value: 100 });
  assert.equal(hopeless.state.chance, 0);
  assert.equal(hopeless.state.decision, 'restart');
});

test('planned evolution makes the target easier', () => {
  const a = analyseGoal({ key: 'int', target: 140, evolution: 'ignore' });
  const b = analyseGoal({ key: 'int', target: 140, evolution: 'plan' });
  assert.ok(b.freshChance > a.freshChance * 5);
});

test('Change Instruction bonuses match status.c', () => {
  const table = [0, 1, 2, 3, 4, 5].map((lv) => { const b = changeInstructionBonus(lv); return [b.str, b.int]; });
  assert.deepEqual(table, [[0, 0], [1, 1], [1, 2], [3, 2], [4, 4], [4, 5]]);
});

test('combat stats', () => {
  const s = { str: 20, agi: 30, vit: 25, int: 120, dex: 40, luk: 15 };
  const c = combatStats(s, 80, { skillLevel: 5 });
  // INT 125 effective, STR 24 effective.
  assert.equal(c.matkMin, 125 + 17 * 17);
  assert.equal(c.matkMax, 125 + 25 * 25);
  assert.equal(c.mdefHard, 8 + 24);           // base INT
  assert.equal(c.mdefSoft, 125 + 12);         // effective INT
  assert.equal(c.atkMin, 24 + 4 + 40);
  assert.equal(c.atkMax, 24 + 4 + 24 + 80);
  assert.equal(c.aspd, Math.floor((2000 - Math.floor((1000 - 120 - 40) * 700 / 1000)) / 10));
  assert.equal(c.crit, 0);
  // Min ATK is clamped to max when DEX is high (battle.c).
  const d = combatStats({ ...s, str: 5, dex: 200 }, 10);
  assert.equal(d.atkMin, d.atkMax);
});

test('growth tables of the other homunculi', () => {
  // Lif INT (4, 20): 4-9 -> +0, 10-19 -> +1, 20 -> +2.
  const lif = statGrowthDist(HOMUNCULI.lif.growth.int);
  [6, 10, 1].forEach((n, i) => close(lif.p[i], n / 17, 1e-12));
  // Filir AGI (8, 20); Amistr INT (1, 10).
  const filir = statGrowthDist(HOMUNCULI.filir.growth.agi);
  [2, 10, 1].forEach((n, i) => close(filir.p[i], n / 13, 1e-12));
  const amiInt = statGrowthDist(HOMUNCULI.amistr.growth.int);
  [9, 1].forEach((n, i) => close(amiInt.p[i], n / 10, 1e-12));
  close(mean(peerDist('vit', 99, { homun: HOMUNCULI.amistr })), 35 + 98 * 12 / 17, 1e-9);
});

test('every homunculus lists all eight keys exactly once in its priorities', () => {
  for (const h of Object.values(HOMUNCULI)) {
    assert.deepEqual([...priorityOrder(h)].sort(), [...STATS, 'hp', 'sp'].sort(), h.name);
  }
});

test('restart policy holds for a +2-max homunculus', () => {
  const h = HOMUNCULI.lif, target = 112, overhead = 96100;
  const r = analyseGoal({ key: 'int', target, overhead, evolution: 'ignore', homun: h });
  const keep = new Map(r.thresholds.map((x) => [x.level, x.minKeep]));
  const rand = rng(11);
  const roll = () => { const v = 4 + Math.floor(rand() * 17); return (v - (v % 10)) / 10; };
  const successes = 400;
  let spent = 0;
  for (let s = 0; s < successes; s++) {
    for (;;) {
      let x = 35, failed = false;
      for (let L = 1; L < 99; L++) {
        spent += HOMUN_EXP[L - 1];
        x += roll();
        const t = keep.get(L + 1);
        if (L + 1 < 99 && (t == null || x < t)) { failed = true; break; }
      }
      if (!failed && x >= target) break;
      spent += overhead;
    }
  }
  close(spent / successes / r.expectedCost, 1, 0.1, 'simulated / predicted cost');
});

test('passive skill bonuses', () => {
  const s = { str: 50, agi: 50, vit: 100, int: 30, dex: 50, luk: 30, hp: 10000, sp: 300 };
  const ami = combatStats(s, 99, { skillLevel: 5, homun: HOMUNCULI.amistr });
  assert.equal(ami.maxHp, 11000);
  assert.equal(ami.defHard, 9 + 20 + 20);
  const lif = combatStats(s, 99, { skillLevel: 5, homun: HOMUNCULI.lif });
  assert.equal(lif.maxSp, 309);
  const fil = combatStats(s, 99, { skillLevel: 5, homun: HOMUNCULI.filir });
  assert.equal(fil.maxHp, 10000);
  assert.equal(fil.matkMin, 30 + 16);
});

test('build score weights follow priority order', () => {
  const g = gradeStats({ ...HOMUNCULI.filir.base, hp: 90, sp: 25 }, 1, { homun: HOMUNCULI.filir });
  assert.deepEqual(g.overall.weights, { agi: 6, str: 5, dex: 4, vit: 3, int: 2, luk: 1 });
});

test('grading uses percentiles', () => {
  // Mean at level 50 is 11 + 49 * 1.1 = 64.9.
  const g = gradeStats({ str: 65, agi: 65, vit: 65, int: 65, dex: 65, luk: 65, hp: 4400, sp: 180 }, 50);
  for (const row of g.rows.filter((r) => STATS.includes(r.key))) close(row.pct, 0.5, 0.06);
  assert.equal(g.overall.grade.letter, 'B');
});
