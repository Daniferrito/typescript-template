import React, { ReactDOM } from 'lib/react';
import { NS } from "@ns";

import hackServer, { HackServerOutput } from "./utils/hackServer";
import { SHARE_SCRIPT, waitTimeMs } from "./utils/constants";
import { calcSortedServerToHackRaw } from "./utils/serversSorting";
import { scanServers } from './utils/scan-servers';
import { runSomewhereUnique } from './utils/runScript';
import { formatTimeShort } from './utils/formatting';
import { HackAnalyzeResult } from './utils/hackAnalize';
import trainHacking from './utils/trainHacking';
import { buyOrUpgradeServers, buyPrograms, upgradeHome } from './utils/upgradingThings';

const doc = eval("document") as Document

let ns: NS

export async function main(_ns: NS): Promise<void> {
  ns = _ns
  ns.clearLog()
  ns.print("------------------------------")
  ns.print("Starting main script...")
  ns.print("------------------------------")

  ns.disableLog("ALL")
  startupScripts(ns,)

  // ns.ui.openTail()
  ns.ui.resizeTail(2000, 400)
  ns.ui.moveTail(300, 820)

  const overviewExtraHook = doc.getElementById('overview-extra-hook-0')
  if (overviewExtraHook && overviewExtraHook.parentElement) {
    (overviewExtraHook.parentElement as HTMLTableCellElement).colSpan = 2
  }
  ReactDOM.render(<TimerComponent />, overviewExtraHook);
  await ns.asleep(100) // wait for scan-all to finish and write the files

  for (; ;) {
    await multiHack(ns, ns.args[0] ? ns.args as string[] : undefined)
    ns.tprint("ERROR  : multiHack returned, this should never happen, something is wrong")
  }
}

async function startupScripts(ns: NS): Promise<void> {
  const servers = scanServers(ns).hackedServers
  copyEverythingEverywhere(ns, servers)
  runSomewhereUnique(ns, "solve-coding-contracts.js", servers)
  runSomewhereUnique(ns, "change-activity.js", servers)
  runSomewhereUnique(ns, "gang-handler.js", servers)
  runSomewhereUnique(ns, "hacknet-improve.js", servers)
  runSomewhereUnique(ns, "join-factions-jobs.js", servers)
  runSomewhereUnique(ns, "buy-augs.js", servers)
  runSomewhereUnique(ns, "bladeburner-skills.js", servers)
  runSomewhereUnique(ns, "prestige.js", servers)
  const homeServer = ns.getServer("home")
  if (!(homeServer.maxRam >= 2 ** 8)) {
    return;
  }
  const ramToUse = homeServer.maxRam * 0.05
  const ramForScript = ns.getScriptRam(SHARE_SCRIPT)
  const threads = Math.floor(ramToUse / ramForScript)
  ns.kill(SHARE_SCRIPT, "home")
  ns.exec(SHARE_SCRIPT, "home", threads)
}

async function preCycleUpgrade(ns: NS): Promise<string[]> {
  const upgradedHome = upgradeHome(ns)
  const boughtPrograms = buyPrograms(ns)
  const upgradedServers = buyOrUpgradeServers(ns)
  const servers = scanServers(ns).hackedServers
  if (upgradedHome || boughtPrograms || upgradedServers) {
    ns.print(`INFO   : Upgraded things before cycle: ${upgradedHome ? "home" : ""} ${boughtPrograms ? "programs" : ""} ${upgradedServers ? "servers" : ""}`)
    startupScripts(ns)
  }
  return servers
}

interface Timer {
  hostname: string
  input: HackAnalyzeResult
  output: HackServerOutput
  timeStarted: number
  timeFinishes: number
  timeStartsFinishing: number
  killed: boolean
}
const timers: Timer[] = []

