import {
  HOMUNCULI, STATS, STAT_LABELS, analyseGoal, gradeStats, levelBands, finalDist, quantile,
  combatStats, expBetween, distMax, evolutionDist, convolve, checkReachable, priorityOrder,
  priorityRank, statGrowthDist, skillBonus,
} from './homunculus.js';

const STORAGE_KEY = 'homunculus-calc-v3';
const LEGACY_KEY = 'vanilmirth-calc-v2';
const NUMBER_FIELDS = ['level', ...STATS, 'hp', 'sp', 'target'];

const $ = (id) => document.getElementById(id);
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

function defaultsFor(homun) {
  return {
    level: 1, ...homun.base, skill: '0', evolved: false,
    focus: homun.priority[0][0], target: homun.defaultTarget, countEvo: false,
  };
}

// ---------------------------------------------------------------------------
// Persistent state: one saved form per homunculus, restart cost shared.
// ---------------------------------------------------------------------------

function loadStore() {
  let store = null;
  try { store = JSON.parse(localStorage.getItem(STORAGE_KEY)); } catch { /* ignore */ }
  if (!store || typeof store !== 'object') {
    store = { selected: 'vanilmirth', restart: '20', per: {} };
    try {
      const old = JSON.parse(localStorage.getItem(LEGACY_KEY));
      if (old && typeof old === 'object') {
        const { ci, restart, ...rest } = old;
        store.per.vanilmirth = { ...rest, skill: ci ?? '0' };
        if (restart) store.restart = restart;
      }
    } catch { /* ignore */ }
  }
  if (!HOMUNCULI[store.selected]) store.selected = 'vanilmirth';
  store.per ??= {};
  return store;
}

const store = loadStore();
const homun = () => HOMUNCULI[$('homun').value];

function stateFor(key) {
  return { ...defaultsFor(HOMUNCULI[key]), ...(store.per[key] || {}) };
}

function readForm() {
  const s = {};
  for (const f of NUMBER_FIELDS) s[f] = parseInt($(f).value, 10);
  s.skill = $('skill').value;
  s.focus = $('focus').value;
  s.evolved = $('evolved').checked;
  s.countEvo = $('countEvo').checked;
  return s;
}

function writeForm(s) {
  for (const f of NUMBER_FIELDS) $(f).value = s[f];
  $('skill').value = s.skill;
  $('focus').value = s.focus;
  $('evolved').checked = s.evolved;
  $('countEvo').checked = s.countEvo;
}

function save(s) {
  store.selected = $('homun').value;
  store.restart = $('restart').value;
  store.per[store.selected] = s;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
}

/** Update every label that depends on which homunculus is selected. */
function applyHomunculus(h) {
  const rank = priorityRank(h);
  $('priorityLine').innerHTML = `<strong>${h.name} priorities:</strong> `
    + h.priority.map((g) => g.map((k) => STAT_LABELS[k].replace('Max ', '')).join(' & ')).join(' › ');
  $('yourTitle').textContent = `Your ${h.name}`;
  $('skillWrap').hidden = !h.skill;
  if (h.skill) $('skillName').textContent = h.skill.name;

  const stats = priorityOrder(h).filter((k) => STATS.includes(k));
  $('focus').innerHTML = stats
    .map((k) => `<option value="${k}">${STAT_LABELS[k]} (#${rank[k]})</option>`).join('');

  $('restartHint').textContent = `An Embryo only becomes a ${h.name} 1 time in 4 on average, so a restart usually costs several Embryos. The more a restart hurts, the more patient the advice becomes.`;
  $('bandLabel').textContent = `Middle 80% of ${h.name}s`;
  $('aboutName').textContent = h.name;
  renderGrowthTable(h);
}

function validate(s) {
  let ok = true;
  for (const f of NUMBER_FIELDS) {
    const bad = !Number.isFinite(s[f]) || s[f] < 0 || (f === 'level' && (s[f] < 1 || s[f] > 99)) || (f === 'target' && s[f] < 1);
    $(f).classList.toggle('invalid', bad);
    if (bad) ok = false;
  }
  return ok;
}

// ---------------------------------------------------------------------------
// Formatting
// ---------------------------------------------------------------------------

function pct(p) {
  if (p <= 0) return '0%';
  if (p >= 1) return '100%';
  if (p < 0.0001) return '<0.01%';
  if (p > 0.9999) return '>99.99%';
  return `${(p * 100).toFixed(p < 0.01 || p > 0.99 ? 2 : 1)}%`;
}

