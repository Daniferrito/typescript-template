import { NS } from "@ns";

export async function main(ns: NS): Promise<void> {
  ns.run("start-script.js", {
    preventDuplicates: true,
  })
}