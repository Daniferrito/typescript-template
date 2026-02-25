import { NS } from "@ns";
import { hasRemainingAugmentations, shouldJoinFaction } from "./utils/factionHandling";
import { CityName, CompanyName, UniversityClassType, UniversityLocationName } from "./utils/enums";

export async function main(ns: NS): Promise<void> {
  const hasFormulas = ns.fileExists("Formulas.exe", "home")
  const hasNeuroReceptorManager = ns.singularity.getOwnedAugmentations().includes("Neuroreceptor Management Implant")

  let isFirstTime = true
  for (; ;) {
    if (isFirstTime) {
      isFirstTime = false
    } else {
      await ns.sleep(2 * 60 * 1000)
    }
    const player = ns.getPlayer()
    // If we have any faction work where we need reputation for unlocking new augmentations, do that first
    const factions = player.factions.reverse()
    const faction = factions.find(f => hasRemainingAugmentations(ns, f) && shouldJoinFaction(ns, f))
    if (faction) {
      const factionWorkTypes = ns.singularity.getFactionWorkTypes(faction).map(wt => ({ workType: wt, repGain: hasFormulas ? ns.formulas.work.factionGains(player, wt, 1).reputation : 0 })).sort((a, b) => b.repGain - a.repGain)
      ns.singularity.workForFaction(faction, factionWorkTypes[0].workType, !hasNeuroReceptorManager)
      continue
    }
    // Work for a company that we are in and that has a faction with augmentations we dont have yet
    const company = Object.keys(player.jobs).find(company => ns.singularity.getCompanyRep(company as CompanyName) < 400_000)
    if (company) {
      ns.singularity.workForCompany(company as CompanyName, !hasNeuroReceptorManager)
      continue
    }
    // Study in whatever university we have access to
    if (ns.getServerMoneyAvailable("home") >= 10_000_000) {
      ns.singularity.travelToCity("Volhaven")
    }
    if (Object.prototype.hasOwnProperty.call(universitiesByCity, player.city)) {
      const location = universitiesByCity[player.city as keyof typeof universitiesByCity];
      ns.singularity.universityCourse(location, UniversityClassType.computerScience, !hasNeuroReceptorManager);
    }

    // Nothing to do, just wait a bit
  }
}

const universitiesByCity = {
  "Aevum": UniversityLocationName.AevumSummitUniversity,
  "Sector-12": UniversityLocationName.Sector12RothmanUniversity,
  "Volhaven": UniversityLocationName.VolhavenZBInstituteOfTechnology,
} satisfies Partial<Record<CityName, UniversityLocationName>>

