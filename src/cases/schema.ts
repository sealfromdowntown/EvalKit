import { z } from "zod";

const IntentProbeRowSchema = z.strictObject({
  month: z.string().optional(),
  town: z.string().optional(),
  flat_type: z.string().optional(),
  block: z.string().optional(),
  street_name: z.string().optional(),
  storey_range: z.string().optional(),
  floor_area_sqm: z.number().optional(),
  flat_model: z.string().optional(),
  lease_commence_date: z.number().int().optional(),
  remaining_lease: z.string().nullable().optional(),
  resale_price: z.number().optional(),
});

export const CaseSchema = z.strictObject({
  id: z
    .string()
    .regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, "use lowercase letters, digits and hyphens"),
  question: z.string().min(10),
  reference_sql: z.string().min(1),
  tags: z.array(z.string()).default([]),
  split: z.enum(["dev", "test"]).default("dev"),
  // Comparison rules are used by the scorer later (Week 2). Optional for now.
  compare: z
    .strictObject({
      ordered: z.boolean().optional(),
      tolerance: z.number().nonnegative().optional(),
    })
    .optional(),
  intent_probe: z
    .strictObject({ rows: z.array(IntentProbeRowSchema).min(1) })
    .optional(),
});

export const CaseFileSchema = z.array(CaseSchema);

export type Case = z.infer<typeof CaseSchema>;
