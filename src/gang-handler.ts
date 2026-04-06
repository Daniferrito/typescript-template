import { GangGenInfo, GangMemberAscension, GangMemberInfo, GangTaskStats, NS } from "@ns";

export async function main(ns: NS): Promise<void> {
  ns.disableLog("ALL")
  while (!ns.gang.inGang() && !ns.gang.createGang("Slum Snakes")) {
    ns.singularity.joinFaction("Slum Snakes")
    await ns.sleep(60 * 1000)
  }

  let ticksSinceLastTerritoryChange = 0;
  let previousTicksSinceLastTerritoryChange = 0;
  let lastTerritory = ns.gang.getGangInformation().territory;
  let lastPower = ns.gang.getGangInformation().power

  for (; ;) {

    const gangInfo = ns.gang.getGangInformation()
    const territory = gangInfo.territory
    const power = gangInfo.power

    // Recruit members until we have the maximum
    while (ns.gang.canRecruitMember()) {
      ns.gang.recruitMember(`M${Math.floor(Math.random() * 100).toString().padStart(2, "0")}`)
    }

    // Buy the best equipment for all members
    const members = ns.gang.getMemberNames()
    const equipment = ns.gang.getEquipmentNames()
    for (const eq of equipment) {
      if (ns.gang.getEquipmentType(eq) === "Augmentation" || ns.gang.getEquipmentCost(eq) < ns.getServerMoneyAvailable("home") * 0.01) {
        for (const member of members) {
          if (ns.gang.purchaseEquipment(member, eq)) {
            ns.print(`Purchased ${eq} for ${member}`)
          }
        }
      }
    }

    // Do not ascend until we have all 12 members
    // if (members.length === 12) {
    // Ascend members that can be ascended
    for (const member of members) {
      const installResults = ns.gang.getInstallResult(member)
      if (installResults && Object.values(installResults).some(v => v > 1)) {
        ns.gang.ascendMember(member)
        ns.print(`Ascended ${member} with install results: ${JSON.stringify(installResults)}`)
        continue
      }
      const ascensionResult = ns.gang.getAscensionResult(member)
      if (ascensionResult) {
        const ascensionMultipliers = getAscensionResultMultiplier(ascensionResult)
        if (ascensionMultipliers > 10) {
          ns.gang.ascendMember(member)
          ns.print(`Ascended ${member} with multipliers: ${JSON.stringify(ascensionResult)}`)
        }
      }
    }
    // }

    if (lastTerritory !== territory || lastPower !== power) {
      // A tick has passed, reset counter
      if (previousTicksSinceLastTerritoryChange != ticksSinceLastTerritoryChange) {
        ns.print(`Power changed from ${lastPower.toFixed(4)} to ${power.toFixed(4)} after ${ticksSinceLastTerritoryChange} (expected: ${previousTicksSinceLastTerritoryChange}) ticks (fist member activity: ${ns.gang.getMemberInformation(members[0]).task})`)
      }
      previousTicksSinceLastTerritoryChange = Math.max(ticksSinceLastTerritoryChange, ns.gang.getBonusTime() > 0 ? 3 : 9)
      ticksSinceLastTerritoryChange = 0
    } else {
      ticksSinceLastTerritoryChange++
    }
    lastPower = power
    lastTerritory = territory

    const chancesToWinClash = Object.entries(ns.gang.getOtherGangInformation())
      .filter(([name, gangObject]) => name != gangInfo.faction && gangObject.territory > 0)
      .map(([name]) => ns.gang.getChanceToWinClash(name))
    const minChangeToWinClash = chancesToWinClash.reduce((acc, val) => Math.min(acc, val), 1)
    ns.gang.setTerritoryWarfare(minChangeToWinClash > 0.6 && territory < 1)
    // ns.print(`Territory: ${territory.toFixed(4)}, Min Win Clash Chance: ${minChangeToWinClash.toFixed(4)}`)

    // If we have 10 or greater ticksSinceLastTerritoryChange, set them all to "Territory Warfare" to try to get more territory
    if ((ticksSinceLastTerritoryChange >= previousTicksSinceLastTerritoryChange) && territory < 1 && minChangeToWinClash < 0.95) {
      // ns.print(`Setting all members to Territory Warfare to increase territory (current: ${territory.toFixed(4)}, clash chance: ${gangInfo.territoryClashChance.toFixed(4)})`)
      for (const member of members) {
        ns.gang.setMemberTask(member, "Territory Warfare")
      }
    } else {
      // Assign tasks to members
      const tasks = ns.gang.getTaskNames().map(t => (ns.gang.getTaskStats(t)))
      let someoneRespecting = false
      const newGangInfo = { ...gangInfo }
      for (const memberIndex in members) {
        const member = members[memberIndex]
        const memberInfo = ns.gang.getMemberInformation(member)
        const taskResults = tasks.map(t => (getTaskResult(ns, memberInfo, t, gangInfo)))

        if (newGangInfo.wantedLevel > 0.001 * newGangInfo.respect && -newGangInfo.wantedLevelGainRate < newGangInfo.wantedLevel - 1) {
          const bestWantedTask = taskResults.filter(t => t.wanted < 0.1).sort((a, b) => a.wanted - b.wanted)[0]
          if (bestWantedTask && bestWantedTask.wanted < 0) {
            ns.gang.setMemberTask(member, bestWantedTask.name)
            newGangInfo.wantedLevelGainRate += bestWantedTask.wanted
            continue
          }
        }

        if (territory < 1 && minChangeToWinClash < 0.7) {
          if (isGreatestCombatMember(ns, memberInfo, members) && !someoneRespecting) {
            const bestRespectTask = taskResults.filter(t => t.respect > 0).sort((a, b) => b.respect - a.respect)[0]
            if (bestRespectTask && bestRespectTask.respect > 0) {
              ns.gang.setMemberTask(member, bestRespectTask.name)
              someoneRespecting = true
              continue
            }
          }
          const options = ["Train Combat", "Train Combat", "Train Charisma", "Train Hacking"]
          ns.gang.setMemberTask(member, options[Math.floor(Math.random() * options.length)])
          continue
        }

        // const newGangInfo = ns.gang.getGangInformation()
        if (shouldTrainCombat(memberInfo)) {
          ns.gang.setMemberTask(member, "Train Combat")
          continue
        } else if (shouldTrainCharisma(memberInfo)) {
          ns.gang.setMemberTask(member, "Train Charisma")
          continue
        } else if (shouldTrainHacking(memberInfo)) {
          ns.gang.setMemberTask(member, "Train Hacking")
          continue
        }

        // ns.print(`${newGangInfo.wantedLevel > 2}, ${-newGangInfo.wantedLevelGainRate < newGangInfo.wantedLevel}, ${-newGangInfo.wantedLevelGainRate}, ${newGangInfo.wantedLevel}`)


        if (gangInfo.respect < 1_000_000_000 || ns.singularity.getFactionRep(gangInfo.faction) < 3_500_000) {
          const bestRespectTask = taskResults.filter(t => t.respect > 0).sort((a, b) => b.respect - a.respect)[0]
          if (bestRespectTask && bestRespectTask.respect > 0) {
            ns.gang.setMemberTask(member, bestRespectTask.name)
            continue
          }
        } else {
          const bestMoneyTask = taskResults.filter(t => t.money > 0).sort((a, b) => b.money - a.money)[0]
          if (bestMoneyTask && bestMoneyTask.money > 0) {
            ns.gang.setMemberTask(member, bestMoneyTask.name)
            continue
          }
        }

        // If no good task is found, just train combat
        ns.gang.setMemberTask(member, "Train Combat")
      }
    }



    await ns.gang.nextUpdate()
  }
}

