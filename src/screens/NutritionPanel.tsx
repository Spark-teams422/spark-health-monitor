// Nutrition (Physical screen): the person's daily targets from NASA JSC 67378 / NASA-STD-3001 formulas, the EVA day,
// a meal plan by ISS menu category, and what was eaten against the target. Numbers: core/nutrition.ts + config.
import { InfoTip } from '../components/InfoTip'
import { Value } from '../components/Value'
import cfg from '../config/nutrition.json'
import { coverage } from '../core/nutrition'
import { crew, useSystem } from '../core/system'

const n0 = (x: number) => x.toLocaleString('en')
const range = (r: [number, number], u: string) => `${n0(r[0])}–${n0(r[1])} ${u}`

export function NutritionPanel({ crewId }: { crewId: string }) {
  const sys = useSystem()
  const c = crew.find((x) => x.id === crewId)!
  const n = sys.nutrition(crewId)
  const p = n.profile, t = n.today
  const iron = t.iron
  const eatenKcal = n.kcalPct ? (n.kcalPct.value / 100) * t.energy : null
  const af = p.af ?? cfg.defaultAF
  const askMenses = p.sex === 'female' && p.age < cfg.iron.ageLimit
  return (
    <section className="panel nutrition" aria-label="Nutrition">
      <div className="panel-head">
        <h2>Nutrition · {c.name}</h2>
        <InfoTip title="Nutrition targets">
          <span>Targets from NASA's exploration nutrition requirements (JSC 67378, up to 365 days) and NASA-STD-3001 Vol. 2: energy by the EER equation from sex, age, mass and height; +{cfg.evaKcalPerHour} kcal per EVA hour; protein {cfg.proteinGPerKg.join('–')} g/kg; fluid {cfg.fluid.mlPerKg} mL/kg, at least {n0(cfg.fluid.baseMl.male)} mL (men) / {n0(cfg.fluid.baseMl.female)} mL (women); carbohydrate {cfg.carbPct.join('–')} % and fat {cfg.fatPct.join('–')} % of energy.</span>
          <ul>
            <li>{cfg.iron.rule}</li>
            <li>{cfg.notes.intake}</li>
            {cfg.openItems.map((o) => <li key={o} className="muted">Open item: {o}</li>)}
            <li className="muted">Not a prescription; the real list needs the flight surgeon and a dietitian. The document read the NASA tables from a summary.</li>
          </ul>
        </InfoTip>
      </div>
      <div className="nu-profile">
        <span>{p.sex === 'female' ? 'Woman' : 'Man'}, {p.age} · <b className="num">{p.kg}</b> kg · <b className="num">{p.heightM.toFixed(2)}</b> m</span>
        <div className="seg" role="group" aria-label="Activity factor">
          {cfg.activityFactors.map((x) => <button key={x} aria-pressed={af === x} onClick={() => sys.setNutrition(crewId, { af: x })}>AF {x}</button>)}
        </div>
        {askMenses && (
          <div className="seg" role="group" aria-label="Menstruation suppressed">
            <span className="muted">Menstruation suppressed?</span>
            <button aria-pressed={p.menstruationSuppressed === true} onClick={() => sys.setNutrition(crewId, { menstruationSuppressed: true })}>Yes</button>
            <button aria-pressed={p.menstruationSuppressed === false} onClick={() => sys.setNutrition(crewId, { menstruationSuppressed: false })}>No</button>
          </div>
        )}
      </div>

      <div className="nu-top">
        <div className="nu-energy">
          <span className="eva-label">Energy today</span>
          <b className="num nu-big">{n0(t.energy)}</b> kcal
          <span className="muted">AF {af}{af !== 1.11 && ` · at AF 1.11: ${n0(t.energyAF111)}`}</span>
          {n.eva && <span className="nu-eva">EVA day {n.eva.day}: <b className="num">{n0(n.eva.energy)}</b> kcal (+{cfg.evaKcalPerHour} × 6.5 h)</span>}
        </div>
        <div className="nu-eaten">
          <span className="eva-label">Eaten (latest day)</span>
          {n.kcalPct ? <Value value={n.kcalPct.value} unit="% of need" status={sys.status('nutrition_kcal_pct', crewId)} size={11} /> : <span className="muted">—</span>}
          {eatenKcal !== null && <span className="muted num">≈ {n0(Math.round(eatenKcal))} of {n0(t.energy)} kcal</span>}
          {n.mealCount > 0 && <span className="muted">Logged today: {n.mealCount} meal{n.mealCount > 1 ? 's' : ''}{n.mealKcal ? ` · ${n0(n.mealKcal)} kcal (${Math.round(coverage(n.mealKcal, t.energy))} %)` : ''}</span>}
        </div>
        <div className="nu-eaten">
          <span className="eva-label">Fluid</span>
          {n.waterL ? <Value value={n.waterL.value} unit="L/day" status={sys.status('water_l', crewId)} size={11} /> : <span className="muted">—</span>}
          <span className="muted">target {n0(t.fluidMl)} mL{t.fluidBase ? ' (minimum applies)' : ''}</span>
          {n.massLoss && <span className="muted">Body mass {n.massLoss.value > 0 ? `−${n.massLoss.value}` : n.massLoss.value} % since launch</span>}
        </div>
      </div>

      <table className="nu-table">
        <thead><tr><th>Nutrient</th><th>Target today</th><th>Nutrient</th><th>Target today</th></tr></thead>
        <tbody>
          {(() => {
            const rows: [string, string, string?][] = [
              ['Protein', range(t.protein, 'g'), 'animal : plant ≤ 60 : 40'],
              ['Carbohydrate', range(t.carb, 'g'), `added sugar < ${cfg.addedSugarMaxPct} %`],
              ['Fat', range(t.fat, 'g')],
              ['Iron', iron.kind === 'ask' ? 'not set — answer above' : `${iron.kind === 'max' ? 'at most' : 'at least'} ${iron.mg} mg`, iron.why],
              ...cfg.targets.map((x): [string, string] => [x.label, `${x[p.sex]} ${x.unit}`]),
            ]
            const half = Math.ceil(rows.length / 2)
            return rows.slice(0, half).map((r, i) => {
              const r2 = rows[half + i]
              return (
                <tr key={r[0]}>
                  <td>{r[0]}</td><td className="num" data-ask={r[0] === 'Iron' && iron.kind === 'ask'}>{r[1]}{r[2] && <small> · {r[2]}</small>}</td>
                  <td>{r2?.[0]}</td><td className="num">{r2?.[1]}{r2?.[2] && <small> · {r2[2]}</small>}</td>
                </tr>
              )
            })
          })()}
        </tbody>
      </table>

      <div className="nu-meals">
        {t.meals.map((m) => (
          <div key={m.id} className="nu-meal">
            <b>{m.label}</b> <span className="num">{n0(m.kcal)} kcal</span>
            <span className="muted">{m.categories}</span>
            <span>{m.examples}</span>
          </div>
        ))}
      </div>
      <span className="muted note">{cfg.mealNote} {cfg.notes.sodium} {cfg.notes.vitD} Mass and height: fictional profiles (team nutrition document) or sample values; menstruation answers are sample data. <span className="tag">SIM</span></span>
    </section>
  )
}
