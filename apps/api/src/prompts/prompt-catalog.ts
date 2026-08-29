import { z } from "zod";

export const promptCategorySchema = z
  .string()
  .trim()
  .min(1)
  .max(64)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Category must be a lowercase slug");

export const promptTextSchema = z.string().trim().min(1).max(500);

export const promptVersionNumberSchema = z.number().int().min(1);

export const promptAuditActionSchema = z.enum([
  "created",
  "updated",
  "retired",
]);

export type PromptCategory = z.infer<typeof promptCategorySchema>;

export type PromptText = z.infer<typeof promptTextSchema>;

export type PromptVersionNumber = z.infer<typeof promptVersionNumberSchema>;

export type PromptAuditAction = z.infer<typeof promptAuditActionSchema>;

export const promptAuditEventSchema = z
  .object({
    action: promptAuditActionSchema,
    previousVersion: promptVersionNumberSchema.nullable(),
    nextVersion: promptVersionNumberSchema,
  })
  .strict()
  .superRefine((event, context) => {
    if (event.action === "created") {
      if (event.previousVersion !== null)
        context.addIssue({
          code: z.ZodIssueCode.custom,
          message: "A created prompt has no previous version",
        });
      return;
    }
    if (event.previousVersion === null) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "A changed prompt must record its previous version",
      });
      return;
    }
    if (
      event.action === "updated" &&
      event.previousVersion === event.nextVersion
    )
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "An updated prompt must move to a different version",
      });
    if (
      event.action === "retired" &&
      event.previousVersion !== event.nextVersion
    )
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "A retired event must reference the version it retires",
      });
  });

export type PromptAuditEvent = z.infer<typeof promptAuditEventSchema>;
