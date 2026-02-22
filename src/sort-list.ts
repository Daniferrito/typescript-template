import { NS } from "@ns";
import getServers from "./utils/getServers";
import { calcSortedServerToHackRaw } from "./utils/serversSorting";

export async function main(ns: NS): Promise<void> {
  // Count how many threads are currently running on each server and print it
  const servers = getServers(ns)
  const sorted = calcSortedServerToHackRaw(ns, servers).reverse() // reverse to have the best servers last
  ns.print("All servers with their sort value:")
  for (const server of sorted) {
    ns.print(`Server ${server.serverName.padStart(18)}, sort value: ${ns.formatNumber(server.sortVal, 0).padStart(4)}$/th/s`)
  }
}
