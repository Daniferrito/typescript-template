import React, { ReactDOM } from 'lib/react';
import { NS } from "@ns";

import getServers from "./utils/getServers";
import hackServer, { HackServerOutput } from "./utils/hackServer";
import { SHARE_SCRIPT, waitTimeMs } from "./utils/constants";
import { upgradeHome, buyOrUpgradeServers, buyPrograms } from "./utils/upgradingThings";
import { calcSortedServerToHack } from "./utils/serversSorting";
import { joinFactions } from "./utils/factionHandling";
import { upgradeJobs } from './utils/jobsHandler';
import { scanServers } from './utils/scan-servers';

let ns: NS

export async function main(_ns: NS): Promise<void> {
  ns = _ns
  ns.clearLog()
  ns.print("------------------------------")
  ns.print("Starting main script...")
  ns.print("------------------------------")

  ns.disableLog("ALL")
  startupScripts(ns)

  ns.ui.openTail()
  ns.ui.resizeTail(2000, 400)

  const overviewExtraHook = document.getElementById('overview-extra-hook-0')
  if (overviewExtraHook && overviewExtraHook.parentElement) {
    (overviewExtraHook.parentElement as HTMLTableCellElement).colSpan = 2
  }
  ReactDOM.render(<TimerComponent />, overviewExtraHook);
  ns.ui.moveTail(550, 800)
  await ns.asleep(100) // wait for scan-all to finish and write the files

  await multiHack(ns)
}

async function startupScripts(ns: NS): Promise<void> {
  scanServers(ns)
  ns.exec("solve-coding-contracts.js", "home", {
    preventDuplicates: true,
  })
  const homeServer = ns.getServer("home")
  if (homeServer.maxRam >= 2 ** 8) {
    const ramToUse = homeServer.maxRam * 0.05
    const ramForScript = ns.getScriptRam(SHARE_SCRIPT)
    const threads = Math.floor(ramToUse / ramForScript)
    ns.kill(SHARE_SCRIPT, "home")
    ns.exec(SHARE_SCRIPT, "home", threads)
  }
}

async function buyThings(ns: NS): Promise<boolean> {
  const upgradeHomeResult = upgradeHome(ns)
  const buyProgramsResult = buyPrograms(ns)
  const buyOrUpgradeServersResult = buyOrUpgradeServers(ns)
  const joinFactionsResult = await joinFactions(ns)
  return upgradeHomeResult || buyProgramsResult || buyOrUpgradeServersResult || joinFactionsResult;
}

async function preCycleUpgrade(ns: NS, servers: string[]): Promise<string[]> {
  await upgradeJobs(ns)
  const changes = await buyThings(ns)
  if (changes) {
    return scanServers(ns).hackedServers
  }
  return servers
}

interface Timer {
  hostname: string
  output: HackServerOutput
  timeStarted: number
  timeFinishes: number
}
const timers: Timer[] = []

async function multiHack(ns: NS, fixedTargets?: string[]): Promise<never> {
  timers.splice(0, timers.length) // clear timers
  let servers = getServers(ns)
  for (; ;) {
    servers = await preCycleUpgrade(ns, servers)
    const targets = (fixedTargets && fixedTargets.length > 0) ? fixedTargets : calcSortedServerToHack(ns, servers)
    // Get first target that does not have a batch running
    const filteredTargets = targets.filter(t => !timers.some(timer => timer.hostname === t))
    if (filteredTargets.length) {
      let couldStartBatch = false
      for (const target of filteredTargets) {
        const output = hackServer(ns, target, servers)
        if (output.totalTime > 0) {
          const now = Date.now()
          timers.push({
            hostname: target,
            timeStarted: now,
            timeFinishes: now + output.totalTime,
            output,
          })
          couldStartBatch = true
        }
      }
      if (!couldStartBatch) {
        if (timers.length === 0) {
          ns.tprint("ERROR  : Couldn't start any batch, but no timers? This should never happen, something is wrong")
          await ns.asleep(waitTimeMs)
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
  const timeToWait = nextTimer.timeFinishes - Date.now()
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
            <tr key={`${timer.hostname}-progress`}><td colSpan={3}><ProgressBar progress={(now - timer.timeStarted) / (timer.timeFinishes - timer.timeStarted)} /></td></tr>
          </>
        ))}
      </tbody>
    </table>
    // </th>
  )
}

function ProgressBar({ progress }: { progress: number }): React.ReactElement {
  return (
    <span
      style={{
        overflow: "hidden",
        display: "block",
        height: "4px",
        position: "relative",
        backgroundColor: "rgb(17,17,17)"
      }}
      role="progressbar" aria-valuenow={progress * 100} aria-valuemin={0} aria-valuemax={100}>
      <span
        style={{
          width: `100%`,
          left: 0,
          bottom: 0,
          top: 0,
          transform: `translateX(${-100 + progress * 100}%)`,
          backgroundColor: "rgb(173, 255, 47)",
          position: "absolute",
        }} />
    </span >)
}