import { FactoryError } from "./errors";

/**
 * Ports & adapters. Capabilities declare ports (`name@majorVersion`);
 * jurisdiction/vertical packs bind adapters at resolve time. The kernel only
 * brokers — it knows nothing about what flows through.
 */
export type PortId = `${string}@${number}`;

interface Binding {
  adapter: unknown;
  providerId: string;
}

export class PortRegistry {
  private bindings = new Map<PortId, Binding>();

  bind(port: PortId, adapter: unknown, providerId: string): void {
    const existing = this.bindings.get(port);
    if (existing) {
      throw new FactoryError(
        "PORT_CONFLICT",
        `Port ${port} is already bound by "${existing.providerId}"; "${providerId}" tried to bind it too. ` +
          `Two selected packs implement the same port — fix the tenant spec or the packs.`,
        { port, providers: [existing.providerId, providerId] },
      );
    }
    this.bindings.set(port, { adapter, providerId });
  }

  get<T>(port: PortId): T {
    const binding = this.bindings.get(port);
    if (!binding) {
      throw new FactoryError(
        "PORT_NOT_BOUND",
        `No adapter bound for port ${port}. A selected pack (jurisdiction or vertical) must provide it; ` +
          `the kernel and capabilities never ship defaults for it.`,
        { port },
      );
    }
    return binding.adapter as T;
  }

  tryGet<T>(port: PortId): T | undefined {
    return (this.bindings.get(port)?.adapter as T) ?? undefined;
  }

  has(port: PortId): boolean {
    return this.bindings.has(port);
  }

  provider(port: PortId): string | undefined {
    return this.bindings.get(port)?.providerId;
  }

  boundPorts(): PortId[] {
    return [...this.bindings.keys()].sort();
  }
}

/** Narrow view given to packs during registration (provider is pinned). */
export interface PortBinder {
  bind(port: PortId, adapter: unknown): void;
}

export function binderFor(registry: PortRegistry, providerId: string): PortBinder {
  return {
    bind(port, adapter) {
      registry.bind(port, adapter, providerId);
    },
  };
}
