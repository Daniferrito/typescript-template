import { NS } from "@ns";

export function getBuyableAugmentations(ns: NS): string[] {
  const player = ns.getPlayer()
  const invitations = ns.singularity.checkFactionInvitations()
  const joinedFactions = player.factions
  const factionWith150Favor = invitations.filter(f => ns.singularity.getFactionFavor(f) >= 150)
  const relevantFactions = [...new Set([...joinedFactions, ...factionWith150Favor])]
  const augmentations = relevantFactions.flatMap(f =>
    ns.singularity.getAugmentationsFromFaction(f)
      .filter(a => ns.singularity.getAugmentationRepReq(a) <= ns.singularity.getFactionRep(f) || ns.singularity.getFactionFavor(f) >= 150)
  )
  const uniqueAugmentations = [...new Set(augmentations)]
  const ownedAugmentations = ns.singularity.getOwnedAugmentations(true)
  const unownedAugmentations = uniqueAugmentations.filter(a => !ownedAugmentations.includes(a))
  return unownedAugmentations.filter(a => hasAllPrerequisites(ns, a, unownedAugmentations))
}

function hasAllPrerequisites(ns: NS, augmentation: string, availableAugs: string[]): boolean {
  const prerequisites = ns.singularity.getAugmentationPrereq(augmentation)
  const ownedAugmentations = ns.singularity.getOwnedAugmentations(true)
  return prerequisites.every(p => ownedAugmentations.includes(p) || availableAugs.includes(p))
}

export function getAugmentationSource(ns: NS, augmentation: string): { faction: string, reason: "rep" | "150+ favor" }[] {
  const factions = ns.singularity.getAugmentationFactions(augmentation)
  return factions.flatMap(f => {
    const repReq = ns.singularity.getAugmentationRepReq(augmentation)
    const favor = ns.singularity.getFactionFavor(f)
    if (repReq <= ns.singularity.getFactionRep(f)) {
      return [{ faction: f, reason: "rep" }]
    } else if (favor >= 150) {
      return [{ faction: f, reason: "150+ favor" }]
    } else {
      return [] as { faction: string, reason: "rep" | "150+ favor" }[]
    }
  })
}

// Sort augmentations, so that if augmentation A is a prerequisite for augmentation B, then A comes before B in the list, and otherwise sort them by money cost in descending order, so that we buy the most expensive ones first
export function sortAugmentations(ns: NS, augmentations: string[]): string[] {
  const sorted = [...augmentations]
  sorted.sort((a, b) => {
    const costA = ns.singularity.getAugmentationPrice(a)
    const costB = ns.singularity.getAugmentationPrice(b)
    return costB - costA
  })

  return bubbleAugPrerequisites(ns, sorted)
}

function bubbleAugPrerequisites(ns: NS, augmentations: string[]): string[] {
  const sorted = [...augmentations]
  const ownedAugmentations = ns.singularity.getOwnedAugmentations(true)
  let changed: boolean
  do {
    changed = false
    for (let i = 0; i < sorted.length; i++) {
      const aug = sorted[i]
      const unownedPrereqs = ns.singularity.getAugmentationPrereq(aug).filter(p => !ownedAugmentations.includes(p))
      if (unownedPrereqs.length > 0) {
        for (const prereq of unownedPrereqs) {
          const index = sorted.indexOf(prereq)
          if (index > i) {
            // Move the prerequisite to before the augmentation
            sorted.splice(index, 1)
            sorted.splice(i, 0, prereq)
            changed = true
          }
        }
      }
    }
  } while (changed)
  return sorted
}