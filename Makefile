# ERP factory — clean-machine entry points (mandate §12.1)

.PHONY: bootstrap demo gates

bootstrap:
	corepack enable
	pnpm install

demo:
	pnpm factory demo tenants/reformas-demo/tenant.yaml

gates:
	pnpm lint && pnpm check-types && pnpm test && pnpm build && pnpm boundaries && node tests/parity/bundle-safety.mjs
