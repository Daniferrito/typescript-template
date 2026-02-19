import { NS } from "@ns";
import { runMultipleScripts } from "./runScript";
import { GROW_SCRIPT, waitTimeMs, WEAK_SCRIPT } from "./constants";
import availableThreads from "./availableThreads";
import { RED, RESET } from "./colors";

export interface PrepareServerOutput {
  totalTime: number
  minWaitTime: number
  firstFinishTime: number
  fullPrepare: boolean
  threadsUsed: [number, number, number] // weakThreads1, growThreads, weakThreads2
}

function prepareServer(ns: NS, target: string, servers: string[]): PrepareServerOutput {
  const hasFormulas = ns.fileExists("Formulas.exe", "home")
  // if (!hasFormulas) {
  //   ns.print(`No Formulas.exe found, using backup method`)
  // }
  const player = ns.getPlayer()
  const server = ns.getServer(target)
  const minSecurity = server.minDifficulty ?? 0
  const maxMoney = server.moneyMax ?? 0
  const security = server.hackDifficulty ?? 0

  if (maxMoney === 0) {
    ns.print(`Server ${target} has no money, skipping...`)
    return { totalTime: 0, minWaitTime: 0, firstFinishTime: 0, fullPrepare: false, threadsUsed: [0, 0, 0] }
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
    return { totalTime: 0, minWaitTime: 0, firstFinishTime: 0, fullPrepare: true, threadsUsed: [0, 0, 0] }
  }

  // const remainingThreads = availableThreads(ns, [GROW_SCRIPT, WEAK_SCRIPT], servers)
  const couldPrepare = runMultipleScripts(ns, [
    { script: WEAK_SCRIPT, threads: weakThreads1, args: [target, weakWaitTime1], useCores: true, allowPartial: true },
    { script: GROW_SCRIPT, threads: growThreads, args: [target, growWaitTime], useCores: true, allowPartial: false },
    { script: WEAK_SCRIPT, threads: weakThreads2, args: [target, weakWaitTime2], useCores: true, allowPartial: true },
  ], servers)

  const originalThreadsWanted = [weakThreads1, growThreads, weakThreads2]

  if (!couldPrepare) {
    // ns.print(`ERROR  : Not enough available threads to prepare ${target}. Needed: ${weakThreads1 + growThreads + weakThreads2}, Available: ${remainingThreads}`)
    const availableThreadCount = availableThreads(ns, [GROW_SCRIPT, WEAK_SCRIPT], servers, true) * 0.5 // use only 50% capacity, as the availableThreads function can be a bit optimistic
    if (availableThreadCount > 0) {
      if (availableThreadCount < weakThreads1) {
        weakThreads1 = availableThreadCount
      }
      let startedWeakThreads = false
      while (!startedWeakThreads && weakThreads1 > 0) {
        startedWeakThreads = runMultipleScripts(ns, [
          { script: WEAK_SCRIPT, threads: weakThreads1, args: [target, weakWaitTime1], useCores: true, allowPartial: true },
        ], servers)
        if (!startedWeakThreads) {
          weakThreads1 = Math.floor(weakThreads1 * 0.9) // reduce the weak threads and try again, to free up some threads for the grow and weak2
        }
      }

      if (weakThreads1 === originalThreadsWanted[0]) {
        let startedGrowThreads = false
        while (!startedGrowThreads && growThreads > 0) {
          startedGrowThreads = runMultipleScripts(ns, [
            { script: GROW_SCRIPT, threads: growThreads, args: [target, growWaitTime], useCores: true, allowPartial: false },
            { script: WEAK_SCRIPT, threads: weakThreads2, args: [target, weakWaitTime2], useCores: true, allowPartial: true },
          ], servers)
          if (!startedGrowThreads) {
            growThreads = Math.floor(growThreads * 0.9) // reduce the grow threads and try again, to free up some threads for weak2
            weakThreads2 = Math.ceil((2 * 0.002 * growThreads) / 0.05)
          }
        }
      } else {
        growThreads = 0
        weakThreads2 = 0
      }
    } else {
      return { totalTime: 0, minWaitTime: 0, firstFinishTime: 0, fullPrepare: false, threadsUsed: [0, 0, 0] }
    }
  }

  const totalTime = Math.max(weakTime + weakWaitTime1, growTime + growWaitTime, weakTime + weakWaitTime2)

  ns.print(`WARN   : Preparing server ${target}${couldPrepare ? "" : ` ${RED}(partially)${RESET}`}, will take approximately ${ns.tFormat(totalTime)} (${weakThreads1 + growThreads + weakThreads2} threads). (${weakThreads1}, ${growThreads}, ${weakThreads2}) ${couldPrepare ? "" : `Originally wanted ${originalThreadsWanted.join(", ")} threads.`}`)
  ns.print(`WARN   : \tNeed to reduce ${ns.formatNumber(security - minSecurity)} security, and increase money by ${ns.formatPercent(growthFactor - 1)} (${ns.formatNumber(moneyAvailable)} to ${ns.formatNumber(maxMoney)}).`)
  const firstFinishTime = weakTime + weakWaitTime1
  const minWaitTime = Math.min(weakWaitTime1, growWaitTime)

  return { totalTime, minWaitTime, firstFinishTime, fullPrepare: couldPrepare, threadsUsed: [weakThreads1, growThreads, weakThreads2] }
}


export default prepareServer