import { NS } from "@ns";

export async function main(ns: NS): Promise<void> {
  ns.disableLog("ALL")
  ns.clearLog()
  ns.ui.openTail();

  for (const task of ns.gang.getTaskNames()) {
    const taskStats = ns.gang.getTaskStats(task)
    ns.print(JSON.stringify(taskStats))
  }
}