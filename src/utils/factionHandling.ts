import { NS } from "@ns";
import { connectServer } from "./connect-server";

const hackingFactionNames = ["CyberSec", "NiteSec", "The Black Hand", "BitRunners"] as const
const hackingFactionServers: {
  [key in typeof hackingFactionNames[number]]: string
} = {
  CyberSec: "CSEC",
  NiteSec: "avmnite-02h",
  "The Black Hand": "I.I.I.I",
  BitRunners: "run4theh111z",
} as const

export async function joinFactions(ns: NS): Promise<boolean> {
  let hadChanges = false;
  for (const faction of hackingFactionNames) {
    const server = ns.getServer(hackingFactionServers[faction])
    if (server.requiredHackingSkill && ns.getPlayer().skills.hacking >= server.requiredHackingSkill && server.hasAdminRights && !server.backdoorInstalled) {
      connectServer(ns, server.hostname)
      await ns.singularity.installBackdoor()
      ns.singularity.connect("home")
    }
  }
  const invitations = ns.singularity.checkFactionInvitations()
  for (const faction of invitations) {
    if (ns.singularity.getFactionEnemies(faction).length === 0) {
      if (ns.singularity.joinFaction(faction)) {
        hadChanges = true;
      }
    }
  }
  return hadChanges;
}