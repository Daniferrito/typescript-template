import { NS, Player, Skills, BladeburnerActionName } from "@ns";
// import { BladeburnerActionName, BladeburnerSkillName, BladeburnerOperationName, CityName } from "./utils/enums";
import { calculateIntelligenceBonus } from "./utils/customFormulas";
import { getRecordValues, getRecordKeys } from "./utils/utils";
import { BladeburnerBlackOpName, BladeburnerOperationName, BladeburnerSkillName, CityName } from "./utils/enums";


export async function main(ns: NS): Promise<void> {
  ns.disableLog("ALL")
  ns.enableLog("bladeburner.upgradeSkill")

  while (!ns.bladeburner.inBladeburner()) {
    await ns.sleep(60 * 1000)
  }

  for (; ;) {
    await ns.bladeburner.nextUpdate()

    // If more than a billion in money, move to city with highest population
    const cityList = getRecordValues(CityName)
      .map(city => ({ city, population: ns.bladeburner.getCityEstimatedPopulation(city) }))
      .sort((a, b) => b.population - a.population)
    if (ns.getServerMoneyAvailable("home") > 1_000_000_000 && cityList[0].population > 0) {
      ns.bladeburner.switchCity(cityList[0].city)
    }


    // const skillNames = [
    //   "Blade's Intuition",
    //   "Cloak",
    //   "Short-Circuit",
    //   "Digital Observer",
    //   "Reaper",
    //   "Evasive System",
    // ] as const
    // const importantSkillNames = [
    //   "Blade's Intuition",
    //   "Digital Observer",
    // ] as const
    // const OverclockName = "Overclock" as const
    // const HyperdriveName = "Hyperdrive" as const
    // for (const skill of skillNames) {
    //   while (ns.bladeburner.getSkillLevel(skill) < 10 && ns.bladeburner.getSkillUpgradeCost(skill) <= ns.bladeburner.getSkillPoints()) {
    //     ns.bladeburner.upgradeSkill(skill)
    //     await ns.sleep(200)
    //   }
    // }
    // const allSkillsAt10 = skillNames.every(skill => ns.bladeburner.getSkillLevel(skill) >= 10)
    // if (!allSkillsAt10) {
    //   continue
    // }
    // if (ns.bladeburner.getActionEstimatedSuccessChance("Operations", "Assassination")[0] < 0.7) {
    //   for (const skill of skillNames) {
    //     if (ns.bladeburner.getSkillUpgradeCost(skill) <= ns.bladeburner.getSkillPoints()) {
    //       ns.bladeburner.upgradeSkill(skill)
    //       await ns.sleep(200)
    //     }
    //   }
    //   continue;
    // }

    // while (ns.bladeburner.getSkillLevel(OverclockName) < 90 && ns.bladeburner.getSkillUpgradeCost(OverclockName) <= ns.bladeburner.getSkillPoints()) {
    //   ns.bladeburner.upgradeSkill(OverclockName)
    //   await ns.sleep(200)
    // }
    // if (ns.bladeburner.getSkillLevel(OverclockName) < 90) {
    //   continue
    // }
    // for (const skill of skillNames) {
    //   if (ns.bladeburner.getSkillLevel(skill) < 20 && ns.bladeburner.getSkillUpgradeCost(skill) <= ns.bladeburner.getSkillPoints()) {
    //     ns.bladeburner.upgradeSkill(skill)
    //     await ns.sleep(200)
    //   }
    // }
    // const allSkillsAt20 = skillNames.every(skill => ns.bladeburner.getSkillLevel(skill) >= 20)
    // if (!allSkillsAt20) {
    //   continue
    // }
    // const targetLevel = Math.min(ns.bladeburner.getSkillLevel(HyperdriveName), 20)

    // for (const skill of importantSkillNames) {
    //   if (ns.bladeburner.getSkillLevel(skill) < targetLevel && ns.bladeburner.getSkillUpgradeCost(skill) <= ns.bladeburner.getSkillPoints()) {
    //     ns.bladeburner.upgradeSkill(skill)
    //     await ns.sleep(200)
    //   }
    // }
    // const allSkillsAtTarget = importantSkillNames.every(skill => ns.bladeburner.getSkillLevel(skill) >= targetLevel)
    // if (!allSkillsAtTarget) {
    //   continue
    // }

    // while (ns.bladeburner.getSkillUpgradeCost(HyperdriveName) <= ns.bladeburner.getSkillPoints()) {
    //   ns.bladeburner.upgradeSkill(HyperdriveName)
    //   await ns.sleep(200)
    // }







    // Calculate optimal skill points for Assassination, then dump remaining points into Hyperdrive

    // ns.print("--------------------")
    const currentSkills = getRecordValues(BladeburnerSkillName).reduce((acc, skill) => {
      acc[skill] = ns.bladeburner.getSkillLevel(skill)
      return acc
    }, {} as Record<BladeburnerSkillName, number>)

    const currentAssassinationChance = ns.bladeburner.getActionEstimatedSuccessChance("Operations", "Assassination")
    const calcCurrentAssasinationChance = getSuccessChance(ns, ns.getPlayer(), currentSkills, BladeburnerOperationName.Assassination, 0, ns.bladeburner.getActionCurrentLevel("Operations", "Assassination"))
    const currentAssassinationSpeed = ns.bladeburner.getActionTime("Operations", "Assassination") / 1000
    const calcCurrentAssasinationSpeed = getActionTime(ns, ns.getPlayer(), currentSkills, BladeburnerOperationName.Assassination, ns.bladeburner.getActionCurrentLevel("Operations", "Assassination"))

    // if (currentAssassinationChance[0] > calcCurrentAssasinationChance || currentAssassinationChance[1] < calcCurrentAssasinationChance) {
    //   ns.print(`Current Assassination Chance: ${currentAssassinationChance} (calculated: ${calcCurrentAssasinationChance})`)
    // }
    // if (currentAssassinationSpeed != Math.ceil(calcCurrentAssasinationSpeed)) {
    //   ns.print(`Current Assassination Speed: ${currentAssassinationSpeed}s (calculated: ${calcCurrentAssasinationSpeed}s)`)
    // }

    const filteredOptions = getAssassinationSkillOptions(ns, currentSkills)

    if (filteredOptions.length > 0) {
      const bestOption = filteredOptions[0]
      if (bestOption.increasePerPoint > 0.01) {
        ns.print(`Best option: ${bestOption.skill} (cost: ${bestOption.cost}, increase: ${bestOption.increase}, increase per point: ${bestOption.increasePerPoint})`)
        if (bestOption.cost <= ns.bladeburner.getSkillPoints()) {
          ns.bladeburner.upgradeSkill(bestOption.skill)
        } else {
          continue
        }
      }
    }

    // ns.print("====================")
    const nextBlackOpName = ns.bladeburner.getNextBlackOp()?.name as BladeburnerBlackOpName | undefined
    if (nextBlackOpName) {
      const teammates = ns.bladeburner.getTeamSize()
      const currentBlackOpChance = ns.bladeburner.getActionEstimatedSuccessChance("Black Operations", nextBlackOpName)
      const calcCurrentBlackOpChance = getSuccessChance(ns, ns.getPlayer(), currentSkills, nextBlackOpName, teammates)
      const currentBlackOpSpeed = ns.bladeburner.getActionTime("Black Operations", nextBlackOpName) / 1000
      const calcCurrentBlackOpSpeed = getActionTime(ns, ns.getPlayer(), currentSkills, nextBlackOpName)

      // if (currentBlackOpChance[0] > calcCurrentBlackOpChance || currentBlackOpChance[1] < calcCurrentBlackOpChance) {
      //   ns.print(`Current ${nextBlackOpName} Chance: ${currentBlackOpChance} (calculated: ${calcCurrentBlackOpChance})`)
      // }
      // if (currentBlackOpSpeed != Math.ceil(calcCurrentBlackOpSpeed)) {
      //   ns.print(`Current ${nextBlackOpName} Speed: ${currentBlackOpSpeed}s (calculated: ${calcCurrentBlackOpSpeed}s)`)
      // }

      const filteredBlackOpOptions = getBlackOpSkillOptions(ns, currentSkills, nextBlackOpName, teammates, calcCurrentBlackOpChance, calcCurrentBlackOpSpeed)

      if (filteredBlackOpOptions.length > 0) {
        const bestOption = filteredBlackOpOptions[0]
        if (bestOption.increasePerPoint > 0.0001) {
          ns.print(`Best option for ${nextBlackOpName}: ${bestOption.skill} (cost: ${bestOption.cost}, increase: ${bestOption.increase}, increase per point: ${bestOption.increasePerPoint})`)
          if (bestOption.cost <= ns.bladeburner.getSkillPoints()) {
            ns.bladeburner.upgradeSkill(bestOption.skill)
          } else {
            continue
          }
        }
      }

    }

    while (ns.bladeburner.getSkillUpgradeCost(BladeburnerSkillName.Hyperdrive) <= ns.bladeburner.getSkillPoints()) {
      ns.bladeburner.upgradeSkill(BladeburnerSkillName.Hyperdrive)
      await ns.sleep(200)
    }
  }

}

