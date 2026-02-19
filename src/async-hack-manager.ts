import { NS } from "@ns";
import { calcBestServerToHack } from "./utils/serversSorting";
import availableThreads from "./utils/availableThreads";
import { HACK_SCRIPT, GROW_SCRIPT, WEAK_SCRIPT, waitTimeMs, GB_FOR_HOME } from "./utils/constants";

const targetMoneyToHackPercentage = 0.3

export async function main(ns: NS): Promise<void> {
  ns.disableLog("ALL")
  ns.exec("scan-all.js", "home")
  await ns.asleep(1000) // wait for scan to populate servers.txt
  const servers = ns.read("servers.txt").split("\n")
  const target = ns.args[0] as string || calcBestServerToHack(ns, servers)

  const minSecurity = ns.getServerMinSecurityLevel(target)
  const maxMoney = ns.getServerMaxMoney(target)

  // if (ns.getServerSecurityLevel(target) > minSecurity) {
  //   const security = ns.getServerSecurityLevel(target)
  //   const money = ns.getServerMoneyAvailable(target)
  //   const weakTime = ns.getWeakenTime(target)
  //   const threads = Math.ceil((security - minSecurity) / 0.05)
  //   runScript(ns, WEAK_SCRIPT, threads, servers, [target, 0])
  //   ns.print(`Weakening ${target}... Money: ${money}, Max Money: ${maxMoney}, Security: ${ns.getServerSecurityLevel(target)}, Min Security: ${minSecurity}`)
  //   ns.print(`Time to weaken: ${ns.tFormat(weakTime)}, Threads: ${threads}`)
  //   await ns.asleep(weakTime + waitTimeMs)
  // }

  // if (ns.getServerMoneyAvailable(target) < maxMoney) {
  //   const money = ns.getServerMoneyAvailable(target)
  //   const weakTime = ns.getWeakenTime(target)
  //   const growTime = ns.getGrowTime(target)
  //   const growThreads = Math.ceil(ns.growthAnalyze(target, Math.max(1, maxMoney / money)))
  //   const weakThreads = Math.ceil((ns.getServerSecurityLevel(target) + 0.05 * growThreads - minSecurity) / 0.05)
  //   const growWaitTime = Math.max(0, weakTime - growTime, 0)
  //   const weakWaitTime = Math.max(0, growTime - weakTime, 0) + waitTimeMs 
  //   runScript(ns, GROW_SCRIPT, growThreads, servers, [target, growWaitTime])
  //   runScript(ns, WEAK_SCRIPT, weakThreads, servers, [target, weakWaitTime])
  //   ns.print(`Growing ${target}... Money: ${money}, Max Money: ${maxMoney}, Security: ${ns.getServerSecurityLevel(target)}, Min Security: ${minSecurity}`)
  //   ns.print(`Time to grow: ${ns.tFormat(growTime)}, Threads: ${growThreads}, wait + time ${ns.tFormat(growTime + growWaitTime)} (${growTime + growWaitTime}ms)`)
  //   ns.print(`Time to weaken: ${ns.tFormat(weakTime)}, Threads: ${weakThreads}, wait + time ${ns.tFormat(weakTime + weakWaitTime)} (${weakTime + weakWaitTime}ms)`)

  //   await ns.asleep(Math.max(growTime, weakTime) + waitTimeMs)
  // }

  // eslint-disable-next-line no-constant-condition
  while (true) {
    const money = ns.getServerMoneyAvailable(target)
    const currMoneyPercentage = money / maxMoney
    const hackTime = ns.getHackTime(target)
    const growTime = ns.getGrowTime(target)
    const weakTime = ns.getWeakenTime(target)
    const hackThreads = Math.floor(ns.hackAnalyzeThreads(target, maxMoney * (targetMoneyToHackPercentage - (1 - currMoneyPercentage))))
    const hackedMoney = hackThreads * ns.hackAnalyze(target) * money
    const weakThreads1 = Math.ceil((ns.getServerSecurityLevel(target) + 0.05 * hackThreads - minSecurity) / 0.05)
    const growThreads = money !== 0 ? Math.ceil(ns.growthAnalyze(target, Math.max(1, maxMoney / (money - hackedMoney)))) : Math.floor(availableThreads(ns, [HACK_SCRIPT, GROW_SCRIPT, WEAK_SCRIPT], servers) / 4)
    // const grownMoney = money - hackedMoney + ns.formulas.hacking.growAmount(ns.getServer(target), ns.getPlayer(), growThreads)
    const weakThreads2 = Math.ceil((ns.getServerSecurityLevel(target) + 0.05 * growThreads - minSecurity) / 0.05)
    // We want each thing to finish `waitTimeMs` after the previous one
    const hackWaitTime = Math.max(0, weakTime - hackTime, growTime - hackTime)
    const weakWaitTime1 = Math.max(0, hackTime - weakTime, growTime - weakTime) + waitTimeMs
    const growWaitTime = Math.max(0, weakTime - growTime, hackTime - growTime) + waitTimeMs * 2
    const weakWaitTime2 = Math.max(0, growTime - weakTime, hackTime - weakTime) + waitTimeMs * 3


    const numThreads = hackThreads + growThreads + weakThreads1 + weakThreads2
    const firstFinishTime = Math.min(hackTime + hackWaitTime, growTime + growWaitTime, weakTime + weakWaitTime1, weakTime + weakWaitTime2)
    const minWaitTime = Math.min(hackWaitTime, growWaitTime, weakWaitTime1, weakWaitTime2)
    let extraWaitTime = 0
    let batchesLaunched = 0
    if (numThreads === 0) {
      ns.print(`Not launching a batch because it would have 0 threads. Money: ${money}, Max Money: ${maxMoney}, Security: ${ns.getServerSecurityLevel(target)}, Min Security: ${minSecurity}`)
      await ns.asleep(1000)
      continue
    }
    while (availableThreads(ns, [HACK_SCRIPT, GROW_SCRIPT, WEAK_SCRIPT], servers) > numThreads && extraWaitTime + minWaitTime < firstFinishTime) {
      runScript(ns, HACK_SCRIPT, hackThreads, servers, [target, hackWaitTime + extraWaitTime])
      runScript(ns, WEAK_SCRIPT, weakThreads1, servers, [target, weakWaitTime1 + extraWaitTime])
      runScript(ns, GROW_SCRIPT, growThreads, servers, [target, growWaitTime + extraWaitTime])
      runScript(ns, WEAK_SCRIPT, weakThreads2, servers, [target, weakWaitTime2 + extraWaitTime])
      extraWaitTime += waitTimeMs * 4
      batchesLaunched++
    }
    ns.print(`Launched ${batchesLaunched} batches`)
    if (batchesLaunched === 0) {
      ns.print(`Not enough available threads to launch a batch of ${numThreads} threads, available: ${availableThreads(ns, [HACK_SCRIPT, GROW_SCRIPT, WEAK_SCRIPT], servers)}`)
      await ns.asleep(1000)
      continue
    }
    const totalWaitTime = Math.max(hackTime + hackWaitTime, growTime + growWaitTime, weakTime + weakWaitTime1, weakTime + weakWaitTime2) + extraWaitTime
    ns.print(`Hacking ${target}... Money: ${money}, Max Money: ${maxMoney}, Security: ${ns.getServerSecurityLevel(target)}, Min Security: ${minSecurity}, Total wait: ${ns.tFormat(totalWaitTime)}`)
    await ns.asleep(totalWaitTime)
    // ns.exec("buy-servers.js", "home") // try to buy/upgrade servers between batches
    await (ns.asleep(waitTimeMs)) // wait for buy-servers to finish before next batch
    // ns.print(`Available threads: ${availableThreads(ns, [HACK_SCRIPT, GROW_SCRIPT, WEAK_SCRIPT], servers)}`)
    // ns.print(`Time to hack: ${ns.tFormat(hackTime)}, Threads: ${hackThreads}, Hacked Money: ${ns.formatNumber(hackedMoney)}, wait + time ${ns.tFormat(hackTime + hackWaitTime)}`)
    // ns.print(`Time to weaken 1: ${ns.tFormat(weakTime)}, Threads: ${weakThreads1}, wait + time ${ns.tFormat(weakTime + weakWaitTime1)}`)
    // ns.print(`Time to grow: ${ns.tFormat(growTime)}, Threads: ${growThreads}, Grown Money: ${ns.formatNumber(grownMoney)}, wait + time ${ns.tFormat(growTime + growWaitTime)}`)
    // ns.print(`Time to weaken 2: ${ns.tFormat(weakTime)}, Threads: ${weakThreads2}, wait + time ${ns.tFormat(weakTime + weakWaitTime2)}`)

    // money = Math.min(Math.max(0, money - hackedMoney) + grownMoney, maxMoney)
  }
}

function runScript(ns: NS, script: string, threads: number, servers: string[], args: (string | number)[]) {
  if (threads <= 0) {
    return
  }
  const ramUsage = ns.getScriptRam(script)
  let threadsLeft = threads
  for (const serverName of servers) {
    const server = ns.getServer(serverName)
    ns.scp(script, serverName)
    const serverMultiplier = server.cpuCores
    const availableRam = server.maxRam - server.ramUsed - (serverName === "home" ? GB_FOR_HOME : 0) // leave some ram on home for other scripts
    const availableThreads = Math.floor(availableRam / ramUsage) * serverMultiplier
    if (availableThreads <= 0) {
      continue
    }
    const threadsToRun = Math.ceil(Math.min(availableThreads, threadsLeft) / serverMultiplier)
    ns.exec(script, serverName, threadsToRun, ...args)
    threadsLeft -= threadsToRun * serverMultiplier
    if (threadsLeft <= 0) {
      return
    }
  }
  throw new Error(`Could not run ${script} with ${threads} threads, not enough available RAM across all servers`)
}

