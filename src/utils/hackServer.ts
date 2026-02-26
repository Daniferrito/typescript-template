import { NS } from "@ns";
import { AllocatorOutput, allScriptsAllocated, mergeAllocations, runAllocatedScripts, scriptAllocator } from "./runScript";
import { GROW_SCRIPT, HACK_SCRIPT, waitTimeMs, WEAK_SCRIPT } from "./constants";
import prepareServer, { PrepareServerOutput } from "./prepareServer";
import { calcEfficiency, hackAnalyze, HackAnalyzeResult } from "./hackAnalize";


export interface HackServerOutput {
  totalTime: number
  firstFinishTime: number
  totalHackedMoney: number
  prepared: "partial" | "fullNoBatches" | "full" | "already" | "no"
  batchesLaunched: number
  batchPids: number[][]
  totalThreads: number
  threadEfficiency: number
  timeEfficiency: number
  efficiency: number
}


function hackServer(ns: NS, target: HackAnalyzeResult, servers: string[], killLowEffScripts: (efficiencyThreshold: number) => boolean): HackServerOutput {
  // const hasFormulas = ns.fileExists("Formulas.exe", "home")
  // if (!hasFormulas) {
  //   ns.print(`No Formulas.exe found, using backup method`)
  // }
  // const player = ns.getPlayer()
  // const server = ns.getServer(target.hostname)
  // const minSecurity = server.minDifficulty ?? 0
  // const maxMoney = server.moneyMax ?? 0
  // const currentMoney = server.moneyAvailable ?? 1

  if (ns.getServerMaxMoney(target.hostname) === 0) {
    ns.print(`Server ${target.hostname} has no money, skipping...`)
    return {
      totalTime: 0,
      firstFinishTime: 0,
      totalHackedMoney: 0,
      prepared: "already",
      batchesLaunched: 0,
      batchPids: [],
      totalThreads: 0,
      threadEfficiency: 0,
      timeEfficiency: 0,
      efficiency: 0
    }
  }

  // 1. Prepare the server if needed
  // 2. Hack the server
  // 1. Weaken to min security
  // 2. Grow to max money
  // 3. Weaken again
  const hackTime = ns.getHackTime(target.hostname)
  const weakTime = ns.getWeakenTime(target.hostname)
  const growTime = ns.getGrowTime(target.hostname)
  // server.hackDifficulty = minSecurity // simulate the effect of the first weaken
  // server.moneyAvailable = maxMoney // simulate the effect of the grow for the hack thread calculation
  // const hackThreads = hasFormulas ?
  //   (Math.ceil(targetPercentage / ns.formulas.hacking.hackPercent(server, player))) :
  //   Math.floor(ns.hackAnalyzeThreads(target, currentMoney * targetPercentage))
  // const hackedMoney = hasFormulas ?
  //   hackThreads * ns.formulas.hacking.hackPercent(server, player) * maxMoney :
  //   hackThreads * ns.hackAnalyze(target) * maxMoney
  // const weakThreads1 = Math.ceil((0.002 * hackThreads) / 0.05)
  // server.moneyAvailable = Math.max(0, maxMoney - hackedMoney) // simulate the effect of the hack for the grow thread calculation
  // const growThreads = hasFormulas ?
  //   ns.formulas.hacking.growThreads(server, player, maxMoney) :
  //   Math.ceil(ns.growthAnalyze(target, 1 / (1 - targetPercentage)))
  // const weakThreads2 = Math.ceil((2 * 0.002 * growThreads) / 0.05)

  const hackedMoney = target.hackedMoney
  const hackThreads = target.hackThreads
  const weakThreads1 = target.weakThreads1
  const growThreads = target.growThreads
  const weakThreads2 = target.weakThreads2

  const prepareOutput: PrepareServerOutput = prepareServer(ns, target.hostname, servers)
  const prepareType =
    (prepareOutput?.fullPrepare ? (prepareOutput?.totalTime === 0 ? "already" : "fullNoBatches") : (prepareOutput?.totalTime === 0 ? "no" : "partial"))

  // const prevTime = prevRunData?.totalTime ?? prepareOutput?.totalTime ?? 0
  // const prevMinWaitTime = prevRunData?.minWaitTime ?? prepareOutput?.minWaitTime ?? 0
  // const prevFirstFinishTime = prepareOutput?.firstFinishTime ?? prevRunData?.firstFinishTime ?? 0


  if (hackThreads <= 0 || prepareType === "no") {
    // ns.print(`ERROR  : Can't hack ${target.hostname} because it requires 0 hack threads or preparation failed.`)
    return {
      totalTime: 0,
      firstFinishTime: 0,
      totalHackedMoney: 0,
      prepared: "already",
      batchesLaunched: 0,
      batchPids: [],
      totalThreads: 0,
      threadEfficiency: 0,
      timeEfficiency: 0,
      efficiency: 0
    }
  }

  const hackWaitTime = Math.max(0, Math.max(weakTime, growTime) - hackTime)
  const weakWaitTime1 = Math.max(0, Math.max(hackTime, growTime) - weakTime) + waitTimeMs
  const growWaitTime = Math.max(0, Math.max(weakTime, hackTime) - growTime) + waitTimeMs * 2
  const weakWaitTime2 = Math.max(0, Math.max(hackTime, growTime) - weakTime) + waitTimeMs * 3

  const minWaitTime = Math.min(hackWaitTime, growWaitTime, weakWaitTime1, weakWaitTime2)

  const firstFinishTime = hackTime + hackWaitTime

  let extraWaitTime = 0
  let batchesLaunched = 0

  const allocations = prepareOutput.allocations

  while (/*extraWaitTime + minWaitTime < firstFinishTime &&*/ allScriptsAllocated(allocations) && prepareType !== "partial") {

    const newAllocations = scriptAllocator(ns, [
      { script: HACK_SCRIPT, threads: hackThreads, args: [target.hostname, hackWaitTime + extraWaitTime], useCores: false, allowPartial: false },
      { script: WEAK_SCRIPT, threads: weakThreads1, args: [target.hostname, weakWaitTime1 + extraWaitTime], useCores: true, allowPartial: true },
      { script: GROW_SCRIPT, threads: growThreads, args: [target.hostname, growWaitTime + extraWaitTime], useCores: true, allowPartial: false },
      { script: WEAK_SCRIPT, threads: weakThreads2, args: [target.hostname, weakWaitTime2 + extraWaitTime], useCores: true, allowPartial: true },
    ], servers, allocations)
    const lastBatchWasLaunched = allScriptsAllocated(newAllocations)
    if (!lastBatchWasLaunched) {
      if (killLowEffScripts(target.efficiency)) {
        continue
      }
      break
    }
    mergeAllocations(allocations, newAllocations)
    extraWaitTime += waitTimeMs * 4
    batchesLaunched++
  }
  const totalTime = batchesLaunched ? weakTime + weakWaitTime2 + extraWaitTime : prepareOutput.totalTime
  // const newTargetPercentage = targetPercentage * 0.5
  // return hackServer(ns, target, servers, newTargetPercentage, remainingRetries - 1, {
  //   allocations,
  //   totalTime,
  //   minWaitTime,
  //   firstFinishTime,
  //   prepared: prepareType === "fullNoBatches" && batchesLaunched > 0 ? "full" : prepareType,
  //   prepareThreadsUsed: prepareOutput ? prepareOutput.threadsUsed : prevRunData?.prepareThreadsUsed ?? [0, 0, 0],
  //   batches: [...(prevRunData?.batches ?? []), { amount: batchesLaunched, threadsUsed: [hackThreads, weakThreads1, growThreads, weakThreads2] }],
  //   totalHackedMoney: hackedMoney * batchesLaunched + (prevRunData?.totalHackedMoney ?? 0)
  // })

  const pids = runAllocatedScripts(ns, allocations)

  if (pids.length === 0 && prepareType === "already") {
    const newThreads = Math.floor(hackThreads * 0.5)
    if (newThreads > 0) {
      const lowerTarget = calcEfficiency(ns, target.hostname, newThreads)
      return hackServer(ns, lowerTarget, servers, killLowEffScripts)
    }
  }


  const batchPids = splitPidsByBatch(pids, allocations, prepareOutput)

  const prepareThreads = prepareOutput.threadsUsed.reduce((acc, val) => acc + val, 0)
  const totalThreads = prepareThreads + (hackThreads + weakThreads1 + growThreads + weakThreads2) * batchesLaunched
  const totalHackedMoney = hackedMoney * batchesLaunched
  const threadEfficiency = totalHackedMoney > 0 ? (totalHackedMoney) / totalThreads : 0
  const timeEfficiency = totalHackedMoney > 0 ? totalHackedMoney / (totalTime / 1000) : 0

  const efficiency = threadEfficiency ? threadEfficiency / (totalTime / 1000) : 0

  if (batchesLaunched > 0) {
    ns.print(`SUCCESS: Launched ${String(batchesLaunched).padStart(6, ' ')} batches (${String(totalThreads).padStart(8, ' ')} threads) on ${target.hostname.padStart(18, ' ')} of ${String(hackThreads).padStart(3, ' ')}, ${String(weakThreads1).padStart(3, ' ')}, ${String(growThreads).padStart(3, ' ')}, ${String(weakThreads2).padStart(3, ' ')}, ${ns.tFormat(totalTime).padStart(21, ' ')}, ${ns.formatNumber(totalHackedMoney, 0).padStart(4, ' ')}$. Eff: ${ns.formatNumber(threadEfficiency, 0).padStart(4, ' ')} $/th, ${ns.formatNumber(timeEfficiency, 0).padStart(4, ' ')} $/s., ${ns.formatNumber(efficiency, 0).padStart(4, ' ')} $/th/s.`)
  }

  return {
    totalTime,
    firstFinishTime,
    totalHackedMoney,
    batchesLaunched,
    batchPids,
    totalThreads,
    threadEfficiency,
    timeEfficiency,
    efficiency,
    prepared: prepareType
  }
}

function splitPidsByBatch(pids: number[], allocations: AllocatorOutput, prepareOutput: PrepareServerOutput): number[][] {
  const batches: number[][] = []
  const numOfPreparePids = prepareOutput.allocations.allocations.reduce((sum, a) => sum + a.servers.length, 0)
  // Remove the prepare scripts from the allocations to get only the hack/weak/grow/weak scripts
  // They are always at the start of the allocations, and they are always the same amount as in prepareOutput allocations
  const batchesAllocations = allocations.allocations.slice(prepareOutput.allocations.allocations.length)
  let pidIndex = numOfPreparePids
  for (let i = 0; i < batchesAllocations.length; i += 4) {
    const batchAllocations = batchesAllocations.slice(i, i + 4)
    const numOfBatchPids = batchAllocations.reduce((sum, a) => sum + a.servers.length, 0)
    batches.push(pids.slice(pidIndex, pidIndex + numOfBatchPids))
    pidIndex += numOfBatchPids
  }
  return batches
}


export default hackServer