function getAssassinationSkillOptions(ns: NS, currentSkills: BBSkillLevels) {
  // const currentAssassinationChance = ns.bladeburner.getActionEstimatedSuccessChance("Operations", "Assassination")[0]
  const calcCurrentAssasinationChance = getSuccessChance(ns, ns.getPlayer(), currentSkills, BladeburnerOperationName.Assassination, 0, ns.bladeburner.getActionCurrentLevel("Operations", "Assassination"))
  // const currentAssassinationSpeed = ns.bladeburner.getActionTime("Operations", "Assassination") / 1000
  const calcCurrentAssasinationSpeed = getActionTime(ns, ns.getPlayer(), currentSkills, BladeburnerOperationName.Assassination, ns.bladeburner.getActionCurrentLevel("Operations", "Assassination"))

  const options: { skill: BladeburnerSkillName, cost: number, increase: number, increasePerPoint: number, chanceBefore: number, chanceAfter: number, speedBefore: number, speedAfter: number }[] = []

  options.push(
    skillToAssassinationOption(ns, BladeburnerSkillName.BladesIntuition, currentSkills, calcCurrentAssasinationChance, calcCurrentAssasinationSpeed),
    skillToAssassinationOption(ns, BladeburnerSkillName.Cloak, currentSkills, calcCurrentAssasinationChance, calcCurrentAssasinationSpeed),
    skillToAssassinationOption(ns, BladeburnerSkillName.ShortCircuit, currentSkills, calcCurrentAssasinationChance, calcCurrentAssasinationSpeed),
    skillToAssassinationOption(ns, BladeburnerSkillName.DigitalObserver, currentSkills, calcCurrentAssasinationChance, calcCurrentAssasinationSpeed),
    skillToAssassinationOption(ns, BladeburnerSkillName.Reaper, currentSkills, calcCurrentAssasinationChance, calcCurrentAssasinationSpeed),
    skillToAssassinationOption(ns, BladeburnerSkillName.EvasiveSystem, currentSkills, calcCurrentAssasinationChance, calcCurrentAssasinationSpeed),
  )

  if (ns.bladeburner.getSkillLevel(BladeburnerSkillName.Overclock) < 90) {
    options.push(skillToAssassinationOption(ns, BladeburnerSkillName.Overclock, currentSkills, calcCurrentAssasinationChance, calcCurrentAssasinationSpeed))
  }

  const filteredOptions = options
    .filter(option => option.increase > 0)
    .sort((a, b) => b.increasePerPoint - a.increasePerPoint)

  return filteredOptions
}

