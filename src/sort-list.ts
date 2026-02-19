import { NS } from "@ns";
import getServers from "./utils/getServers";
import { calcSortedServerToHackRaw } from "./utils/serversSorting";

export async function main(ns: NS): Promise<void> {
  // Count how many threads are currently running on each server and print it
  const servers = getServers(ns)
  const sorted = calcSortedServerToHackRaw(ns, servers).reverse() // reverse to have the best servers last
  ns.print("All servers with their sort value:")
  for (const server of sorted) {
    ns.print(`Server ${server.serverName.padStart(18)}, sort value: ${ns.formatNumber(server.sortVals[2], 0).padStart(4)}$/th/s, ${ns.formatNumber(server.sortVals[1], 0).padStart(4)}$/s, ${ns.formatNumber(server.sortVals[0], 0).padStart(4)}$/th, time: ${ns.tFormat(server.sortVals[3]).padStart(21)}, money: ${ns.formatNumber(server.sortVals[4], 0).padStart(4)}`)
  }
}
