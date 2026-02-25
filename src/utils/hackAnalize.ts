import { NS } from "@ns"
import { waitTimeMs } from "./constants"
import { calculatePercentMoneyHacked, numCycleForGrowthCorrected, times } from "./customFormulas"

export interface HackAnalyzeResult {
  hostname: string

  hackThreads: number
  weakThreads1: number
  growThreads: number
  weakThreads2: number

  hackTime: number
  weakTime: number
  growTime: number

  hackedMoney: number

  totalThreads: number
  totalTime: number
  totalHackedMoney: number

  threadEfficiency: number
  timeEfficiency: number
  efficiency: number
}

const emptyHackAnalyzeResult: HackAnalyzeResult = {
  hostname: "",

  hackThreads: 0,
  weakThreads1: 0,
  growThreads: 0,
  weakThreads2: 0,

  hackTime: 0,
  weakTime: 0,
  growTime: 0,

  hackedMoney: 0,

  totalThreads: 0,
  totalTime: 0,
  totalHackedMoney: 0,

  threadEfficiency: 0,
  timeEfficiency: 0,
  efficiency: 0
}

// The main purpose of this function is to optimize targetMoneyToHackPercentage to get the best efficiency
export function hackAnalyze(ns: NS, hostname: string): HackAnalyzeResult {
  let bestResult = calcEfficiency(ns, hostname, 30)
  const initialResult = bestResult

  // Try different targetMoneyToHackPercentage values to see if we can get better efficiency
  for (let numHackThreads = 1; numHackThreads <= 500; numHackThreads += 1) {
    const result = calcEfficiency(ns, hostname, numHackThreads)
    if (result.efficiency > bestResult.efficiency) {
      bestResult = result
    }
    if (result.efficiency < initialResult.efficiency * 0.9) {
      // If the efficiency drops significantly, we can stop trying higher percentages
      break
    }
  }

  return bestResult
}

export function calcEfficiency(ns: NS, serverName: string, hackThreads: number): HackAnalyzeResult {
  // const hasFormulas = ns.fileExists("Formulas.exe", "home")

  const server = ns.getServer(serverName)
  const player = ns.getPlayer()

  const maxMoney = server.moneyMax ?? 0
  const currentMoney = server.moneyAvailable ?? 0
  const serverGrowth = server.serverGrowth ?? 0

  if (serverGrowth <= 10 || maxMoney < 1 || (server.requiredHackingSkill ?? Infinity) > player.skills.hacking || !server.hasAdminRights) {
    return { ...emptyHackAnalyzeResult, hostname: serverName } // ignore home, filter servers with low cash/low growth/too high hacking reqs
  }


  // Assume prepared server for time calculations
  server.hackDifficulty = server.minDifficulty ?? 0
  server.moneyAvailable = maxMoney

  // const hackTime = hasFormulas ? ns.formulas.hacking.hackTime(server, player) : ns.getHackTime(serverName)
  // const weakTime = hasFormulas ? ns.formulas.hacking.weakenTime(server, player) : ns.getWeakenTime(serverName)
  // const growTime = hasFormulas ? ns.formulas.hacking.growTime(server, player) : ns.getGrowTime(serverName)

  const { hackTime, weakTime, growTime } = times(ns, player, server)

  // const hackThreads = (Math.ceil(targetPercentage / ns.formulas.hacking.hackPercent(server, player)))
  // const hackThreads = hasFormulas ?
  //   (Math.ceil(targetPercentage / ns.formulas.hacking.hackPercent(server, player))) :
  //   Math.floor(ns.hackAnalyzeThreads(serverName, currentMoney * targetPercentage))
  const weakThreads1 = Math.ceil((0.002 * hackThreads) / 0.05)
  // const hackedMoney = hackThreads * ns.formulas.hacking.hackPercent(server, player) * maxMoney
  // const hackedMoney = hasFormulas ?
  //   Math.min(hackThreads * ns.formulas.hacking.hackPercent(server, player) * maxMoney, maxMoney) :
  //   Math.min(maxMoney, hackThreads * ns.hackAnalyze(serverName) * maxMoney)
  const hackedMoney = Math.min(hackThreads * calculatePercentMoneyHacked(ns, player, server) * maxMoney, maxMoney)
  server.moneyAvailable = Math.max(0, maxMoney - hackedMoney) // simulate the effect of the hack for the grow thread calculation
  // const growThreads = ns.formulas.hacking.growThreads(server, player, maxMoney)
  // const growThreads = hasFormulas ?
  //   ns.formulas.hacking.growThreads(server, player, maxMoney) :
  //   Math.ceil(ns.growthAnalyze(serverName, maxMoney / hackedMoney))
  const growThreads = numCycleForGrowthCorrected(ns, server, maxMoney, server.moneyAvailable, 1, player)
  const weakThreads2 = Math.ceil((2 * 0.002 * growThreads) / 0.05)

  const hackWaitTime = Math.max(0, Math.max(weakTime, growTime) - hackTime)
  const weakWaitTime1 = Math.max(0, Math.max(hackTime, growTime) - weakTime) + waitTimeMs
  const growWaitTime = Math.max(0, Math.max(weakTime, hackTime) - growTime) + waitTimeMs * 2
  const weakWaitTime2 = Math.max(0, Math.max(hackTime, growTime) - weakTime) + waitTimeMs * 3

  const minWaitTime = Math.min(hackWaitTime, growWaitTime, weakWaitTime1, weakWaitTime2)

  const firstFinishTime = hackTime + hackWaitTime

  let extraWaitTime = 0
  let batchesLaunched = 0

  while (extraWaitTime + minWaitTime < firstFinishTime) {
    extraWaitTime += waitTimeMs * 4
    batchesLaunched++
  }

  const totalTime = Math.max(hackTime, weakTime, growTime) + (4 * waitTimeMs * batchesLaunched) // add some buffer time between batches

  const totalThreads = (hackThreads + weakThreads1 + growThreads + weakThreads2) * batchesLaunched
  const totalHackedMoney = hackedMoney * batchesLaunched
  const threadEfficiency = (totalHackedMoney) / totalThreads
  const timeEfficiency = totalHackedMoney / (totalTime / 1000)

  const efficiency = threadEfficiency / (totalTime / 1000)

  return {
    hostname: serverName,

    hackThreads,
    weakThreads1,
    growThreads,
    weakThreads2,

    hackTime,
    weakTime,
    growTime,

    hackedMoney,

    totalThreads,
    totalTime,
    totalHackedMoney,

    threadEfficiency,
    timeEfficiency,
    efficiency
  }
}