function getBlackOpSkillOptions(ns: NS, currentSkills: BBSkillLevels, blackOpName: BladeburnerBlackOpName, teammates: number, currentChance: number, currentSpeed: number) {
  const options: { skill: BladeburnerSkillName, cost: number, increase: number, increasePerPoint: number, chanceBefore: number, chanceAfter: number, speedBefore: number, speedAfter: number }[] = []

  options.push(
    skillToBlackOpOption(ns, BladeburnerSkillName.BladesIntuition, currentSkills, blackOpName, teammates, currentChance, currentSpeed),
    skillToBlackOpOption(ns, BladeburnerSkillName.Cloak, currentSkills, blackOpName, teammates, currentChance, currentSpeed),
    skillToBlackOpOption(ns, BladeburnerSkillName.ShortCircuit, currentSkills, blackOpName, teammates, currentChance, currentSpeed),
    skillToBlackOpOption(ns, BladeburnerSkillName.DigitalObserver, currentSkills, blackOpName, teammates, currentChance, currentSpeed),
    skillToBlackOpOption(ns, BladeburnerSkillName.Reaper, currentSkills, blackOpName, teammates, currentChance, currentSpeed),
    skillToBlackOpOption(ns, BladeburnerSkillName.EvasiveSystem, currentSkills, blackOpName, teammates, currentChance, currentSpeed),
  )

  if (ns.bladeburner.getSkillLevel(BladeburnerSkillName.Overclock) < 90) {
    options.push(skillToBlackOpOption(ns, BladeburnerSkillName.Overclock, currentSkills, blackOpName, teammates, currentChance, currentSpeed))
  }

  const filteredOptions = options
    .filter(option => option.increase > 0)
    .sort((a, b) => b.increasePerPoint - a.increasePerPoint)

  return filteredOptions
}