interface TaskResult {
  /** Task name */
  name: string;
  /** Task Description */
  desc: string;
  /** Is a task of a hacking gang */
  isHacking: boolean;
  /** Is a task of a combat gang */
  isCombat: boolean;
  /** Respect earned */
  respect: number;
  /** Wanted earned */
  wanted: number;
  /** Money earned */
  money: number;
}

function getTaskResult(ns: NS, memberInfo: GangMemberInfo, taskStats: GangTaskStats, gang: GangGenInfo): TaskResult {
  const currentNodeMults = ns.getBitNodeMultipliers()
  const statWeight = (
    (taskStats.hackWeight / 100) * memberInfo.hack +
    (taskStats.strWeight / 100) * memberInfo.str +
    (taskStats.defWeight / 100) * memberInfo.def +
    (taskStats.dexWeight / 100) * memberInfo.dex +
    (taskStats.agiWeight / 100) * memberInfo.agi +
    (taskStats.chaWeight / 100) * memberInfo.cha
  )

  const territoryMultRespect = Math.max(0.005, Math.pow(gang.territory * 100, taskStats.territory.respect) / 100);
  const territoryMultWanted = Math.max(0.005, Math.pow(gang.territory * 100, taskStats.territory.wanted) / 100);
  const territoryMultMoney = Math.max(0.005, Math.pow(gang.territory * 100, taskStats.territory.money) / 100);
  const territoryPenalty = (0.2 * gang.territory + 0.8) * currentNodeMults.GangSoftcap;
  const wantedPenalty = calculateWantedPenalty(gang);
  const wantGain = Math.min(100, (7 * taskStats.baseWanted) / Math.pow(3 * (statWeight - 3.5 * taskStats.difficulty) * territoryMultWanted, 0.8));
  const wantedReductionFromVigilanteJustice = calculateWantedReductionFromVigilanteJustice(ns, memberInfo, gang)
  const wantedPenalization = wantGain > 0 ? wantedReductionFromVigilanteJustice / (wantGain + wantedReductionFromVigilanteJustice) : 1
  const respectGain = Math.pow(11 * taskStats.baseRespect * (statWeight - 4 * taskStats.difficulty) * territoryMultRespect * wantedPenalty, territoryPenalty) * wantedPenalization;
  const moneyGain = Math.pow(5 * taskStats.baseMoney * (statWeight - 3.2 * taskStats.difficulty) * territoryMultMoney * wantedPenalty, territoryPenalty) * wantedPenalization;
  return {
    name: taskStats.name,
    desc: taskStats.desc,
    isHacking: taskStats.isHacking,
    isCombat: taskStats.isCombat,
    respect: respectGain,
    wanted: wantGain,
    money: moneyGain
  }
}

