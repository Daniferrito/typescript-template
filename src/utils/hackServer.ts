import { NS } from "@ns";
import { AllocatorOutput, allScriptsAllocated, emptyAllocatorOutput, mergeAllocations, runAllocatedScripts, scriptAllocator } from "./runScript";
import { GROW_SCRIPT, HACK_SCRIPT, targetMoneyToHackPercentage, waitTimeMs, WEAK_SCRIPT } from "./constants";
import prepareServer, { PrepareServerOutput } from "./prepareServer";

interface HackPrevRunData {
  allocations: AllocatorOutput
  totalTime: number
  firstFinishTime: number
  minWaitTime: number
  prepared: "partial" | "fullNoBatches" | "full" | "already" | "no"
  prepareThreadsUsed: [number, number, number] // weakThreads1, growThreads, weakThreads2
  batches: {
    amount: number
    threadsUsed: [number, number, number, number]
  }[]
  totalHackedMoney: number
}

export interface HackServerOutput {
  totalTime: number
  firstFinishTime: number
  totalHackedMoney: number
  prepared: "partial" | "fullNoBatches" | "full" | "already" | "no"
  threadEfficiency: number
  timeEfficiency: number
  efficiency: number
}

function hackServer(ns: NS, target: string, servers: string[], targetPercentage = targetMoneyToHackPercentage, remainingRetries = 3, prevRunData?: HackPrevRunData): HackServerOutput {
  const hasFormulas = ns.fileExists("Formulas.exe", "home")
  // if (!hasFormulas) {
  //   ns.print(`No Formulas.exe found, using backup method`)
  // }
  const player = ns.getPlayer()
  const server = ns.getServer(target)
  const minSecurity = server.minDifficulty ?? 0
  const maxMoney = server.moneyMax ?? 0
  const currentMoney = server.moneyAvailable ?? 1

  if (maxMoney === 0) {
    ns.print(`Server ${target} has no money, skipping...`)
    return {
      totalTime: 0,
      firstFinishTime: 0,
      totalHackedMoney: 0,
      prepared: "already",
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
  const hackTime = ns.getHackTime(target)
  const weakTime = ns.getWeakenTime(target)
  const growTime = ns.getGrowTime(target)
  server.hackDifficulty = minSecurity // simulate the effect of the first weaken
  server.moneyAvailable = maxMoney // simulate the effect of the grow for the hack thread calculation
  const hackThreads = hasFormulas ?
    (Math.ceil(targetPercentage / ns.formulas.hacking.hackPercent(server, player))) :
    Math.floor(ns.hackAnalyzeThreads(target, currentMoney * targetPercentage))
  const hackedMoney = hasFormulas ?
    hackThreads * ns.formulas.hacking.hackPercent(server, player) * maxMoney :
    hackThreads * ns.hackAnalyze(target) * maxMoney
  const weakThreads1 = Math.ceil((0.002 * hackThreads) / 0.05)
  server.moneyAvailable = Math.max(0, maxMoney - hackedMoney) // simulate the effect of the hack for the grow thread calculation
  const growThreads = hasFormulas ?
    ns.formulas.hacking.growThreads(server, player, maxMoney) :
    Math.ceil(ns.growthAnalyze(target, 1 / (1 - targetPercentage)))
  const weakThreads2 = Math.ceil((2 * 0.002 * growThreads) / 0.05)

  const prepareOutput: PrepareServerOutput | undefined = prevRunData ? undefined : prepareServer(ns, target, servers)
  const prepareType = prevRunData?.prepared ??
    (prepareOutput?.fullPrepare ? (prepareOutput?.totalTime === 0 ? "already" : "fullNoBatches") : (prepareOutput?.totalTime === 0 ? "no" : "partial"))

  const prevTime = prevRunData?.totalTime ?? prepareOutput?.totalTime ?? 0
  const prevMinWaitTime = prevRunData?.minWaitTime ?? prepareOutput?.minWaitTime ?? 0
  const prevFirstFinishTime = prepareOutput?.firstFinishTime ?? prevRunData?.firstFinishTime ?? 0


  if (((prepareOutput?.totalTime ?? 0) > 0 && !hasFormulas) || hackThreads <= 0 || remainingRetries <= 0 || prepareType === "no") {
    runAllocatedScripts(ns,
      prevRunData ? prevRunData.allocations : prepareOutput?.allocations ?? emptyAllocatorOutput(ns, servers),
    )

    const totalThreads = prevRunData?.batches.reduce((sum, b) => sum + b.amount * b.threadsUsed.reduce((a, b) => a + b, 0), 0) ?? 0
    const totalBatches = prevRunData?.batches.reduce((sum, b) => sum + b.amount, 0) ?? 0
    const threadsFirstBatch = prevRunData?.batches[0]?.threadsUsed ?? [0, 0, 0, 0]
    // const totalThreads = (hackThreads + weakThreads1 + growThreads + weakThreads2) * batchesLaunched + prepareThreadsUsed.reduce((a, b) => a + b, 0)
    const totalHackedMoney = prevRunData?.totalHackedMoney ?? 0
    if (!(prevTime === 0 || totalThreads === 0 || totalHackedMoney === 0)) {
      const threadEfficiency = (totalHackedMoney) / totalThreads
      const timeEfficiency = totalHackedMoney / (prevTime / 1000)
      const efficiency = threadEfficiency / (prevTime / 1000)
      // for (const batch of prevRunData?.batches ?? []) {
      //   ns.tprint(`  - Launched ${String(batch.amount).padStart(6, ' ')} batches with ${String(batch.threadsUsed[0]).padStart(3, ' ')} hack threads, ${String(batch.threadsUsed[1]).padStart(3, ' ')} weak1 threads, ${String(batch.threadsUsed[2]).padStart(3, ' ')} grow threads, ${String(batch.threadsUsed[3]).padStart(3, ' ')} weak2 threads.`)
      // }
      ns.print(`SUCCESS: Launched ${String(totalBatches).padStart(6, ' ')} batches (${String(totalThreads).padStart(8, ' ')} threads) on ${target.padStart(18, ' ')} of ${String(threadsFirstBatch[0]).padStart(3, ' ')}, ${String(threadsFirstBatch[1]).padStart(3, ' ')}, ${String(threadsFirstBatch[2]).padStart(3, ' ')}, ${String(threadsFirstBatch[3]).padStart(3, ' ')}, ${ns.tFormat(prevTime).padStart(21, ' ')}, ${ns.formatNumber(totalHackedMoney, 0).padStart(4, ' ')}$. Eff: ${ns.formatNumber(threadEfficiency, 0).padStart(4, ' ')} $/th, ${ns.formatNumber(timeEfficiency, 0).padStart(4, ' ')} $/s., ${ns.formatNumber(efficiency, 0).padStart(4, ' ')} $/th/s.`)
      return {
        totalTime: prevRunData?.totalTime ?? prepareOutput?.totalTime ?? 0,
        firstFinishTime: prevRunData?.firstFinishTime ?? prepareOutput?.firstFinishTime ?? 0,
        totalHackedMoney,
        threadEfficiency,
        timeEfficiency,
        efficiency,
        prepared: prepareType
      }
    }
    if (prepareType !== "already" && prepareType !== "no") {
      ns.print(`SUCCESS: Prepared server ${target} (${prepareType}), but couldn't launch any batches${!hasFormulas ? " because Formulas.exe is missing" : ""}.`)
    }
    return {
      totalTime: prevRunData?.totalTime ?? prepareOutput?.totalTime ?? 0,
      firstFinishTime: prevRunData?.firstFinishTime ?? prepareOutput?.firstFinishTime ?? 0,
      totalHackedMoney: prevRunData?.totalHackedMoney ?? 0,
      threadEfficiency: 0,
      timeEfficiency: 0,
      efficiency: 0,
      prepared: prepareType
    }
  }

  const hackWaitTime = Math.max(0, Math.max(prevTime, weakTime, growTime) - hackTime)
  const weakWaitTime1 = Math.max(0, Math.max(prevTime, hackTime, growTime) - weakTime) + waitTimeMs
  const growWaitTime = Math.max(0, Math.max(prevTime, weakTime, hackTime) - growTime) + waitTimeMs * 2
  const weakWaitTime2 = Math.max(0, Math.max(prevTime, hackTime, growTime) - weakTime) + waitTimeMs * 3

  const minWaitTime = Math.min(prevMinWaitTime, hackWaitTime, growWaitTime, weakWaitTime1, weakWaitTime2)

  const firstFinishTime = prevFirstFinishTime || hackTime + hackWaitTime

  let extraWaitTime = 0
  let batchesLaunched = 0

  const allocations = prevRunData ? prevRunData.allocations : prepareOutput?.allocations ?? emptyAllocatorOutput(ns, servers)

  while (extraWaitTime + minWaitTime < firstFinishTime && allScriptsAllocated(allocations)) {

    const newAllocations = scriptAllocator(ns, [
      { script: HACK_SCRIPT, threads: hackThreads, args: [target, hackWaitTime + extraWaitTime], useCores: false, allowPartial: false },
      { script: WEAK_SCRIPT, threads: weakThreads1, args: [target, weakWaitTime1 + extraWaitTime], useCores: true, allowPartial: true },
      { script: GROW_SCRIPT, threads: growThreads, args: [target, growWaitTime + extraWaitTime], useCores: true, allowPartial: false },
      { script: WEAK_SCRIPT, threads: weakThreads2, args: [target, weakWaitTime2 + extraWaitTime], useCores: true, allowPartial: true },
    ], servers, allocations)
    const lastBatchWasLaunched = allScriptsAllocated(newAllocations)
    if (!lastBatchWasLaunched) {
      break
    }
    mergeAllocations(allocations, newAllocations)
    extraWaitTime += waitTimeMs * 4
    batchesLaunched++
  }
  const totalTime = batchesLaunched ? weakTime + weakWaitTime2 + extraWaitTime : prevTime
  const newTargetPercentage = targetPercentage * 0.5
  return hackServer(ns, target, servers, newTargetPercentage, remainingRetries - 1, {
    allocations,
    totalTime,
    minWaitTime,
    firstFinishTime,
    prepared: prepareType === "fullNoBatches" && batchesLaunched > 0 ? "full" : prepareType,
    prepareThreadsUsed: prepareOutput ? prepareOutput.threadsUsed : prevRunData?.prepareThreadsUsed ?? [0, 0, 0],
    batches: [...(prevRunData?.batches ?? []), { amount: batchesLaunched, threadsUsed: [hackThreads, weakThreads1, growThreads, weakThreads2] }],
    totalHackedMoney: hackedMoney * batchesLaunched + (prevRunData?.totalHackedMoney ?? 0)
  })
}


export default hackServer