function oneIn(p) {
  if (p <= 0 || p >= 0.5) return '';
  const n = 1 / p;
  return ` (about 1 in ${n >= 1000 ? Math.round(n).toLocaleString() : Math.round(n)})`;
}

function exp(n) {
  if (n >= 1e9) return `${(n / 1e9).toFixed(2)}B`;
  if (n >= 1e6) return `${(n / 1e6).toFixed(1)}M`;
  if (n >= 1e3) return `${(n / 1e3).toFixed(1)}k`;
  return `${Math.round(n)}`;
}

function ordinal(p) {
  const n = Math.min(99, Math.max(1, Math.round(p * 100)));
  const s = n % 100 >= 11 && n % 100 <= 13 ? 'th' : ['th', 'st', 'nd', 'rd'][n % 10] || 'th';
  return `${n}${s}`;
}

const gradeBadge = (g) => `<span class="grade grade-${g.letter}" title="${esc(g.label)}">${g.letter}</span>`;

// ---------------------------------------------------------------------------
// Rendering
// ---------------------------------------------------------------------------

function freshText(h, s, goal, evoNote) {
  return `A brand-new ${h.name} has a ${pct(goal.freshChance)} chance${oneIn(goal.freshChance)} of reaching
    ${STAT_LABELS[s.focus]} ${s.target}${evoNote} at level 99. If you follow the keep line and count your chosen restart cost,
    expect to spend about ${(goal.expectedCost / goal.totalExp).toFixed(1)}× the EXP of one 1→99 run
    (${exp(goal.expectedCost)}) in total.`;
}

function renderVerdict(h, s, goal) {
  const label = STAT_LABELS[s.focus];
  const el = $('verdict');
  const evoNote = s.evolved ? '' : s.countEvo ? ' after evolution' : '';

  if (goal.impossible) {
    el.className = 'panel verdict warn';
    el.innerHTML = `<div class="verdict-word">Unreachable target</div>
      <p>No ${h.name} can reach ${label} ${s.target}${evoNote}. The best possible is
      ${distMax(goal.freshFinal)}. Lower the target.</p>`;
    return;
  }

  const bad = checkReachable(s.focus, s.level, s[s.focus], { evolved: s.evolved, homun: h });
  if (bad) {
    el.className = 'panel verdict warn';
    el.innerHTML = `<div class="verdict-word">Check your numbers</div>
      <p>${esc(bad)} Make sure the right homunculus and level are selected, that you entered stats without
      skill bonuses, and that "Already evolved" is set correctly.</p>`;
    return;
  }

  if (s.level === 1 && !s.evolved) {
    el.className = 'panel verdict done';
    el.innerHTML = `<div class="verdict-word">Level it up</div>
      <p>Every ${h.name} starts with identical stats. Check again after the first few levels; the keep line
      below shows what to look for.</p>
      <p class="fresh">${freshText(h, s, goal, evoNote)}</p>`;
    return;
  }

  const st = goal.state;
  const keepLine = goal.thresholds.find((t) => t.level === s.level);
  const fin = st.final;
  const median = quantile(fin, 0.5), lo = quantile(fin, 0.1), hi = quantile(fin, 0.9);

  const words = { keep: 'Keep', restart: 'Restart', done: 'Target reached', evolve: 'Evolve and see' };
  let summary;
  if (st.decision === 'done') {
    summary = `Your ${h.name} meets the goal of ${label} ${s.target}${evoNote}.`;
  } else if (st.decision === 'evolve') {
    summary = `At level 99 it all comes down to the evolution roll: ${pct(st.chance)} chance it lifts ${label} to ${s.target}.`;
  } else if (st.chance <= 0) {
    summary = `This one can no longer reach ${label} ${s.target}${evoNote}, even with perfect rolls.`;
  } else if (st.decision === 'keep') {
    summary = `Keeping it is cheaper on average than starting over. If it falls below the keep line later, restart then.`;
  } else {
    summary = `Starting over is cheaper on average than pushing this one to level 99.`;
  }

  const facts = [];
  if (s.level < 99) {
    facts.push(['Chance this one reaches the target', `${pct(st.chance)}<small>${oneIn(st.chance)}</small>`]);
    if (keepLine) {
      facts.push([`Keep line at level ${s.level}`, keepLine.minKeep == null
        ? 'none — restart'
        : `${label} ≥ ${keepLine.minKeep} <small>(you: ${s[s.focus]})</small>`]);
    }
    facts.push([`Projected ${label} at 99${s.countEvo && !s.evolved ? ' + evolution' : ''}`,
      `${median} <small>(80% range ${lo}–${hi})</small>`]);
    if (st.chance > 0) {
      facts.push([`Expected EXP until you own a target ${h.name}`,
        `keep ${exp(st.keepCost)} <small>vs restart ${exp(goal.restartCost)}</small>`]);
    }
  } else {
    facts.push(['Chance of meeting the target', pct(st.chance)]);
  }

  el.className = `panel verdict ${st.decision}`;
  el.innerHTML = `<div class="verdict-word">${words[st.decision]}</div>
    <p>${summary}</p>
    <dl class="facts">${facts.map(([k, v]) => `<div><dt>${k}</dt><dd>${v}</dd></div>`).join('')}</dl>
    <p class="fresh">${freshText(h, s, goal, evoNote)}</p>`;
}

