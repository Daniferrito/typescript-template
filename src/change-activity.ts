/* eslint-disable no-case-declarations */
import { BladeburnerActionTypeForSleeve, BladeburnerBlackOpName, BladeburnerContractName, BladeburnerCurAction, BladeburnerGeneralActionName, BladeburnerOperationName, CompanyWorkTask, CreateProgramWorkTask, CrimeTask, FactionWorkTask, GangGenInfo, GraftingTask, NS, Player, SleeveBladeburnerTask, SleeveInfiltrateTask, SleevePerson, SleeveRecoveryTask, SleeveSupportTask, SleeveSynchroTask, SleeveTask, StudyTask, Task } from "@ns";
import { ALL_FACTIONS, companyFactions, factionCompanies, hasRemainingAugmentations, shouldJoinFaction } from "./utils/factionHandling";
import { CityName, CompanyName, CrimeType, GymLocationName, GymType, LocationName, UniversityClassType, UniversityLocationName } from "./utils/enums";
import { neverReached } from "./utils/utils";

let hasNeuroReceptorManager = false
let player: Player
let gang: GangGenInfo | null

export async function main(ns: NS): Promise<void> {
  ns.disableLog("disableLog")
  ns.disableLog("getServerMoneyAvailable")
  ns.disableLog("asleep")
  ns.disableLog("sleeve.setToFactionWork")
  ns.disableLog("bladeburner.setTeamSize")
  hasNeuroReceptorManager = ns.singularity.getOwnedAugmentations().includes("Neuroreceptor Management Implant")

  let isFirstTime = true
  for (; ;) {
    if (isFirstTime) {
      isFirstTime = false
    } else {
      const promises: Promise<unknown>[] = [
        ns.asleep(hasNeuroReceptorManager ? 10 * 1000 : 2 * 60 * 1000),
      ]
      if (ns.bladeburner.inBladeburner() && ns.bladeburner.getCurrentAction() !== null) {
        promises.push(ns.bladeburner.nextUpdate())
      }
      await Promise.race(promises)
      await ns.sleep(100)
    }
    hasNeuroReceptorManager = hasNeuroReceptorManager || !ns.singularity.isFocused()
    player = ns.getPlayer()
    gang = ns.gang.inGang() ? ns.gang.getGangInformation() : null
    const currentActivity = ns.singularity.getCurrentWork()
    const currentBBActivity = ns.bladeburner.inBladeburner() ? ns.bladeburner.getCurrentAction() : null

    const tasks = decideTask(ns, player)

    for (const task of tasks) {
      if (doTask(ns, player, task, currentActivity, -1, currentBBActivity)) {
        break
      }
    }
    const numSleeves = 6;//ns.sleeve.getNumSleeves()
    for (let i = 0; i < numSleeves; i++) {
      const sleeve = ns.sleeve.getSleeve(i)
      const sleeveTask = ns.sleeve.getTask(i)
      const tasks = decideTask(ns, sleeve, i)
      for (const task of tasks) {
        if (doTask(ns, sleeve, task, sleeveTask, i)) {
          break
        }
      }
    }
  }
}
interface GeneralBladeburnerTask {
  type: "BLADEBURNER";
  actionType: "General";
  actionName: BladeburnerGeneralActionName;
}
interface ContractBladeburnerTask {
  type: "BLADEBURNER";
  actionType: "Contracts";
  actionName: BladeburnerContractName;
}
interface OperationBladeburnerTask {
  type: "BLADEBURNER";
  actionType: "Operations";
  actionName: BladeburnerOperationName;
}
interface BlackOpBladeburnerTask {
  type: "BLADEBURNER";
  actionType: "Black Operations";
  actionName: BladeburnerBlackOpName;
}

type ExtendedBladeburnerTask =
  | GeneralBladeburnerTask
  | ContractBladeburnerTask
  | OperationBladeburnerTask
  | BlackOpBladeburnerTask;

interface SleeveExtendedBladeburnerTask {
  type: "BLADEBURNER",
  actionName: BladeburnerActionTypeForSleeve,
  contract?: BladeburnerContractName,
}

type PlayerTask =
  | StudyTask
  | CompanyWorkTask
  | CreateProgramWorkTask
  | CrimeTask
  | FactionWorkTask
  | GraftingTask
  | ExtendedBladeburnerTask;