function skillToAssassinationOption(ns: NS, skill: BladeburnerSkillName, currentSkills: BBSkillLevels, currentChance: number, currentSpeed: number) {

  const newSkills = { ...currentSkills, [skill]: currentSkills[skill] + 1 }

  const newAssassinationChance = getSuccessChance(ns, ns.getPlayer(), newSkills, BladeburnerOperationName.Assassination, 0, ns.bladeburner.getActionCurrentLevel("Operations", "Assassination"))
  const newAssassinationSpeed = getActionTime(ns, ns.getPlayer(), newSkills, BladeburnerOperationName.Assassination, ns.bladeburner.getActionCurrentLevel("Operations", "Assassination"))
  const newAssassinationsPerSecond = newAssassinationChance / (newAssassinationSpeed / 1000)
  const assassinationIncrease = (newAssassinationsPerSecond - (currentChance / (currentSpeed / 1000)))
  const cost = ns.bladeburner.getSkillUpgradeCost(skill)
  return {
    skill,
    cost,
    increase: assassinationIncrease,
    increasePerPoint: assassinationIncrease / cost,
    chanceBefore: currentChance,
    chanceAfter: newAssassinationChance,
    speedBefore: currentSpeed,
    speedAfter: newAssassinationSpeed,
  }
}

function skillToBlackOpOption(ns: NS, skill: BladeburnerSkillName, currentSkills: BBSkillLevels, blackOpName: BladeburnerBlackOpName, teammates: number, currentChance: number, currentSpeed: number) {
  const newSkills = { ...currentSkills, [skill]: currentSkills[skill] + 1 }

  const newBlackOpChance = getSuccessChance(ns, ns.getPlayer(), newSkills, blackOpName, teammates)
  const newBlackOpSpeed = getActionTime(ns, ns.getPlayer(), newSkills, blackOpName)
  const newBlackOpsPerSecond = newBlackOpChance / (newBlackOpSpeed / 1000)
  const blackOpIncrease = (newBlackOpsPerSecond - (currentChance / (currentSpeed / 1000)))
  const cost = ns.bladeburner.getSkillUpgradeCost(skill)
  return {
    skill,
    cost,
    increase: blackOpIncrease,
    increasePerPoint: blackOpIncrease / cost,
    chanceBefore: currentChance,
    chanceAfter: newBlackOpChance,
    speedBefore: currentSpeed,
    speedAfter: newBlackOpSpeed,
  }
}

