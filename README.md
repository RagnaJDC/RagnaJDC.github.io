# Homunculus Calculator

A calculator for the four pre-renewal Ragnarok Online homunculi: **Lif, Amistr, Filir and Vanilmirth**.
Enter your homunculus's level and stats and it tells you whether it's worth **keeping or restarting**, how
its stats compare with other homunculi of the same type and level, what it will probably look like at level
99, and its combat stats.

All growth odds come straight from the [Hercules](https://github.com/HerculesWS/Hercules) emulator source,
so the numbers match how the server actually levels your homunculus.

## How to use it

1. **Pick your homunculus** from the dropdown at the top. Its stat priorities are shown underneath.
2. **Enter its level and stats** from the homunculus window in game (`Alt+R`), or from `@homstats` if your
   server has it. Enter the stats *without* skill bonuses. If you have learned Change Instruction, Adamantium
   Skin or Brain Surgery, choose the skill level in the skill box and the calculator adds the bonus itself.
3. **Tick "Already evolved"** if it has evolved, so the evolution bonus is accounted for.
4. **Set your goal**: the stat you care about (its #1 stat by default) and the value you want at level 99.
   Tick "Count the evolution bonus" if you plan to evolve and want the bonus to count toward the target.
5. **Set how painful a restart is.** An Embryo only turns into the homunculus you want about 1 time in 4, so
   a restart usually costs several Embryos plus re-leveling time. The more a restart hurts, the more patient
   the advice becomes.

Results update as you type, and your inputs are saved in your browser separately for each homunculus.
Check again every few levels: the advice changes as your homunculus grows.

## Reading the results

- **Verdict**: *Keep*, *Restart*, *Evolve and see* (at level 99, when the evolution roll decides it) or
  *Target reached*. Underneath you'll see the chance this homunculus reaches your target, the keep line for
  its current level, its projected stat at 99, and the expected EXP cost of keeping versus restarting.
- **Growth chart**: the shaded band is where the middle 80% of homunculi of that type sit at each level, the
  blue line is the median, the green line is the keep line, and the white dot is you. Above the green line
  means keep.
- **Keep checkpoints**: the minimum goal stat worth keeping at each level. Restart if you're below it.
- **Stat grades**: each stat's percentile against every homunculus of the same type and level (S = top 10%,
  A = top 30%, B = middle 40%, C = bottom 30%, D = bottom 10%). The **build score** weights the six stats
  by priority (#1 counts 6×, down to 1× for #6) and grades the whole build.
- **Level 99 projection**: the most likely value of each stat at 99, the likely range, and the result after
  evolution.
- **Combat stats**: ATK, MATK, DEF, MDEF, HIT, FLEE, ASPD, Max HP and Max SP now, at 99, and after
  evolution, including your passive skill bonuses.

A **"Check your numbers"** warning means a stat is impossible for that homunculus at that level. Usually the
wrong homunculus or level is selected, or skill bonuses were included in the stats.

## Stat priorities

| Homunculus | Priority                                    | Default goal at Lv 99 | Chance for a fresh one |
|------------|---------------------------------------------|-----------------------|------------------------|
| Lif        | INT & SP › AGI › VIT & HP › DEX › STR › LUK | INT 115               | 3.4%                   |
| Amistr     | VIT & HP › AGI › STR › DEX › INT & SP › LUK | VIT 115               | 3.4%                   |
| Filir      | AGI › STR › DEX › VIT & HP › INT & SP › LUK | AGI 135               | 2.6%                   |
| Vanilmirth | INT & SP › VIT & HP › AGI › DEX › STR › LUK | INT 140               | 0.8%                   |

HP and SP are grouped with the stat whose role they share, but they're separate rolls: VIT doesn't raise a
homunculus's Max HP and INT doesn't raise its Max SP.

## How it works

### Stat growth

Every level, each stat rolls a random number within the homunculus's growth range (in tenths of a point) and
the server throws away the fraction. For Vanilmirth that means each stat gains:

| Gain | Chance  |
|------|---------|
| +0   | 9 / 30  |
| +1   | 10 / 30 |
| +2   | 10 / 30 |
| +3   | 1 / 30  |

That averages +1.1 per level. Lif, Amistr and Filir never gain more than +2 in a level, and their odds
differ per stat. The page's "How the math works" section shows the full table for the selected homunculus.
HP and SP grow by a random whole number each level. Evolution adds a one-time bonus to every stat, and the
evolved form keeps the same growth odds, so when you evolve doesn't change the final result.

All chances on the page are calculated exactly from these odds, not estimated from averages.

### Keep or restart

The advice picks whichever option means spending the least total homunculus EXP before you own a level 99
homunculus that meets your goal, counting your restart cost. At each level it compares keeping this one
(and restarting later if it falls behind) with starting over now. The **keep line** is the lowest stat at
which keeping is the cheaper choice.

The first 20 levels together cost less EXP than a single late level, so the keep line is strict early and
relaxes later. Restarting early is cheap; restarting at level 80 throws away a lot.

### Combat stats

- ATK: `STR + (STR/10)²` plus a hit roll from `DEX` (capped at the maximum) to `STR + Level`
- MATK: `INT + (INT/7)²` to `INT + (INT/5)²`
- DEF: `Level/10 + VIT/5` hard DEF, plus `VIT` soft DEF
- MDEF: `Level/10 + INT/5` hard MDEF, plus `INT + VIT/2` soft MDEF
- HIT: `Level + DEX`; FLEE: `Level + AGI`
- ASPD: from AGI and DEX, base attack delay 700
- Change Instruction (Vanilmirth): extra STR and INT
- Adamantium Skin (Amistr): +4 DEF and +2% Max HP per level
- Brain Surgery (Lif): extra Max SP %
- Crit: 0, because homunculi can't crit on default server settings

Servers with custom homunculus growth tables or settings will give different results.
