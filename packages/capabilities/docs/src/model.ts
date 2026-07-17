import { z } from "zod";

/**
 * Documents are generic: a metadata register attaching files to any entity
 * (customer, project, quote, invoice…) with tags and versions. The bytes live
 * behind an injected blob-store port; this capability owns only metadata.
 */
export interface DocMeta {
  id: string;
  entityKind: string;
  entityRef: string;
  name: string;
  mime: string;
  sizeBytes: number;
  storageKey: string;
  tags: string[];
  version: number;
  uploadedAt: string;
}

export interface Register {
  docs: DocMeta[];
}

export const docsConfigSchema = z.object({}).default({});
export type DocsConfig = z.infer<typeof docsConfigSchema>;