const ACTION_STATS = {
  [BladeburnerOperationName.Assassination]: {
    baseDifficulty: 1500,
    difficultyFac: 1.06,
    isStealth: true,
    isKill: true,
    weights: {
      hacking: 0.1,
      strength: 0.1,
      defense: 0.1,
      dexterity: 0.3,
      agility: 0.3,
      charisma: 0,
      intelligence: 0.1,
    },
    decays: {
      hacking: 0.6,
      strength: 0.8,
      defense: 0.8,
      dexterity: 0.8,
      agility: 0.8,
      charisma: 0,
      intelligence: 0.8,
    },
    actionTypeTimePenalty: 1,
  },
  [BladeburnerBlackOpName.OperationTyphoon]: {
    baseDifficulty: 2000,
    weights: {
      hacking: 0.1,
      strength: 0.2,
      defense: 0.2,
      dexterity: 0.2,
      agility: 0.2,
      charisma: 0,
      intelligence: 0.1,
    },
    decays: {
      hacking: 0.6,
      strength: 0.8,
      defense: 0.8,
      dexterity: 0.8,
      agility: 0.8,
      charisma: 0,
      intelligence: 0.75,
    },
    isKill: true,
    actionTypeTimePenalty: 1.5,
  },
  [BladeburnerBlackOpName.OperationZero]: {
    baseDifficulty: 2500,
    weights: {
      hacking: 0.2,
      strength: 0.15,
      defense: 0.15,
      dexterity: 0.2,
      agility: 0.2,
      charisma: 0,
      intelligence: 0.1,
    },
    decays: {
      hacking: 0.6,
      strength: 0.8,
      defense: 0.8,
      dexterity: 0.8,
      agility: 0.8,
      charisma: 0,
      intelligence: 0.75,
    },
    isStealth: true,
    actionTypeTimePenalty: 1.5,
  },
  [BladeburnerBlackOpName.OperationX]: {
    baseDifficulty: 3000,
    weights: {
      hacking: 0.1,
      strength: 0.2,
      defense: 0.2,
      dexterity: 0.2,
      agility: 0.2,
      charisma: 0,
      intelligence: 0.1,
    },
    decays: {
      hacking: 0.6,
      strength: 0.8,
      defense: 0.8,
      dexterity: 0.8,
      agility: 0.8,
      charisma: 0,
      intelligence: 0.75,
    },
    isKill: true,
    actionTypeTimePenalty: 1.5,
  },
  [BladeburnerBlackOpName.OperationTitan]: {
    baseDifficulty: 4000,
    weights: {
      hacking: 0.1,
      strength: 0.2,
      defense: 0.2,
      dexterity: 0.2,
      agility: 0.2,
      charisma: 0,
      intelligence: 0.1,
    },
    decays: {
      hacking: 0.6,
      strength: 0.8,
      defense: 0.8,
      dexterity: 0.8,
      agility: 0.8,
      charisma: 0,
      intelligence: 0.75,
    },
    isKill: true,
    actionTypeTimePenalty: 1.5,
  },
  [BladeburnerBlackOpName.OperationAres]: {
    baseDifficulty: 5000,
    weights: {
      hacking: 0,
      strength: 0.25,
      defense: 0.25,
      dexterity: 0.25,
      agility: 0.25,
      charisma: 0,
      intelligence: 0,
    },
    decays: {
      hacking: 0,
      strength: 0.8,
      defense: 0.8,
      dexterity: 0.8,
      agility: 0.8,
      charisma: 0,
      intelligence: 0.75,
    },
    isKill: true,
    actionTypeTimePenalty: 1.5,
  },
  [BladeburnerBlackOpName.OperationArchangel]: {
    baseDifficulty: 7500,
    weights: {
      hacking: 0,
      strength: 0.2,
      defense: 0.2,
      dexterity: 0.3,
      agility: 0.3,
      charisma: 0,
      intelligence: 0,
    },
    decays: {
      hacking: 0,
      strength: 0.8,
      defense: 0.8,
      dexterity: 0.8,
      agility: 0.8,
      charisma: 0,
      intelligence: 0.75,
    },
    isKill: true,
    actionTypeTimePenalty: 1.5,
  },
  [BladeburnerBlackOpName.OperationJuggernaut]: {
    baseDifficulty: 10e3,
    weights: {
      hacking: 0,
      strength: 0.25,
      defense: 0.25,
      dexterity: 0.25,
      agility: 0.25,
      charisma: 0,
      intelligence: 0,
    },
    decays: {
      hacking: 0,
      strength: 0.8,
      defense: 0.8,
      dexterity: 0.8,
      agility: 0.8,
      charisma: 0,
      intelligence: 0.75,
    },
    isKill: true,
    actionTypeTimePenalty: 1.5,
  },
  [BladeburnerBlackOpName.OperationRedDragon]: {
    baseDifficulty: 12.5e3,
    weights: {
      hacking: 0.05,
      strength: 0.2,
      defense: 0.2,
      dexterity: 0.25,
      agility: 0.25,
      charisma: 0,
      intelligence: 0.05,
    },
    decays: {
      hacking: 0.6,
      strength: 0.8,
      defense: 0.8,
      dexterity: 0.8,
      agility: 0.8,
      charisma: 0,
      intelligence: 0.75,
    },
    isKill: true,
    actionTypeTimePenalty: 1.5,
  },
  [BladeburnerBlackOpName.OperationK]: {
    baseDifficulty: 15e3,
    weights: {
      hacking: 0.05,
      strength: 0.2,
      defense: 0.2,
      dexterity: 0.25,
      agility: 0.25,
      charisma: 0,
      intelligence: 0.05,
    },
    decays: {
      hacking: 0.6,
      strength: 0.8,
      defense: 0.8,
      dexterity: 0.8,
      agility: 0.8,
      charisma: 0,
      intelligence: 0.75,
    },
    isKill: true,
    actionTypeTimePenalty: 1.5,
  },
  [BladeburnerBlackOpName.OperationDeckard]: {
    baseDifficulty: 20e3,
    weights: {
      hacking: 0,
      strength: 0.24,
      defense: 0.24,
      dexterity: 0.24,
      agility: 0.24,
      charisma: 0,
      intelligence: 0.04,
    },
    decays: {
      hacking: 0,
      strength: 0.8,
      defense: 0.8,
      dexterity: 0.8,
      agility: 0.8,
      charisma: 0,
      intelligence: 0.75,
    },
    isKill: true,
    actionTypeTimePenalty: 1.5,
  },
  [BladeburnerBlackOpName.OperationTyrell]: {
    baseDifficulty: 25e3,
    weights: {
      hacking: 0.1,
      strength: 0.2,
      defense: 0.2,
      dexterity: 0.2,
      agility: 0.2,
      charisma: 0,
      intelligence: 0.1,
    },
    decays: {
      hacking: 0.6,
      strength: 0.8,
      defense: 0.8,
      dexterity: 0.8,
      agility: 0.8,
      charisma: 0,
      intelligence: 0.75,
    },
    isKill: true,
    actionTypeTimePenalty: 1.5,
  },
  [BladeburnerBlackOpName.OperationWallace]: {
    baseDifficulty: 30e3,
    weights: {
      hacking: 0,
      strength: 0.24,
      defense: 0.24,
      dexterity: 0.24,
      agility: 0.24,
      charisma: 0,
      intelligence: 0.04,
    },
    decays: {
      hacking: 0.6,
      strength: 0.8,
      defense: 0.8,
      dexterity: 0.8,
      agility: 0.8,
      charisma: 0,
      intelligence: 0.75,
    },
    isKill: true,
    actionTypeTimePenalty: 1.5,
  },
  [BladeburnerBlackOpName.OperationShoulderOfOrion]: {
    baseDifficulty: 35e3,
    weights: {
      hacking: 0.1,
      strength: 0.2,
      defense: 0.2,
      dexterity: 0.2,
      agility: 0.2,
      charisma: 0,
      intelligence: 0.1,
    },
    decays: {
      hacking: 0.6,
      strength: 0.8,
      defense: 0.8,
      dexterity: 0.8,
      agility: 0.8,
      charisma: 0,
      intelligence: 0.75,
    },
    isStealth: true,
    actionTypeTimePenalty: 1.5,
  },
  [BladeburnerBlackOpName.OperationHyron]: {
    baseDifficulty: 40e3,
    weights: {
      hacking: 0.1,
      strength: 0.2,
      defense: 0.2,
      dexterity: 0.2,
      agility: 0.2,
      charisma: 0,
      intelligence: 0.1,
    },
    decays: {
      hacking: 0.6,
      strength: 0.8,
      defense: 0.8,
      dexterity: 0.8,
      agility: 0.8,
      charisma: 0,
      intelligence: 0.75,
    },
    isKill: true,
    actionTypeTimePenalty: 1.5,
  },
  [BladeburnerBlackOpName.OperationMorpheus]: {
    baseDifficulty: 45e3,
    weights: {
      hacking: 0.05,
      strength: 0.15,
      defense: 0.15,
      dexterity: 0.3,
      agility: 0.3,
      charisma: 0,
      intelligence: 0.05,
    },
    decays: {
      hacking: 0.6,
      strength: 0.8,
      defense: 0.8,
      dexterity: 0.8,
      agility: 0.8,
      charisma: 0,
      intelligence: 0.75,
    },
    isStealth: true,
    actionTypeTimePenalty: 1.5,
  },
  [BladeburnerBlackOpName.OperationIonStorm]: {
    baseDifficulty: 50e3,
    weights: {
      hacking: 0,
      strength: 0.24,
      defense: 0.24,
      dexterity: 0.24,
      agility: 0.24,
      charisma: 0,
      intelligence: 0.04,
    },
    decays: {
      hacking: 0.6,
      strength: 0.8,
      defense: 0.8,
      dexterity: 0.8,
      agility: 0.8,
      charisma: 0,
      intelligence: 0.75,
    },
    isKill: true,
    actionTypeTimePenalty: 1.5,
  },
  [BladeburnerBlackOpName.OperationAnnihilus]: {
    baseDifficulty: 55e3,
    weights: {
      hacking: 0,
      strength: 0.24,
      defense: 0.24,
      dexterity: 0.24,
      agility: 0.24,
      charisma: 0,
      intelligence: 0.04,
    },
    decays: {
      hacking: 0.6,
      strength: 0.8,
      defense: 0.8,
      dexterity: 0.8,
      agility: 0.8,
      charisma: 0,
      intelligence: 0.75,
    },
    isKill: true,
    actionTypeTimePenalty: 1.5,
  },
  [BladeburnerBlackOpName.OperationUltron]: {
    baseDifficulty: 60e3,
    weights: {
      hacking: 0.1,
      strength: 0.2,
      defense: 0.2,
      dexterity: 0.2,
      agility: 0.2,
      charisma: 0,
      intelligence: 0.1,
    },
    decays: {
      hacking: 0.6,
      strength: 0.8,
      defense: 0.8,
      dexterity: 0.8,
      agility: 0.8,
      charisma: 0,
      intelligence: 0.75,
    },
    isKill: true,
    actionTypeTimePenalty: 1.5,
  },
  [BladeburnerBlackOpName.OperationCenturion]: {
    baseDifficulty: 70e3,
    weights: {
      hacking: 0.1,
      strength: 0.2,
      defense: 0.2,
      dexterity: 0.2,
      agility: 0.2,
      charisma: 0,
      intelligence: 0.1,
    },
    decays: {
      hacking: 0.6,
      strength: 0.8,
      defense: 0.8,
      dexterity: 0.8,
      agility: 0.8,
      charisma: 0,
      intelligence: 0.75,
    },
    actionTypeTimePenalty: 1.5,
  },
  [BladeburnerBlackOpName.OperationVindictus]: {
    baseDifficulty: 75e3,
    weights: {
      hacking: 0.1,
      strength: 0.2,
      defense: 0.2,
      dexterity: 0.2,
      agility: 0.2,
      charisma: 0,
      intelligence: 0.1,
    },
    decays: {
      hacking: 0.6,
      strength: 0.8,
      defense: 0.8,
      dexterity: 0.8,
      agility: 0.8,
      charisma: 0,
      intelligence: 0.75,
    },
    actionTypeTimePenalty: 1.5,
  },
  [BladeburnerBlackOpName.OperationDaedalus]: {
    baseDifficulty: 80e3,
    weights: {
      hacking: 0.1,
      strength: 0.2,
      defense: 0.2,
      dexterity: 0.2,
      agility: 0.2,
      charisma: 0,
      intelligence: 0.1,
    },
    decays: {
      hacking: 0.6,
      strength: 0.8,
      defense: 0.8,
      dexterity: 0.8,
      agility: 0.8,
      charisma: 0,
      intelligence: 0.75,
    },
    actionTypeTimePenalty: 1.5,
  },
} as Partial<Record<BladeburnerActionName, ActionStats>>

