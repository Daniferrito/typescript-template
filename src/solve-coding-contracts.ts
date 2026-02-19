import { CodingContractName, CodingContractSignatures, NS } from "@ns";

export async function main(ns: NS): Promise<void> {
  ns.disableLog("ALL")
  ns.print("------------------------------")
  ns.print("Starting contracts script...")
  ns.print("------------------------------")
  const servers = ns.read("servers.txt").split("\n")

  if (!testContracts(ns)) {
    ns.print("One or more contract types are not working, not starting the main loop to avoid wasting time on unsolvable contracts. Please implement the missing solvers and test again.")
    return
  }


  for (; ;) {
    const contracts = getContracts(ns, servers)
    for (const { server, contract } of contracts) {
      solveContract(ns, server, contract)
    }
    await ns.sleep(60_000)
  }
}

function testContracts(ns: NS) {
  for (let i = 0; i < 10; i++) {
    for (const contractType of Object.values(CodingContractNameObject)) {
      const solver = ContractSolvers[contractType as CodingContractName]
      const contractName = ns.codingcontract.createDummyContract(contractType)
      if (solver) {
        solveContract(ns, "home", contractName, true)
      } else {
        const contract = ns.codingcontract.getContract(contractName, "home")
        ns.print('================================================')
        ns.print(`No solver implemented for contract type ${contract.type}, skipping...`)
        ns.print(`Contract description: ${contract.description}`)
        return false
      }
    }
  }
  return true
}

function getContracts(ns: NS, servers: string[]): { server: string, contract: string }[] {
  const contracts: { server: string, contract: string }[] = []
  for (const server of servers) {
    const files = ns.ls(server, ".cct")
    for (const file of files) {
      contracts.push({ server, contract: file })
    }
  }
  return contracts
}

function solveContract(ns: NS, server: string, contractName: string, isTest = false): void {
  const contract = ns.codingcontract.getContract(contractName, server)
  const type = contract.type
  const data = contract.data
  const solution = getSolution(type, data)
  if (solution === undefined) {
    ns.print(`No solution found for contract ${contractName} on server ${server}, type: ${type}`)
    return
  }
  const result = ns.codingcontract.attempt(solution, contractName, server)
  if (result) {
    if (!isTest) {
      ns.print(`Successfully solved contract ${type} (${contractName}) on server ${server}, reward: ${result}`)
    }
  } else {
    ns.print(`Contract description: ${contract.description}`)
    if (typeof data === "bigint" || typeof solution === "bigint") {
      ns.alert(`Failed to solve contract ${type} (${contractName}) on server ${server}, data: ${data.toString()}, solution: ${solution.toString()}`);
      throw new Error(`Failed to solve contract ${type} (${contractName}) on server ${server}, data: ${data.toString()}, solution: ${solution.toString()}`);
    } else {
      ns.alert(`Failed to solve contract ${type} (${contractName}) on server ${server}, data: ${JSON.stringify(data)}, solution: ${JSON.stringify(solution)}`);
      throw new Error(`Failed to solve contract ${type} (${contractName}) on server ${server}, data: ${JSON.stringify(data)}, solution: ${JSON.stringify(solution)}`);
    }
  }
}


const CodingContractNameObject = {
  FindLargestPrimeFactor: "Find Largest Prime Factor",
  SubarrayWithMaximumSum: "Subarray with Maximum Sum",
  TotalWaysToSum: "Total Ways to Sum",
  TotalWaysToSumII: "Total Ways to Sum II",
  SpiralizeMatrix: "Spiralize Matrix",
  ArrayJumpingGame: "Array Jumping Game",
  ArrayJumpingGameII: "Array Jumping Game II",
  MergeOverlappingIntervals: "Merge Overlapping Intervals",
  GenerateIPAddresses: "Generate IP Addresses",
  AlgorithmicStockTraderI: "Algorithmic Stock Trader I",
  AlgorithmicStockTraderII: "Algorithmic Stock Trader II",
  AlgorithmicStockTraderIII: "Algorithmic Stock Trader III",
  AlgorithmicStockTraderIV: "Algorithmic Stock Trader IV",
  MinimumPathSumInATriangle: "Minimum Path Sum in a Triangle",
  UniquePathsInAGridI: "Unique Paths in a Grid I",
  UniquePathsInAGridII: "Unique Paths in a Grid II",
  ShortestPathInAGrid: "Shortest Path in a Grid",
  SanitizeParenthesesInExpression: "Sanitize Parentheses in Expression",
  FindAllValidMathExpressions: "Find All Valid Math Expressions",
  HammingCodesIntegerToEncodedBinary: "HammingCodes: Integer to Encoded Binary",
  HammingCodesEncodedBinaryToInteger: "HammingCodes: Encoded Binary to Integer",
  Proper2ColoringOfAGraph: "Proper 2-Coloring of a Graph",
  CompressionIRLECompression: "Compression I: RLE Compression",
  CompressionIILZDecompression: "Compression II: LZ Decompression",
  CompressionIIILZCompression: "Compression III: LZ Compression",
  EncryptionICaesarCipher: "Encryption I: Caesar Cipher",
  EncryptionIIVigenereCipher: "Encryption II: Vigenère Cipher",
  SquareRoot: "Square Root",
}