function killLowEffScriptsGen(timers: Timer[]): (efficiencyThreshold: number) => boolean {
  return (efficiencyThreshold: number): boolean => {
    // ns.print(`Checking for batches to kill with efficiency threshold ${ns.format.number(efficiencyThreshold, 0)}$/th/s ( ${timers.length} timers)`)
    const now = Date.now()
    for (const timer of timers) {
      if (timer.timeStartsFinishing < now || timer.output.batchPids.length === 0) {
        // ns.print(`Skipping timer on ${timer.hostname} because it has started to finish`)
        continue
      }
      const totalTime = timer.timeFinishes - now

      const totalThreads = timer.output.totalThreads
      const totalHackedMoney = timer.output.totalHackedMoney
      const threadEfficiency = (totalHackedMoney) / totalThreads

      const efficiency = threadEfficiency / (totalTime / 1000)
      if (efficiency < efficiencyThreshold && !timer.killed) {
        if (efficiency > 0) {
          ns.print(`WARN   : Killing batch on ${timer.hostname} with efficiency ${ns.format.number(efficiency, 0)}$/th/s, which is below the threshold of ${ns.format.number(efficiencyThreshold, 0)}$/th/s`)
        }
        for (const batch of timer.output.batchPids) {
          for (const pid of batch) {
            ns.kill(pid)
          }
        }
        timer.killed = true
        if (timer.output.prepared === "already" || timer.output.prepared === "no") {
          // Remove the timer immediately if the server was already prepared
          timers.splice(timers.indexOf(timer), 1)
        }
        return true
      }
    }
    return false
  }
}
let maxEff = 0
async function multiHack(ns: NS, fixedTargets?: string[]): Promise<never> {
  timers.splice(0, timers.length) // clear timers
  maxEff = 0
  let timeLastDecrease = Date.now()
  for (; ;) {
    const now = Date.now()
    while (now - timeLastDecrease > 5 * 1000) {
      maxEff *= 0.99
      timeLastDecrease += 5 * 1000
    }
    if (timers.length === 0) {
      maxEff = 0
    }
    const servers = await preCycleUpgrade(ns)
    const targets = (fixedTargets && fixedTargets.length > 0) ? fixedTargets : servers
    // Get first target that does not have a batch running
    const filteredTargets = targets.filter(t => !timers.some(timer => timer.hostname === t))
    const sortedTargets = calcSortedServerToHackRaw(ns, filteredTargets).filter(t => t.efficiency > maxEff * 0.1)
    maxEff = Math.max(maxEff, sortedTargets[0]?.efficiency ?? 0)
    if (sortedTargets.length) {
      // let couldStartBatch = false
      for (const target of sortedTargets) {
        if (timers.length >= 20) {
          break
        }
        const output = hackServer(ns, target, servers, killLowEffScriptsGen(timers))
        // ns.print(`INFO   : Hack attempt on ${target.hostname} finished. Efficiency: ${ns.format.number(output.efficiency, 0)}$/th/s. Prepared: ${output.prepared}. Time until first batch can finish: ${ns.format.time(output.firstFinishTime)}. Total time until all batches finish: ${ns.format.time(output.totalTime)}.`)
        if (output.totalTime > 0) {
          timers.push({
            hostname: target.hostname,
            timeStarted: now,
            timeFinishes: now + output.totalTime,
            timeStartsFinishing: now + output.firstFinishTime,
            input: target,
            output,
            killed: false
          })
          // couldStartBatch = true
        }
      }
    }
    const trainingOutput = trainHacking(ns, servers)
    if (trainingOutput.totalTime > 0) {
      timers.push({
        hostname: `training (${trainingOutput.hostname})`,
        timeStarted: now,
        timeFinishes: now + trainingOutput.totalTime,
        timeStartsFinishing: now + trainingOutput.firstFinishTime,
        input: {} as HackAnalyzeResult,
        output: trainingOutput,
        killed: false
      })
      // couldStartBatch = true
    }

    await waitForNextTimer(ns, timers)

  }
}

