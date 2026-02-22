import { NS, Server } from "@ns";
import { GB_FOR_HOME } from "./constants";
import { CYAN, RED, RESET } from "./colors";

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

function adjustThreadsForCores(threads: number, cores: number, useCores = false): number {
  if (!useCores) {
    return threads
  }
  return Math.ceil(threads / coresFormula(cores))
}

export interface ScriptAllocation extends RunScriptOptions {
  servers: { hostname: string, threads: number }[]
}

export interface AllocatorOutput {
  allocations: ScriptAllocation[]
  servers: {
    server: Server
    prevReservedRam: number
  }[]
}

export function mergeAllocations(alloc1: AllocatorOutput, alloc2: AllocatorOutput): AllocatorOutput {
  alloc1.allocations.push(...alloc2.allocations)
  const mergedServers = [...alloc1.servers]
  for (const serverContainer of alloc2.servers) {
    const existingServer = mergedServers.find(s => s.server.hostname === serverContainer.server.hostname)
    if (existingServer) {
      existingServer.prevReservedRam += serverContainer.prevReservedRam
    } else {
      mergedServers.push(serverContainer)
    }
  }
  alloc1.servers = mergedServers
  return alloc1
}

export function emptyAllocatorOutput(ns: NS, servers: string[]): AllocatorOutput {
  return {
    allocations: [],
    servers: servers.map(h => ({
      server: ns.getServer(h),
      prevReservedRam: 0
    }))
  }
}

// Returns the allocation of scripts to servers
export function scriptAllocator(ns: NS, scripts: RunScriptOptions[], serverHostnames: string[], prevScriptAllocation?: AllocatorOutput): AllocatorOutput {
  scripts = scripts.sort((a, b) =>  // sort scripts with NOT allowPartial first, then by RAM usage (descending) to try to fit the biggest scripts first
    (a.allowPartial === b.allowPartial) ? (ns.getScriptRam(b.script) * b.threads - ns.getScriptRam(a.script) * a.threads) : (a.allowPartial ? 1 : -1)
  )
  const serversToRunOn = scripts.map(() => [] as { hostname: string, threads: number }[]) // array of servers to run each script on, with the number of threads to run on each server
  const scriptRams = scripts.map(s => ns.getScriptRam(s.script))
  const servers = prevScriptAllocation ? JSON.parse(JSON.stringify(prevScriptAllocation.servers)) as AllocatorOutput["servers"] : serverHostnames
    .map(h => ns.getServer(h))
    .map(server => ({
      server,
      prevReservedRam: 0,
    }))

  servers.sort((a, b) => (
    (a.server.maxRam - a.prevReservedRam - a.server.ramUsed - ramReservation(a.server)) -
    (b.server.maxRam - b.prevReservedRam - b.server.ramUsed - ramReservation(b.server))))
  // sort servers by RAM available ascending to try to fit scripts on bigger servers first
  for (const serverContainer of servers) {
    const server = serverContainer.server
    for (let i = 0; i < scripts.length; i++) {
      const remainingThreadsToSchedule = scripts[i].threads - serversToRunOn[i].reduce((sum, s) => sum + s.threads, 0)
      if (remainingThreadsToSchedule <= 0) {
        // This script is already fully scheduled, skip to the next one
        continue
      }
      const availableRam = server.maxRam - server.ramUsed - serverContainer.prevReservedRam - ramReservation(server) // leave some ram on home for other scripts
      if (scripts[i].allowPartial) {
        const maxThreadsForScript = Math.floor(availableRam / adjustThreadsForCores(scriptRams[i], server.cpuCores, scripts[i].useCores))
        if (maxThreadsForScript > 0) {
          const threadsToRun = Math.min(maxThreadsForScript, remainingThreadsToSchedule)
          serversToRunOn[i].push({ hostname: server.hostname, threads: threadsToRun })
          serverContainer.prevReservedRam += adjustThreadsForCores(threadsToRun, server.cpuCores, scripts[i].useCores) * scriptRams[i]
        }
      } else if (availableRam >= scriptRams[i] * adjustThreadsForCores(remainingThreadsToSchedule, server.cpuCores, scripts[i].useCores)) {
        serversToRunOn[i] = [{ hostname: server.hostname, threads: scripts[i].threads }]
        serverContainer.prevReservedRam += (scriptRams[i] * adjustThreadsForCores(remainingThreadsToSchedule, server.cpuCores, scripts[i].useCores))
      }
    }
  }
  const allocations = scripts.map((script, i) => ({
    ...script,
    servers: serversToRunOn[i],
  }))
  return { allocations, servers }
}

