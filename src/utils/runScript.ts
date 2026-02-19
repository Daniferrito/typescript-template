import { NS } from "@ns";
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

interface ScriptAllocation extends RunScriptOptions {
  servers: { hostname: string, threads: number }[]
}
// Returns the allocation of scripts to servers
export function scriptAllocator(ns: NS, scripts: RunScriptOptions[], serverHostnames: string[], prevScriptAllocation: ScriptAllocation[]): ScriptAllocation[] {
  scripts = scripts.sort((a, b) =>  // sort scripts with NOT allowPartial first, then by RAM usage (descending) to try to fit the biggest scripts first
    (a.allowPartial === b.allowPartial) ? (ns.getScriptRam(b.script) * b.threads - ns.getScriptRam(a.script) * a.threads) : (a.allowPartial ? 1 : -1)
  )
  const serversToRunOn = scripts.map(() => [] as { hostname: string, threads: number }[]) // array of servers to run each script on, with the number of threads to run on each server
  const scriptRams = scripts.map(s => ns.getScriptRam(s.script))
  const servers = serverHostnames.map(h => ns.getServer(h))
  for (const server of servers) {
    let reservedRam = prevScriptAllocation.reduce((sum, schedule) => {
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

export function canRunScripts(scripts: ScriptAllocation[]): boolean {
  for (const script of scripts) {
    const totalThreadsScheduled = script.servers.reduce((sum, s) => sum + s.threads, 0)
    if (totalThreadsScheduled < script.threads) {
      return false
    }
  }
  return true
}

export function runAllocatedScripts(ns: NS, scriptAllocations: ScriptAllocation[]): void {
  for (const allocation of scriptAllocations) {
    for (const server of allocation.servers) {
      if (server && allocation.threads > 0) {
        const threads = Math.ceil(server.threads / (allocation.useCores ? coresFormula(ns.getServer(server.hostname).cpuCores) : 1))
        ns.exec(
          allocation.script,
          server.hostname,
          {
            threads,
            temporary: allocation.temporary ?? false,
          },
          ...allocation.args)
      }
    }
  }
}

export function runMultipleScripts(ns: NS, scripts: RunScriptOptions[], serverHostnames: string[], prevScriptAllocation: ScriptAllocation[] = []): boolean {
  const allocations = scriptAllocator(ns, scripts, serverHostnames, prevScriptAllocation)
  if (canRunScripts(allocations)) {
    runAllocatedScripts(ns, allocations)
    return true
  }
  return false
}