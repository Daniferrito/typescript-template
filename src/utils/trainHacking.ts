import { NS, Server } from "@ns"
import { HackServerOutput } from "./hackServer";
import { runAllocatedScripts, scriptAllocator } from "./runScript";
import { WEAK_SCRIPT } from "./constants";

export default function trainHacking(ns: NS, servers: string[]): HackServerOutput {
  const player = ns.getPlayer()
  const bestServer = servers
    .map(s => ns.getServer(s) as Server)
    .filter(s => (s.requiredHackingSkill ?? Infinity <= player.skills.hacking) && s.hasAdminRights)
    .map(s => ({ name: s.hostname, server: s, expPerSec: expGain(s) / ns.formulas.hacking.weakenTime({ ...s, hackDifficulty: s.minDifficulty }, player) }))
    .sort((a, b) => b.expPerSec - a.expPerSec)[0]

  const allocations = scriptAllocator(ns, [
    { script: WEAK_SCRIPT, threads: Infinity, args: [bestServer.name, 0], useCores: true, allowPartial: true },
  ], servers)

  const pids = runAllocatedScripts(ns, allocations)

  const totalThreads = allocations.allocations.reduce((sum, a) => sum + a.servers.reduce((s, srv) => s + srv.threads, 0), 0)
  const totalTime = totalThreads > 0 ? ns.getWeakenTime(bestServer.name) : 0

  return {
    hostname: bestServer.name,
    totalTime,
    firstFinishTime: totalTime,
    totalHackedMoney: 0,
    prepared: "no",
    batchesLaunched: 1,
    batchPids: [pids],
    totalThreads,
    threadEfficiency: 0,
    timeEfficiency: 0,
    efficiency: 0
  }
}

function expGain(server: Server): number {
  const baseDifficulty = server.baseDifficulty;
  if (!baseDifficulty) return 0;
  const baseExpGain = 3;
  const diffFactor = 0.3;
  let expGain = baseExpGain;
  expGain += baseDifficulty * diffFactor;
  return expGain;
}