type ActionStats = {
  baseDifficulty: number,
  difficultyFac?: number,
  isStealth?: boolean;
  isKill?: boolean;
  weights: Skills,
  decays: Skills,
  actionTypeTimePenalty: number,
}

type BBSkillLevels = Record<BladeburnerSkillName, number>

function getSuccessChance(ns: NS, person: Player, skillLevels: BBSkillLevels, action: keyof typeof ACTION_STATS, teammates = 0, level = 1): number {
  const actionStats = ACTION_STATS[action] as ActionStats
  let difficulty = actionStats.baseDifficulty * Math.pow(actionStats.difficultyFac || 1, level - 1);
  let competence = 0;
  for (const stat of getRecordKeys(person.skills)) {
    competence += actionStats.weights[stat] * Math.pow(getEffectiveSkillLevel(person, stat, skillLevels), actionStats.decays[stat]);
  }
  competence *= calculateIntelligenceBonus(person.skills.intelligence, 0.75);
  competence *= 1 //inst.calculateStaminaPenalty();

  competence *= getTeamSuccessBonus(teammates);

  competence *= getPopulationSuccessFactor(ns);
  difficulty *= 1 //this.getChaosSuccessFactor(inst);

  // Factor skill multipliers into success chance
  competence *= getSkillMult(BladeburnerSkillName.BladesIntuition, skillLevels);
  competence *= getSkillMult(BladeburnerSkillName.DigitalObserver, skillLevels);
  if (actionStats.isStealth || false) competence *= getSkillMult(BladeburnerSkillName.Cloak, skillLevels);
  if (actionStats.isKill) competence *= getSkillMult(BladeburnerSkillName.ShortCircuit, skillLevels);

  // Augmentation multiplier
  competence *= person.mults.bladeburner_success_chance;

  if (isNaN(competence)) {
    throw new Error("Competence calculated as NaN in Action.getSuccessChance()");
  }
  return Math.min(1, competence / difficulty);
}

