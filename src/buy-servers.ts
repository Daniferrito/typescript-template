import { NS } from "@ns";

export async function main(ns: NS): Promise<void> {
  ns.disableLog("ALL")
  // Purchase servers at the minimum ram until we have the max, then upgrade them one by one
  while (ns.getPurchasedServers().length < ns.getPurchasedServerLimit() && ns.getPurchasedServerCost(2) < ns.getServerMoneyAvailable("home")) {
     ns.purchaseServer(`pserv-${ns.getPurchasedServers().length.toString().padStart(2, "0")}`, 2)
     await ns.sleep(100) // wait for server to be purchased before trying to buy another one
  }
  
  for (let i = 2; i <= 20 ; i++) {
    const cost = ns.getPurchasedServerCost(2 ** i)
    if (cost > ns.getServerMoneyAvailable("home")){
      ns.print(`Not enough money to upgrade servers to ${ns.formatRam(2 ** i)} RAM for ${ns.formatNumber(cost)}...`)
      break
    }
    for (const server of ns.getPurchasedServers()) {
      if (cost > ns.getServerMoneyAvailable("home")){
        ns.print(`Not enough money to upgrade servers to ${ns.formatRam(2 ** i)} RAM for ${ns.formatNumber(cost)}...`)
        break
      }
      if (ns.getServerMaxRam(server) < 2 ** i) {
        ns.print(`Upgrading ${server} to ${ns.formatRam(2 ** i)} RAM for ${ns.formatNumber(cost)}...`)
        ns.upgradePurchasedServer(server, 2 ** i)
        await ns.sleep(100) // wait for server to be purchased before trying to buy another one
      }
    }
  }
  ns.print(`Finished upgrading servers to ${ns.formatRam(2 ** 20)} RAM`)
}