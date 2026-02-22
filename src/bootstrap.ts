import { NS } from "@ns";

export async function main(ns: NS): Promise<void> {
  let homeRam = ns.getServerMaxRam("home")
  ns.kill("start-script.js") // kill any existing instance of start-script to prevent multiple instances running at the same time
  if (homeRam >= 256) {
    ns.run("start-script.js")
    return
  }
  // Start in basic mode
  ns.run("start-script.js", {
    preventDuplicates: true,
    ramOverride: 20,
  })

  for (; ;) {
    await ns.sleep(10 * 1000)
    const newHomeRam = ns.getServerMaxRam("home")
    if (newHomeRam > homeRam) {
      ns.kill("start-script.js")
      homeRam = newHomeRam
      if (homeRam >= 256) {
        ns.run("start-script.js")
        return
      }
      ns.exec("start-script.js", "home", {
        preventDuplicates: true,
        ramOverride: 20,
      })
    }
  }
}