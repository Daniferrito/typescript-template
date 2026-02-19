/* eslint-disable no-case-declarations */
import { NS, Player, PlayerRequirement } from "@ns";
import { neverReached } from "./utils";
import { connectServer } from "./connect-server";

export enum FactionName {
  Illuminati = "Illuminati",
  Daedalus = "Daedalus",
  TheCovenant = "The Covenant",
  ECorp = "ECorp",
  MegaCorp = "MegaCorp",
  BachmanAssociates = "Bachman & Associates",
  BladeIndustries = "Blade Industries",
  NWO = "NWO",
  ClarkeIncorporated = "Clarke Incorporated",
  OmniTekIncorporated = "OmniTek Incorporated",
  FourSigma = "Four Sigma",
  KuaiGongInternational = "KuaiGong International",
  FulcrumSecretTechnologies = "Fulcrum Secret Technologies",
  BitRunners = "BitRunners",
  TheBlackHand = "The Black Hand",
  NiteSec = "NiteSec",
  Aevum = "Aevum",
  Chongqing = "Chongqing",
  Ishima = "Ishima",
  NewTokyo = "New Tokyo",
  Sector12 = "Sector-12",
  Volhaven = "Volhaven",
  SpeakersForTheDead = "Speakers for the Dead",
  TheDarkArmy = "The Dark Army",
  TheSyndicate = "The Syndicate",
  Silhouette = "Silhouette",
  Tetrads = "Tetrads",
  SlumSnakes = "Slum Snakes",
  Netburners = "Netburners",
  TianDiHui = "Tian Di Hui",
  CyberSec = "CyberSec",
  Bladeburners = "Bladeburners",
  ChurchOfTheMachineGod = "Church of the Machine God",
  ShadowsOfAnarchy = "Shadows of Anarchy",
}

export const allFactions = Object.values(FactionName)

export async function __joinFactions(ns: NS): Promise<boolean> {
  let hadChanges = false;

  for (const faction of allFactions) {
    const requirements = ns.singularity.getFactionInviteRequirements(faction)
    for (const requirement of requirements) {
      if (! await meetsRequirement(ns, requirement)) {
        break
      }
    }
  }
  const invitations = ns.singularity.checkFactionInvitations()
  for (const faction of invitations) {
    if (ns.singularity.getFactionEnemies(faction).length === 0) {
      ns.singularity.joinFaction(faction)
      hadChanges = true;
    }
  }

  return hadChanges;
}

async function meetsRequirement(ns: NS, requirement: PlayerRequirement, tryFulfill = false): Promise<boolean> {
  const player = ns.getPlayer()
  switch (requirement.type) {
    case "money":
      return ns.getServerMoneyAvailable("home") >= requirement.money
    case "backdoorInstalled":
      const server = ns.getServer(requirement.server)
      if (tryFulfill && (!server.backdoorInstalled && (server.requiredHackingSkill ?? 0) <= player.skills.hacking)) {
        connectServer(ns, requirement.server)
        await ns.singularity.installBackdoor()
      }
      return server.backdoorInstalled ?? false
    case "bitNodeN":
      return ns.getResetInfo().currentNode === requirement.bitNodeN
    case "bladeburnerRank":
      return ns.bladeburner.getRank() >= requirement.bladeburnerRank
    case "city":
      if (tryFulfill) {
        ns.singularity.travelToCity(requirement.city)
      }
      return player.city === requirement.city
    case "companyReputation":
      return ns.singularity.getCompanyRep(requirement.company) >= requirement.reputation
    case "employedBy":
      if (tryFulfill) {
        const jobTypes = ns.singularity.getCompanyPositions(requirement.company)
        if (jobTypes.length === 0) {
          return false
        }
        const jobInfo = ns.singularity.getCompanyPositionInfo(requirement.company, jobTypes[0])
        if (jobInfo == null) {
          return false
        }
        ns.singularity.applyToCompany(requirement.company, jobInfo.field)
      }
      return player.jobs[requirement.company] != null
    case "skills":
      for (const skillName in requirement.skills) {
        const skill = skillName as keyof Player["skills"]
        if (player.skills[skill] < (requirement.skills[skill] ?? 0)) {
          return false
        }
      }
      return true
    case "everyCondition":
      for (const subRequirement of requirement.conditions) {
        if (!await meetsRequirement(ns, subRequirement, tryFulfill)) {
          return false
        }
      }
      return true
    case "file":
      return ns.fileExists(requirement.file)
    case "hacknetCores":
      let totalCores = 0
      for (let i = 0; i < ns.hacknet.numNodes(); i++) {
        totalCores += ns.hacknet.getNodeStats(i).cores
      }
      return totalCores >= requirement.hacknetCores
    case "hacknetLevels":
      let totalLevels = 0
      for (let i = 0; i < ns.hacknet.numNodes(); i++) {
        totalLevels += ns.hacknet.getNodeStats(i).level
      }
      return totalLevels >= requirement.hacknetLevels
    case "hacknetRAM":
      let totalRAM = 0
      for (let i = 0; i < ns.hacknet.numNodes(); i++) {
        totalRAM += ns.hacknet.getNodeStats(i).ram
      }
      return totalRAM >= requirement.hacknetRAM
    case "jobTitle":
      return Object.values(player.jobs).some((job) => job === requirement.jobTitle)
    case "karma":
      return player.karma <= requirement.karma
    case "location":
      if (tryFulfill) {
        // ns.singularity.travelToLocation(requirement.location)
      }
      return player.location === requirement.location
    case "not":
      return !await meetsRequirement(ns, requirement.condition, false)
    case "numAugmentations":
      return ns.singularity.getOwnedAugmentations().length >= requirement.numAugmentations
    case "numInfiltrations":
      return false // TODO: implement
    case "numPeopleKilled":
      return player.numPeopleKilled >= requirement.numPeopleKilled
    case "someCondition":
      for (const subRequirement of requirement.conditions) {
        if (await meetsRequirement(ns, subRequirement, tryFulfill)) {
          return true
        }
      }
      return false
    case "sourceFile":
      return ns.singularity.getOwnedSourceFiles().some(sf => sf.n === requirement.sourceFile)
    default:
      neverReached(requirement)
  }
}

// type MapKey<BaseType> = BaseType extends Map<infer KeyType, unknown> ? KeyType : never;
// type MapValue<BaseType> = BaseType extends Map<unknown, infer ValueType> ? ValueType : never;

// type _ArrayEntry<BaseType extends readonly unknown[]> = [number, BaseType[number]];
// type _MapEntry<BaseType> = [MapKey<BaseType>, MapValue<BaseType>];
// type _ObjectEntry<BaseType> = [keyof BaseType, BaseType[keyof BaseType]];
// type _SetEntry<BaseType> = BaseType extends Set<infer ItemType> ? [ItemType, ItemType] : never;

// type ArrayEntries<BaseType extends readonly unknown[]> = Array<_ArrayEntry<BaseType>>;
// type MapEntries<BaseType> = Array<_MapEntry<BaseType>>;
// type ObjectEntries<BaseType> = Array<_ObjectEntry<BaseType>>;
// type SetEntries<BaseType extends Set<unknown>> = Array<_SetEntry<BaseType>>;

// type Entries<BaseType> =
//   BaseType extends Map<unknown, unknown> ? MapEntries<BaseType>
//   : BaseType extends Set<unknown> ? SetEntries<BaseType>
//   : BaseType extends readonly unknown[] ? ArrayEntries<BaseType>
//   : BaseType extends object ? ObjectEntries<BaseType>
//   : never;