type MySleeveTask =
  | SleeveExtendedBladeburnerTask
  | StudyTask
  | CompanyWorkTask
  | CrimeTask
  | FactionWorkTask
  | SleeveInfiltrateTask
  | SleeveRecoveryTask
  | SleeveSupportTask
  | SleeveSynchroTask;

type MyPerson = Player | SleevePerson
type PersonTask<T> =
  T extends Player ? PlayerTask :
  MySleeveTask

function decideTask<T extends MyPerson>(ns: NS, person: T, sleeveNumber = -1): PersonTask<T>[] {
  const tasks: PersonTask<T>[] = []
  const isPlayer = "karma" in person

  if (!isPlayer) {
    // Shock recovery until 0 shock
    if (person.shock > 95) {
      tasks.push({
        type: "RECOVERY",
      } as PersonTask<T>)
    }
    // Sync until 100 sync
    if (person.sync < 1) {
      tasks.push({
        type: "SYNCHRO",
      } as PersonTask<T>)
    }
    // Do crime for karma until we have -54k karma
    if (player.karma > -54000) {
      tasks.push(bestCrime(ns, person, "karma"))
    }
  } else if (!ns.bladeburner.inBladeburner()) {
    for (const statName of ["strength", "defense", "dexterity", "agility"] as const) {
      if (person.skills[statName] < 100) {
        // Study in whatever university we have access to
        if (ns.getServerMoneyAvailable("home") >= 10_000_000) {
          // ns.singularity.travelToCity("Volhaven")
          person.city = CityName.Sector12
        }
        const gym = gymsByCity[person.city as keyof typeof gymsByCity]
        if (gym) {
          tasks.push({
            type: "CLASS",
            classType: GymType[statName],
            location: gym,
            cyclesWorked: 0
          })
        }
      }
    }
  }

  if (isPlayer && ns.bladeburner.inBladeburner()) {
    const [currStamina, maxStamina] = ns.bladeburner.getStamina()
    if (currStamina * 1.4 > maxStamina && person.hp.current * 1.4 > person.hp.max) {
      const outputs = [];
      const types = isPlayer ? ["General", "Contracts", "Operations", "Black Operations"] as const : ["General", "Contracts"] as const
      for (const type of types) {
        const names = type === "General" ? ns.bladeburner.getGeneralActionNames() :
          type === "Contracts" ? ns.bladeburner.getContractNames() :
            type === "Operations" ? ns.bladeburner.getOperationNames() :
              type === "Black Operations" ? ns.bladeburner.getBlackOpNames() :
                neverReached(type)
        for (const name of names) {
          ns.bladeburner.setTeamSize(type, name, 0)
          const successChances = ns.bladeburner.getActionEstimatedSuccessChance(type, name)
          const remaining = ns.bladeburner.getActionCountRemaining(type, name)
          const result = ns.bladeburner.getActionRepGain(type, name)
          const time = ns.bladeburner.getActionTime(type, name)
          if (successChances[0] < 0.4 || successChances[1] < 0.7) {
            continue
          }
          outputs.push({
            type,
            name,
            result: result * successChances[0] / time,
            remaining,
          })
        }
      }

      outputs.sort((a, b) => b.result - a.result)
      for (const output of outputs) {
        if (output.result > 0 && output.remaining >= 1) {
          tasks.push({
            type: "BLADEBURNER",
            actionType: output.type,
            actionName: output.name,
          } as PersonTask<T>)
        }
      }

    } else {
      tasks.push({
        type: "BLADEBURNER",
        actionType: "General",
        actionName: "Hyperbolic Regeneration Chamber",
      } as ExtendedBladeburnerTask as PersonTask<T>)
    }
  }


  const factions = player.factions.reverse().filter(f => f !== gang?.faction)
  // Work for non-company factions that have augmentations we dont have yet and that we should join
  const nonCompanyFactions = factions
    // Dont work for company factions yet, we want to unlock them all first
    .filter(f => companyFactions.find(cf => cf === f) === undefined)
    .filter(f => hasRemainingAugmentations(ns, f) && shouldJoinFaction(ns, f))
  for (const faction of nonCompanyFactions) {
    const task = decideFactionWork(ns, person, faction)
    if (task) {
      tasks.push(task)
    }
  }
  // Work for a company that we are in and that has a faction with augmentations we dont have yet
  const companies = Object.keys(player.jobs)
    .filter(company =>
      !player.factions.includes(factionCompanies[company as CompanyName] ?? "") &&
      hasRemainingAugmentations(ns, factionCompanies[company as CompanyName] ?? "") &&
      !ns.singularity.checkFactionInvitations().includes(factionCompanies[company as CompanyName] ?? "")
    )
  for (const company of companies) {
    tasks.push({
      type: "COMPANY",
      companyName: company as CompanyName,
      cyclesWorked: 0
    })
  }
  // Work for a faction that we are in and that has augmentations we dont have yet
  const playerCompanyFactions = player.factions.reverse()
    .filter(f => hasRemainingAugmentations(ns, f) && shouldJoinFaction(ns, f))
  for (const faction of playerCompanyFactions) {
    const task = decideFactionWork(ns, person, faction)
    if (task) {
      tasks.push(task)
    }
  }

  const factionsWith150Favor = ALL_FACTIONS.filter(f => ns.singularity.getFactionFavor(f) >= ns.getBitNodeMultipliers().RepToDonateToFaction)
  if (factionsWith150Favor.length === 0) {
    const factionWithGreatestFavor = factions.map(f => ({ faction: f, favor: ns.singularity.getFactionFavor(f) })).sort((a, b) => b.favor - a.favor)[0]?.faction
    if (factionWithGreatestFavor) {
      const task = decideFactionWork(ns, person, factionWithGreatestFavor)
      if (task) {
        tasks.push(task)
      }
    }
  }

  if (isPlayer) {
    if (person.skills.hacking < 100) {
      // Study in whatever university we have access to
      if (ns.getServerMoneyAvailable("home") >= 10_000_000) {
        // ns.singularity.travelToCity("Volhaven")
        person.city = CityName.Volhaven
      }
      if (universitiesByCity[person.city as keyof typeof universitiesByCity]) {
        const location = universitiesByCity[person.city as keyof typeof universitiesByCity];
        if (ns.getServerMoneyAvailable("home") >= 1_000_000) {
          tasks.push({
            type: "CLASS",
            classType: UniversityClassType.algorithms,
            location,
            cyclesWorked: 0
          })
        } else {
          tasks.push({
            type: "CLASS",
            classType: UniversityClassType.computerScience,
            location,
            cyclesWorked: 0
          })
        }
      }
    }
    for (const statName of ["strength", "defense", "dexterity", "agility"] as const) {
      if (person.skills[statName] < 850) {
        // Study in whatever university we have access to
        if (ns.getServerMoneyAvailable("home") >= 10_000_000) {
          // ns.singularity.travelToCity("Volhaven")
          person.city = CityName.Sector12
        }
        const gym = gymsByCity[person.city as keyof typeof gymsByCity]
        if (gym) {
          tasks.push({
            type: "CLASS",
            classType: GymType[statName],
            location: gym,
            cyclesWorked: 0
          })
        }
      }
    }
  }

  if (player.karma > -54000) {
    tasks.push(bestCrime(ns, person, "karma"))
  }

  if (!isPlayer && ns.bladeburner.inBladeburner()) {
    // Recruit
    const recruitChance = ns.bladeburner.getActionEstimatedSuccessChance("General", "Recruitment", sleeveNumber)
    if (recruitChance[0] > 0.7) {
      tasks.push({
        type: "BLADEBURNER",
        actionName: "Recruitment",
      } as SleeveExtendedBladeburnerTask as PersonTask<T>)
    }
    if (sleeveNumber === 2 || sleeveNumber === 3) {
      tasks.push({
        type: "INFILTRATE",
      } as PersonTask<T>)
    }


  }


  // Do crime for money
  tasks.push(
    bestCrime(ns, person, "karma")
  )

  return tasks as PersonTask<T>[]
}

