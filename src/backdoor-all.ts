import { NS, Server } from "@ns";
import getServers from "./utils/getServers";
import { connectServer } from "./utils/connect-server";

export async function main(ns: NS): Promise<void> {
  ns.disableLog("ALL")
  ns.enableLog("singularity.installBackdoor")
  const servers = getServers(ns)
  for (const serverHostname of servers) {
    const server = ns.getServer(serverHostname) as Server
    if (!server.backdoorInstalled && server.hasAdminRights && !(server.purchasedByPlayer || serverHostname === "home") && (server.requiredHackingSkill ?? 0) <= ns.getHackingLevel()) {
      connectServer(ns, serverHostname)
      await ns.sleep(100) // wait for connect-server to finish and we are connected to the server
      await ns.singularity.installBackdoor()
    }
  }
  connectServer(ns, "home") // connect back to home at the end
}