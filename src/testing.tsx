import { NS } from "@ns";
import { CrimeType } from "./utils/enums";

export async function main(ns: NS): Promise<void> {
  ns.disableLog("ALL")
  ns.clearLog()
  ns.ui.openTail();

  const crimeTypes: CrimeType[] = [
    CrimeType.shoplift,
    CrimeType.robStore,
    CrimeType.mug,
    CrimeType.larceny,
    CrimeType.dealDrugs,
    CrimeType.bondForgery,
    CrimeType.traffickArms,
    CrimeType.homicide,
    CrimeType.grandTheftAuto,
    CrimeType.kidnap,
    CrimeType.assassination,
    CrimeType.heist
  ]

  const person = ns.getPlayer()

  const crimeStats = crimeTypes.map(crimeType => ({ crimeType, chance: ns.formulas.work.crimeSuccessChance(person, crimeType), stats: ns.singularity.getCrimeStats(crimeType) }))

  let bestCrime: CrimeType = CrimeType.homicide

  const objective: "money" | "karma" | "kills" | "intelligence" = "intelligence";

  switch (objective) {
    case "money":
      bestCrime = crimeStats.map(cs => ({ ...cs, score: cs.stats.money * cs.chance / cs.stats.time })).sort((a, b) => b.score - a.score)[0].crimeType
      break
    case "karma":
      bestCrime = crimeStats.map(cs => ({ ...cs, score: cs.stats.karma * cs.chance / cs.stats.time })).sort((a, b) => b.score - a.score)[0].crimeType
      break
    case "kills":
      bestCrime = crimeStats.map(cs => ({ ...cs, score: cs.stats.kills * cs.chance / cs.stats.time })).sort((a, b) => b.score - a.score)[0].crimeType
      break
    case "intelligence":
      // Change is marked that way because a failed attempt still gives half experience
      bestCrime = crimeStats.map(cs => ({ ...cs, score: cs.stats.intelligence_exp * ((1 + cs.chance) / 2) / cs.stats.time })).sort((a, b) => b.score - a.score)[0].crimeType
      break
  }

  ns.print(`Best crime for ${objective}: ${bestCrime}`)
  ns.print(JSON.stringify(crimeStats.map(cs => ({ type: cs.crimeType, score: cs.stats.intelligence_exp * ((1 + cs.chance) / 2) / cs.stats.time })).sort((a, b) => b.score - a.score)))
}
