import { NS, Player, Server } from "@ns"

interface TimesOutput {
  hackTime: number
  weakTime: number
  growTime: number
}

export function times(ns: NS, player: Player, server: Server): TimesOutput {
  const hasFormulas = ns.fileExists("Formulas.exe", "home")
  const growTimeMultiplier = 3.2;
  const weakenTimeMultiplier = 4.0;
  if (hasFormulas) {
    const hackingTime = ns.formulas.hacking.hackTime(server, player)
    return {
      hackTime: hackingTime,
      weakTime: hackingTime * weakenTimeMultiplier,
      growTime: hackingTime * growTimeMultiplier,
    }
  }
  const { hackDifficulty, requiredHackingSkill } = server;
  if (typeof hackDifficulty !== "number" || typeof requiredHackingSkill !== "number") return { hackTime: Infinity, weakTime: Infinity, growTime: Infinity };
  const difficultyMult = requiredHackingSkill * hackDifficulty;


  const baseDiff = 500;
  const baseSkill = 50;
  const diffFactor = 2.5;
  let skillFactor = diffFactor * difficultyMult + baseDiff;
  skillFactor /= player.skills.hacking + baseSkill;

  const hackTimeMultiplier = 5;
  const hackingTime =
    (hackTimeMultiplier * skillFactor) /
    (player.mults.hacking_speed *
      // ns.getBitNodeMultipliers().HackingSpeedMultiplier *
      calculateIntelligenceBonus(player.skills.intelligence, 1));

  return {
    hackTime: hackingTime,
    weakTime: hackingTime * weakenTimeMultiplier,
    growTime: hackingTime * growTimeMultiplier
  };
}

export function calculatePercentMoneyHacked(ns: NS, player: Player, server: Server): number {
  const hackDifficulty = server.hackDifficulty ?? 100;
  if (hackDifficulty >= 100) return 0;
  const requiredHackingSkill = server.requiredHackingSkill ?? 1e9;
  // Adjust if needed for balancing. This is the divisor for the final calculation
  const balanceFactor = 240;

  const difficultyMult = (100 - hackDifficulty) / 100;
  const skillMult = (player.skills.hacking - (requiredHackingSkill - 1)) / player.skills.hacking;
  const percentMoneyHacked =
    (difficultyMult
      * skillMult
      * player.mults.hacking_money
      * 0.2
      // * ns.getBitNodeMultipliers().ScriptHackMoney
    ) / balanceFactor;

  return Math.min(1, Math.max(percentMoneyHacked, 0));
}

