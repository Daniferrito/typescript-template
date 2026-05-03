import { NS } from "@ns";

export async function main(ns: NS): Promise<void> {
  const resetInfo = ns.getResetInfo()
  const currentBitnode = resetInfo.currentNode
  const allSourceFiles = ns.singularity.getOwnedSourceFiles()
  const currentBitnodeData = allSourceFiles.find(sF => sF.n === currentBitnode)
  const nextBitnode = currentBitnodeData == null || (currentBitnodeData.lvl >= 3 && currentBitnodeData.n != 12) ? currentBitnode : 12
  for (; ;) {
    ns.singularity.destroyW0r1dD43m0n(nextBitnode, "start-script.js")
    await ns.sleep(60 * 1000)
  }
}
