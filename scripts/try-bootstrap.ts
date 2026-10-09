import { bootstrapMeanDiff } from "../src/stats/bootstrap";

const diffs = [
  ...new Array<number>(7).fill(1),
  ...new Array<number>(3).fill(-1),
  ...new Array<number>(39).fill(0),
];

const r = bootstrapMeanDiff(diffs);
const pts = (x: number) => (x * 100).toFixed(1);

console.log(`n = ${r.n}, mean difference = ${pts(r.mean)} points`);
console.log(`95% interval: ${pts(r.lower)} to ${pts(r.upper)} points`);
console.log(
  r.lower > 0 || r.upper < 0
    ? "The interval excludes zero: a real difference."
    : "The interval includes zero: you can't call it a real difference.",
);