// Type for mapper from CodingContractName to its corresponding (data: CodingContractSignatures[CodingContractName]) => unknown solver function
const ContractSolvers: Partial<{ [K in CodingContractName]?: (data: CodingContractSignatures[K][0]) => CodingContractSignatures[K][1] }> = {
  "Encryption I: Caesar Cipher": solveCaesarCipher,
  "Encryption II: Vigenère Cipher": solveVigenereCipher,
  "Find Largest Prime Factor": findLargestPrimeFactor,
  "Array Jumping Game": arrayJumpingGame,
  "Array Jumping Game II": arrayJumpingGameII,
  "Merge Overlapping Intervals": mergeOverlappingIntervals,
  "Total Ways to Sum": totalWaysToSum,
  "Total Ways to Sum II": totalWaysToSumII,
  "Unique Paths in a Grid I": uniquePathsInGridI,
  "Unique Paths in a Grid II": uniquePathsInGridII,
  "Compression I: RLE Compression": rleCompression,
  "Compression II: LZ Decompression": solveLZDecompression,
  "Compression III: LZ Compression": solveLZCompression,
  "Algorithmic Stock Trader I": solveAlgorithmicStockTraderI,
  "Algorithmic Stock Trader II": solveAlgorithmicStockTraderII,
  "Algorithmic Stock Trader III": solveAlgorithmicStockTraderIII,
  "Algorithmic Stock Trader IV": solveAlgorithmicStockTraderIV,
  "Subarray with Maximum Sum": solveSubarrayWithMaximumSum,
  "Generate IP Addresses": solveGenerateIPAddresses,
  "Spiralize Matrix": solveSpiralizeMatrix,
  "Minimum Path Sum in a Triangle": solveMinimumPathSumInTriangle,
  "Sanitize Parentheses in Expression": solveSanitizeParenthesesInExpression,
  "Find All Valid Math Expressions": solveFindAllValidMathExpressions,
  "HammingCodes: Encoded Binary to Integer": solveHammingCodesEncodedBinaryToInteger,
  "HammingCodes: Integer to Encoded Binary": solveHammingCodesIntegerToEncodedBinary,
  "Proper 2-Coloring of a Graph": solveProper2ColoringOfGraph,
  "Shortest Path in a Grid": solveShortestPathInGrid,
  "Square Root": solveSquareRoot,
}

function getSolution<K extends CodingContractName>(type: K, data: CodingContractSignatures[K][0]): CodingContractSignatures[K][1] | undefined {
  const solver = ContractSolvers[type]
  if (!solver) {
    return
  }
  return solver(data)
}

function solveCaesarCipher([ciphertext, shift]: [string, number]): string {
  let plaintext = ""
  for (let i = 0; i < ciphertext.length; i++) {
    if (ciphertext[i] === " ") {
      plaintext += " "
      continue
    }
    const c = ciphertext.charCodeAt(i) - 65
    const p = (c - shift + 26) % 26
    plaintext += String.fromCharCode(p + 65)
  }
  return plaintext
}


