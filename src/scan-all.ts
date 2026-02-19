import { NS } from "@ns";
import { scanServers } from "./utils/scan-servers";

export async function main(ns: NS): Promise<void> {
  ns.disableLog("ALL")
  await scanServers(ns)
}
