import { z } from "zod";

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
});

export const CaseFileSchema = z.array(CaseSchema);

export type Case = z.infer<typeof CaseSchema>;