function solveVigenereCipher([ciphertext, keyword]: [string, string]): string {
  let plaintext = ""
  for (let i = 0; i < ciphertext.length; i++) {
    const c = ciphertext.charCodeAt(i) - 65
    const k = keyword.charCodeAt(i % keyword.length) - 65
    const p = (c + k) % 26
    plaintext += String.fromCharCode(p + 65)
  }
  return plaintext
}

function findLargestPrimeFactor(n: number): number {
  let largestFactor = -1
  while (n % 2 === 0) {
    largestFactor = 2
    n /= 2
  }
  for (let i = 3; i <= Math.sqrt(n); i += 2) {
    while (n % i === 0) {
      largestFactor = i
      n /= i
    }
  }
  if (n > 2) {
    largestFactor = n
  }
  return largestFactor
}

function arrayJumpingGame(array: number[]): (0 | 1) {
  let maxReach = 0
  for (let i = 0; i <= maxReach && i < array.length; i++) {
    maxReach = Math.max(maxReach, i + array[i])
  }
  return maxReach >= (array.length - 1) ? 1 : 0
}

function arrayJumpingGameII(array: number[]): number {
  //  Each element in the array represents your MAXIMUM jump length at that position. This means that if you are at position i and your maximum jump length is n, you can jump to any position from i to i+n. 

  //Assuming you are initially positioned at the start of the array, determine the minimum number of jumps to reach the end of the array.

  // If it's impossible to reach the end, then the answer should be 0.
  let jumps = 0
  let currentEnd = 0
  let farthest = 0
  for (let i = 0; i < array.length - 1; i++) {
    farthest = Math.max(farthest, i + array[i])
    if (i === currentEnd) {
      jumps++
      currentEnd = farthest
    }
  }
  return currentEnd >= array.length - 1 ? jumps : 0
}

function mergeOverlappingIntervals(intervals: [number, number][]): [number, number][] {
  if (intervals.length === 0)
    return []
  intervals.sort((a, b) => a[0] - b[0])
  const merged: [number, number][] = [intervals[0]]
  for (let i = 1; i < intervals.length; i++) {
    const last = merged[merged.length - 1]
    const current = intervals[i]
    if (current[0] <= last[1]) {
      last[1] = Math.max(last[1], current[1])
    }
    else {
      merged.push(current)
    }
  }
  return merged
}

function totalWaysToSum(n: number): number {
  const ways = new Array(n + 1).fill(0)
  ways[0] = 1
  for (let i = 1; i <= n; i++) {
    for (let j = i; j <= n; j++) {
      ways[j] += ways[j - i]
    }
  }
  return ways[n] - 1
}

function totalWaysToSumII(data: [number, number[]]): number {
  const [n, options] = data
  const ways = new Array(n + 1).fill(0)
  ways[0] = 1
  for (const option of options) {
    for (let j = option; j <= n; j++) {
      ways[j] += ways[j - option]
    }
  }
  return ways[n]
}

function uniquePathsInGridI([m, n]: [number, number]): number {
  const paths = new Array(m).fill(0).map(() => new Array(n).fill(0))
  for (let i = 0; i < m; i++) {
    paths[i][0] = 1
  }
  for (let j = 0; j < n; j++) {
    paths[0][j] = 1
  }
  for (let i = 1; i < m; i++) {
    for (let j = 1; j < n; j++) {
      paths[i][j] = paths[i - 1][j] + paths[i][j - 1]
    }
  }
  return paths[m - 1][n - 1]
}

function uniquePathsInGridII(data: number[][]): number {
  /**
   * Data looks like this:
   *  0,0,0,0,1,0,
   *  0,1,0,0,0,0,
   *  0,0,0,0,0,0,
   *  0,0,0,0,1,0,
   */
  const m = data.length
  const n = data[0].length
  const paths = new Array(m).fill(0).map(() => new Array(n).fill(0))
  for (let i = 0; i < m; i++) {
    if (data[i][0] === 1) {
      break
    }
    paths[i][0] = 1
  }
  for (let j = 0; j < n; j++) {
    if (data[0][j] === 1) {
      break
    }
    paths[0][j] = 1
  }
  for (let i = 1; i < m; i++) {
    for (let j = 1; j < n; j++) {
      if (data[i][j] === 1) {
        paths[i][j] = 0
      } else {
        paths[i][j] = paths[i - 1][j] + paths[i][j - 1]
      }
    }
  }
  return paths[m - 1][n - 1]
}

