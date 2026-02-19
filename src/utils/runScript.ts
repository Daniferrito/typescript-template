import { NS, Server } from "@ns";
import { GB_FOR_HOME } from "./constants";

interface RunScriptOptions {
  script: string
  threads: number
  useCores?: boolean
  allowPartial?: boolean
  temporary?: boolean
  args: (string | number)[]
}

function coresFormula(cores: number): number {
  return 1 + (cores - 1) / 16
}

// Either runs all the scripts as instructed, or fails without running any if there isn't enough RAM to run all of them
export function runMultipleScripts(ns: NS, scripts: RunScriptOptions[], serverHostnames: string[]): boolean {
  // ns.tprint("INFO  : Checking if there is enough RAM to run all scripts...")
  scripts = scripts.sort((a, b) =>  // sort scripts with NOT allowPartial first, then by RAM usage (descending) to try to fit the biggest scripts first
    (a.allowPartial === b.allowPartial) ? (ns.getScriptRam(b.script) * b.threads - ns.getScriptRam(a.script) * a.threads) : (a.allowPartial ? 1 : -1)
  )
  // const ramUsages = scripts.map(s => ns.getScriptRam(s.script) * s.threads)
  const scriptRams = scripts.map(s => ns.getScriptRam(s.script))
  const serversToRunOn = scripts.map(() => [] as [Server, number][]) // array of servers to run each script on, with the number of threads to run on each server
  const servers = serverHostnames.map(h => ns.getServer(h))
  for (const server of servers) {
    let reservedRam = 0
    for (let i = 0; i < scripts.length; i++) {
      const remainingThreadsToSchedule = scripts[i].threads - serversToRunOn[i].reduce((sum, [, t]) => sum + t, 0)
      if (remainingThreadsToSchedule <= 0) {
        continue
      }
      const availableRam = server.maxRam - server.ramUsed - reservedRam - (server.hostname === "home" ? GB_FOR_HOME : 0) // leave some ram on home for other scripts
      // if (server.hostname === "home") {
      //   ns.tprint(`Checking server ${server.hostname} for script ${scripts[i].script}. Available RAM: ${ns.formatRam(availableRam)}, RAM needed: ${ns.formatRam(ramUsages[i])}, Threads needed: ${scripts[i].threads}`)
      //   ns.tprint(`  - Max ram: ${ns.formatRam(server.maxRam)}, Used ram: ${ns.formatRam(server.ramUsed)}, Reserved ram: ${ns.formatRam(reservedRam)}`)
      // }
      if (scripts[i].allowPartial) {
        const maxThreadsForScript = Math.floor(availableRam * (scripts[i].useCores ? coresFormula(server.cpuCores) : 1) / scriptRams[i])
        if (maxThreadsForScript > 0) {
          const threadsToRun = Math.min(maxThreadsForScript, remainingThreadsToSchedule)
          serversToRunOn[i].push([server, threadsToRun])
          reservedRam += (threadsToRun / (scripts[i].useCores ? coresFormula(server.cpuCores) : 1)) * scriptRams[i]
        }
      } else if (availableRam * (scripts[i].useCores ? coresFormula(server.cpuCores) : 1) >= scriptRams[i] * remainingThreadsToSchedule) {
        serversToRunOn[i] = [[server, scripts[i].threads]]
        reservedRam += (scriptRams[i] * remainingThreadsToSchedule) / (scripts[i].useCores ? coresFormula(server.cpuCores) : 1)
      }
    }
  }
  if (serversToRunOn.some((servers, i) => servers.reduce((sum, [, t]) => sum + t, 0) < scripts[i].threads)) {
    // Not enough RAM to run all scripts, finish without running any
    // ns.tprint("ERROR  : Not enough RAM to run all scripts, not running any.")
    // for (let i = 0; i < scripts.length; i++) {
    //   ns.tprint(`  - Script ${scripts[i].script}: needed threads: ${scripts[i].threads}, RAM needed: ${ns.formatRam(ramUsages[i])}, number of servers to run on: ${serversToRunOn[i].length}`)
    //   for (const [server, threadsToRun] of serversToRunOn[i]) {
    //     ns.tprint(`    - Server ${server.hostname}: planned threads to run: ${threadsToRun}, RAM needed: ${ns.formatRam(threadsToRun * ns.getScriptRam(scripts[i].script))}`)
    //   }
    // }
    return false
  }
  for (let i = 0; i < scripts.length; i++) {
    const servers = serversToRunOn[i]
    for (const [server, threadsToRun] of servers) {
      if (server && scripts[i].threads > 0) {
        // ns.print(`Running ${scripts[i].script} with ${threadsToRun} threads on ${server.hostname} for script that needs ${scripts[i].threads} threads.`)
        // ns.print(`Available RAM on ${server.hostname}: ${ns.formatRam(ns.getServerMaxRam(server.hostname) - ns.getServerUsedRam(server.hostname))}, RAM to use: ${ns.formatRam(threadsToRun * ns.getScriptRam(scripts[i].script))}`)
        const threads = Math.ceil(threadsToRun / (scripts[i].useCores ? coresFormula(server.cpuCores) : 1))
        ns.exec(
          scripts[i].script,
          server.hostname,
          {
            threads,
            temporary: scripts[i].temporary ?? false,
          },
          ...scripts[i].args)
        // ns.print("....")
      }
    }
  }
  return true
}

