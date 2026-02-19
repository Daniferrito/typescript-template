import { NS } from "@ns"

function getServers(ns: NS, onlyHacked = true): string[] {
  if (onlyHacked) {
    return ns.read("hacked_servers.txt").split("\n")
  }
  return ns.read("servers.txt").split("\n")
}

export default getServers