import { NS } from "@ns";
import { companyFactionCompanies, companyFactions, factionCompanies, hasRemainingAugmentations, shouldJoinFaction } from "./utils/factionHandling";
import { CityName, CompanyName, FactionName, UniversityClassType, UniversityLocationName } from "./utils/enums";

export async function main(ns: NS): Promise<void> {
  const hasFormulas = ns.fileExists("Formulas.exe", "home")
  const hasNeuroReceptorManager = ns.singularity.getOwnedAugmentations().includes("Neuroreceptor Management Implant")

  let isFirstTime = true
  for (; ;) {
    if (isFirstTime) {
      isFirstTime = false
    } else {
      await ns.sleep(hasNeuroReceptorManager ? 2 * 1000 : 2 * 60 * 1000)
    }
    const player = ns.getPlayer()
    const gang = ns.gang.getGangInformation()
    // If we have any faction work where we need reputation for unlocking new augmentations, do that first
    const factions = player.factions.reverse().filter(f => f !== gang.faction)
    const nonCompanyFactions = factions
      // Dont work for company factions yet, we want to unlock them all first
      .filter(f => companyFactions.find(cf => cf === f) === undefined)
    const faction = nonCompanyFactions.find(f => hasRemainingAugmentations(ns, f) && shouldJoinFaction(ns, f))
    if (faction) {
      const factionWorkTypes = ns.singularity.getFactionWorkTypes(faction).map(wt => ({ workType: wt, repGain: hasFormulas ? ns.formulas.work.factionGains(player, wt, 1).reputation : 0 })).sort((a, b) => b.repGain - a.repGain)
      if (factionWorkTypes.length > 0) {
        ns.singularity.workForFaction(faction, factionWorkTypes[0].workType, !hasNeuroReceptorManager)
        continue
      }
    }
    // Work for a company that we are in and that has a faction with augmentations we dont have yet
    const company = Object.keys(player.jobs).find(company => !player.factions.includes(factionCompanies[company as CompanyName] ?? "") && hasRemainingAugmentations(ns, factionCompanies[company as CompanyName] ?? "") && !ns.singularity.checkFactionInvitations().includes(factionCompanies[company as CompanyName] ?? ""))
    if (company) {
      ns.singularity.workForCompany(company as CompanyName, !hasNeuroReceptorManager)
      continue
    }

    const playerCompanyFactions = player.factions.reverse()
    const companyFaction = playerCompanyFactions.find(f => hasRemainingAugmentations(ns, f) && shouldJoinFaction(ns, f))
    if (companyFaction) {
      const factionWorkTypes = ns.singularity.getFactionWorkTypes(companyFaction).map(wt => ({ workType: wt, repGain: hasFormulas ? ns.formulas.work.factionGains(player, wt, 1).reputation : 0 })).sort((a, b) => b.repGain - a.repGain)
      if (factionWorkTypes.length > 0) {
        ns.singularity.workForFaction(companyFaction, factionWorkTypes[0].workType, !hasNeuroReceptorManager)
        continue
      }
    }

    const factionsWith150Favor = factions.filter(f => ns.singularity.getFactionFavor(f) >= 150)
    if (factionsWith150Favor.length === 0) {
      // Work for the faction with greatest favor that we are in
      const factionWithGreatestFavor = factions.map(f => ({ faction: f, favor: ns.singularity.getFactionFavor(f) })).sort((a, b) => b.favor - a.favor)[0]?.faction
      if (factionWithGreatestFavor) {
        const factionWorkTypes = ns.singularity.getFactionWorkTypes(factionWithGreatestFavor).map(wt => ({ workType: wt, repGain: hasFormulas ? ns.formulas.work.factionGains(player, wt, 1).reputation : 0 })).sort((a, b) => b.repGain - a.repGain)
        if (factionWorkTypes.length > 0) {
          ns.singularity.workForFaction(factionWithGreatestFavor, factionWorkTypes[0].workType, !hasNeuroReceptorManager)
          continue
        }
      }
    }

    if (player.skills.hacking < 1000) {
      // Study in whatever university we have access to
      if (ns.getServerMoneyAvailable("home") >= 10_000_000) {
        ns.singularity.travelToCity("Volhaven")
      }
      if (universitiesByCity[player.city as keyof typeof universitiesByCity]) {
        const location = universitiesByCity[player.city as keyof typeof universitiesByCity];
        if (ns.getServerMoneyAvailable("home") >= 1_000_000) {
          ns.singularity.universityCourse(location, UniversityClassType.algorithms, !hasNeuroReceptorManager);
        } else {
          ns.singularity.universityCourse(location, UniversityClassType.computerScience, !hasNeuroReceptorManager);
        }
        continue
      }
    }
    // Do crime
    ns.singularity.commitCrime("Homicide", !hasNeuroReceptorManager)
    // Nothing to do, just wait a bit
  }
}

const universitiesByCity = {
  "Aevum": UniversityLocationName.AevumSummitUniversity,
  "Sector-12": UniversityLocationName.Sector12RothmanUniversity,
  "Volhaven": UniversityLocationName.VolhavenZBInstituteOfTechnology,
} satisfies Partial<Record<CityName, UniversityLocationName>>

