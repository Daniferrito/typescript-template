import { NS } from "@ns";
import { connectServer } from "./connect-server";
import { CityName, CompanyName, FactionName } from "./enums";
import { hasNecessarySkills } from "./jobsHandler";

export const hackingFactionServers = {
  CyberSec: "CSEC",
  NiteSec: "avmnite-02h",
  "The Black Hand": "I.I.I.I",
  BitRunners: "run4theh111z",
} satisfies Partial<Record<FactionName, string>>

const hackingFactions = Object.keys(hackingFactionServers) as FactionName[]

const extraFactionServers = {
  ECorp: "ecorp",
  MegaCorp: "megacorp",
  "KuaiGong International": "kuai-gong",
  "Four Sigma": "4sigma",
  NWO: "nwo",
  "Blade Industries": "blade",
  "Clarke Incorporated": "clarkinc",
  "OmniTek Incorporated": "omnitek",
  "Bachman & Associates": "b-and-a",
  "Fulcrum Secret Technologies": ["fulcrumtech", "fulcrumassets"],
} satisfies Partial<Record<FactionName, string | string[]>>

const allFactionServers = { ...hackingFactionServers, ...extraFactionServers } satisfies Partial<Record<FactionName, string | string[]>>

export const companyFactionCompanies = {
  ECorp: CompanyName.ECorp,
  MegaCorp: CompanyName.MegaCorp,
  "KuaiGong International": CompanyName.KuaiGongInternational,
  "Four Sigma": CompanyName.FourSigma,
  NWO: CompanyName.NWO,
  "Blade Industries": CompanyName.BladeIndustries,
  "Clarke Incorporated": CompanyName.ClarkeIncorporated,
  "OmniTek Incorporated": CompanyName.OmniTekIncorporated,
  "Bachman & Associates": CompanyName.BachmanAndAssociates,
  "Fulcrum Secret Technologies": CompanyName.FulcrumTechnologies,
} satisfies Partial<Record<FactionName, CompanyName>>

// Inverse of companyFactionCompanies
export const factionCompanies = Object.fromEntries(Object.entries(companyFactionCompanies).map(([faction, company]) => [company, faction])) as Partial<Record<CompanyName, FactionName>>

export const locationFactions = {
  "Sector-12": CityName.Sector12,
  "Chongqing": CityName.Chongqing,
  "Tian Di Hui": CityName.Chongqing,
  "New Tokyo": CityName.NewTokyo,
  "Ishima": CityName.Ishima,
  "Aevum": CityName.Aevum,
  "Volhaven": CityName.Volhaven,
} satisfies Partial<Record<FactionName, CityName>>

export const enemyFactions = {
  "Sector-12": [FactionName.Volhaven, FactionName.Chongqing, FactionName.NewTokyo, FactionName.Ishima],
  "Aevum": [FactionName.Volhaven, FactionName.Chongqing, FactionName.NewTokyo, FactionName.Ishima],
  "Chongqing": [FactionName.Volhaven, FactionName.Sector12, FactionName.Aevum],
  "New Tokyo": [FactionName.Volhaven, FactionName.Sector12, FactionName.Aevum],
  "Ishima": [FactionName.Volhaven, FactionName.Sector12, FactionName.Aevum],
  "Volhaven": [FactionName.Sector12, FactionName.Aevum, FactionName.Chongqing, FactionName.NewTokyo, FactionName.Ishima],
} satisfies Partial<Record<FactionName, FactionName[]>>

export const companyFactions = Object.keys(companyFactionCompanies) as FactionName[]

export const ALL_FACTIONS = Object.values(FactionName) as FactionName[]

export async function joinFactions(ns: NS): Promise<boolean> {
  let hadChanges = false;
  await backdoorFactionServers(ns)
  await moveToFactionsCities(ns)
  await applyToCompanyFactions(ns)
  await joinBladeBurnerFaction(ns)

  const invitations = ns.singularity.checkFactionInvitations()
  for (const faction of invitations) {
    // Only join factions that dont have enemies and that have augmentations we don't have yet, to avoid joining factions that we will never do anything with
    if (shouldJoinFaction(ns, faction)) {
      ns.print(`Joining faction ${faction}...`)
      if (ns.singularity.joinFaction(faction)) {
        hadChanges = true;
      }
    }
  }
  return hadChanges;
}

async function backdoorFactionServers(ns: NS): Promise<void> {
  for (const faction in allFactionServers) {
    let serverNames = allFactionServers[faction as keyof typeof allFactionServers]
    if (typeof serverNames === "string") {
      serverNames = [serverNames]
    }
    for (const serverName of serverNames) {
      const server = ns.getServer(serverName)
      const reqHack = server.requiredHackingSkill ?? 0
      if (ns.getPlayer().skills.hacking >= reqHack && server.hasAdminRights && !server.backdoorInstalled) {
        ns.print(`Backdooring ${server.hostname} for faction ${faction}...`)
        connectServer(ns, server.hostname)
        await ns.sleep(200)
        await ns.singularity.installBackdoor()
        await ns.sleep(200)
        ns.singularity.connect("home")
        await ns.sleep(200)
      }
    }
  }
}

