import { CompanyName, NS, Player, Skills } from "@ns";

export async function upgradeJobs(ns: NS): Promise<void> {
  if (!ns.fileExists("Formulas.exe")) {
    return
  }
  const player = ns.getPlayer()
  const jobs = player.jobs
  Object.entries(jobs).forEach(([c, job]) => {
    const companyName = c as CompanyName
    const options = ns.singularity.getCompanyPositions(companyName).map(position => ns.singularity.getCompanyPositionInfo(companyName, position))
    const currentPosition = ns.singularity.getCompanyPositionInfo(companyName, job)
    const currentReputation = ns.singularity.getCompanyRep(companyName)
    const currentGains = ns.formulas.work.companyGains(player, companyName, currentPosition.name, 0)
    let bestOption = currentPosition
    for (const option of options) {
      const optionGains = ns.formulas.work.companyGains(player, companyName, option.name, 0)
      if (
        option.requiredReputation <= currentReputation &&
        hasNecessarySkills(player, option.requiredSkills) &&
        (optionGains.reputation > currentGains.reputation ||
          (optionGains.reputation === currentGains.reputation && optionGains.money > currentGains.money))
      ) {
        bestOption = option
      }
    }
    if (bestOption !== currentPosition) {
      ns.singularity.applyToCompany(companyName, bestOption.field)
    }
  })
}

function hasNecessarySkills(player: Player, requiredSkills: Skills): boolean {
  for (const skill in requiredSkills) {
    const requiredLevel = requiredSkills[skill as keyof Skills] ?? 0
    if (player.skills[skill as keyof Skills] < requiredLevel) {
      return false
    }
  }
  return true
}