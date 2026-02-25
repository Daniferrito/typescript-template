import { NodeStats, NS } from "@ns";

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
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const options = getOptions(ns)
    options.sort((a, b) => (a.timeToPayback + a.timeToBuy) - (b.timeToPayback + b.timeToBuy))
    const bestOption = options[0]
    ns.print(`Best option: ${bestOption.optionType} ${bestOption.index} - Cost: ${bestOption.cost} - Increase: ${bestOption.increase}, Time to Payback: ${ns.tFormat(bestOption.timeToPayback * 1000)}, Time to Buy: ${ns.tFormat(bestOption.timeToBuy * 1000)}`)
    if (bestOption.timeToBuy == 0 && bestOption.timeToPayback < 60 * 30) {
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
}

function getOptions(ns: NS): Option[] {
  const money = ns.getServerMoneyAvailable("home") * 0.01
  const income = getIncome(ns)
  const options: Pick<Option, "optionType" | "index" | "cost" | "increase">[] = []
  if (ns.hacknet.numNodes() < ns.hacknet.maxNumNodes()) {
    options.push({
      optionType: "new",
      index: -1,
      cost: ns.hacknet.getPurchaseNodeCost(),
      increase: calcNewNodeIncrease(ns),
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
  for (let i = 0; i < ns.hacknet.numNodes(); i++) {
    const node = ns.hacknet.getNodeStats(i)
    income += node.production
  }
  return income
}

function calcNewNodeIncrease(ns: NS) {
  return calcNodeGeneration(ns, {
    cores: 1,
    level: 1,
    name: "",
    ram: 1,
    production: 0,
    timeOnline: 0,
    totalProduction: 0,
  })
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
  const gainPerLevel = MoneyGainPerLevel;
  const multipliers = ns.getHacknetMultipliers()

  const levelMult = node.level * gainPerLevel;
  const ramMult = Math.pow(1.035, node.ram - 1);
  const coresMult = (node.cores + 5) / 6;
  return levelMult * ramMult * coresMult * multipliers.production * HacknetNodeMoney;
}