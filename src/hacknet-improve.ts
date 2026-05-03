import { NodeStats, NS } from "@ns";
import getServers from "./utils/getServers";
import { calcSortedServerToHackRaw } from "./utils/serversSorting";

const MoneyGainPerLevel = 1.5
const HacknetNodeMoney = 1

interface Option {
  optionType: "new" | "core" | "level" | "ram"
  index: number
  cost: number
  increase: number
  timeToPayback: number
  timeToBuy: number
}

export async function main(ns: NS) {
  ns.disableLog("ALL")
  ns.enableLog("hacknet.spendHashes")

  const bestServer = calcOptimalServerToImprove(ns)
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const percentageToBuy = 0.95 * (Math.min(Math.log10(ns.getServerMoneyAvailable("home")), 9) / 9)
    while (((ns.hacknet.numHashes() > ns.hacknet.hashCapacity() * percentageToBuy) && ns.hacknet.numHashes() > 4)) {
      ns.hacknet.spendHashes("Sell for Money")
    }
    const percentageOfMoneyToUse = 0.0001 // 0.0001% of current money
    while (ns.hacknet.getPurchaseNodeCost() < ns.getServerMoneyAvailable("home") * percentageOfMoneyToUse * 10) {
      ns.hacknet.purchaseNode()
    }
    for (let i = 0; i < ns.hacknet.numNodes(); i++) {
      while (ns.hacknet.getLevelUpgradeCost(i) < ns.getServerMoneyAvailable("home") * percentageOfMoneyToUse) {
        ns.hacknet.upgradeLevel(i)
      }
      while (ns.hacknet.getRamUpgradeCost(i) < ns.getServerMoneyAvailable("home") * percentageOfMoneyToUse) {
        ns.hacknet.upgradeRam(i)
      }
      while (ns.hacknet.getCoreUpgradeCost(i) < ns.getServerMoneyAvailable("home") * percentageOfMoneyToUse) {
        ns.hacknet.upgradeCore(i)
      }
      while (ns.hacknet.getCacheUpgradeCost(i) < ns.getServerMoneyAvailable("home") * percentageOfMoneyToUse) {
        ns.hacknet.upgradeCache(i)
      }
    }

    if (ns.hacknet.numHashes() > ns.hacknet.hashCost("Exchange for Bladeburner Rank")) {
      ns.print("Exchanging hashes for Bladeburner Rank")
      ns.hacknet.spendHashes("Exchange for Bladeburner Rank")
    }
    if (ns.hacknet.numHashes() > ns.hacknet.hashCost("Exchange for Bladeburner SP")) {
      ns.print("Exchanging hashes for Bladeburner SP")
      ns.hacknet.spendHashes("Exchange for Bladeburner SP")
    }
    if (ns.hacknet.numHashes() > ns.hacknet.hashCost("Generate Coding Contract")) {
      ns.print("Exchanging hashes for Coding Contract")
      ns.hacknet.spendHashes("Generate Coding Contract")
    }
    const jobs = Object.keys(ns.getPlayer().jobs)
    if (ns.hacknet.numHashes() > ns.hacknet.hashCost("Company Favor") && jobs.length > 0) {
      ns.print(`Exchanging hashes for Company Favor with ${jobs[0]}`)
      ns.hacknet.spendHashes("Company Favor", jobs[0])
    }
    if (ns.hacknet.numHashes() > ns.hacknet.hashCost("Reduce Minimum Security") && bestServer) {
      ns.print(`Exchanging hashes to reduce minimum security of ${bestServer}`)
      ns.hacknet.spendHashes("Reduce Minimum Security", bestServer)
    }
    if (ns.hacknet.numHashes() > ns.hacknet.hashCost("Increase Maximum Money") && bestServer) {
      ns.print(`Exchanging hashes to increase maximum money of ${bestServer}`)
      ns.hacknet.spendHashes("Increase Maximum Money", bestServer)
    }

    const options = getOptions(ns)
    options.sort((a, b) => (a.timeToPayback + a.timeToBuy) - (b.timeToPayback + b.timeToBuy))
    const bestOption = options[0]
    const surplus = surplusMoney(ns)
    // ns.print(`Best option: ${bestOption.optionType} ${bestOption.index} - Cost: ${ns.format.number(bestOption.cost, 0)} - Increase: ${ns.format.number(bestOption.increase, 0)}, Time to Payback: ${ns.format.time(bestOption.timeToPayback * 1000)}, Time to Buy: ${ns.format.time(bestOption.timeToBuy * 1000)}, Surplus: ${ns.format.number(surplus, 0)} (Income: ${ns.format.number(getIncome(ns), 0)}/s)`)
    // const newNodeOption = options.find(o => o.optionType === "new")
    // ns.print(`New node option: Cost: ${newNodeOption?.cost} - Increase: ${newNodeOption?.increase}, Time to Payback: ${ns.format.time((newNodeOption?.timeToPayback ?? 0) * 1000)}, Time to Buy: ${ns.format.time((newNodeOption?.timeToBuy ?? 0) * 1000)}`)
    if (bestOption.timeToBuy == 0 && (bestOption.timeToPayback < 60 * 60 || (surplus > bestOption.cost && bestOption.timeToPayback < 60 * 60 * 6))) {
      await buyOption(ns, bestOption)
    } else {
      await ns.asleep(5000)
    }
  }
}

