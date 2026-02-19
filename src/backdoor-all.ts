import { NS } from "@ns";
import getServers from "./utils/getServers";
import { connectServer } from "./utils/connect-server";

export async function main(ns: NS): Promise<void> {
  ns.disableLog("ALL")
  ns.enableLog("singularity.installBackdoor")
  const servers = getServers(ns)
  for (const serverHostname of servers) {
    const server = ns.getServer(serverHostname)
    if (!server.backdoorInstalled && server.hasAdminRights && !(server.purchasedByPlayer || serverHostname === "home") && (server.requiredHackingSkill ?? 0) <= ns.getHackingLevel()) {
      connectServer(ns, serverHostname)
      await ns.sleep(100) // wait for connect-server to finish and we are connected to the server
      await ns.singularity.installBackdoor()
    }
  }
  await connectServer(ns, "home") // connect back to home at the end
  const invitations = ns.singularity.checkFactionInvitations()
  if (invitations.length > 0) {
    ns.print(`Joining factions: ${invitations.join(", ")}`)
    for (const faction of invitations) {
      if (ns.singularity.getFactionEnemies(faction).length === 0) {
        ns.singularity.joinFaction(faction)
      }
    }
  }
}