function rleCompression(data: string): string {
  let compressed = ""
  let count = 1
  for (let i = 1; i <= data.length; i++) {
    if (i < data.length && data[i] === data[i - 1] && count < 9) {
      count++
    } else {
      compressed += count.toString() + data[i - 1]
      count = 1
    }
  }
  return compressed
}

function solveLZDecompression(compr: string): string {
  let plain = "";

  for (let i = 0; i < compr.length;) {
    const literal_length = compr.charCodeAt(i) - 0x30;

    if (literal_length < 0 || literal_length > 9 || i + 1 + literal_length > compr.length) {
      // return null;
    }

    plain += compr.substring(i + 1, i + 1 + literal_length);
    i += 1 + literal_length;

    if (i >= compr.length) {
      break;
    }
    const backref_length = compr.charCodeAt(i) - 0x30;

    if (backref_length < 0 || backref_length > 9) {
      // return null;
    } else if (backref_length === 0) {
      ++i;
    } else {
      if (i + 1 >= compr.length) {
        // return null;
      }

      const backref_offset = compr.charCodeAt(i + 1) - 0x30;
      if ((backref_length > 0 && (backref_offset < 1 || backref_offset > 9)) || backref_offset > plain.length) {
        // return null;
      }

      for (let j = 0; j < backref_length; ++j) {
        plain += plain[plain.length - backref_offset];
      }

      i += 2;
    }
  }

  return plain;
}

function solveLZCompression(plain: string): string {
  // for state[i][j]:
  //      if i is 0, we're adding a literal of length j
  //      else, we're adding a backreference of offset i and length j
  let cur_state: (string | null)[][] = Array.from(Array(10), () => Array<string | null>(10).fill(null));
  let new_state: (string | null)[][] = Array.from(Array(10), () => Array<string | null>(10));

  function set(state: (string | null)[][], i: number, j: number, str: string): void {
    const current = state[i][j];
    if (current == null || str.length < current.length) {
      state[i][j] = str;
    } else if (str.length === current.length && Math.random() < 0.5) {
      // if two strings are the same length, pick randomly so that
      // we generate more possible inputs to Compression II
      state[i][j] = str;
    }
  }

  // initial state is a literal of length 1
  cur_state[0][1] = "";

  for (let i = 1; i < plain.length; ++i) {
    for (const row of new_state) {
      row.fill(null);
    }
    const c = plain[i];

    // handle literals
    for (let length = 1; length <= 9; ++length) {
      const string = cur_state[0][length];
      if (string == null) {
        continue;
      }

      if (length < 9) {
        // extend current literal
        set(new_state, 0, length + 1, string);
      } else {
        // start new literal
        set(new_state, 0, 1, string + "9" + plain.substring(i - 9, i) + "0");
      }

      for (let offset = 1; offset <= Math.min(9, i); ++offset) {
        if (plain[i - offset] === c) {
          // start new backreference
          set(new_state, offset, 1, string + String(length) + plain.substring(i - length, i));
        }
      }
    }

    // handle backreferences
    for (let offset = 1; offset <= 9; ++offset) {
      for (let length = 1; length <= 9; ++length) {
        const string = cur_state[offset][length];
        if (string == null) {
          continue;
        }

        if (plain[i - offset] === c) {
          if (length < 9) {
            // extend current backreference
            set(new_state, offset, length + 1, string);
          } else {
            // start new backreference
            set(new_state, offset, 1, string + "9" + String(offset) + "0");
          }
        }

        // start new literal
        set(new_state, 0, 1, string + String(length) + String(offset));

        // end current backreference and start new backreference
        for (let new_offset = 1; new_offset <= Math.min(9, i); ++new_offset) {
          if (plain[i - new_offset] === c) {
            set(new_state, new_offset, 1, string + String(length) + String(offset) + "0");
          }
        }
      }
    }

    const tmp_state = new_state;
    new_state = cur_state;
    cur_state = tmp_state;
  }

  let result = null;

  for (let len = 1; len <= 9; ++len) {
    let string = cur_state[0][len];
    if (string == null) {
      continue;
    }

    string += String(len) + plain.substring(plain.length - len, plain.length);
    if (result == null || string.length < result.length) {
      result = string;
    } else if (string.length == result.length && Math.random() < 0.5) {
      result = string;
    }
  }

  for (let offset = 1; offset <= 9; ++offset) {
    for (let len = 1; len <= 9; ++len) {
      let string = cur_state[offset][len];
      if (string == null) {
        continue;
      }

      string += String(len) + "" + String(offset);
      if (result == null || string.length < result.length) {
        result = string;
      } else if (string.length == result.length && Math.random() < 0.5) {
        result = string;
      }
    }
  }

  return result ?? "";
}

