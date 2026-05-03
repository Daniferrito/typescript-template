import { NS } from "@ns";
import getServers from "./utils/getServers";


export async function main(ns: NS): Promise<void> {
  ns.disableLog("ALL")
  const servers = getServers(ns)
  for (const server of servers) {
    // const security = ns.getServerSecurityLevel(server)
    // const minSecurity = ns.getServerMinSecurityLevel(server)
    // const moneyAvailable = ns.getServerMoneyAvailable(server)
    // const moneyMax = ns.getServerMaxMoney(server)
    // ns.print(`Server: ${server}, Security: ${security}/${minSecurity}, Money: ${ns.format.number(moneyAvailable)}/${ns.format.number(moneyMax)}`)
    const cores = ns.getServer(server).cpuCores ?? 1
    const ram = ns.getServerMaxRam(server)
    ns.print(`Server: ${server}, Cores: ${cores}, RAM: ${ns.format.ram(ram)}`)
  }
}