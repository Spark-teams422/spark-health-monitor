// Per-person nutrition targets (team document "Astronaut Nutrition List", NASA JSC 67378 and NASA-STD-3001 Vol. 2).
// Pure functions; numbers in config/nutrition.json. Targets only: intake alerts stay in the status engine.
import cfg from '../config/nutrition.json'

export interface NutritionProfile { sex: 'male' | 'female'; age: number; kg: number; heightM: number; af?: number; menstruationSuppressed?: boolean | null }

/** EER (kcal/day), 19 years and older. */
export function eer(p: NutritionProfile, af = p.af ?? cfg.defaultAF): number {
  const c = cfg.eer[p.sex]
  return c.a - c.age * p.age + af * (c.kg * p.kg + c.m * p.heightM)
}

/** Iron branch: a ceiling (men, women ≥ 50, suppressed menstruation), a floor, or unknown (ask the person). */
export function ironRule(p: NutritionProfile): { kind: 'max' | 'min' | 'ask'; mg: number | null; why: string } {
  const r = cfg.iron
  if (p.sex === 'male') return { kind: 'max', mg: r.maxMg, why: 'man' }
  if (p.age >= r.ageLimit) return { kind: 'max', mg: r.maxMg, why: `woman, ${r.ageLimit} or older` }
  if (p.menstruationSuppressed === true) return { kind: 'max', mg: r.maxMg, why: 'woman under 50, menstruation suppressed' }
  if (p.menstruationSuppressed === false) return { kind: 'min', mg: r.minMg, why: 'woman under 50, menstruation not suppressed' }
  return { kind: 'ask', mg: null, why: 'woman under 50: is menstruation suppressed? (not applied until answered)' }
}

/** Daily targets for one person; `evaHours` adds 200 kcal per EVA hour; carb and fat are shares of the total energy. */
export function targets(p: NutritionProfile, evaHours = 0) {
  const energy = eer(p) + cfg.evaKcalPerHour * evaHours
  const g = (pct: number, kcal: number) => (energy * pct) / 100 / kcal
  return {
    energy: Math.round(energy),
    energyAF111: Math.round(eer(p, 1.11)),
    protein: cfg.proteinGPerKg.map((x) => Math.round(x * p.kg)) as [number, number],
    carb: cfg.carbPct.map((x) => Math.round(g(x, cfg.kcalPerG.carb))) as [number, number],
    fat: cfg.fatPct.map((x) => Math.round(g(x, cfg.kcalPerG.fat))) as [number, number],
    fluidMl: Math.round(Math.max(cfg.fluid.mlPerKg * p.kg, cfg.fluid.baseMl[p.sex])),
    fluidBase: cfg.fluid.mlPerKg * p.kg < cfg.fluid.baseMl[p.sex],
    iron: ironRule(p),
    meals: cfg.meals.map((m) => ({ ...m, kcal: Math.round(energy * m.share) })),
  }
}

/** Share of the target eaten, % (document step 6). */
export const coverage = (eaten: number, target: number) => (eaten / target) * 100
