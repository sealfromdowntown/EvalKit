# EvalKit

<p align="left">
  <img alt="TypeScript" src="https://img.shields.io/badge/TypeScript-3178C6?logo=typescript&logoColor=white">
  <img alt="Node.js 22.12+" src="https://img.shields.io/badge/Node.js-22.12%2B-339933?logo=nodedotjs&logoColor=white">
  <img alt="SQLite" src="https://img.shields.io/badge/SQLite-07405E?logo=sqlite&logoColor=white">
  <img alt="OpenAI API" src="https://img.shields.io/badge/OpenAI_API-412991?logo=openai&logoColor=white">
  <img alt="GitHub Actions" src="https://img.shields.io/badge/GitHub_Actions-CI-2088FF?logo=githubactions&logoColor=white">
  <img alt="GitHub Pages" src="https://img.shields.io/badge/GitHub_Pages-dashboard-222222?logo=githubpages&logoColor=white">
</p>

[![CI](https://github.com/sealfromdowntown/EvalKit/actions/workflows/ci.yml/badge.svg)](https://github.com/sealfromdowntown/EvalKit/actions/workflows/ci.yml)

EvalKit is a TypeScript evaluation toolkit for comparing large language model (LLM) prompts and models on text-to-SQL tasks. It runs configured candidates against a Singapore HDB resale benchmark, scores generated SQL by executing it against SQLite, and presents run results in a dashboard.

[View the live dashboard](https://sealfromdowntown.github.io/EvalKit/)

## Why EvalKit

A prompt that sounds clearer does not necessarily produce more accurate SQL. EvalKit makes prompt and model comparisons measurable by giving candidates the same questions, database, and scoring rules. It records not only whether a query passed, but also the generated SQL, failure type, latency, token usage, and estimated cost.

The current benchmark contains 189 cases across separate development and test splits: 89 dev cases and 100 test cases. Case counts can change as the benchmark grows.

## Features

- Run multiple configured model-and-prompt candidates against the same benchmark split.
- Execute generated SQL against a local SQLite database and compare its results with reference SQL.
- Cache model calls and store runs, scores, token usage, latency, and estimated cost in SQLite.
- Compare candidates from the same run with paired differences and a seeded bootstrap interval.
- Set per-case result ordering and numeric tolerance rules.
- Add optional counterfactual intent probes for zero-answer cases to catch some wrong-filter queries that otherwise match the real answer.
- Export evaluation results as JSON for a static dashboard hosted on GitHub Pages.
- Run automated tests, type checks, and benchmark validation in GitHub Actions.

## Dashboard

The dashboard summarizes candidate performance and lets you inspect individual questions, model outcomes, generated SQL, expected results, and failure details.

[Open the live dashboard](https://sealfromdowntown.github.io/EvalKit/)

To preview the dashboard locally, serve the `dashboard` directory:

```powershell
npx --yes http-server dashboard -p 8080 -c-1
```

Then open <http://localhost:8080>.

The `npm run dashboard:refresh` command runs the dev and test evaluations, exports their JSON, then commits and pushes changed dashboard data to `main`. The push triggers the GitHub Pages deployment workflow. Run it from `main` with no staged changes. Uncached model calls can incur API costs.

## Technology

- **TypeScript and Node.js** for the CLI, evaluation runner, and benchmark tooling.
- **SQLite** for the HDB dataset, cached model calls, and run results.
- **OpenAI API** for the configured model candidates.
- **Vitest** for automated tests.
- **GitHub Actions** for continuous integration and dashboard deployment.
- **GitHub Pages** for hosting the static dashboard.

## Getting started

### Requirements

- Node.js 22.12 or newer
- npm
- An OpenAI API key for uncached model calls
- The HDB resale CSV dataset

Create a local `.env` file in the project root:

```text
OPENAI_API_KEY=your-key
```

Do not commit the `.env` file or your API key.

Download the [HDB resale flat prices dataset](https://data.gov.sg/datasets/d_8b84c4ee58e3cfc0ece0d773c8ca6abc/view) and place the CSV at:

```text
examples/hdb/data/resale_2017_onwards.csv
```

Install dependencies, create the local SQLite database, compute reference results, and validate the benchmark:

```powershell
npm ci
npm run hdb:setup
npm run dev -- compute-expected
npm run dev -- validate
```

The source CSV and generated SQLite database are not included in the repository.

## Running evaluations

Candidate definitions are in [`examples/hdb/config.yaml`](examples/hdb/config.yaml). Each candidate selects a model, prompt file, generation parameters, and optional token pricing. Prompt files are in [`examples/hdb/prompts/`](examples/hdb/prompts/), and benchmark questions are in [`examples/hdb/cases/`](examples/hdb/cases/).

Run the development split while iterating on prompts:

```powershell
npm run dev -- run --split dev --show-failures
```

Run the test split for held-out evaluation:

```powershell
npm run dev -- run --split test --show-failures
```

Each run prints a run ID. To compare two candidates from the same run, substitute that ID:

```powershell
npm run dev -- compare main-v2 main-v3 --run YOUR_RUN_ID
```

Matching model, prompt, question, and generation settings can reuse a cached call. Changing those inputs creates a different cache entry and may incur API costs.

## Case splits and scoring

Each benchmark case contains a natural-language question and reference SQL. EvalKit executes the reference query against the local HDB database to obtain the expected result. It then executes each candidate’s generated SQL and compares the returned result with the expected one.

Generated cases receive a stable split based on their case ID. Handwritten cases default to `dev`; cases intended for held-out evaluation set `split: test` in YAML. Use dev cases to inspect errors and refine prompts, and reserve test cases for evaluation after prompt changes are settled.

By default, row order is ignored, column names are ignored, `NULL` matches `NULL`, and numeric values use an absolute tolerance of 0.5. Individual cases can override ordering or tolerance with a `compare` block.

### Counterfactual intent probes

A wrong query can return the right result by coincidence. This is especially concerning for a legitimate zero answer: a misspelled town filter may also return zero. A case can define an optional `intent_probe` with small synthetic `resale` rows that make the reference query return a discriminating result. When the candidate matches the real-data answer but fails that probe, EvalKit reports `intent_probe_failed` and counts it as a failed case.

Intent probes are case-specific and only as strong as their example rows. They strengthen execution-based scoring; they do not prove full SQL equivalence. Cases without a probe are evaluated against the real dataset only.

## Development checks

Run the project checks locally:

```powershell
npm test
npm run typecheck
npm run dev -- validate
```

GitHub Actions runs tests, type checking, and case validation on pushes to `main` and pull requests.

## Limitations

- The benchmark focuses on one dataset and one task: writing SQL for questions about HDB resale transactions.
- Development cases are used while refining prompts; their scores are tuning results.
- Test results describe performance on this specific held-out case set and do not establish general model quality.
- Some cases share patterns, so the number of cases is not the same as the number of independent task types.
- Model outputs can vary between calls. A single run does not measure all run-to-run variation.
- Matching query results, numeric tolerance, and counterfactual probes each have limits; passing does not guarantee general SQL correctness.
- Cost is estimated from configured token prices and recorded usage.

## Data source and attribution

Contains information from [Resale flat prices based on registration date from Jan-2017 onwards](https://data.gov.sg/datasets/d_8b84c4ee58e3cfc0ece0d773c8ca6abc/view), provided by the Housing & Development Board and accessed 12 October 2026 via data.gov.sg. The dataset is made available under the [Singapore Open Data Licence v1.0](https://data.gov.sg/open-data-licence).
