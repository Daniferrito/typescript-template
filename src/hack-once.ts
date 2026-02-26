import { NS } from "@ns"

export async function main(ns: NS): Promise<void> {
  await ns.hack(ns.args[0] as string, {
    additionalMsec: ns.args[1] as number,
    stock: ns.args[2] as boolean,
  })
}