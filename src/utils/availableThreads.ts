import { NS } from "@ns";
import { GB_FOR_HOME } from "./constants";

function availableThreads(ns: NS, scripts: string[], servers: string[], useCores = false): number {
  const ramUsage = Math.max(...scripts.map(script => ns.getScriptRam(script)));
  let totalThreads = 0;
  for (const serverName of servers) {
    const server = ns.getServer(serverName);
    const availableRam = server.maxRam - server.ramUsed - (serverName === "home" ? GB_FOR_HOME : 0); // leave some ram on home for other scripts
    totalThreads += Math.floor(availableRam / ramUsage) * (useCores ? server.cpuCores : 1);
  }
  return totalThreads;
}

export default availableThreads