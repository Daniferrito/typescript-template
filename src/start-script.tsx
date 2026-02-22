import React, { ReactDOM } from 'lib/react';
import { NS } from "@ns";

import hackServer, { HackServerOutput } from "./utils/hackServer";
import { SHARE_SCRIPT, waitTimeMs } from "./utils/constants";
import { calcSortedServerToHack } from "./utils/serversSorting";
import { scanServers } from './utils/scan-servers';
import { runSomewhereUnique } from './utils/runScript';

let ns: NS

export async function main(_ns: NS): Promise<void> {
  ns = _ns
  ns.clearLog()
  ns.print("------------------------------")
  ns.print("Starting main script...")
  ns.print("------------------------------")

  ns.disableLog("ALL")
  startupScripts(ns,)

  ns.ui.openTail()
  ns.ui.resizeTail(2000, 400)
  ns.ui.moveTail(550, 820)

  const overviewExtraHook = document.getElementById('overview-extra-hook-0')
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
  runSomewhereUnique(ns, "upgrade-things.js", servers)
  runSomewhereUnique(ns, "solve-coding-contracts.js", servers)
  runSomewhereUnique(ns, "hacknet-improve.js", servers)
  runSomewhereUnique(ns, "join-factions-jobs.js", servers)
  runSomewhereUnique(ns, "change-activity.js", servers)
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
  while (ns.singularity.upgradeHomeRam()) {
    // Repeat until we can't upgrade anymore
  }
  return scanServers(ns).hackedServers
}

interface Timer {
  hostname: string
  output: HackServerOutput
  timeStarted: number
  timeFinishes: number
  timeStartsFinishing: number
}
const timers: Timer[] = []

async function multiHack(ns: NS, fixedTargets?: string[]): Promise<never> {
  timers.splice(0, timers.length) // clear timers
  for (; ;) {
    const servers = await preCycleUpgrade(ns)
    const targets = (fixedTargets && fixedTargets.length > 0) ? fixedTargets : calcSortedServerToHack(ns, servers)
    // Get first target that does not have a batch running
    const filteredTargets = targets.filter(t => !timers.some(timer => timer.hostname === t))
    if (filteredTargets.length) {
      let couldStartBatch = false
      for (const target of filteredTargets) {
        const output = hackServer(ns, target, servers)
        // ns.print(`INFO   : Hack attempt on ${target} finished. Efficiency: ${ns.formatNumber(output.efficiency, 0)}$/th/s. Prepared: ${output.prepared}. Time until first batch can finish: ${ns.tFormat(output.firstFinishTime)}. Total time until all batches finish: ${ns.tFormat(output.totalTime)}.`)
        if (output.totalTime > 0) {
          const now = Date.now()
          timers.push({
            hostname: target,
            timeStarted: now,
            timeFinishes: now + output.totalTime,
            timeStartsFinishing: now + output.firstFinishTime,
            output,
          })
          couldStartBatch = true
        }
      }
      if (!couldStartBatch) {
        if (timers.length === 0) {
          ns.tprint("ERROR  : Couldn't start any batch, but no timers? This should never happen, something is wrong")
          await ns.asleep(5 * 1000)
        } else {
          await waitForNextTimer(ns, timers)
        }
      }
    } else {
      await waitForNextTimer(ns, timers)
    }
  }
}

async function waitForNextTimer(ns: NS, timers: Timer[]): Promise<void> {
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

  return (
    // <th colSpan={2}>
    <table>
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
              color: timer.output.prepared === "full" ? "rgb(204, 204, 0)" : (timer.output.prepared === "partial" ? "rgb(255, 0, 0)" : "rgb(0, 204, 0)")
            }}>
              <td style={{ textAlign: "start" }}>{timer.hostname}</td>
              <td>{ns.tFormat(timer.timeFinishes - now)}</td>
              <td>{`${ns.formatNumber(timer.output.efficiency, 0).padStart(4, ' ')}$/th/s`}</td>
            </tr>
            <tr key={`${timer.hostname}-progress`}><td colSpan={3}><DoubleProgressBar progress1={(now - timer.timeStarted) / (timer.timeFinishes - timer.timeStarted)} progress2={(now - timer.timeStarted) / (timer.timeStartsFinishing - timer.timeStarted)} /></td></tr>
          </>
        ))}
      </tbody>
    </table>
    // </th>
  )
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