import { NS } from "@ns";
import { getAugmentationSource, getBuyableAugmentations, sortAugmentations } from "./utils/augHandling";

export async function main(ns: NS): Promise<void> {
  ns.disableLog("ALL")
  ns.clearLog()
  // Count how many threads are currently running on each server and print it
  const buyableAugmentations = sortAugmentations(ns, getBuyableAugmentations(ns))
  for (const aug of buyableAugmentations) {
    const sources = getAugmentationSource(ns, aug)
    ns.print(`${aug} ${ns.formatNumber(ns.singularity.getAugmentationPrice(aug), 0)}: ${sources.map(s => `${s.faction} (${s.reason})`).join(", ")}`)
    ns.singularity.purchaseAugmentation(sources[0].faction, aug)
    await ns.sleep(200)
  }

} 