function solveSubarrayWithMaximumSum(array: number[]): number {
  let maxSum = -Infinity
  let currentSum = 0
  for (const num of array) {
    currentSum = Math.max(num, currentSum + num)
    maxSum = Math.max(maxSum, currentSum)
  }
  return maxSum
}

function solveSpiralizeMatrix(matrix: number[][]): number[] {
  const m = matrix.length
  const n = matrix[0].length
  const spiralized: number[] = []
  let top = 0
  let bottom = m - 1
  let left = 0
  let right = n - 1
  while (top <= bottom && left <= right) {
    for (let j = left; j <= right; j++) {
      spiralized.push(matrix[top][j])
    }
    top++
    for (let i = top; i <= bottom; i++) {
      spiralized.push(matrix[i][right])
    }
    right--
    if (top <= bottom) {
      for (let j = right; j >= left; j--) {
        spiralized.push(matrix[bottom][j])
      }
      bottom--
    }
    if (left <= right) {
      for (let i = bottom; i >= top; i--) {
        spiralized.push(matrix[i][left])
      }
      left++
    }
  }

  return spiralized

}

function solveGenerateIPAddresses(data: string): string[] {
  function isValidIPPart(part: string): boolean {
    if (part.length === 0 || part.length > 3) {
      return false
    }
    if (part[0] === "0" && part.length > 1) {
      return false
    }
    const num = parseInt(part)
    return num >= 0 && num <= 255
  }
  const result: string[] = []
  const s = data
  for (let i = 1; i < 4 && i < s.length - 2; i++) {
    for (let j = i + 1; j < i + 4 && j < s.length - 1; j++) {
      for (let k = j + 1; k < j + 4 && k < s.length; k++) {
        const part1 = s.substring(0, i)
        const part2 = s.substring(i, j)
        const part3 = s.substring(j, k)
        const part4 = s.substring(k)
        if (isValidIPPart(part1) && isValidIPPart(part2) && isValidIPPart(part3) && isValidIPPart(part4)) {
          result.push(`${part1}.${part2}.${part3}.${part4}`)
        }
      }
    }
  }
  return result
}
function solveAlgorithmicStockTraderI(data: number[]): number {
  let minPrice = Infinity
  let maxProfit = 0
  for (const price of data) {
    minPrice = Math.min(minPrice, price)
    maxProfit = Math.max(maxProfit, price - minPrice)
  }
  return maxProfit
}

function solveAlgorithmicStockTraderII(data: number[]): number {
  //Determine the maximum possible profit you can earn using as many transactions as you'd like. A transaction is defined as buying and then selling one share of the stock. Note that you cannot engage in multiple transactions at once. In other words, you must sell the stock before you buy it again.
  let maxProfit = 0
  for (let i = 1; i < data.length; i++) {
    if (data[i] > data[i - 1]) {
      maxProfit += data[i] - data[i - 1]
    }
  }
  return maxProfit
}

function solveAlgorithmicStockTraderIII(data: number[]): number {
  let minPrice1 = Infinity
  let maxProfit1 = 0
  let minPrice2 = Infinity
  let maxProfit2 = 0
  for (const price of data) {
    minPrice1 = Math.min(minPrice1, price)
    maxProfit1 = Math.max(maxProfit1, price - minPrice1)
    minPrice2 = Math.min(minPrice2, price - maxProfit1)
    maxProfit2 = Math.max(maxProfit2, price - minPrice2)
  }
  return maxProfit2
}

