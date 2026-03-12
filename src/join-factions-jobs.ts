import { NS } from "@ns"
import { joinFactions } from "./utils/factionHandling"
import { upgradeJobs } from "./utils/jobsHandler"


export async function main(ns: NS): Promise<void> {
  ns.disableLog("ALL")
  for (; ;) {
    await joinFactions(ns)
    await upgradeJobs(ns)
    await ns.sleep(5 * 1000)
  }
}
