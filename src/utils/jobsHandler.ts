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
    let bestOption = currentPosition
    for (const option of options) {
      if (
        option.requiredReputation <= currentReputation &&
        hasNecessarySkills(player, option.requiredSkills) &&
        ns.formulas.work.companyGains(player, companyName, option.name, 0) > ns.formulas.work.companyGains(player, companyName, bestOption.name, 0)
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