function solveAlgorithmicStockTraderIV(data: [number, number[]]): number {
  const [k, prices] = data
  const n = prices.length
  if (n === 0 || k === 0) {
    return 0
  }
  if (k >= n / 2) {
    // If k is large enough, we can make as many transactions as we want
    let maxProfit = 0
    for (let i = 1; i < n; i++) {
      if (prices[i] > prices[i - 1]) {
        maxProfit += prices[i] - prices[i - 1]
      }
    }
    return maxProfit
  }
  const dp: number[][] = Array.from({ length: k + 1 }, () => new Array(n).fill(0))
  for (let i = 1; i <= k; i++) {
    let maxDiff = -prices[0]
    for (let j = 1; j < n; j++) {
      dp[i][j] = Math.max(dp[i][j - 1], prices[j] + maxDiff)
      maxDiff = Math.max(maxDiff, dp[i - 1][j] - prices[j])
    }
  }
  return dp[k][n - 1]
}

function solveMinimumPathSumInTriangle(data: number[][]): number {
  const n = data.length
  const dp: number[][] = Array.from({ length: n }, () => new Array(n).fill(0))
  dp[0][0] = data[0][0]
  for (let i = 1; i < n; i++) {
    dp[i][0] = dp[i - 1][0] + data[i][0]
    for (let j = 1; j < i; j++) {
      dp[i][j] = Math.min(dp[i - 1][j - 1], dp[i - 1][j]) + data[i][j]
    }
    dp[i][i] = dp[i - 1][i - 1] + data[i][i]
  }
  return Math.min(...dp[n - 1])
}

function solveShortestPathInGrid(data: (0 | 1)[][]): string {
  //  Determine the shortest path from start to finish, if one exists. The answer should be given as a string of UDLR characters, indicating the moves along the path
  const m = data.length
  const n = data[0].length
  const directions: [number, number, string][] = [
    [-1, 0, "U"],
    [1, 0, "D"],
    [0, -1, "L"],
    [0, 1, "R"],
  ]
  const queue: { x: number, y: number, path: string }[] = [{ x: 0, y: 0, path: "" }]
  const visited = new Set<string>()
  visited.add("0,0")
  while (queue.length > 0) {
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    const { x, y, path } = queue.shift()!
    if (x === m - 1 && y === n - 1) {
      return path
    }
    for (const [dx, dy, move] of directions) {
      const newX = x + dx
      const newY = y + dy
      if (newX >= 0 && newX < m && newY >= 0 && newY < n && data[newX][newY] === 0 && !visited.has(`${newX},${newY}`)) {
        visited.add(`${newX},${newY}`)
        queue.push({ x: newX, y: newY, path: path + move })
      }
    }
  }
  return ""
}

function solveSanitizeParenthesesInExpression(data: string): string[] {
  function isValid(expr: string): boolean {
    let balance = 0
    for (const char of expr) {
      if (char === "(") {
        balance++
      } else if (char === ")") {
        balance--
        if (balance < 0) {
          return false
        }
      }
    }
    return balance === 0
  }
  const result: string[] = []
  const queue: string[] = [data]
  const visited = new Set<string>()
  visited.add(data)
  let found = false
  while (queue.length > 0) {
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    const expr = queue.shift()!
    if (isValid(expr)) {
      result.push(expr)
      found = true
    }
    if (found) {
      continue
    }
    for (let i = 0; i < expr.length; i++) {
      if (expr[i] === "(" || expr[i] === ")") {
        const newExpr = expr.substring(0, i) + expr.substring(i + 1)
        if (!visited.has(newExpr)) {
          visited.add(newExpr)
          queue.push(newExpr)
        }
      }
    }
  }
  return result
}

function solveFindAllValidMathExpressions(data: [string, number]): string[] {
  // Numbers cannot start with a leading zero, so 1+2 and 1*2 are valid expressions, but 1+02 and 1*02 are not valid expressions.
  const [num, target] = data
  const result: string[] = []
  function backtrack(expr: string, index: number, value: number, lastValue: number) {
    if (index === num.length) {
      if (value === target) {
        result.push(expr)
      }
      return
    }
    for (let i = index; i < num.length; i++) {
      const currentNumStr = num.substring(index, i + 1)
      if (currentNumStr.length > 1 && currentNumStr[0] === '0') {
        continue; // Skip numbers starting with 0
      }
      const currentNum = parseInt(currentNumStr)
      if (index === 0) {
        backtrack(currentNumStr, i + 1, currentNum, currentNum)
      } else {
        backtrack(expr + "+" + currentNumStr, i + 1, value + currentNum, currentNum)
        backtrack(expr + "-" + currentNumStr, i + 1, value - currentNum, -currentNum)
        backtrack(expr + "*" + currentNumStr, i + 1, value - lastValue + lastValue * currentNum, lastValue * currentNum)
      }
    }
  }
  backtrack("", 0, 0, 0)
  return result
}