function renderChart(h, s, goal, bands) {
  const key = s.focus;
  const keep = goal.impossible ? [] : goal.thresholds.filter((t) => t.minKeep != null);
  $('chartTitle').textContent = `${h.name} ${STAT_LABELS[key]} growth`;

  const W = 640, H = 300, m = { l: 40, r: 14, t: 12, b: 28 };
  const values = [...bands.map((b) => b.p10), ...bands.map((b) => b.p90), ...keep.map((k) => k.minKeep), s[key], s.target];
  const yMin = Math.max(0, Math.floor(Math.min(...values) / 10) * 10);
  const yMax = Math.ceil((Math.max(...values) + 1) / 10) * 10;
  const x = (L) => m.l + ((L - 1) / 98) * (W - m.l - m.r);
  const y = (v) => H - m.b - ((v - yMin) / (yMax - yMin)) * (H - m.t - m.b);

  const parts = [];
  const yStep = (yMax - yMin) > 150 ? 50 : (yMax - yMin) > 60 ? 20 : 10;
  for (let v = yMin; v <= yMax; v += yStep) {
    parts.push(`<line class="grid" x1="${m.l}" x2="${W - m.r}" y1="${y(v)}" y2="${y(v)}"/>`,
      `<text x="${m.l - 6}" y="${y(v) + 4}" text-anchor="end">${v}</text>`);
  }
  for (const L of [1, 10, 20, 30, 40, 50, 60, 70, 80, 90, 99]) {
    parts.push(`<text x="${x(L)}" y="${H - 8}" text-anchor="middle">${L}</text>`);
  }
  parts.push(`<line class="axis" x1="${m.l}" x2="${W - m.r}" y1="${H - m.b}" y2="${H - m.b}"/>`);

  const top = bands.map((b) => `${x(b.level)},${y(b.p90)}`);
  const bottom = bands.slice().reverse().map((b) => `${x(b.level)},${y(b.p10)}`);
  parts.push(`<polygon class="band" points="${[...top, ...bottom].join(' ')}"/>`);
  parts.push(`<polyline class="median" points="${bands.map((b) => `${x(b.level)},${y(b.p50)}`).join(' ')}"/>`);

  if (keep.length) {
    // Step line: the keep threshold only changes at whole levels.
    const pts = [];
    keep.forEach((k, i) => {
      if (i > 0) pts.push(`${x(k.level)},${y(keep[i - 1].minKeep)}`);
      pts.push(`${x(k.level)},${y(k.minKeep)}`);
    });
    parts.push(`<polyline class="keep" points="${pts.join(' ')}"/>`);
  }
  if (!goal.impossible) {
    parts.push(`<line class="target" x1="${x(92)}" x2="${x(99)}" y1="${y(s.target)}" y2="${y(s.target)}"/>`,
      `<text x="${x(91)}" y="${y(s.target) + 4}" text-anchor="end">target ${s.target}</text>`);
  }
  parts.push(`<circle class="you" cx="${x(s.level)}" cy="${y(s[key])}" r="6"><title>You: level ${s.level}, ${STAT_LABELS[key]} ${s[key]}</title></circle>`);

  $('chart').innerHTML = `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="${STAT_LABELS[key]} by level">${parts.join('')}</svg>`;
}