function calculateWantedReductionFromVigilanteJustice(ns: NS, memberInfo: GangMemberInfo, gang: GangGenInfo): number {
  const taskStats = ns.gang.getTaskStats("Vigilante Justice")
  const statWeight = (
    (taskStats.hackWeight / 100) * memberInfo.hack +
    (taskStats.strWeight / 100) * memberInfo.str +
    (taskStats.defWeight / 100) * memberInfo.def +
    (taskStats.dexWeight / 100) * memberInfo.dex +
    (taskStats.agiWeight / 100) * memberInfo.agi +
    (taskStats.chaWeight / 100) * memberInfo.cha
  ) - 4 * taskStats.difficulty

  const territoryMultWanted = Math.max(0.005, Math.pow(gang.territory * 100, taskStats.territory.wanted) / 100);
  const wantGain = Math.min(100, (7 * taskStats.baseWanted) / Math.pow(3 * statWeight * territoryMultWanted, 0.8));
  return -wantGain
}

function calculateWantedPenalty(gang: GangGenInfo): number {
  return gang.respect / (gang.respect + gang.wantedLevel);
}

function getAscensionResultMultiplier(ascensionResult: GangMemberAscension): number {
  return ascensionResult.hack * ascensionResult.str * ascensionResult.def * ascensionResult.dex * ascensionResult.agi * ascensionResult.cha
}

function shouldTrainCombat(memberInfo: GangMemberInfo): boolean {
  const combatLevels = [memberInfo.str, memberInfo.def, memberInfo.dex, memberInfo.agi]
  if (combatLevels.some(level => level < 50)) {
    return true
  }
  const combatExps = [memberInfo.str_exp, memberInfo.def_exp, memberInfo.dex_exp, memberInfo.agi_exp]
  const baseMult = (25 / 1500) // From weight of Train Combar
    * (100 ** 0.9) // From difficulty of Train Combat
    * 120 // From 60 ticks
  const desiredExp = [
    baseMult * memberInfo.str_mult * memberInfo.str_asc_mult,
    baseMult * memberInfo.def_mult * memberInfo.def_asc_mult,
    baseMult * memberInfo.dex_mult * memberInfo.dex_asc_mult,
    baseMult * memberInfo.agi_mult * memberInfo.agi_asc_mult,
  ]

  return combatExps.some((exp, index) => exp < desiredExp[index])
}

function shouldTrainCharisma(memberInfo: GangMemberInfo): boolean {
  if (memberInfo.cha < 30) {
    return true
  }
  const baseMult = (100 / 1500) // From weight of Train Charisma
    * (100 ** 0.9) // From difficulty of Train Charisma
    * 60 // From 20 ticks
  const desiredExp = baseMult * memberInfo.cha_mult * memberInfo.cha_asc_mult

  return memberInfo.cha_exp < desiredExp
}

function shouldTrainHacking(memberInfo: GangMemberInfo): boolean {
  if (memberInfo.hack < 10) {
    return true
  }
  const baseMult = (100 / 1500) // From weight of Train Hacking
    * (100 ** 0.9) // From difficulty of Train Hacking
    * 60 // From 20 ticks
  const desiredExp = baseMult * memberInfo.hack_mult * memberInfo.hack_asc_mult

  return memberInfo.hack_exp < desiredExp
}

function isGreatestCombatMember(ns: NS, memberInfo: GangMemberInfo, members: string[]): boolean {

  const combatLevel = memberInfo.str + memberInfo.def + memberInfo.dex + memberInfo.agi
  for (const member of members) {
    const otherMemberInfo = ns.gang.getMemberInformation(member)
    const otherCombatLevel = otherMemberInfo.str + otherMemberInfo.def + otherMemberInfo.dex + otherMemberInfo.agi
    if (otherCombatLevel > combatLevel) {
      return false
    }
  }
  return true
}
