/* eslint-disable no-case-declarations */
import { BladeburnerCurAction, CompanyWorkTask, CreateProgramWorkTask, CrimeTask, FactionWorkTask, GangGenInfo, GraftingTask, NS, Player, SleeveBladeburnerTask, SleeveInfiltrateTask, SleevePerson, SleeveRecoveryTask, SleeveSynchroTask, SleeveTask, StudyTask, Task } from "@ns";
import { ALL_FACTIONS, companyFactions, factionCompanies, hasRemainingAugmentations, shouldJoinFaction } from "./utils/factionHandling";
import { CityName, CompanyName, CrimeType, GymLocationName, GymType, LocationName, UniversityClassType, UniversityLocationName } from "./utils/enums";
import { neverReached } from "./utils/utils";

let hasNeuroReceptorManager = false
let player: Player
let gang: GangGenInfo | null

export async function main(ns: NS): Promise<void> {
  ns.disableLog("disableLog")
  ns.disableLog("getServerMoneyAvailable")
  ns.disableLog("sleep")
  hasNeuroReceptorManager = ns.singularity.getOwnedAugmentations().includes("Neuroreceptor Management Implant")

  let isFirstTime = true
  for (; ;) {
    if (isFirstTime) {
      isFirstTime = false
    } else {
      await ns.sleep(hasNeuroReceptorManager ? 10 * 1000 : 2 * 60 * 1000)
    }
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
    const numSleeves = ns.sleeve.getNumSleeves()
    for (let i = 0; i < numSleeves; i++) {
      const sleeve = ns.sleeve.getSleeve(i)
      const sleeveTask = ns.sleeve.getTask(i)
      const tasks = decideTask(ns, sleeve)
      for (const task of tasks) {
        if (doTask(ns, sleeve, task, sleeveTask, i)) {
          break
        }
      }
    }
  }
}

type PlayerTask =
  | StudyTask
  | CompanyWorkTask
  | CreateProgramWorkTask
  | CrimeTask
  | FactionWorkTask
  | GraftingTask;
type MySleeveTask =
  | SleeveBladeburnerTask
  | StudyTask
  | CompanyWorkTask
  | CrimeTask
  | FactionWorkTask
  | SleeveInfiltrateTask
  | SleeveRecoveryTask
  // | SleeveSupportTask
  | SleeveSynchroTask;

type MyPerson = Player | SleevePerson
type PersonTask<T> =
  T extends Player ? PlayerTask :
  MySleeveTask

function decideTask<T extends MyPerson>(ns: NS, person: T): PersonTask<T>[] {
  const tasks: PersonTask<T>[] = []
  const isPlayer = "karma" in person

  ns.sleeve.getTask(0)

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
  } else {
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

  const factionsWith150Favor = ALL_FACTIONS.filter(f => ns.singularity.getFactionFavor(f) >= 150)
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
  // Do crime for money
  tasks.push(
    bestCrime(ns, person, "karma")
  )

  return tasks as PersonTask<T>[]
}

function doTask(ns: NS, person: MyPerson, task: Task | SleeveTask, currentTask: Task | SleeveTask | null, sleeveNumber = -1, currentBBActivity?: BladeburnerCurAction | null): boolean {
  try {
    // If currentTask is the same as task, do nothing and return true
    if (tasksAreEqual(currentTask, task)) {
      return true
    }
    if (currentTask?.type === "GRAFTING") {
      return true
    }
    if (currentBBActivity != null) {
      return true
    }
    ns.print(`${sleeveNumber} - ${JSON.stringify(task)}`)

    switch (task.type) {
      case "RECOVERY":
        return ns.sleeve.setToShockRecovery(sleeveNumber)
      case "SYNCHRO":
        return ns.sleeve.setToSynchronize(sleeveNumber)
      case "SUPPORT":
        return false
      case "BLADEBURNER":
        return false
      case "INFILTRATE":
        return false
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
        return ns.singularity.createProgram(task.programName)
      case "CRIME":
        if (sleeveNumber === -1) {
          ns.singularity.commitCrime(task.crimeType, !hasNeuroReceptorManager)
          return true
        } else {
          return ns.sleeve.setToCommitCrime(sleeveNumber, task.crimeType) ?? false
        }
      case "GRAFTING":
        return ns.grafting.graftAugmentation(task.augmentation)
      default:
        neverReached(task)
    }
  } catch (e) {
    return false
  }
}

function tasksAreEqual(task1: Task | SleeveTask | null, task2: Task | SleeveTask): boolean {
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
      return isBladeburnerTask(task2) && task1.actionName === task2.actionName && task1.actionType === task2.actionType
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

function isStudyTask(task: Task | SleeveTask | null): task is StudyTask {
  return task?.type === "CLASS"
}

function isCompanyWorkTask(task: Task | SleeveTask | null): task is CompanyWorkTask {
  return task?.type === "COMPANY"
}

function isCreateProgramWorkTask(task: Task | SleeveTask | null): task is CreateProgramWorkTask {
  return task?.type === "CREATE_PROGRAM"
}

function isCrimeTask(task: Task | SleeveTask | null): task is CrimeTask {
  return task?.type === "CRIME"
}

function isFactionWorkTask(task: Task | SleeveTask | null): task is FactionWorkTask {
  return task?.type === "FACTION"
}

function isGraftingTask(task: Task | SleeveTask | null): task is GraftingTask {
  return task?.type === "GRAFTING"
}

function isBladeburnerTask(task: Task | SleeveTask | null): task is SleeveBladeburnerTask {
  return task?.type === "BLADEBURNER"
}

function isInfiltrateTask(task: Task | SleeveTask | null): task is SleeveInfiltrateTask {
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