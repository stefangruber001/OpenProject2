import type { CapabilityManifest, PackManifest, Registries } from "@repo/kernel";
import { quotingManifest } from "@repo/capability-quoting";
import { billingManifest } from "@repo/capability-billing";
import { sourcingManifest } from "@repo/capability-sourcing";
import { messagingManifest } from "@repo/capability-messaging";
import { esPack } from "@repo/pack-jurisdiction-es-es";
import { reformasPack } from "@repo/pack-vertical-construction-reformas";

/** P2 build-out pending — declared so tenant specs can already select them. */
const stub = (id: string): CapabilityManifest => ({ id, version: "0.1.0", requiredPorts: [] });

export const capabilityRegistry: ReadonlyMap<string, CapabilityManifest> = new Map(
  [
    quotingManifest,
    billingManifest,
    sourcingManifest,
    messagingManifest,
    stub("scheduling"),
    stub("time"),
    stub("procurement"),
    stub("docs"),
  ].map((c) => [c.id, c] as const),
);

export const packRegistry: readonly PackManifest[] = [esPack, reformasPack];

export const registries: Registries = {
  capabilities: capabilityRegistry,
  packs: packRegistry,
};
