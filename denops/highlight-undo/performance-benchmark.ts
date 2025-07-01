// Performance benchmark script
import { DiffOptimizer } from "./core/diff-optimizer.ts";
import { computeRanges, fillRangeGaps } from "./core/utils.ts";
import { diffChars } from "./deps.ts";

function generateLargeText(lines: number, charsPerLine: number): string {
  const text: string[] = [];
  for (let i = 0; i < lines; i++) {
    text.push("x".repeat(charsPerLine));
  }
  return text.join("\n");
}

function benchmark(name: string, fn: () => void, iterations = 1000): void {
  const start = performance.now();
  for (let i = 0; i < iterations; i++) {
    fn();
  }
  const end = performance.now();
  const avg = (end - start) / iterations;
  console.log(`${name}: ${avg.toFixed(3)}ms per operation`);
}

console.log("=== highlight-undo Performance Benchmark ===\n");

// Test 1: DiffOptimizer with cache
const optimizer = new DiffOptimizer();
const text1 = generateLargeText(50, 80);
const text2 = text1 + "\nNew line added";

console.log("1. DiffOptimizer Performance:");
benchmark("  First diff calculation", () => {
  optimizer.calculateDiff(text1, text2, { line: 100, char: 5000 });
}, 100);

benchmark("  Cached diff retrieval", () => {
  optimizer.calculateDiff(text1, text2, { line: 100, char: 5000 });
}, 1000);

// Test 2: Direct diff comparison
console.log("\n2. Direct diff comparison:");
benchmark("  diffChars", () => {
  diffChars(text1, text2);
}, 100);

// Test 3: Range computation
const changes = diffChars("hello world", "hello new world");
console.log("\n3. Range computation:");
benchmark("  computeRanges", () => {
  computeRanges({
    changes,
    beforeCode: "hello world",
    afterCode: "hello new world",
    changeType: "added",
  });
}, 1000);

// Test 4: Complex diff
const complexBefore = `
function hello() {
  console.log("Hello");
  return true;
}

function world() {
  console.log("World");
  return false;
}
`;

const complexAfter = `
function hello() {
  console.log("Hello, World!");
  return true;
}

function universe() {
  console.log("Universe");
  return true;
}
`;

console.log("\n4. Complex code diff:");
benchmark("  Complex diff calculation", () => {
  optimizer.calculateDiff(complexBefore, complexAfter, { line: 100, char: 5000 });
}, 100);

// Test 5: fillRangeGaps performance
const ranges = [
  { lnum: 1, lineText: "test", col: { start: 0, end: 4 }, matchText: "test", changeType: "added" as const },
  { lnum: 3, lineText: "test", col: { start: 0, end: 4 }, matchText: "test", changeType: "added" as const },
  { lnum: 5, lineText: "test", col: { start: 0, end: 4 }, matchText: "test", changeType: "added" as const },
];

console.log("\n5. fillRangeGaps performance:");
benchmark("  fillRangeGaps", () => {
  fillRangeGaps({ ranges, aboveLine: 1, belowLine: 5 });
}, 10000);

console.log("\n=== Benchmark Complete ===");