function getActionTime(ns: NS, person: Player, skillLevels: BBSkillLevels, action: keyof typeof ACTION_STATS, level = 1): number {
  const actionStats = ACTION_STATS[action] as ActionStats
  const difficulty = actionStats.baseDifficulty * Math.pow(actionStats.difficultyFac || 1, level - 1);
  let baseTime = difficulty / 10;//BladeburnerConstants.DifficultyToTimeFactor;
  const skillFac = getSkillMult(BladeburnerSkillName.Overclock, skillLevels); // Always < 1

  const effAgility = getEffectiveSkillLevel(person, "agility", skillLevels);
  const effDexterity = getEffectiveSkillLevel(person, "dexterity", skillLevels);
  const statFac =
    0.5 *
    (effAgility ** 0.04 +
      effDexterity ** 0.035 +
      effAgility / 10e3 +
      effDexterity / 10e3); // Always > 1

  baseTime = Math.max(1, (baseTime * skillFac) / statFac);

  return baseTime * actionStats.actionTypeTimePenalty;
}

function getEffectiveSkillLevel(person: Player, stat: keyof Skills, skillLevels: BBSkillLevels): number {
  switch (stat) {
    case "strength":
      return person.skills.strength * (1 + (0.02 * skillLevels[BladeburnerSkillName.Reaper]));
    case "defense":
      return person.skills.defense * (1 + (0.02 * skillLevels[BladeburnerSkillName.Reaper]));
    case "dexterity":
      return person.skills.dexterity * (1 + (0.02 * skillLevels[BladeburnerSkillName.Reaper])) * ((0.04 * skillLevels[BladeburnerSkillName.EvasiveSystem]));
    case "agility":
      return person.skills.agility * (1 + (0.02 * skillLevels[BladeburnerSkillName.Reaper])) * ((0.04 * skillLevels[BladeburnerSkillName.EvasiveSystem]));
    case "charisma":
      return person.skills.charisma;
    default:
      return person.skills[stat];
  }
}

