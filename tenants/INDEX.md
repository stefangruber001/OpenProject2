# Fleet inventory

Every tenant is a spec directory under `tenants/<id>/`. Rows are appended by
`factory new-tenant` — the seed of the P4 control-plane inventory.

| Tenant         | Composition                                                         | Kernel |
| -------------- | ------------------------------------------------------------------- | ------ |
| reformas-demo  | jurisdiction/es-ES + vertical/construction-reformas                 | 1.0.0  |
| azulejos-lopez | jurisdiction/es-ES + vertical/construction-reformas                 | 1.0.0  |
| diorka         | jurisdiction/es-ES + vertical/construction-reformas (group: diorka) | 1.0.0  |
