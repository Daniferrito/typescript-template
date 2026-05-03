import { NS, ProgramName } from "@ns"

export function buyOrUpgradeServers(ns: NS): boolean {
  let hadChanges = false;
  // Purchase servers at the minimum ram until we have the max, then upgrade them one by one
  while (ns.cloud.getServerNames().length < ns.cloud.getServerLimit() && ns.cloud.getServerCost(2) < ns.getServerMoneyAvailable("home")) {
    ns.print(`Purchasing new server with 2GB of RAM (current: ${ns.cloud.getServerNames().length}/${ns.cloud.getServerLimit()})`)
    ns.cloud.purchaseServer(`pserv-${ns.cloud.getServerNames().length.toString().padStart(2, "0")}`, 2)
    hadChanges = true;
    // await ns.sleep(100) // wait for server to be purchased before trying to buy another one
  }
  if (ns.cloud.getServerNames().length < ns.cloud.getServerLimit()) {
    return hadChanges;
  }

  // Find the server with the least ram and upgrade it as much as possible, then repeat
  for (const server of ns.cloud.getServerNames().sort((a, b) => ns.getServerMaxRam(a) - ns.getServerMaxRam(b))) {
    if (ns.getServerUsedRam(server) < ns.getServerMaxRam(server) * 0.1 && ns.getServerMaxRam(server) < 2 ** 10) {
      continue // skip servers that are barely used, as we dont need to upgrade servers that we dont need
    }
    for (let i = 20; i > 1; i--) {
      const ram = 2 ** i
      if (ns.getServerMaxRam(server) >= ram) {
        break
      }
      if (ns.cloud.getServerCost(ram) < ns.getServerMoneyAvailable("home") * (ram > 2 ** 10 ? 0.05 : 1)) {
        ns.print(`Upgrading server ${server} from ${ns.getServerMaxRam(server)}GB to ${ram}GB of RAM (cost: ${ns.format.number(ns.cloud.getServerCost(ram), 0)})`)
        ns.cloud.upgradeServer(server, ram)
        hadChanges = true;
        continue
      }
    }
  }
  return hadChanges;
}

export function upgradeHome(ns: NS): boolean {
  let hadChanges = false;
  while (ns.singularity.upgradeHomeRam()) {
    ns.print(`Upgrading home RAM to ${ns.getServerMaxRam("home")}GB...`)
    hadChanges = true;
  }
  while (ns.singularity.upgradeHomeCores()) {
    ns.print(`Upgrading home cores to ${ns.getServer("home").cpuCores}...`)
    // hadChanges = true;
  }

  return hadChanges;
}

export function buyPrograms(ns: NS): boolean {
  let hadChanges = false;
  if (!ns.singularity.purchaseTor()) {
    return false
  }
  const programs = ns.singularity.getDarkwebPrograms() as ProgramName[];
  for (const program of programs) {
    if (ns.singularity.getDarkwebProgramCost(program) < ns.getServerMoneyAvailable("home") && !ns.fileExists(program, "home") && ns.singularity.purchaseProgram(program)) {
      ns.print(`Purchased program ${program} from the dark web`)
      hadChanges = true;
    }
  }
  return hadChanges;
} 