export function numCycleForGrowthCorrected(
  ns: NS,
  server: Server,
  targetMoney: number,
  startMoney: number,
  cores = 1,
  person: Player,
): number {
  if (!server.serverGrowth) return Infinity;
  const moneyMax = server.moneyMax ?? 1;

  if (startMoney < 0) startMoney = 0; // servers "can't" have less than 0 dollars on them
  if (targetMoney > moneyMax) targetMoney = moneyMax; // can't grow a server to more than its moneyMax
  if (targetMoney <= startMoney) return 0; // no growth --> no threads

  const k = calculateServerGrowthLog(ns, server, 1, person, cores);
  /* To understand what is done below we need to do some math. I hope the explanation is clear enough.
   * First of, the names will be shortened for ease of manipulation:
   * n:= targetMoney (n for new), o:= startMoney (o for old), k:= calculateServerGrowthLog, x:= threads
   * x is what we are trying to compute.
   *
   * After growing, the money on a server is n = (o + x) * exp(k*x)
   * x appears in an exponent and outside it, this is usually solved using the productLog/lambert's W special function,
   * but it turns out that due to floating-point range issues this approach is *useless* to us, so it will be ignored.
   *
   * Instead, we proceed directly to Newton-Raphson iteration. We first rewrite the equation in
   * log-form, since iterating it this way has faster convergence: log(n) = log(o+x) + k*x.
   * Now our goal is to find the zero of f(x) = log((o+x)/n) + k*x.
   * (Due to the shape of the function, there will be a single zero.)
   *
   * The idea of this method is to take the horizontal position at which the horizontal axis
   * intersects with of the tangent of the function's curve as the next approximation.
   * It is equivalent to treating the curve as a line (it is called a first order approximation)
   * If the current approximation is x then the new approximated value is x - f(x)/f'(x)
   * (where f' is the derivative of f).
   *
   * In our case f(x) = log((o+x)/n) + k*x, f'(x) = d(log((o+x)/n) + k*x)/dx
   *                                              = 1/(o + x) + k
   * And the update step is x[new] = x - (log((o+x)/n) + k*x)/(1/(o+x) + k)
   * We can simplify this by bringing the first term up into the fraction:
   * = (x * (1/(o+x) + k) - log((o+x)/n) - k*x) / (1/(o+x) + k)
   * = (x/(o+x) - log((o+x)/n)) / (1/(o+x) + k)    [multiplying top and bottom by (o+x)]
   * = (x - (o+x)*log((o+x)/n)) / (1 + (o+x)*k)
   *
   * The main question to ask when using this method is "does it converge?"
   * (are the approximations getting better?), if it does then it does quickly.
   * Since the derivative is always positive but also strictly decreasing, convergence is guaranteed.
   * This also provides the useful knowledge that any x which starts *greater* than the solution will
   * undershoot across to the left, while values *smaller* than the zero will continue to find
   * closer approximations that are still smaller than the final value.
   *
   * Of great importance for reducing the number of iterations is starting with a good initial
   * guess. We use a very simple starting condition: x_0 = n - o. We *know* this will always overshot
   * the target, usually by a vast amount. But we can run it manually through one Newton iteration
   * to get a better start with nice properties:
   * x_1 = ((n - o) - (n - o + o)*log((n-o+o)/n)) / (1 + (n-o+o)*k)
   *     = ((n - o) - n * log(n/n)) / (1 + n*k)
   *     = ((n - o) - n * 0) / (1 + n*k)
   *     = (n - o) / (1 + n*k)
   * We can do the same procedure with the exponential form of Newton's method, starting from x_0 = 0.
   * This gives x_1 = (n - o) / (1 + o*k), (full derivation omitted) which will be an overestimate.
   * We use a weighted average of the denominators to get the final guess:
   *   x = (n - o) / (1 + (1/16*n + 15/16*o)*k)
   * The reason for this particular weighting is subtle; it is exactly representable and holds up
   * well under a wide variety of conditions, making it likely that the we start within 1 thread of
   * correct. It particularly bounds the worst-case to 3 iterations, and gives a very wide swatch
   * where 2 iterations is good enough.
   *
   * The accuracy of the initial guess is good for many inputs - often one iteration
   * is sufficient. This means the overall cost is two logs (counting the one in calculateServerGrowthLog),
   * possibly one exp, 5 divisions, and a handful of basic arithmetic.
   */
  const guess = (targetMoney - startMoney) / (1 + (targetMoney * (1 / 16) + startMoney * (15 / 16)) * k);
  let x = guess;
  let diff;
  do {
    const ox = startMoney + x;
    // Have to use division instead of multiplication by inverse, because
    // if targetMoney is MIN_VALUE then inverting gives Infinity
    const newx = (x - ox * Math.log(ox / targetMoney)) / (1 + ox * k);
    diff = newx - x;
    x = newx;
  } while (diff < -1 || diff > 1);
  /* If we see a diff of 1 or less we know all future diffs will be smaller, and the rate of
   * convergence means the *sum* of the diffs will be less than 1.

   * In most cases, our result here will be ceil(x).
   */
  const ccycle = Math.ceil(x);
  if (ccycle - x > 0.999999) {
    // Rounding-error path: It's possible that we slightly overshot the integer value due to
    // rounding error, and more specifically precision issues with log and the size difference of
    // startMoney vs. x. See if a smaller integer works. Most of the time, x was not close enough
    // that we need to try.
    const fcycle = ccycle - 1;
    if (targetMoney <= (startMoney + fcycle) * Math.exp(k * fcycle)) {
      return fcycle;
    }
  }
  if (ccycle >= x + ((diff <= 0 ? -diff : diff) + 0.000001)) {
    // Fast-path: We know the true value is somewhere in the range [x, x + |diff|] but the next
    // greatest integer is past this. Since we have to round up grows anyway, we can return this
    // with no more calculation. We need some slop due to rounding errors - we can't fast-path
    // a value that is too small.
    return ccycle;
  }
  if (targetMoney <= (startMoney + ccycle) * Math.exp(k * ccycle)) {
    return ccycle;
  }
  return ccycle + 1;
}

export function calculateServerGrowthLog(ns: NS, server: Server, threads: number, p: Player, cores = 1): number {
  if (!server.serverGrowth) return -Infinity;
  const hackDifficulty = server.hackDifficulty ?? 100;
  const numServerGrowthCycles = Math.max(threads, 0);

  //Get adjusted growth log, which accounts for server security
  //log1p computes log(1+p), it is far more accurate for small values.
  let adjGrowthLog = Math.log1p(ServerConstants.ServerBaseGrowthIncr / hackDifficulty);
  if (adjGrowthLog >= ServerConstants.ServerMaxGrowthLog) {
    adjGrowthLog = ServerConstants.ServerMaxGrowthLog;
  }

  //Calculate adjusted server growth rate based on parameters
  const serverGrowthPercentage = server.serverGrowth / 100;
  const serverGrowthPercentageAdjusted = serverGrowthPercentage
  // * ns.getBitNodeMultipliers().ServerGrowthRate;

  //Apply serverGrowth for the calculated number of growth cycles
  const coreBonus = getCoreBonus(cores);
  // It is critical that numServerGrowthCycles (aka threads) is multiplied last,
  // so that it rounds the same way as numCycleForGrowthCorrected.
  return adjGrowthLog * serverGrowthPercentageAdjusted * p.mults.hacking_grow * coreBonus * numServerGrowthCycles;
}

const ServerConstants = {
  // Base RAM costs
  BaseCostFor1GBOfRamHome: 32000,
  BaseCostFor1GBOfRamServer: 55000, //1 GB of RAM
  // Server-related constants
  HomeComputerMaxRam: 1073741824, // 2 ^ 30
  ServerBaseGrowthIncr: 0.03, // Unadjusted growth increment (growth rate is this * adjustment + 1)
  ServerMaxGrowthLog: 0.00349388925425578, // Maximum possible growth rate accounting for server security, precomputed as log1p(.0035)
  ServerFortifyAmount: 0.002, // Amount by which server's security increases when its hacked/grown
  ServerWeakenAmount: 0.05, // Amount by which server's security decreases when weakened

  CloudServerLimit: 25,
  CloudServerMaxRam: 1048576, // 2^20
} as const;

export function getCoreBonus(cores = 1): number {
  return 1 + (cores - 1) / 16;
}

export function calculateIntelligenceBonus(intelligence: number, weight = 1): number {
  return 1 + (weight * Math.pow(intelligence, 0.8)) / 600;
}