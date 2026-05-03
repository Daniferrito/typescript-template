import { NS } from "@ns";
import { HACK_SCRIPT, GROW_SCRIPT, WEAK_SCRIPT } from "./constants";

interface Servers {
  allServers: string[]
  hackedServers: string[]
}

export function scanServers(ns: NS): Servers {
  const open = ["home"]
  const visited = []
  const hacked = []
  while (open.length > 0) {
    const curr = open.pop() as string
    visited.push(curr)
    const neightbours = ns.scan(curr)
    ns.scp([HACK_SCRIPT, GROW_SCRIPT, WEAK_SCRIPT], curr)
    if (tryHack(ns, curr)) {
      hacked.push(curr)
    }
    for (const neightbour of neightbours) {
      if (visited.includes(neightbour) || neightbour.startsWith("hacknet-server-")) {
        continue
      }
      open.push(neightbour)
    }
  }

  ns.write("servers.txt", visited
    .join("\n"), "w")

  ns.write("hacked_servers.txt", hacked
    .join("\n"), "w")

  return {
    allServers: visited,
    hackedServers: hacked
  }
}

function tryHack(ns: NS, serverHostname: string): boolean {
  let openPorts = 0
  if (ns.fileExists("BruteSSH.exe", "home")) {
    ns.brutessh(serverHostname)
    openPorts++
  }
  if (ns.fileExists("FTPCrack.exe", "home")) {
    ns.ftpcrack(serverHostname)
    openPorts++
  }
  if (ns.fileExists("HTTPWorm.exe", "home")) {
    ns.httpworm(serverHostname)
    openPorts++
  }
  if (ns.fileExists("SQLInject.exe", "home")) {
    ns.sqlinject(serverHostname)
    openPorts++
  }
  if (ns.fileExists("relaySMTP.exe", "home")) {
    ns.relaysmtp(serverHostname)
    openPorts++
  }
  if (ns.getServerNumPortsRequired(serverHostname) <= openPorts) {
    ns.nuke(serverHostname)
    // ns.print(`Successfully hacked ${serverHostname}`)
  }
  return ns.hasRootAccess(serverHostname)
}
