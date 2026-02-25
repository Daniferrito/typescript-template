/* eslint-disable @typescript-eslint/no-unused-vars */
import { NS } from "@ns";
import { targetMoneyToHackPercentage, waitTimeMs } from "./constants";
import { calcEfficiency, hackAnalyze, HackAnalyzeResult } from "./hackAnalize";

interface ServerToHack {
  target: string
  hackAmount: number
}

export function calcSortedServerToHack(ns: NS, servers: string[]): string[] {
  const serversWithSortVal = calcSortedServerToHackRaw(ns, servers)
  const bestVal = serversWithSortVal[0].efficiency

  if (bestVal < 0) {
    return serversWithSortVal.map(s => s.hostname)
  }

  // Only take those that have at least 10% of the best value, to avoid wasting time on very bad servers
  return serversWithSortVal.filter(s => (bestVal < 0) || (s.efficiency >= 0.1 * bestVal)).map(s => s.hostname)
}

export function calcSortedServerToHackRaw(ns: NS, servers: string[]): HackAnalyzeResult[] {
  servers = servers.filter(serverName => {
    const server = ns.getServer(serverName)
    const p = ns.getPlayer()
    return (server.serverGrowth ?? 0) > 10 && (server.moneyMax ?? 0) > 1 && (server.requiredHackingSkill ?? Infinity) <= p.skills.hacking && server.hasAdminRights
  })

  return servers.map(serverName => hackAnalyze(ns, serverName)).sort((a, b) => b.efficiency - a.efficiency)
}

export function calcBestServerToHack(ns: NS, servers: string[]): string {
  return calcSortedServerToHack(ns, servers)[0]
}

function upgradedServerToSortVal(ns: NS, serverName: string): number {
  const hasFormulas = ns.fileExists("Formulas.exe", "home")

  const server = ns.getServer(serverName)
  const player = ns.getPlayer()

  const maxMoney = server.moneyMax ?? 0
  const currentMoney = server.moneyAvailable ?? 0
  const serverGrowth = server.serverGrowth ?? 0

  if (serverGrowth <= 10 || maxMoney < 1 || (server.requiredHackingSkill ?? Infinity) > player.skills.hacking || !server.hasAdminRights) {
    return 0 // ignore home, filter servers with low cash/low growth/too high hacking reqs
  }


  // Assume prepared server for time calculations
  server.hackDifficulty = server.minDifficulty ?? 0
  server.moneyAvailable = maxMoney

  const hackTime = hasFormulas ? ns.formulas.hacking.hackTime(server, player) : ns.getHackTime(serverName)
  const weakTime = hasFormulas ? ns.formulas.hacking.weakenTime(server, player) : ns.getWeakenTime(serverName)
  const growTime = hasFormulas ? ns.formulas.hacking.growTime(server, player) : ns.getGrowTime(serverName)

  const targetPercentage = targetMoneyToHackPercentage

  // const hackThreads = (Math.ceil(targetPercentage / ns.formulas.hacking.hackPercent(server, player)))
  const hackThreads = hasFormulas ?
    (Math.ceil(targetPercentage / ns.formulas.hacking.hackPercent(server, player))) :
    Math.floor(ns.hackAnalyzeThreads(serverName, currentMoney * targetPercentage))
  const weakThreads1 = Math.ceil((0.002 * hackThreads) / 0.05)
  // const hackedMoney = hackThreads * ns.formulas.hacking.hackPercent(server, player) * maxMoney
  const hackedMoney = hasFormulas ?
    hackThreads * ns.formulas.hacking.hackPercent(server, player) * maxMoney :
    hackThreads * ns.hackAnalyze(serverName) * maxMoney
  server.moneyAvailable = Math.max(0, maxMoney - hackedMoney) // simulate the effect of the hack for the grow thread calculation
  // const growThreads = ns.formulas.hacking.growThreads(server, player, maxMoney)
  const growThreads = hasFormulas ?
    ns.formulas.hacking.growThreads(server, player, maxMoney) :
    Math.ceil(ns.growthAnalyze(serverName, 1 / (1 - targetPercentage)))
  const weakThreads2 = Math.ceil((2 * 0.002 * growThreads) / 0.05)

  // Assume we launch one batch
  const batchesLaunched = 1

  const totalTime = Math.max(hackTime, weakTime, growTime) + (4 * waitTimeMs * batchesLaunched) // add some buffer time between batches

  const totalThreads = (hackThreads + weakThreads1 + growThreads + weakThreads2) * batchesLaunched
  const totalHackedMoney = hackedMoney * batchesLaunched
  const threadEfficiency = (totalHackedMoney) / totalThreads
  // const timeEfficiency = totalHackedMoney / (totalTime / 1000)
  const efficiency = threadEfficiency / (totalTime / 1000)

  return efficiency
}