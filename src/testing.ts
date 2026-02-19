import { NS } from "@ns";
import getServers from "./utils/getServers";

export async function main(ns: NS): Promise<void> {
  // Count how many threads are currently running on each server and print it
  const servers = getServers(ns)
  let totalThreads = 0
  for (const server of servers) {
    const processes = ns.ps(server)
    const serverThreads = processes.reduce((sum, process) => sum + process.threads, 0)
    totalThreads += serverThreads
    ns.print(`Server ${server} is running ${serverThreads} threads.`)
  }
  ns.print(`Total threads running across all servers: ${totalThreads}`)
}
