# EvalKit
![CI](https://github.com/sealfromdowntown/EvalKit/actions/workflows/ci.yml/badge.svg)

> **Draft:** This README describes the current HDB Text-to-SQL demo. Setup and benchmark coverage are still being improved.

EvalKit is a command-line tool for checking whether a change to an LLM prompt or model improves a task. It runs configured candidates on the same question set, scores their outputs against expected answers, and compares the candidates with a paired bootstrap interval.

This repository demonstrates EvalKit on Singapore HDB resale data. A case contains a natural-language question and reference SQL. For each candidate, EvalKit asks a model to write SQL, runs that SQL against a local SQLite database, and compares the result with the result of the reference query.

## Current capabilities

- YAML case and candidate configuration with schema validation.
- Cached model calls, with results and scores stored in SQLite.
- A read-only SQL execution process with a timeout and row limit.
- Execution-match scoring with per-case row-order and numeric-tolerance options.
- Candidate comparison using paired differences and a seeded bootstrap confidence interval.
- Separate `dev` and `test` case splits.

## Requirements and setup

- Node.js 20.6 or newer and npm.
- An OpenAI API key for uncached model calls.
- The HDB CSV expected by the setup script at `examples/hdb/data/resale_2017_onwards.csv`.

Install dependencies and put the API key in the local, git-ignored `.env` file:

```text
OPENAI_API_KEY=your-key
```

Then build the local data database and compute the expected results:

```powershell
npm ci
npm run hdb:setup
npm run dev -- compute-expected
npm run dev -- validate
```

The setup script reads the CSV from the path above and creates `examples/hdb/hdb.db`. The CSV is not included in the repository; a fresh checkout needs that file before setup can run. Data acquisition and source attribution instructions still need to be added here.

## Run and compare candidates

Candidates are listed in `examples/hdb/config.yaml`. Each candidate names a model, a prompt file, and optional generation parameters and pricing. Cases live in `examples/hdb/cases/`; reference results are stored in `examples/hdb/expected.json`.

Run the default development split:

```powershell
npm run dev -- run --split dev --show-failures
```

The command prints a run ID. Compare two candidates from that same run by replacing the example ID below with the printed ID:

```powershell
npm run dev -- compare main-v2 main-v3 --run 2026-10-11T10-25-40-350Z-5368a5
```

Replace the example run ID with the `Run id:` value printed by your own run.

Model calls with matching cached inputs do not call the API again. Changes to a prompt, model, parameters, or question create a different cache entry and may incur API costs.

## Case splits

Generated cases receive a stable split based on their case ID: roughly 80% are assigned to `dev` and 20% to `test`. The assignment does not change between runs unless the ID changes. Hand-written cases default to `dev`; set `split: test` explicitly in YAML to assign one to the test split.

Use `dev` while inspecting failures and refining prompts. Keep `test` separate until the prompt is settled. In the current suite, the 12 test cases are generated cases; they are not a random sample redrawn each time a run starts.

## Current prompt comparison

The current comparison uses the same model (`gpt-6-luna`) with three prompts. On the 89 development cases in the latest recorded run:

| Candidate | Passed | Accuracy |
|---|---:|---:|
| `main-v1` | 75/89 | 84.3% |
| `main-v2` | 80/89 | 89.9% |
| `main-v3` | 89/89 | 100.0% |

The paired comparison of v3 against v2 reported nine cases fixed, no cases broken, and a 95% bootstrap interval of +4.5 to +16.9 percentage points. Several of the fixed cases test closely related value-format and capitalization patterns, so this result is evidence that v3 helps on those observed development cases; it is not proof of a general improvement across unrelated text-to-SQL tasks.

In an earlier run of the separate 12-case test split, both v2 and v3 scored 12/12. Those cases were not changed during the recent development-case additions. This shows no regression on those observed cases, but because every case tied, it does not show that v3 is better or that the prompts are equivalent. Rerun the test split after settling the prompt and report that result separately.

## Scoring notes and limitations

By default, row order is ignored, column names are ignored, `NULL` matches `NULL`, and numeric values are compared with an absolute tolerance of 0.5. Individual cases can set `compare.ordered` or `compare.tolerance` in YAML. These rules make execution matching practical for the demo, but a matching result does not prove that two SQL queries express the same logic in every possible situation.

The current benchmark is small and includes related generated questions. The development cases have been used to shape v3, and the existing test set is only 12 cases. More independently designed hard cases, broader task coverage, reproducible data acquisition, and further validation of the statistical reporting remain future work.