async function buyOption(ns: NS, option: Option) {
  switch (option.optionType) {
    case "new":
      ns.hacknet.purchaseNode()
      break
    case "core":
      ns.hacknet.upgradeCore(option.index)
      break
    case "level":
      ns.hacknet.upgradeLevel(option.index)
      break
    case "ram":
      ns.hacknet.upgradeRam(option.index)
      break
  }
  await ns.sleep(1)
}

function getOptions(ns: NS): Option[] {
  const money = ns.getServerMoneyAvailable("home") * 0.1
  const income = getIncome(ns)
  const options: Pick<Option, "optionType" | "index" | "cost" | "increase">[] = []
  const firstNode = ns.hacknet.numNodes() > 0 ? ns.hacknet.getNodeStats(0) : null
  if (ns.hacknet.numNodes() < ns.hacknet.maxNumNodes()) {
    const newNodeOptions = calcNewNodeOptions(ns, firstNode)
    options.push({
      optionType: "new",
      index: -1,
      cost: newNodeOptions.cost,
      increase: newNodeOptions.increase,
    })
  }
  for (let i = 0; i < ns.hacknet.numNodes(); i++) {
    const node = ns.hacknet.getNodeStats(i)
    options.push({
      optionType: "core",
      index: i,
      cost: ns.hacknet.getCoreUpgradeCost(i),
      increase: calcCoreIncrease(ns, node)
    })
    options.push({
      optionType: "level",
      index: i,
      cost: ns.hacknet.getLevelUpgradeCost(i),
      increase: calcLevelIncrease(ns, node)
    })
    options.push({
      optionType: "ram",
      index: i,
      cost: ns.hacknet.getRamUpgradeCost(i),
      increase: calcRamIncrease(ns, node)
    })
  }
  const finalOptions: Option[] = []
  for (const option of options) {
    finalOptions.push({
      ...option,
      timeToPayback: option.cost / option.increase,
      timeToBuy: option.cost - money > 0 ? (option.cost - money) / income : 0,
    })
  }
  return finalOptions
}

function getIncome(ns: NS) {
  let income = 0
  const hashMult = ns.hacknet.numHashes() > 0 ? 1_000_000 / 4 : 1
  for (let i = 0; i < ns.hacknet.numNodes(); i++) {
    const node = ns.hacknet.getNodeStats(i)
    income += node.production * hashMult
  }
  return income
}

function calcNewNodeOptions(ns: NS, firstNode: NodeStats | null): { cost: number, increase: number } {
  if (!firstNode) {
    return {
      cost: ns.hacknet.getPurchaseNodeCost(), increase: calcNodeGeneration(ns, {
        cores: 1,
        level: 1,
        name: "",
        ram: 1,
        production: 0,
        timeOnline: 0,
        totalProduction: 0,
      })
    }
  }
  const halfNode: NodeStats = {
    ...firstNode,
    level: Math.ceil(firstNode.level / 2),
    ram: Math.ceil(firstNode.ram / 2),
    cores: Math.ceil(firstNode.cores / 2),
  }
  const cost = calcNodeCost(ns, halfNode) + ns.hacknet.getPurchaseNodeCost()
  const increase = calcNodeGeneration(ns, halfNode)
  return { cost, increase }
}

function calcNodeCost(ns: NS, node: NodeStats): number {
  let cost = 0
  cost += ns.formulas.hacknetNodes.levelUpgradeCost(0, node.level)
  cost += ns.formulas.hacknetNodes.ramUpgradeCost(0, node.ram)
  cost += ns.formulas.hacknetNodes.coreUpgradeCost(0, node.cores)
  return cost
}

function calcCoreIncrease(ns: NS, node: NodeStats) {
  const upgraded = {
    ...node,
    cores: node.cores + 1
  }
  return calcNodeGeneration(ns, upgraded) - calcNodeGeneration(ns, node)
}

function calcLevelIncrease(ns: NS, node: NodeStats) {
  const upgraded = {
    ...node,
    level: node.level + 1
  }
  return calcNodeGeneration(ns, upgraded) - calcNodeGeneration(ns, node)
}

function calcRamIncrease(ns: NS, node: NodeStats) {
  const upgraded = {
    ...node,
    ram: node.ram * 2
  }
  return calcNodeGeneration(ns, upgraded) - calcNodeGeneration(ns, node)
}

function calcNodeGeneration(ns: NS, node: NodeStats) {
  return ns.formulas.hacknetServers.hashGainRate(node.level, 0, node.ram, node.cores) * 1_000_000 / 4
}

function surplusMoney(ns: NS) {
  const sources = ns.getMoneySources()
  const gainedMoney = sources.sinceInstall.hacknet
  const spentMoney = sources.sinceInstall.hacknet_expenses
  return gainedMoney + spentMoney + sources.sinceInstall.total * 0.001 // add 0.1% of current money as a buffer
}

function calcOptimalServerToImprove(ns: NS): string {
  const servers = getServers(ns)
  const player = ns.getPlayer()
  const previousHacking = ns.read("previous_hacking.txt")
  try {
    player.skills.hacking = parseInt(previousHacking)
    if (isNaN(player.skills.hacking)) {
      player.skills.hacking = 1000
    }
  } catch (e) {
    player.skills.hacking = 1000
  }
  const sorted = calcSortedServerToHackRaw(ns, servers, player, true)
  return sorted[0].hostname
}