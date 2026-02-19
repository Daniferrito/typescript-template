import { NS } from "@ns"

function getPath(visited: { [hostname: string]: string }, target: string): string[] {
  const path = [target]
  while (path[0] !== "home") {
    const parent = visited[path[0]]
    if (!parent) {
      throw new Error(`Could not find path to ${target}`)
    }
    path.unshift(parent)
  }
  return path
}

export function connectServer(ns: NS, target: string) {
  const open: [string, string][] = [["home", ""]]
  const visited: { [hostname: string]: string } = {}

  while (open.length > 0) {
    const curr = open.pop() as [string, string]
    visited[curr[0]] = curr[1]
    if (curr[0] === target) {
      break
    }
    const neightbours = ns.scan(curr[0])
    for (const neightbour of neightbours) {
      if (visited[neightbour]) {
        continue
      }
      open.push([neightbour, curr[0]])
    }
  }
  const path = getPath(visited, target)

  ns.singularity.connect("home")
  for (let i = 1; i < path.length; i++) {
    const server = path[i]
    ns.singularity.connect(server)
  }
}