function renderCheckpoints(s, goal, bands) {
  const label = STAT_LABELS[s.focus];
  $('checkpointTitle').textContent = `Keep checkpoints — ${label} ${s.target}${s.countEvo && !s.evolved ? ' after evolution' : ''}`;
  if (goal.impossible) {
    $('checkpointHint').textContent = 'Target is unreachable.';
    $('checkpoints').innerHTML = '';
    return;
  }
  $('checkpointHint').textContent = `Restart if ${label} is below this value at that level. `
    + `Median shown for comparison${s.evolved ? ' (stats include the evolution bonus)' : ''}.`;

  const levels = [2, 3, 4, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55, 60, 65, 70, 75, 80, 85, 90, 95, 98];
  if (s.level > 1 && s.level < 99 && !levels.includes(s.level)) levels.push(s.level);
  levels.sort((a, b) => a - b);
  const byLevel = new Map(goal.thresholds.map((t) => [t.level, t.minKeep]));

  const cls = (L) => (L === s.level ? ' class="current"' : '');
  $('checkpoints').innerHTML = [
    `<tr><th>Level</th>${levels.map((L) => `<th>${L}</th>`).join('')}</tr>`,
    `<tr><td>Keep if ≥</td>${levels.map((L) => `<td${cls(L)}>${byLevel.get(L) ?? '—'}</td>`).join('')}</tr>`,
    `<tr><td>Median</td>${levels.map((L) => `<td>${bands[L - 1].p50}</td>`).join('')}</tr>`,
  ].join('');
}

function renderGrades(h, s) {
  const rank = priorityRank(h);
  const g = gradeStats(s, s.level, { evolved: s.evolved, homun: h });
  const rows = g.rows.map((r) => `<tr class="${r.key === s.focus ? 'focus' : ''}">
      <td>#${rank[r.key]}</td>
      <td>${STAT_LABELS[r.key]}</td>
      <td class="${r.error ? 'bad-value' : ''}" title="${esc(r.error ?? '')}">${r.value}${r.error ? ' ⚠' : ''}</td>
      <td>${r.expected.toFixed(1)}</td>
      <td>${r.low}–${r.high}</td>
      <td>${ordinal(r.pct)}</td>
      <td>${gradeBadge(r.grade)}</td>
    </tr>`).join('');
  $('grades').innerHTML = `<tr><th>Priority</th><th>Stat</th><th>Yours</th><th>Average</th><th>80% range</th><th>Percentile</th><th>Grade</th></tr>${rows}`;

  const errors = g.rows.filter((r) => r.error);
  const weights = Object.entries(g.overall.weights).map(([k, w]) => `${w}×${STAT_LABELS[k]}`).join(' + ');
  $('overall').innerHTML = s.level === 1 && !s.evolved
    ? `Every ${h.name} starts with the same stats at level 1.`
    : `Build score (${weights}) = ${g.overall.value}, average ${g.overall.expected.toFixed(1)}: `
      + `${gradeBadge(g.overall.grade)} ${ordinal(g.overall.pct)} percentile`
      + (errors.length ? `<br><span class="warning">⚠ ${errors.map((r) => `${STAT_LABELS[r.key]} ${r.error}`).join('; ')}. Check that the right homunculus is selected and your level and stats are correct, or your server uses different growth rates.</span>` : '');
}

function projectedStats(h, s, withEvolution) {
  const out = {};
  for (const k of priorityOrder(h)) {
    let d = finalDist(k, s.level, s[k], { homun: h });
    if (withEvolution) d = convolve(d, evolutionDist(k, h));
    out[k] = { median: quantile(d, 0.5), lo: quantile(d, 0.1), hi: quantile(d, 0.9) };
  }
  return out;
}

const medians = (p) => Object.fromEntries(Object.entries(p).map(([k, v]) => [k, v.median]));

function renderProjection(h, s) {
  const lv99 = projectedStats(h, s, false);
  const evo = s.evolved ? null : projectedStats(h, s, true);
  const head = `<tr><th>Stat</th><th>Now</th><th>Lv 99 median</th><th>80% range</th>${evo ? '<th>+ evolution (median)</th>' : ''}</tr>`;
  const rows = priorityOrder(h).map((k) => `<tr class="${k === s.focus ? 'focus' : ''}">
      <td>${STAT_LABELS[k]}</td><td>${s[k]}</td><td>${lv99[k].median}</td>
      <td>${lv99[k].lo}–${lv99[k].hi}</td>${evo ? `<td>${evo[k].median}</td>` : ''}</tr>`).join('');
  $('projection').innerHTML = head + rows;
  return { lv99: medians(lv99), evo: evo && medians(evo) };
}

