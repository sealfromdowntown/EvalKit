## How cases are generated

- `npm run hdb:generate` fills question templates (count, average, median, max,
  price per sqm, count by flat type, top town) using a fixed seed (20260101),
  so output is identical on every run.
- Only complete calendar years are used (2026 is partial), and only 3 ROOM,
  4 ROOM, 5 ROOM and EXECUTIVE flats (other types are too small).
- A candidate case is kept only if at least 30 rows support the answer (50 for
  count questions, 1000 for the top-town question) and the top-town answer is not a tie.
- Questions use natural casing ('Ang Mo Kio', '4-room'); the SQL filters on stored
  values ('ANG MO KIO', '4 ROOM'). Models are not told the stored casing in the v1 prompt.
- About 20% of generated cases are assigned to the held-out `test` split by hashing
  the case id. `evalkit run` skips them unless `--split test` or `--split all` is used.
- Medians use the sort/OFFSET pattern because SQLite has no median function.
- Changing the templates, quotas or seed reshuffles the output, so rerun
  `compute-expected` afterwards.