function getTeamSuccessBonus(teammates: number): number {
  return Math.pow(teammates + 1, 0.05)
}

function getPopulationSuccessFactor(ns: NS): number {
  const pop = ns.bladeburner.getCityEstimatedPopulation(ns.bladeburner.getCity());
  return Math.pow(pop / 1e9, 0.7);
}

function getSkillMult(skill: BladeburnerSkillName, skillLevels: BBSkillLevels): number {
  switch (skill) {
    case BladeburnerSkillName.BladesIntuition:
      return 1 + (0.03 * skillLevels[BladeburnerSkillName.BladesIntuition]);
    case BladeburnerSkillName.Cloak:
      return 1 + (0.055 * skillLevels[BladeburnerSkillName.Cloak]);
    case BladeburnerSkillName.ShortCircuit:
      return 1 + (0.055 * skillLevels[BladeburnerSkillName.ShortCircuit]);
    case BladeburnerSkillName.DigitalObserver:
      return 1 + (0.04 * skillLevels[BladeburnerSkillName.DigitalObserver]);
    case BladeburnerSkillName.Tracer:
      return 1 + (0.04 * skillLevels[BladeburnerSkillName.Tracer]);
    case BladeburnerSkillName.Overclock:
      return 1 + (-0.01 * skillLevels[BladeburnerSkillName.Overclock]);
    default:
      return 1;
  }
}


