import { NS } from "@ns";
import { getAugmentationSource, getBuyableAugmentations, sortAugmentations } from "./utils/augHandling";
import { FactionName } from "./utils/enums";

export async function main(ns: NS): Promise<void> {
  ns.disableLog("ALL")
  ns.enableLog("singularity.purchaseAugmentation")
  // ns.enableLog("singularity.donateToFaction")
  ns.clearLog()

  for (; ;) {
    // const [numOfBuyableAugs, numOfNFGs] = countPurchaseableAugs(ns)
    const buyableAugmentations = getMaxBuyableAugmentations(ns)
    const numOfBuyableAugs = buyableAugmentations.length
    const numOfNFGs = buyableAugmentations.filter(a => a === "NeuroFlux Governor").length
    const canBuyRedPill = ns.singularity.getFactionFavor(FactionName.Daedalus) + ns.singularity.getFactionFavorGain(FactionName.Daedalus) >= ns.getBitNodeMultipliers().FavorToDonateToFaction * 150 && ns.getServerMoneyAvailable("home") >= ns.formulas.reputation.donationForRep(ns.getBitNodeMultipliers().FavorToDonateToFaction * 150, ns.getPlayer())
    const numOfNonNFGAugs = numOfBuyableAugs - numOfNFGs
    ns.print(`You can currently buy ${numOfBuyableAugs} augmentations (${numOfNonNFGAugs} non-NFGs and ${numOfNFGs} NFGs) with your current money and faction reputations (including donations)`)
    ns.print(`Buyable augmentations: ${buyableAugmentations.join(", ")}`)
    if (canBuyRedPill || numOfNFGs + numOfNonNFGAugs * 2 >= 10) {
      // await buyAllAugmentations(ns)
      await buySpecificAugmentations(ns, buyableAugmentations)
      const currHacking = ns.getPlayer().skills.hacking
      ns.write("previous_hacking.txt", currHacking.toString(), "w")
      ns.singularity.installAugmentations("start-script.js")
    }
    await ns.sleep(5 * 1000)
  }
}

