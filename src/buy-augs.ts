import { NS } from "@ns";
import { getAugmentationSource, getBuyableAugmentations, sortAugmentations } from "./utils/augHandling";

export async function main(ns: NS): Promise<void> {
  ns.disableLog("ALL")
  // ns.enableLog("singularity.purchaseAugmentation")
  // ns.enableLog("singularity.donateToFaction")
  ns.clearLog()

  for (; ;) {
    const [numOfBuyableAugs, numOfNFGs] = countPurchaseableAugs(ns)
    const numOfNonNFGAugs = numOfBuyableAugs - numOfNFGs
    ns.print(`You can currently buy ${numOfBuyableAugs} augmentations (${numOfNonNFGAugs} non-NFGs and ${numOfNFGs} NFGs) with your current money and faction reputations (including donations)`)
    if (numOfNonNFGAugs >= 5) {
      await buyAllAugmentations(ns)
      ns.singularity.installAugmentations("start-script.js")
    }
    await ns.sleep(60 * 1000)
  }
}

async function buyAllAugmentations(ns: NS) {
  // If there are any factions with 150+ favor that have augs we dont have yet, and that are not on the getBuyableAugmentations list, donate to them until we can buy those augs
  const baseBuyableAugmentations = getBuyableAugmentations(ns)
  const factions = ns.singularity.checkFactionInvitations().concat(ns.getPlayer().factions)
  for (const faction of factions) {
    if (ns.singularity.getFactionFavor(faction) < ns.getBitNodeMultipliers().RepToDonateToFaction) {
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
    .filter(f => ns.singularity.getFactionFavor(f) >= ns.getBitNodeMultipliers().RepToDonateToFaction)
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

function countPurchaseableAugs(ns: NS): [number, number] {
  // Simulate the process of buying augmentations and keep track of spent money to see how many augmentations we can buy with the current money
  // Each purchased augmentation increases the price of the next one by 1.9x

  const player = ns.getPlayer()

  const buyableAugmentations = getBuyableAugmentations(ns)
  let money = ns.getServerMoneyAvailable("home")
  let count = 0
  const sources = player.factions.concat(ns.singularity.checkFactionInvitations()).map(f => ({
    faction: f,
    favor: ns.singularity.getFactionFavor(f),
    rep: ns.singularity.getFactionRep(f),
    donatedMoney: 0,
  }))

  for (const aug of buyableAugmentations) {
    const price = ns.singularity.getAugmentationPrice(aug) * (1.9 ** count)
    if (money < price) {
      continue
    }
    const augSources = getAugmentationSource(ns, aug)
    if (augSources.every(s => s.reason === "150+ favor")) {
      const faction = sources.filter(s => s.faction === augSources[0].faction).sort((a, b) => b.rep - a.rep)[0]
      if (faction == null) {
        continue
      }
      const reqRepGain = ns.singularity.getAugmentationRepReq(aug) - faction.rep
      if (reqRepGain > 0) {
        const donation = ns.formulas.reputation.donationForRep(reqRepGain, ns.getPlayer())
        if (money < donation) {
          break
        }
        faction.donatedMoney += donation
        money -= donation
        faction.rep += reqRepGain
      }
    }
    money -= price
    count++
  }
  let nfgBought = 0

  const higherRepFactionWith150Favor = sources
    .filter(s => s.favor >= ns.getBitNodeMultipliers().RepToDonateToFaction)
    .sort((a, b) => b.rep - a.rep)[0]
  const higherRepFaction = sources.filter(s => s.rep > 0)
    .sort((a, b) => b.rep - a.rep)[0]
  if (!higherRepFaction) {
    return [count, nfgBought]
  }
  for (; ;) {
    // Buy as many NFG as we can with the remaining money, donating if needed
    const nfgPrice = ns.singularity.getAugmentationPrice("NeuroFlux Governor") * (1.9 ** count) * (1.14 ** nfgBought)
    const nfgRepReq = ns.singularity.getAugmentationRepReq("NeuroFlux Governor") * (1.14 ** nfgBought)
    const repReqGain = nfgRepReq - (higherRepFactionWith150Favor ?? higherRepFaction).rep
    if (repReqGain > 0 && higherRepFactionWith150Favor) {
      const donation = ns.formulas.reputation.donationForRep(repReqGain, ns.getPlayer())
      if (money < donation) {
        break
      }
      money -= donation
      higherRepFactionWith150Favor.donatedMoney += donation
      higherRepFactionWith150Favor.rep += repReqGain
    }
    if (money < nfgPrice || (higherRepFactionWith150Favor ?? higherRepFaction).rep < nfgRepReq) {
      break
    }
    money -= nfgPrice
    nfgBought++
    count++
  }

  return [count, nfgBought]
}