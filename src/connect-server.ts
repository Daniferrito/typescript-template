import { NS } from "@ns";
import { connectServer } from "./utils/connect-server";

export async function main(ns: NS): Promise<void> {
  ns.disableLog("ALL")
  if (ns.args.length < 1) {
    throw new Error("Please provide a target server as an argument")
  }
  const target = ns.args[0] as string
  return connectServer(ns, target)
}

