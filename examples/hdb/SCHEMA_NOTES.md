# HDB schema notes (2017-onwards file)

- 242,259 rows, months 2017-01 to 2026-10. The last month is partial,
  so "in 2026" is a partial year and "last year" is ambiguous.
- Towns and flat_type are UPPERCASE ('TAMPINES', '4 ROOM').
- flat_model is mixed case ('Model A', '2-room', '3Gen'), unlike the other text columns.
- 'Multi Generation' (flat_model) vs 'MULTI-GENERATION' (flat_type): hyphen vs space.
- Town 'KALLANG/WHAMPOA' contains a slash. 'CENTRAL AREA' has a space.
- storey_range is a text bucket in 17 steps ('01 TO 03' ... '49 TO 51'), zero-padded.
  "Above the 20th floor" is ambiguous because '19 TO 21' straddles floor 20.
- remaining_lease is text ('61 years 04 months'; '1 month' is singular).
  Zero NULLs in this file, but older files may differ.
- Small groups: MULTI-GENERATION has 91 rows and 1 ROOM has 89. A town x flat_type x
  year combination can easily be empty, so templates must check that
  expected results are non-empty (or include empty results as a deliberate case).