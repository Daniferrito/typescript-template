import { NS, Server } from "@ns";
import { AllocatorOutput, allScriptsAllocated, emptyAllocatorOutput, mergeAllocations, scriptAllocator } from "./runScript";
import { GROW_SCRIPT, waitTimeMs, WEAK_SCRIPT } from "./constants";
import { RED, RESET } from "./colors";

export interface PrepareServerOutput {
  allocations: AllocatorOutput
  totalTime: number
  minWaitTime: number
  firstFinishTime: number
  fullPrepare: boolean
  threadsUsed: [number, number, number] // weakThreads1, growThreads, weakThreads2
}

function prepareServer(ns: NS, target: string, servers: string[], killLowEffScripts: (efficiencyThreshold: number) => boolean): PrepareServerOutput {
  const hasFormulas = ns.fileExists("Formulas.exe", "home")
  // if (!hasFormulas) {
  //   ns.print(`No Formulas.exe found, using backup method`)
  // }
  const player = ns.getPlayer()
  const server = ns.getServer(target) as Server
  const minSecurity = server.minDifficulty ?? 0
  const maxMoney = server.moneyMax ?? 0
  const security = server.hackDifficulty ?? 0

  if (maxMoney === 0) {
    ns.print(`Server ${target} has no money, skipping...`)
    return { allocations: { allocations: [], servers: [] }, totalTime: 0, minWaitTime: 0, firstFinishTime: 0, fullPrepare: false, threadsUsed: [0, 0, 0] }
  }

  // 1. Weaken to min security
  // 2. Grow to max money
  // 3. Weaken again
  const weakTime = ns.getWeakenTime(target)
  const growTime = ns.getGrowTime(target)

  const moneyAvailable = server.moneyAvailable ?? 1
  let weakThreads1 = Math.ceil((security - minSecurity) / 0.05)
  server.hackDifficulty = minSecurity // simulate the effect of the first weaken
  const growthFactor = maxMoney / moneyAvailable
  let growThreads = hasFormulas ?
    ns.formulas.hacking.growThreads(server, player, maxMoney) :
    Math.ceil(ns.growthAnalyze(target, growthFactor))
  let weakThreads2 = Math.ceil((2 * 0.002 * growThreads) / 0.05)

  const weakWaitTime1 = Math.max(0, growTime - weakTime)
  const growWaitTime = Math.max(0, weakTime - growTime) + waitTimeMs
  const weakWaitTime2 = Math.max(0, growTime - weakTime) + waitTimeMs * 2

  if (weakThreads1 === 0 && growThreads === 0 && weakThreads2 === 0) {
    // ns.print(`Server ${target} is already prepared, skipping...`)
    return { allocations: emptyAllocatorOutput(ns, servers), totalTime: 0, minWaitTime: 0, firstFinishTime: 0, fullPrepare: true, threadsUsed: [0, 0, 0] }
  }

  // const remainingThreads = availableThreads(ns, [GROW_SCRIPT, WEAK_SCRIPT], servers)
  const prepareAllocations = scriptAllocator(ns, [
    { script: WEAK_SCRIPT, threads: weakThreads1, args: [target, weakWaitTime1], useCores: true, allowPartial: true },
    { script: GROW_SCRIPT, threads: growThreads, args: [target, growWaitTime], useCores: true, allowPartial: false },
    { script: WEAK_SCRIPT, threads: weakThreads2, args: [target, weakWaitTime2], useCores: true, allowPartial: true },
  ], servers)

  const couldPrepare = allScriptsAllocated(prepareAllocations)

  const firstFinishTime = weakTime + weakWaitTime1
  const minWaitTime = Math.min(weakWaitTime1, growWaitTime)

  if (!couldPrepare) {
    const originalThreadsWanted = [weakThreads1, growThreads, weakThreads2]
    let couldFullyWeaken = false
    let partialPrepareAllocations: AllocatorOutput = emptyAllocatorOutput(ns, servers)
    while (!couldFullyWeaken) {
      partialPrepareAllocations = scriptAllocator(ns, [
        { script: WEAK_SCRIPT, threads: weakThreads1, args: [target, weakWaitTime1], useCores: true, allowPartial: true },
      ], servers)
      couldFullyWeaken = allScriptsAllocated(partialPrepareAllocations)
      if (!couldFullyWeaken) {
        if (killLowEffScripts(0.001)) {
          continue
        }
        break
      }
    }

    let missingGrowThreads = growThreads
    let totalGrowThreadsAllocated = 0
    let totalWeak2ThreadsAllocated = 0

    if (couldFullyWeaken) {
      while (missingGrowThreads > 0 && growThreads > 0) {
        const growAndWeak2Allocations = scriptAllocator(ns, [
          { script: GROW_SCRIPT, threads: growThreads, args: [target, growWaitTime], useCores: true, allowPartial: false },
          { script: WEAK_SCRIPT, threads: weakThreads2, args: [target, weakWaitTime2], useCores: true, allowPartial: true },
        ], servers, partialPrepareAllocations)
        const canStartGrowThreads = allScriptsAllocated(growAndWeak2Allocations)
        if (canStartGrowThreads) {
          mergeAllocations(partialPrepareAllocations, growAndWeak2Allocations)
          missingGrowThreads -= growThreads
          totalGrowThreadsAllocated += growThreads
          totalWeak2ThreadsAllocated += weakThreads2
          growThreads = Math.min(growThreads, missingGrowThreads)
          weakThreads2 = Math.ceil((2 * 0.002 * growThreads) / 0.05)
        } else {
          if (killLowEffScripts(0.001)) {
            continue
          }
          growThreads = Math.floor(growThreads * 0.9) // reduce the grow threads and try again, to free up some threads for weak2
          weakThreads2 = Math.ceil((2 * 0.002 * growThreads) / 0.05)

          if (totalGrowThreadsAllocated < originalThreadsWanted[1] * 0.02 && weakThreads1 === 0 && growThreads === 0) {
            // If we cant even allocate 10% of the grow threads, it's probably not worth it to prepare this server partially, so we just skip it
            // ns.print(`ERROR  : Could not allocate enough threads to grow server ${target} (allocated ${totalGrowThreadsAllocated} / wanted ${originalThreadsWanted[1]}), skipping...`)
            return { allocations: emptyAllocatorOutput(ns, servers), totalTime: 0, minWaitTime: 0, firstFinishTime: 0, fullPrepare: false, threadsUsed: [0, 0, 0] }
          }
        }
      }
      growThreads = totalGrowThreadsAllocated
      weakThreads2 = totalWeak2ThreadsAllocated
    } else {
      weakThreads1 = partialPrepareAllocations.allocations.filter(a => a.script === WEAK_SCRIPT).reduce((sum, a) => sum + a.servers.reduce((s, server) => s + server.threads, 0), 0)
      growThreads = 0
      weakThreads2 = 0

      if (weakThreads1 < originalThreadsWanted[0] * 0.1) {
        // If we cant even allocate 10% of the weaken threads, it's probably not worth it to prepare this server partially, so we just skip it
        // ns.print(`ERROR  : Could not allocate enough threads to weaken server ${target} (allocated ${weakThreads1} / wanted ${originalThreadsWanted[0]}), skipping...`)
        return { allocations: emptyAllocatorOutput(ns, servers), totalTime: 0, minWaitTime: 0, firstFinishTime: 0, fullPrepare: false, threadsUsed: [0, 0, 0] }
      }
    }

    const times = [0]
    if (weakThreads1 > 0) {
      times.push(weakTime + weakWaitTime1)
    }
    if (partialPrepareAllocations.allocations.some(a => a.script === GROW_SCRIPT && a.threads > 0)) {
      times.push(growTime + growWaitTime)
      times.push(weakTime + weakWaitTime2)
    }

    const totalTime = Math.max(...times)
    if (totalTime === 0) {
      // ns.print(`ERROR  : Could not allocate any threads to prepare server ${target}, skipping...`)
      return { allocations: emptyAllocatorOutput(ns, servers), totalTime: 0, minWaitTime: 0, firstFinishTime: 0, fullPrepare: false, threadsUsed: [0, 0, 0] }
    }

    const didComplete = totalGrowThreadsAllocated === originalThreadsWanted[1]

    ns.print(`WARN   : Preparing server ${target} ${didComplete ? "" : `${RED}(partially)${RESET}`}, will take approximately ${ns.format.time(totalTime)} (${weakThreads1 + growThreads + weakThreads2} threads). (${weakThreads1}, ${growThreads}, ${weakThreads2}) Originally wanted ${originalThreadsWanted.join(", ")} threads.`)
    ns.print(`WARN   : \tNeed to reduce ${ns.format.number(security - minSecurity)} security, and increase money by ${ns.format.percent(growthFactor - 1)} (${ns.format.number(moneyAvailable)} to ${ns.format.number(maxMoney)}).`)
    return { allocations: partialPrepareAllocations, totalTime, minWaitTime, firstFinishTime, fullPrepare: !didComplete, threadsUsed: [partialPrepareAllocations.allocations[0].threads, growThreads, weakThreads2] }
  }

  const totalTime = weakTime + weakWaitTime2

  ns.print(`WARN   : Preparing server ${target}, will take approximately ${ns.format.time(totalTime)} (${weakThreads1 + growThreads + weakThreads2} threads). (${weakThreads1}, ${growThreads}, ${weakThreads2})`)
  ns.print(`WARN   : \tNeed to reduce ${ns.format.number(security - minSecurity)} security, and increase money by ${ns.format.percent(growthFactor - 1)} (${ns.format.number(moneyAvailable)} to ${ns.format.number(maxMoney)}).`)

  return { allocations: prepareAllocations, totalTime, minWaitTime, firstFinishTime, fullPrepare: couldPrepare, threadsUsed: [weakThreads1, growThreads, weakThreads2] }
}


export default prepareServer