interface ScriptSchedule extends RunScriptOptions {
  servers: { hostname: string, threads: number }[]
}
// Returns the 
export function scriptAllocator(ns: NS, scripts: RunScriptOptions[], serverHostnames: string[], prevScriptSchedule: ScriptSchedule[]): ScriptSchedule[] {
  scripts = scripts.sort((a, b) =>  // sort scripts with NOT allowPartial first, then by RAM usage (descending) to try to fit the biggest scripts first
    (a.allowPartial === b.allowPartial) ? (ns.getScriptRam(b.script) * b.threads - ns.getScriptRam(a.script) * a.threads) : (a.allowPartial ? 1 : -1)
  )
  const serversToRunOn = scripts.map(() => [] as { hostname: string, threads: number }[]) // array of servers to run each script on, with the number of threads to run on each server
  const scriptRams = scripts.map(s => ns.getScriptRam(s.script))
  const servers = serverHostnames.map(h => ns.getServer(h))
  for (const server of servers) {
    let reservedRam = prevScriptSchedule.reduce((sum, schedule) => {
      const scheduleForServer = schedule.servers.find(s => s.hostname === server.hostname) ?? { hostname: server.hostname, threads: 0 }
      return sum + (scheduleForServer ? (scheduleForServer.threads * ns.getScriptRam(schedule.script)) : 0)
    }, 0)
    for (let i = 0; i < scripts.length; i++) {
      const remainingThreadsToSchedule = scripts[i].threads - serversToRunOn[i].reduce((sum, s) => sum + s.threads, 0)
      if (remainingThreadsToSchedule <= 0) {
        // This script is already fully scheduled, skip to the next one
        continue
      }
      const availableRam = server.maxRam - server.ramUsed - reservedRam - (server.hostname === "home" ? GB_FOR_HOME : 0) // leave some ram on home for other scripts
      if (scripts[i].allowPartial) {
        const maxThreadsForScript = Math.floor(availableRam * (scripts[i].useCores ? coresFormula(server.cpuCores) : 1) / scriptRams[i])
        if (maxThreadsForScript > 0) {
          const threadsToRun = Math.min(maxThreadsForScript, remainingThreadsToSchedule)
          serversToRunOn[i].push({ hostname: server.hostname, threads: threadsToRun })
          reservedRam += (threadsToRun / (scripts[i].useCores ? coresFormula(server.cpuCores) : 1)) * scriptRams[i]
        }
      } else if (availableRam * (scripts[i].useCores ? coresFormula(server.cpuCores) : 1) >= scriptRams[i] * remainingThreadsToSchedule) {
        serversToRunOn[i] = [{ hostname: server.hostname, threads: scripts[i].threads }]
        reservedRam += (scriptRams[i] * remainingThreadsToSchedule) / (scripts[i].useCores ? coresFormula(server.cpuCores) : 1)
      }
    }
  }
  return scripts.map((script, i) => ({
    ...script,
    servers: serversToRunOn[i],
  }))
}