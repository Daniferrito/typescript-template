import { NS } from "@ns";
import { getAugmentationSource, getBuyableAugmentations, sortAugmentations } from "./utils/augHandling";

export async function main(ns: NS): Promise<void> {
  ns.disableLog("ALL")
  ns.enableLog("singularity.purchaseAugmentation")
  ns.enableLog("singularity.donateToFaction")
  ns.clearLog()

  // If there are any factions with 150+ favor that have augs we dont have yet, and that are not on the getBuyableAugmentations list, donate to them until we can buy those augs
  const baseBuyableAugmentations = getBuyableAugmentations(ns)
  const factions = ns.singularity.checkFactionInvitations().concat(ns.getPlayer().factions)
  for (const faction of factions) {
    if (ns.singularity.getFactionFavor(faction) < 150) {
      continue
    }
    const augmentations = ns.singularity.getAugmentationsFromFaction(faction)
    const unownedAugmentations = augmentations.filter(a => !ns.singularity.getOwnedAugmentations(true).includes(a))
    const donateableAugmentations = unownedAugmentations.filter(a => !baseBuyableAugmentations.includes(a))
    if (donateableAugmentations.length >= 0) {
      ns.singularity.joinFaction(faction)
      await ns.sleep(200)
    }
    for (const aug of donateableAugmentations) {
      const currentRep = ns.singularity.getFactionRep(faction)
      const reqRepGain = ns.singularity.getAugmentationRepReq(aug) - currentRep
      if (reqRepGain > 0) {
        ns.singularity.donateToFaction(faction, ns.formulas.reputation.donationForRep(reqRepGain, ns.getPlayer()))
        await ns.sleep(200)
        baseBuyableAugmentations.push(aug)
      }
    }
  }
  // Count how many threads are currently running on each server and print it
  const buyableAugmentations = sortAugmentations(ns, getBuyableAugmentations(ns))
  for (const aug of buyableAugmentations) {
    const sources = getAugmentationSource(ns, aug)
    ns.print(`${aug} ${ns.formatNumber(ns.singularity.getAugmentationPrice(aug), 0)}: ${sources.map(s => `${s.faction} (${s.reason})`).join(", ")}`)
    if (sources.every(s => s.reason === "150+ favor")) {
      const reqRepGain = ns.singularity.getAugmentationRepReq(aug) - ns.singularity.getFactionRep(sources[0].faction)
      ns.singularity.donateToFaction(sources[0].faction, ns.formulas.reputation.donationForRep(reqRepGain, ns.getPlayer()))
      await ns.sleep(200)
      ns.singularity.purchaseAugmentation(sources[0].faction, aug)
    } else {
      ns.singularity.purchaseAugmentation(sources.filter(s => s.reason !== "150+ favor")[0].faction, aug)
    }
    await ns.sleep(200)
  }

  const higherRepFactionWith150Favor = factions
    .filter(f => ns.singularity.getFactionFavor(f) >= 150)
    .sort((a, b) => ns.singularity.getFactionRep(b) - ns.singularity.getFactionRep(a))[0]
  const higherRepFaction = factions.filter(f => ns.singularity.getFactionRep(f) > 0)
    .sort((a, b) => ns.singularity.getFactionRep(b) - ns.singularity.getFactionRep(a))[0]
  for (; ;) {
    // Buy NFG as much as we can, donating to the faction with greatest current rep if needed
    const nfg = "NeuroFlux Governor"
    const nfgPrice = ns.singularity.getAugmentationPrice(nfg)
    const reqRepGain = ns.singularity.getAugmentationRepReq(nfg) - ns.singularity.getFactionRep(higherRepFactionWith150Favor ?? higherRepFaction)
    if (reqRepGain > 0 && higherRepFactionWith150Favor) {
      ns.singularity.donateToFaction(higherRepFactionWith150Favor, ns.formulas.reputation.donationForRep(reqRepGain, ns.getPlayer()))
      await ns.sleep(200)
    }
    if (ns.getServerMoneyAvailable("home") >= nfgPrice && ns.singularity.getFactionRep(higherRepFactionWith150Favor ?? higherRepFaction) >= ns.singularity.getAugmentationRepReq(nfg)) {
      ns.singularity.purchaseAugmentation(higherRepFactionWith150Favor ?? higherRepFaction, nfg)
      await ns.sleep(200)
    } else {
      break
    }
  }
}