function solveHammingCodesEncodedBinaryToInteger(data: string): number {
  let err = 0;
  const bits: number[] = [];

  /* TODO why not just work with an array of digits from the start? */
  const bitStringArray = data.split("");
  for (let i = 0; i < bitStringArray.length; ++i) {
    const bit = parseInt(bitStringArray[i]);
    bits[i] = bit;

    if (bit) {
      err ^= +i;
    }
  }

  /* If err != 0 then it spells out the index of the bit that was flipped */
  if (err) {
    /* Flip to correct */
    bits[err] = bits[err] ? 0 : 1;
  }

  /* Now we have to read the message, bit 0 is unused (it's the overall parity bit
   * which we don't care about). Each bit at an index that is a power of 2 is
   * a parity bit and not part of the actual message. */

  let ans = "";

  for (let i = 1; i < bits.length; i++) {
    /* i is not a power of two so it's not a parity bit */
    if ((i & (i - 1)) != 0) {
      ans += bits[i];
    }
  }

  /* TODO to avoid ambiguity about endianness why not let the player return the extracted (and corrected)
   * data bits, rather than guessing at how to convert it to a decimal string? */
  return parseInt(ans, 2);
}

function solveHammingCodesIntegerToEncodedBinary(data: number): string {
  const enc: number[] = [0];
  const data_bits: number[] = data
    .toString(2)
    .split("")
    .reverse()
    .map((value) => parseInt(value));

  let k = data_bits.length;

  /* NOTE: writing the data like this flips the endianness, this is what the
   * original implementation by Hedrauta did so I'm keeping it like it was. */
  for (let i = 1; k > 0; i++) {
    if ((i & (i - 1)) != 0) {
      enc[i] = data_bits[--k];
    } else {
      enc[i] = 0;
    }
  }

  let parityNumber = 0;

  /* Figure out the subsection parities */
  for (let i = 0; i < enc.length; i++) {
    if (enc[i]) {
      parityNumber ^= i;
    }
  }

  const parityArray = parityNumber
    .toString(2)
    .split("")
    .reverse()
    .map((value) => parseInt(value));

  /* Set the parity bits accordingly */
  for (let i = 0; i < parityArray.length; i++) {
    enc[2 ** i] = parityArray[i] ? 1 : 0;
  }

  parityNumber = 0;
  /* Figure out the overall parity for the entire block */
  for (let i = 0; i < enc.length; i++) {
    if (enc[i]) {
      parityNumber++;
    }
  }

  /* Finally set the overall parity bit */
  enc[0] = parityNumber % 2 == 0 ? 0 : 1;

  return enc.join("");
}

function solveProper2ColoringOfGraph(data: [number, [number, number][]]): (0 | 1)[] {
  const [n, edges] = data
  const graph: number[][] = Array.from({ length: n }, () => [])
  for (const [u, v] of edges) {
    graph[u].push(v)
    graph[v].push(u)
  }
  const colors: (0 | 1 | null)[] = new Array(n).fill(null)
  for (let i = 0; i < n; i++) {
    if (colors[i] === null) {
      colors[i] = 0
      const queue: number[] = [i]
      while (queue.length > 0) {
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        const node = queue.shift()!
        for (const neighbor of graph[node]) {
          if (colors[neighbor] === null) {
            colors[neighbor] = colors[node] === 0 ? 1 : 0
            queue.push(neighbor)
          } else if (colors[neighbor] === colors[node]) {
            return []
          }
        }
      }
    }
  }
  return colors as (0 | 1)[]
}

function solveSquareRoot(n: bigint): bigint {
  let x: bigint;
  let y = n;
  do {
    x = y;
    y = (x + n / x) / 2n;
  } while (y < x);
  const t = x * x + x + 1n;
  if (n >= t) x++;
  return x;
}