function ramReservation(server: Server): number {
  return (server.hostname === "home" ? GB_FOR_HOME : 0)
}

export function allScriptsAllocated(scripts: AllocatorOutput): boolean {
  for (const script of scripts.allocations) {
    const totalThreadsScheduled = script.servers.reduce((sum, s) => sum + s.threads, 0)
    if (totalThreadsScheduled < script.threads) {
      return false
    }
  }
  return true
}

export function scriptsFitOnServers(ns: NS, scripts: AllocatorOutput): boolean {
  const serversWithRamAllocated: { [hostname: string]: number } = {}

  for (const script of scripts.allocations) {
    const scriptRam = ns.getScriptRam(script.script)
    for (const server of script.servers) {
      if (!serversWithRamAllocated[server.hostname]) {
        serversWithRamAllocated[server.hostname] = 0
      }
      serversWithRamAllocated[server.hostname] += adjustThreadsForCores(server.threads, ns.getServer(server.hostname).cpuCores, script.useCores) * scriptRam
    }
  }

  for (const hostname in serversWithRamAllocated) {
    const server = ns.getServer(hostname)
    const availableRam = server.maxRam - server.ramUsed - ramReservation(server)
    if (serversWithRamAllocated[hostname] > availableRam) {
      return false
    }
  }
  return true
}

export function runAllocatedScripts(ns: NS, scriptAllocations: AllocatorOutput): void {
  if (!allScriptsAllocated(scriptAllocations)) {
    ns.tprint(`${RED}Cannot run scripts, not enough resources (${scriptAllocations.allocations.map(a => a.script).join(", ")})${RESET}`)
  }
  if (!scriptsFitOnServers(ns, scriptAllocations)) {
    ns.tprint(`${RED}Cannot run scripts, allocated scripts do not fit on servers${RESET}`)
  }
  for (const allocation of scriptAllocations.allocations) {
    for (const server of allocation.servers) {
      if (server && allocation.threads > 0) {
        const threads = adjustThreadsForCores(server.threads, ns.getServer(server.hostname).cpuCores, allocation.useCores)
        const pid = ns.exec(
          allocation.script,
          server.hostname,
          {
            threads,
            temporary: allocation.temporary ?? false,
          },
          ...allocation.args)
        if (pid === 0) {
          ns.tprint(`${CYAN}Failed to run script ${allocation.script} on server ${server.hostname} with ${threads} threads, Av RAM: ${ns.getServer(server.hostname).maxRam - ns.getServer(server.hostname).ramUsed} Req RAM: ${threads * ns.getScriptRam(allocation.script)}${RESET}`)
        }
      }
    }
  }
}

export function runMultipleScripts(ns: NS, scripts: RunScriptOptions[], serverHostnames: string[]): boolean {
  const allocations = scriptAllocator(ns, scripts, serverHostnames)
  if (allScriptsAllocated(allocations)) {
    runAllocatedScripts(ns, allocations)
    return true
  }
  return false
}

export function runSomewhereUnique(ns: NS, scriptName: string, serverHostnames: string[]): void {
  const isRunningSomewhere = serverHostnames.some(hostname => ns.isRunning(scriptName, hostname))
  if (isRunningSomewhere) {
    return
  }
  const allocation = scriptAllocator(ns, [{ script: scriptName, args: [], threads: 1 }], serverHostnames)
  if (allocation.allocations.length > 0 && allocation.allocations[0].servers.length > 0) {
    for (const server of allocation.allocations[0].servers) {
      ns.scp(scriptName, server.hostname, "home")
    }
    runAllocatedScripts(ns, allocation)
  } else {
    ns.print(`WARNING: Failed to run script ${scriptName} (${ns.getScriptRam(scriptName)} RAM) somewhere unique, not enough resources`)
  }
}