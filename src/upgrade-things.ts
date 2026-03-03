import { NS } from "@ns";
import { buyPrograms, buyOrUpgradeServers, upgradeHome } from "./utils/upgradingThings";

export async function main(ns: NS): Promise<void> {
  ns.disableLog("ALL")
  for (; ;) {
    // upgradeHome(ns)
    buyPrograms(ns)
    buyOrUpgradeServers(ns)
    await ns.sleep(10 * 1000)
  }
}