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
    // Only join factions that dont have enemies and that have augmentations we don't have yet, to avoid joining factions that we will never do anything with
    if (ns.singularity.getFactionEnemies(faction).length === 0 && hasRemainingAugmentations(ns, faction)) {
      if (ns.singularity.joinFaction(faction)) {
        hadChanges = true;
      }
    }
  }
  return hadChanges;
}

function hasRemainingAugmentations(ns: NS, faction: string): boolean {
  const augmentations = ns.singularity.getAugmentationsFromFaction(faction)
  const ownedAugmentations = ns.singularity.getOwnedAugmentations(true)
  const unownedAugmentations = augmentations.filter(a => !ownedAugmentations.includes(a))
  const otherFactionAugmentations = unownedAugmentations.filter(a => otherJoinedFactionHasAugmentation(ns, a, faction))
  return unownedAugmentations.length > 0 && otherFactionAugmentations.length < unownedAugmentations.length
}

function otherJoinedFactionHasAugmentation(ns: NS, augmentation: string, faction: string): boolean {
  const factions = ns.singularity.getAugmentationFactions(augmentation)
  const player = ns.getPlayer()
  return factions.some(f => f !== faction && player.factions.includes(f))
}