function renderCombat(h, s, proj) {
  const skillLevel = h.skill ? parseInt(s.skill, 10) : 0;
  const opts = { skillLevel, homun: h };
  const cols = [['Now', combatStats(s, s.level, opts)]];
  if (s.level < 99) cols.push(['Lv 99 median', combatStats(proj.lv99, 99, opts)]);
  if (proj.evo) cols.push(['+ evolution', combatStats(proj.evo, 99, opts)]);

  const rows = [
    ['Max HP', (c) => c.maxHp],
    ['Max SP', (c) => c.maxSp],
    ['ATK', (c) => `${c.atkMin} ~ ${c.atkMax}`],
    ['MATK', (c) => `${c.matkMin} ~ ${c.matkMax}`],
    ['DEF', (c) => `${c.defHard} + ${c.defSoft}`],
    ['MDEF', (c) => `${c.mdefHard} + ${c.mdefSoft}`],
    ['HIT', (c) => c.hit],
    ['FLEE', (c) => c.flee],
    ['ASPD', (c) => c.aspd],
    ['CRIT', (c) => c.crit],
  ];
  const b = skillBonus(h, skillLevel);
  const effects = [
    b.str && `+${b.str} STR`, b.int && `+${b.int} INT`, b.def && `+${b.def} DEF`,
    b.hpPct && `+${b.hpPct}% HP`, b.spPct && `+${b.spPct}% SP`,
  ].filter(Boolean);
  const note = effects.length ? ` <small>(${esc(h.skill.name)} ${effects.join(', ')})</small>` : '';
  $('combat').innerHTML = `<tr><th>Stat${note}</th>${cols.map(([n]) => `<th>${n}</th>`).join('')}</tr>`
    + rows.map(([n, f]) => `<tr><td>${n}</td>${cols.map(([, c]) => `<td>${f(c)}</td>`).join('')}</tr>`).join('');
}

function renderGrowthTable(h) {
  const odds = (k) => {
    const d = statGrowthDist(h.growth[k]);
    return [0, 1, 2, 3].map((g) => {
      const p = g - d.min >= 0 && g - d.min < d.p.length ? d.p[g - d.min] : 0;
      return `<td>${p ? `${Math.round(p * 1000) / 10}%` : '—'}</td>`;
    }).join('');
  };
  const avg = (k) => {
    const d = statGrowthDist(h.growth[k]);
    return d.p.reduce((s, p, i) => s + p * (d.min + i), 0).toFixed(2);
  };
  const evo = (k) => h.evolution[k].join('–');
  const stats = priorityOrder(h).filter((k) => STATS.includes(k));
  $('growthTable').innerHTML = `<tr><th>Stat</th><th>+0</th><th>+1</th><th>+2</th><th>+3</th><th>Avg / level</th><th>Evolution</th></tr>`
    + stats.map((k) => `<tr><td>${STAT_LABELS[k]}</td>${odds(k)}<td>${avg(k)}</td><td>+${evo(k)}</td></tr>`).join('')
    + ['hp', 'sp'].map((k) => `<tr><td>${STAT_LABELS[k]}</td><td colspan="4">${h.growth[k].join('–')} per level</td>`
      + `<td>${((h.growth[k][0] + h.growth[k][1]) / 2).toFixed(1)}</td><td>+${evo(k)}</td></tr>`).join('');
}

function render() {
  const h = homun();
  const s = readForm();
  $('countEvo').disabled = s.evolved;
  $('countEvoWrap').classList.toggle('disabled', s.evolved);
  $('countEvoText').textContent = `Count the evolution bonus (+${h.evolution[s.focus].join('–')} ${STAT_LABELS[s.focus]}) toward the target`;
  if (!validate(s)) return;
  save(s);

  const evolution = s.evolved ? 'evolved' : s.countEvo ? 'plan' : 'ignore';
  const goal = analyseGoal({
    key: s.focus, target: s.target, overhead: expBetween(1, parseInt($('restart').value, 10)), evolution,
    level: s.level, value: s[s.focus], homun: h,
  });
  const bands = levelBands(s.focus, { evolved: s.evolved, homun: h });

  renderVerdict(h, s, goal);
  renderChart(h, s, goal, bands);
  renderCheckpoints(s, goal, bands);
  renderGrades(h, s);
  renderCombat(h, s, renderProjection(h, s));
}

function selectHomunculus(key) {
  $('homun').value = key;
  applyHomunculus(HOMUNCULI[key]);
  writeForm(stateFor(key));
}

let timer;
const schedule = () => { clearTimeout(timer); timer = setTimeout(render, 60); };

$('restart').value = store.restart ?? '20';
selectHomunculus(store.selected);
$('form').addEventListener('input', (e) => { if (e.target.id !== 'homun') schedule(); });
$('form').addEventListener('change', (e) => {
  if (e.target.id === 'homun') { selectHomunculus(e.target.value); render(); } else schedule();
});
$('reset').addEventListener('click', () => {
  const s = readForm();
  const d = defaultsFor(homun());
  writeForm({ ...d, skill: s.skill, focus: s.focus, target: s.target, countEvo: s.countEvo });
  render();
});
render();
