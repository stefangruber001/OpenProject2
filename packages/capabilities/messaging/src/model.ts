import { z } from "zod";

/**
 * An email template is DATA (tenant config), not code — so this capability
 * carries no sector or jurisdiction wording. `subject`/`body` may contain
 * `{{placeholder}}` tokens filled from event variables at draft time.
 */
export const emailTemplateSchema = z.object({
  /** Lifecycle event this template drafts for, e.g. "quote-sent". */
  event: z.string().min(1),
  subject: z.string(),
  body: z.string(),
});
export type EmailTemplate = z.infer<typeof emailTemplateSchema>;

/** Mounted at `config.messaging` when the capability is selected. */
export const messagingConfigSchema = z
  .object({
    /** Sender address; also injected as the `{{from}}` variable. */
    from: z.string().default(""),
    /** Signature block; injected as the `{{signature}}` variable. */
    signature: z.string().default(""),
    templates: z.array(emailTemplateSchema).default([]),
  })
  .default({});
export type MessagingConfig = z.infer<typeof messagingConfigSchema>;

/** A drafted (or sent) message. Auto-generated, then a single Send action. */
export interface EmailDraft {
  event: string;
  to: string;
  from: string;
  subject: string;
  body: string;
  status: "draft" | "sent";
}

/**
 * Tenant-file schema for a communications rule, kept here beside the other
 * config schemas rather than in rules.ts. The plain type and its defaults live
 * in rules.ts, which the browser bundle imports; keeping zod out of that module
 * is what stops a validation library travelling into a phone to plan a queue.
 */
export const commsRuleSchema = z.object({
  id: z.string().min(1),
  label: z.string().optional(),
  event: z.string().min(1),
  template: z.string().min(1),
  recipient: z.string().default("customer"),
  afterDays: z.number().int().min(0).max(365).default(0),
  channel: z.enum(["email", "whatsapp", "sms"]).default("email"),
  mode: z.enum(["draft", "auto"]).default("draft"),
  requiresFlag: z.string().optional(),
  active: z.boolean().default(true),
});