async function waitForNextTimer(ns: NS, timers: Timer[]): Promise<void> {
  if (timers.length === 0) {
    await ns.asleep(5 * 1000)
    return
  }
  const nextTimer = timers.reduce((prev, curr) => prev.timeFinishes < curr.timeFinishes ? prev : curr)
  const timeToWait = Math.min(5 * 1000, nextTimer.timeFinishes - Date.now())
  if (timeToWait > 0) {
    await ns.asleep(timeToWait + waitTimeMs)
  }
  const now = Date.now()
  timers.splice(0, timers.length, ...timers.filter(timer => timer.timeFinishes > now)) // remove timers that have finished
  // return timers.filter(timer => timer.timeFinishes > now);
}

function TimerComponent() {
  const [now, setNow] = React.useState(Date.now())

  React.useEffect(() => {
    const interval = setInterval(() => {
      setNow(Date.now())
    }, 1000)
    return () => clearInterval(interval)
  }, [])

  const player = ns.getPlayer()
  return (
    // <th colSpan={2}>
    <>
      <p>Karma: {ns.format.number(player.karma, 2)}, Kills: {ns.format.number(player.numPeopleKilled, 0)}</p>
      <p>Total: {ns.format.number(timers.reduce((acc, timer) => acc + timer.output.timeEfficiency, 0), 0)}$/s (${ns.format.number(maxEff, 0)}$/th/s)</p>
      <table style={{ width: "100%" }}>
        <thead><tr>
          <td>Hostname</td>
          <td>Time</td>
          <td>Eff</td>
        </tr></thead>
        <tbody>
          {timers.map(timer => (
            <>
              <tr key={timer.hostname} style={{
                textAlign: "end",
                color: preparedTypeToColor(timer.output.prepared)
              }}>
                <td style={{ textAlign: "start" }}>{timer.hostname}</td>
                <td>{formatTimeShort(timer.timeFinishes - now)}</td>
                <td>{`${ns.format.number(timer.output.efficiency, 0).padStart(4, ' ')}`}</td>
              </tr>
              <tr key={`${timer.hostname}-progress`}><td colSpan={3}><DoubleProgressBar progress1={(now - timer.timeStarted) / (timer.timeFinishes - timer.timeStarted)} progress2={(now - timer.timeStarted) / (timer.timeStartsFinishing - timer.timeStarted)} /></td></tr>
            </>
          ))}
        </tbody>
      </table>
    </>
  )
}

function preparedTypeToColor(preparedType: string): string {
  switch (preparedType) {
    case "full":
      return "rgb(204, 204, 0)"
    case "partial":
      return "rgb(255, 0, 0)"
    case "already":
      return "rgb(0, 204, 0)"
    case "fullNoBatches":
      return "rgb(204, 102, 0)"
    case "no":
      return "rgb(102, 102, 102)"
    default:
      return "rgb(255, 255, 255)"
  }
}

// progress1 marsk the right of the bar, and progress2 marks the left
// so if progress1 is 0.8 and progress2 is 0.5, the bar will be from 50% to 80%
function DoubleProgressBar({ progress1, progress2 }: { progress1: number, progress2: number }): React.ReactElement {
  return (
    <span
      style={{
        overflow: "hidden",
        display: "block",
        height: "4px",
        position: "relative",
        backgroundColor: "rgb(17,17,17)"
      }}
      role="progressbar" aria-valuenow={(progress2) * 100} aria-valuemin={0} aria-valuemax={100}>
      <span
        style={{
          width: `${(progress1) * 100}%`,
          left: 0,
          bottom: 0,
          top: 0,
          backgroundColor: "rgb(173, 255, 47)",
          position: "absolute",
        }} />
      <span
        style={{
          width: `${(progress2 - progress1) * 100}%`,
          left: `${progress1 * 100}%`,
          bottom: 0,
          top: 0,
          backgroundColor: "rgb(255, 0, 0)",
          position: "absolute",
        }} />
    </span >)
}

function copyEverythingEverywhere(ns: NS, servers: string[]) {
  const everything = ns.ls("home").filter(file => file.endsWith(".js") || file.endsWith(".txt"))
  for (const server of servers) {
    ns.scp(everything, server, "home")
  }
}
