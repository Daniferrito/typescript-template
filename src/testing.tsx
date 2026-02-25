import React from 'lib/react';

import { NS } from "@ns";
import { calcEfficiency } from "./utils/hackAnalize";
import getServers from './utils/getServers';

export async function main(ns: NS): Promise<void> {
  ns.disableLog("ALL")
  ns.clearLog()
  ns.ui.openTail();

  const servers = getServers(ns)
  // const servers = ["n00dles"]

  // const servers = [
  //   "omega-net",
  //   "phantasy",
  // ]

  const results: Entry[] = []
  for (const server of servers) {
    if (ns.getServerMaxMoney(server) === 0 || (ns.getServerRequiredHackingLevel(server) ?? Infinity) > ns.getPlayer().skills.hacking || !ns.hasRootAccess(server)) {
      continue
    }
    const serverResults: { x: number, y: number }[] = []
    for (let hackThreads = 1; hackThreads <= 3000; hackThreads += 1) {
      const result = calcEfficiency(ns, server, hackThreads)
      serverResults.push({ x: result.hackThreads, y: result.efficiency })
    }
    const maxEfficiency = Math.max(...serverResults.map(d => d.y))
    if (maxEfficiency <= 0) {
      continue
    }
    results.push({ name: server, data: serverResults })
  }
  for (const result of results) {
    const maxEfficiency = Math.max(...result.data.map(d => d.y))
    const maxEfficiencyPoint = result.data.find(d => d.y === maxEfficiency)
    ns.print(`${result.name.padStart(18)}: max efficiency ${ns.formatNumber(maxEfficiency, 2).padStart(6)} at ${String(maxEfficiencyPoint?.x ?? 0).padStart(6)}`)
  }

  ns.printRaw(<Graph entries={results} />)
}

interface Entry {
  name: string
  data: { x: number, y: number }[]
}

function Graph({ entries }: { entries: Entry[] }) {
  const maxY = Math.max(...entries.flatMap(e => e.data.map(d => d.y)))
  const minY = Math.min(...entries.flatMap(e => e.data.map(d => d.y)))
  return (
    <svg viewBox={`0 0 100 100`} style={{ width: "1000px", height: "1000px" }}>
      {entries.map((entry, i) => <GraphPolyline key={i} data={entry.data} minY={minY} maxY={maxY} colour={`hsl(${(i / entries.length) * 360}, 100%, 50%)`} />)}
    </svg>
  )
}

function GraphPolyline({ data, colour, minY, maxY }: { data: { x: number, y: number }[], colour: string, minY: number, maxY: number }) {
  // const maxY = Math.max(...data.map(d => d.y))
  // const minY = Math.min(...data.map(d => d.y))
  const minX = Math.min(...data.map(d => d.x))
  const maxX = Math.max(...data.map(d => d.x))
  return (
    <polyline fill="none" stroke={colour} strokeWidth="0.5" points={
      data.map(d => `${((d.x - minX) / (maxX - minX)) * 100},${100 - ((d.y - minY) / (maxY - minY)) * 100}`).join(" ")
    } />
  )
}
