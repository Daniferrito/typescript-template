import { NS } from "@ns";

export async function main(ns: NS): Promise<void> {
  ns.disableLog("ALL")
  ns.clearLog()
  ns.ui.openTail();

}