function doTask(ns: NS, person: MyPerson, task: PlayerTask | MySleeveTask, currentTask: Task | SleeveTask | null, sleeveNumber = -1, currentBBActivity?: BladeburnerCurAction | null): boolean {
  try {
    // If currentTask is the same as task, do nothing and return true
    if (tasksAreEqual(currentTask, task)) {
      return true
    }
    if (currentTask?.type === "GRAFTING") {
      return true
    }
    if (isBladeburnerTask(task) &&
      (
        (currentBBActivity != null && currentBBActivity.name === task.actionName)
        ||
        (isBladeburnerTask(currentTask) && currentTask.actionName === task.actionName))
    ) {
      return true
    }
    if (currentBBActivity != null && ns.bladeburner.getActionCurrentTime() > 5 * 1000) {
      return false
    }

    switch (task.type) {
      case "RECOVERY":
        return ns.sleeve.setToShockRecovery(sleeveNumber)
      case "SYNCHRO":
        return ns.sleeve.setToSynchronize(sleeveNumber)
      case "SUPPORT":
        return false
      case "BLADEBURNER":
        if (sleeveNumber === -1) {
          const personTask = task as ExtendedBladeburnerTask
          return ns.bladeburner.startAction(personTask.actionType, personTask.actionName)
        } else {
          const sleeveTask = task as SleeveExtendedBladeburnerTask
          return ns.sleeve.setToBladeburnerAction(sleeveNumber, sleeveTask.actionName)
        }
      case "INFILTRATE":
        return ns.sleeve.setToBladeburnerAction(sleeveNumber, "Infiltrate Synthoids")
      case "COMPANY":
        if (sleeveNumber === -1) {
          return ns.singularity.workForCompany(task.companyName, !hasNeuroReceptorManager)
        } else {
          return ns.sleeve.setToCompanyWork(sleeveNumber, task.companyName)
        }
      case "FACTION":
        if (sleeveNumber === -1) {
          return ns.singularity.workForFaction(task.factionName, task.factionWorkType, !hasNeuroReceptorManager)
        } else {
          return ns.sleeve.setToFactionWork(sleeveNumber, task.factionName, task.factionWorkType) ?? false
        }
      case "CLASS":
        const city = classCity.find(([, ul]) => ul === task.location)?.[0] as CityName | undefined
        if (!city) {
          return false
        }
        if (sleeveNumber === -1) {
          if (person.city !== city) {
            ns.singularity.travelToCity(city)
          }
          if (isUniversityTaskClass(task)) {
            return ns.singularity.universityCourse(task.location, task.classType, !hasNeuroReceptorManager)
          } else if (isGymTaskClass(task)) {
            return ns.singularity.gymWorkout(task.location, task.classType, !hasNeuroReceptorManager)
          } else {
            return false
          }
        } else {
          if (person.city !== city) {
            ns.sleeve.travel(sleeveNumber, city)
          }
          if (isUniversityTaskClass(task)) {
            return ns.sleeve.setToUniversityCourse(sleeveNumber, task.location, task.classType)
          } else if (isGymTaskClass(task)) {
            return ns.sleeve.setToGymWorkout(sleeveNumber, task.location, task.classType)
          } else {
            return false
          }
        }
      case "CREATE_PROGRAM":
        // return ns.singularity.createProgram(task.programName)
        return false
      case "CRIME":
        if (sleeveNumber === -1) {
          ns.singularity.commitCrime(task.crimeType, !hasNeuroReceptorManager)
          return true
        } else {
          return ns.sleeve.setToCommitCrime(sleeveNumber, task.crimeType) ?? false
        }
      case "GRAFTING":
        // return ns.grafting.graftAugmentation(task.augmentation)
        return false
      default:
        neverReached(task)
    }
  } catch (e) {
    return false
  }
}