async function buyAllAugmentations(ns: NS) {
  // If there are any factions with 150+ favor that have augs we dont have yet, and that are not on the getBuyableAugmentations list, donate to them until we can buy those augs
  const baseBuyableAugmentations = getBuyableAugmentations(ns)
  const factions = ns.singularity.checkFactionInvitations().concat(ns.getPlayer().factions)
  for (const faction of factions) {
    if (ns.singularity.getFactionFavor(faction) < ns.getBitNodeMultipliers().FavorToDonateToFaction * 150) {
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
  const buyableAugmentations = sortAugmentations(ns, getBuyableAugmentations(ns))
  for (const aug of buyableAugmentations) {
    const sources = getAugmentationSource(ns, aug)
    ns.print(`${aug} ${ns.format.number(ns.singularity.getAugmentationPrice(aug), 0)}: ${sources.map(s => `${s.faction} (${s.reason})`).join(", ")}`)
    const nonFavorSource = sources.find(s => s.reason !== "150+ favor")
    if (sources.every(s => s.reason === "150+ favor") && sources[0] != null) {
      const reqRepGain = ns.singularity.getAugmentationRepReq(aug) - ns.singularity.getFactionRep(sources[0].faction)
      ns.singularity.donateToFaction(sources[0].faction, ns.formulas.reputation.donationForRep(reqRepGain, ns.getPlayer()))
      await ns.sleep(200)
      ns.singularity.purchaseAugmentation(sources[0].faction, aug)
    } else if (nonFavorSource) {
      ns.singularity.purchaseAugmentation(nonFavorSource.faction, aug)
    }
    await ns.sleep(200)
  }
  const gang = ns.gang.inGang() ? ns.gang.getGangInformation() : null
  const higherRepFactionWith150Favor = factions
    .filter(f => f !== gang?.faction && f !== "Bladeburners")
    .filter(f => ns.singularity.getFactionFavor(f) >= ns.getBitNodeMultipliers().FavorToDonateToFaction * 150)
    .sort((a, b) => ns.singularity.getFactionRep(b) - ns.singularity.getFactionRep(a))[0]
  const higherRepFaction = factions
    .filter(f => f !== gang?.faction && f !== "Bladeburners")
    .filter(f => ns.singularity.getFactionRep(f) > 0)
    .sort((a, b) => ns.singularity.getFactionRep(b) - ns.singularity.getFactionRep(a))[0]
  if (!higherRepFaction) {
    return
  }
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
      const faction = sources.filter(s => s.faction === augSources[0]?.faction).sort((a, b) => b.rep - a.rep)[0]
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

  const gang = ns.gang.inGang() ? ns.gang.getGangInformation() : null
  const higherRepFactionWith150Favor = sources
    .filter(s => s.faction !== gang?.faction && s.faction !== "Bladeburners")
    .filter(s => s.favor >= ns.getBitNodeMultipliers().FavorToDonateToFaction * 150)
    .sort((a, b) => b.rep - a.rep)[0]
  const higherRepFaction = sources
    .filter(s => s.faction !== gang?.faction && s.faction !== "Bladeburners")
    .filter(s => s.rep > 0)
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

function getMaxBuyableAugmentations(ns: NS): string[] {
  // Decides the maximum number of augmentations we can buy with the current money and faction reputations, without actually buying them, by simulating the buying process and keeping track of spent money and used reputation

  const augList = []
  const buyableAugmentations = getBuyableAugmentations(ns)
    .sort((a, b) => ns.singularity.getAugmentationPrice(a) - ns.singularity.getAugmentationPrice(b))
  // Add augmentations one by one, starting with the cheapest, and check if we can afford to buy them with the current money and faction reputations (including donations), by keeping track of spent money and used reputation
  // If not, skip that one and move to the next one.
  // Use canBuyAugmentationList to check if we can buy the current list of augmentations
  for (const aug of buyableAugmentations) {
    const newAugList = [aug, ...augList]
    if (canBuyAugmentationList(ns, newAugList)) {
      augList.unshift(aug)
    }
  }
  // Add as many NFG as we can with the remaining money, donating if needed
  for (; ;) {
    const newAugList = [...augList, "NeuroFlux Governor"]
    if (!canBuyAugmentationList(ns, newAugList)) {
      break
    }
    augList.push("NeuroFlux Governor")
  }
  return augList
}

function canBuyAugmentationList(ns: NS, augmentations: string[]): boolean {
  // Simulates buying the given list of augmentations in order and checks if we can afford to buy all of them with the current money and faction reputations, by keeping track of spent money and used reputation
  const player = ns.getPlayer()
  let money = ns.getServerMoneyAvailable("home")
  const sources = player.factions.concat(ns.singularity.checkFactionInvitations()).map(f => ({
    faction: f,
    favor: ns.singularity.getFactionFavor(f),
    rep: ns.singularity.getFactionRep(f),
    donatedMoney: 0,
  }))
  let priceMultiplier = 1
  const multiplierIncrement = 1.9 * 0.93 // SF 11 lvl 3

  for (const aug of augmentations) {
    const price = ns.singularity.getAugmentationPrice(aug)
      * priceMultiplier
    priceMultiplier *= multiplierIncrement
    if (money < price) {
      return false
    }
    const augSources = getAugmentationSource(ns, aug)
    if (augSources.every(s => s.reason === "150+ favor")) {
      const faction = sources.filter(s => s.faction === augSources[0]?.faction).sort((a, b) => b.rep - a.rep)[0]
      if (faction == null) {
        return false
      }
      const reqRepGain = ns.singularity.getAugmentationRepReq(aug) - faction.rep
      if (reqRepGain > 0) {
        const donation = ns.formulas.reputation.donationForRep(reqRepGain, ns.getPlayer())
        if (money < donation) {
          return false
        }
        faction.donatedMoney += donation
        money -= donation
        faction.rep += reqRepGain
      }
    }
    money -= price
  }
  return true
}

async function buySpecificAugmentations(ns: NS, augmentations: string[]) {
  ns.write("augs-to-buy.txt", `Trying to buy the following augmentations in order: ${augmentations.join(", ")}\n`, "a")
  // Buys the given list of augmentations in order, by keeping track of spent money and used reputation to make sure we buy them in the correct order
  const sources = ns.getPlayer().factions.concat(ns.singularity.checkFactionInvitations()).map(f => ({
    faction: f,
    favor: ns.singularity.getFactionFavor(f),
    rep: ns.singularity.getFactionRep(f),
    donatedMoney: 0,
  }))
  for (const aug of augmentations) {
    const augSources = getAugmentationSource(ns, aug)
    if (augSources.every(s => s.reason === "150+ favor")) {
      const faction = sources.filter(s => s.faction === augSources[0]?.faction).sort((a, b) => b.rep - a.rep)[0]
      if (faction == null) {
        ns.write("augs-to-buy.txt", `Could not find faction for augmentation ${aug}\n`, "a")
        continue
      }
      ns.singularity.joinFaction(faction.faction)
      const reqRepGain = ns.singularity.getAugmentationRepReq(aug) - faction.rep
      if (reqRepGain > 0) {
        ns.singularity.donateToFaction(faction.faction, ns.formulas.reputation.donationForRep(reqRepGain, ns.getPlayer()))
        ns.write("augs-to-buy.txt", `Donated ${ns.formulas.reputation.donationForRep(reqRepGain, ns.getPlayer())} to ${faction.faction} for augmentation ${aug}\n`, "a")
        await ns.sleep(200)
        faction.donatedMoney += ns.formulas.reputation.donationForRep(reqRepGain, ns.getPlayer())
        faction.rep += reqRepGain
      }
      ns.singularity.purchaseAugmentation(faction.faction, aug)
      ns.write("augs-to-buy.txt", `Bought ${aug} from ${faction.faction}\n`, "a")
      await ns.sleep(200)
    } else {
      const nonFavorSource = augSources.find(s => s.reason !== "150+ favor")
      if (nonFavorSource) {
        ns.singularity.purchaseAugmentation(nonFavorSource.faction, aug)
        ns.write("augs-to-buy.txt", `Bought ${aug} from ${nonFavorSource.faction}\n`, "a")
        await ns.sleep(200)
      }
    }
  }
}