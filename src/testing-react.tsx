import React from 'lib/react';

import { NS, Server } from '@ns';
import getServers from './utils/getServers';
import { connectServer } from './utils/connect-server';
import { calcSortedServerToHack } from './utils/serversSorting';

export function MyComponent() {
  const [count, setCount] = React.useState(0);

  return <div>Count {count} <button onClick={() => setCount(count + 1)}>Add to count</button></div>;
}

export function ServerBrowser({ ns }: { ns: NS }) {
  const [serverList, setServerList] = React.useState<Server[]>([]);
  const timeStarted = React.useMemo(() => Date.now(), []);
  const [timeSinceStart, setTimeSinceStart] = React.useState(0);

  React.useEffect(() => {
    const interval = setInterval(() => {
      // setServerList(getServers(ns).map(server => ns.getServer(server)));
      setTimeSinceStart(Date.now() - timeStarted);
    }, 1000);
    return () => clearInterval(interval);
  }, [ns, timeStarted]);

  React.useEffect(() => {
    const servers = getServers(ns)
    const sorted = calcSortedServerToHack(ns, servers)
    setServerList(sorted.map(s => ns.getServer(s) as Server))
  }, [ns])

  return (
    <div>
      <table>
        <thead><tr><td>Hostname</td><td>Max$</td><td>$</td></tr></thead>
        <tbody>
          {serverList.map(server =>
            (<tr onClick={() => { connectServer(ns, server.hostname) }}><td>{server.hostname}</td><td>{server.moneyMax}</td><td>{server.moneyAvailable}</td></tr>)
          )}
        </tbody>
      </table>
      {`Time since start: ${ns.format.time(timeSinceStart)}`}
    </div>
  )
}

export async function main(ns: NS) {
  ns.ui.openTail();
  ns.disableLog("ALL")

  ns.printRaw(<ServerBrowser ns={ns} />);


  for (; ;) {
    await ns.asleep(1000);
  }

}