function tasksAreEqual(task1: Task | SleeveTask | null, task2: PlayerTask | MySleeveTask): boolean {
  if (task1?.type !== task2.type) {
    return false
  }
  switch (task1.type) {
    case "RECOVERY":
    case "SYNCHRO":
    case "SUPPORT":
      return true
    case "CRIME":
      return isCrimeTask(task2) && task1.crimeType === task2.crimeType
    case "FACTION":
      return isFactionWorkTask(task2) && task1.factionName === task2.factionName && task1.factionWorkType === task2.factionWorkType
    case "COMPANY":
      return isCompanyWorkTask(task2) && task1.companyName === task2.companyName
    case "CLASS":
      return isStudyTask(task2) && task1.classType === task2.classType && task1.location === task2.location
    case "CREATE_PROGRAM":
      return isCreateProgramWorkTask(task2) && task1.programName === task2.programName
    case "GRAFTING":
      return isGraftingTask(task2) && task1.augmentation === task2.augmentation
    case "BLADEBURNER":
      return isBladeburnerTask(task2) && task1.actionName === task2.actionName
    case "INFILTRATE":
      return true
    default:
      neverReached(task1)
  }
}

function decideFactionWork(ns: NS, person: MyPerson, faction: string): FactionWorkTask | null {
  const factionWorkTypes = ns.singularity.getFactionWorkTypes(faction)
    .map(wt => ({ workType: wt, repGain: ns.formulas.work.factionGains(person, wt, 1).reputation })).sort((a, b) => b.repGain - a.repGain)
  if (factionWorkTypes.length === 0) {
    return null
  }
  return {
    type: "FACTION",
    factionName: faction,
    factionWorkType: factionWorkTypes[0].workType,
    cyclesWorked: 0
  }
}