async function moveToFactionsCities(ns: NS): Promise<void> {
  if (ns.getServerMoneyAvailable("home") < 1e7) {
    return
  }
  const invitations = ns.singularity.checkFactionInvitations()
  const player = ns.getPlayer()
  const joinedFactions = player.factions
  for (const faction in locationFactions) {
    const city = locationFactions[faction as keyof typeof locationFactions]
    const enemies = enemyFactions[faction as keyof typeof enemyFactions] as FactionName[] | null
    if ((!invitations.includes(faction) && !joinedFactions.includes(faction)) && shouldJoinFaction(ns, faction) && !joinedFactions.some(f => enemies?.includes(f as FactionName))) {
      ns.print(`Traveling to ${city} to join faction ${faction}...`)
      ns.singularity.travelToCity(city)
      ns.singularity.checkFactionInvitations()
      await ns.sleep(200)
    }
  }
}

async function applyToCompanyFactions(ns: NS): Promise<void> {
  const invitations = ns.singularity.checkFactionInvitations()
  const player = ns.getPlayer()
  const joinedFactions = player.factions
  for (const faction in companyFactionCompanies) {
    const company = companyFactionCompanies[faction as keyof typeof companyFactionCompanies]
    if (!invitations.includes(faction) && !joinedFactions.includes(faction) && shouldJoinFaction(ns, faction) && player.jobs[company as CompanyName] == null) {
      const jobNames = ns.singularity.getCompanyPositions(company)
      const jobs = jobNames
        .map(j => ns.singularity.getCompanyPositionInfo(company, j))
        .filter(j => hasNecessarySkills(ns.getPlayer(), j.requiredSkills))
      if (jobs.length === 0) {
        continue
      }
      ns.singularity.applyToCompany(company, jobs[0].field)
      await ns.sleep(200)
    }
  }
}

export function hasRemainingAugmentations(ns: NS, faction: string): boolean {
  const augmentations = ns.singularity.getAugmentationsFromFaction(faction)
  const ownedAugmentations = ns.singularity.getOwnedAugmentations(true)
  const unownedAugmentations = augmentations
    // Filter out augmentations we already have
    .filter(a => !ownedAugmentations.includes(a))
    // Filter out augmentations that other factions we are in have, as we can get those from those factions instead if we want them
    .filter(a => !otherJoinedFactionHasAugmentation(ns, a, faction))
    // Filter out augmentations that have unowned prerequisites that we dont have, and that no other faction we are in has either, and that the faction itself doesnt have either, as we wont be able to get those for a long time if we join this faction now
    .filter(a => !augmentationHasUnownedPrerequisites(ns, a, faction))
    // Filter out augmentations that we already have the rep for
    .filter(a => ns.singularity.getAugmentationRepReq(a) > ns.singularity.getFactionRep(faction) && ns.singularity.getFactionFavor(faction) < ns.getBitNodeMultipliers().RepToDonateToFaction * 150)
  return unownedAugmentations.length > 0
}

function otherJoinedFactionHasAugmentation(ns: NS, augmentation: string, faction: string): boolean {
  const factions = ns.singularity.getAugmentationFactions(augmentation)
  const player = ns.getPlayer()
  return factions.some(f => f !== faction && (player.factions.includes(f) || hackingFactions.includes(f as FactionName)))
}

// Returns true if the augmentation has prerequisites that we dont have, and that no other faction we are in has either, and that the passed faction itself doesnt have either
function augmentationHasUnownedPrerequisites(ns: NS, augmentation: string, faction: string): boolean {
  const prerequisites = ns.singularity.getAugmentationPrereq(augmentation)
  const ownedAugmentations = ns.singularity.getOwnedAugmentations(true)
  const player = ns.getPlayer()
  return prerequisites.some(p =>
    // We dont have the prerequisite
    !ownedAugmentations.includes(p) &&
    // No faction we are in has the prerequisite
    !player.factions.some(f => ns.singularity.getAugmentationFactions(p).includes(f)) &&
    // The faction we are looking at doesnt have the prerequisite either
    !ns.singularity.getAugmentationFactions(p).includes(faction)
  )
}

function factionHas150Favor(ns: NS, faction: string): boolean {
  const favor = ns.singularity.getFactionFavor(faction)
  const futureFavor = ns.singularity.getFactionFavorGain(faction)
  return favor + futureFavor >= ns.getBitNodeMultipliers().RepToDonateToFaction * 150
}

export function shouldJoinFaction(ns: NS, faction: string): boolean {
  if (faction === "CyberSec" && !factionHas150Favor(ns, "CyberSec")) {
    return true
  }
  // Dont join factions that only have augmentations that we already have, or that other factions we are in have, as we can get those from those factions instead if we want them
  if (!hasRemainingAugmentations(ns, faction)) {
    return false
  }
  // Dont join factions that have 150 favor, as we can just boost our rep with money
  if (factionHas150Favor(ns, faction)) {
    return false
  }
  return true
}

function joinBladeBurnerFaction(ns: NS) {
  if (!ns.bladeburner.inBladeburner() && !ns.bladeburner.joinBladeburnerDivision()) {
    return
  }
  ns.bladeburner.joinBladeburnerFaction()
}