const universitiesByCity = {
  "Aevum": LocationName.AevumSummitUniversity,
  "Sector-12": LocationName.Sector12RothmanUniversity,
  "Volhaven": LocationName.VolhavenZBInstituteOfTechnology,
} satisfies Partial<Record<CityName, LocationName>>

const gymsByCity = {
  "Aevum": LocationName.AevumCrushFitnessGym,
  "Sector-12": LocationName.Sector12PowerhouseGym,
  "Volhaven": LocationName.VolhavenMilleniumFitnessGym,
} satisfies Partial<Record<CityName, LocationName>>

const classCity = [
  ...(Object.entries(universitiesByCity) as [CityName, LocationName][]),
  ...(Object.entries(gymsByCity) as [CityName, LocationName][])
] as [CityName, LocationName][]

function isStudyTask(task: Task | SleeveTask | PlayerTask | MySleeveTask | null): task is StudyTask {
  return task?.type === "CLASS"
}

function isCompanyWorkTask(task: Task | SleeveTask | PlayerTask | MySleeveTask | null): task is CompanyWorkTask {
  return task?.type === "COMPANY"
}

function isCreateProgramWorkTask(task: Task | SleeveTask | PlayerTask | MySleeveTask | null): task is CreateProgramWorkTask {
  return task?.type === "CREATE_PROGRAM"
}

function isCrimeTask(task: Task | SleeveTask | PlayerTask | MySleeveTask | null): task is CrimeTask {
  return task?.type === "CRIME"
}

function isFactionWorkTask(task: Task | SleeveTask | PlayerTask | MySleeveTask | null): task is FactionWorkTask {
  return task?.type === "FACTION"
}

function isGraftingTask(task: Task | SleeveTask | PlayerTask | MySleeveTask | null): task is GraftingTask {
  return task?.type === "GRAFTING"
}

function isBladeburnerTask(task: Task | SleeveTask | PlayerTask | MySleeveTask | null): task is SleeveBladeburnerTask | ExtendedBladeburnerTask | SleeveExtendedBladeburnerTask {
  return task?.type === "BLADEBURNER"
}

function isInfiltrateTask(task: Task | SleeveTask | PlayerTask | MySleeveTask | null): task is SleeveInfiltrateTask {
  return task?.type === "INFILTRATE"
}

interface UniversityTask extends StudyTask {
  location: UniversityLocationName
  classType: UniversityClassType
}

function isUniversityTaskClass(task: Task | SleeveTask): task is UniversityTask {
  return task?.type === "CLASS" && Object.values(UniversityLocationName).includes(task.location as UniversityLocationName) && Object.values(UniversityClassType).includes(task.classType as UniversityClassType)
}

interface GymTask extends StudyTask {
  location: GymLocationName
  classType: GymType
}

function isGymTaskClass(task: Task | SleeveTask): task is GymTask {
  return task?.type === "CLASS" && Object.values(GymLocationName).includes(task.location as GymLocationName) && Object.values(GymType).includes(task.classType as GymType)
}

function bestCrime(ns: NS, person: MyPerson, objective: "money" | "karma" | "kills" | "intelligence"): CrimeTask {
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

  const crimeStats = crimeTypes.map(crimeType => ({ crimeType, chance: ns.formulas.work.crimeSuccessChance(person, crimeType), stats: ns.singularity.getCrimeStats(crimeType) }))

  let bestCrime: CrimeType = CrimeType.homicide

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

  return {
    type: "CRIME",
    crimeType: bestCrime,
    cyclesWorked: 0
  }
}