# Printing Settings Contracts

Contrato extraido do codigo real do backend para implementacao de
`/admin/settings/printing` no frontend.

Arquivos auditados:

- `prisma/schema.prisma`
- `src/modules/settings/services/printing-settings-service.ts`
- `src/modules/settings/services/settings-resolver-service.ts`
- `src/modules/settings/services/settings-shared.ts`
- `src/modules/settings/schemas/settings-schemas.ts`
- `src/modules/settings/controllers/settings-controllers.ts`
- `src/modules/settings/routes/settings-routes.ts`
- `src/modules/devices/routes/devices-routes.ts`
- `src/modules/devices/controllers/list-devices-controller.ts`
- `src/modules/devices/services/list-devices-service.ts`
- `src/modules/devices/controllers/get-device-controller.ts`
- `src/modules/devices/services/get-device-service.ts`
- `src/modules/devices/services/get-device-config-service.ts`

Nao depende de backend online. Nao exige token real. Nao expoe credenciais.

## Autenticacao e tenant context

Todas as rotas de settings abaixo usam:

- `Authorization: Bearer <jwt>`
- `verifyJWT`
- `requireTenantContext`

Tenant:

- Usuario comum/admin: `organizationId` vem do JWT.
- `SUPER_ADMIN`: deve enviar `x-organization-id: <organizationId>`.
- Tambem existe suporte legado a `?organizationId=...`, mas o middleware loga warning e recomenda `x-organization-id`.
- Se nao houver tenant valido: `401`, `400`, `403` ou `404`, dependendo do caso.

## Enums reais

### PrintingSource

Valores do Prisma e do contrato `sources`:

```ts
"ONLINE_STORE" | "MANUAL_STORE" | "EVENT" | "MANUAL_EVENT" | "TOTEM" | "POS" | "API" | "WAITER"
```

### PrintingSector

Valores do Prisma e do contrato `sectors`:

```ts
"COOK" | "BAR" | "GENERAL"
```

### PrintMode

```ts
"FULL_ORDER" | "BY_SECTOR" | "BOTH"
```

### paperSize

Nao existe enum Prisma para `paperSize`. No schema Prisma e string; no PATCH Zod aceita somente:

```ts
"58mm" | "80mm"
```

Defaults internos usam `"80mm"`.

### DeviceType

```ts
"TOTEM" | "PRINTER" | "CALL_SCREEN" | "SK210"
```

### DeviceStatus

```ts
"ACTIVE" | "PAUSED" | "OFFLINE" | "MAINTENANCE"
```

### DeviceAuthStatus

```ts
"PENDING" | "ACTIVE" | "REVOKED"
```

### SettingsChannel

Usado por `GET /settings/effective`:

```ts
"ALL" | "DELIVERY" | "PICKUP" | "DIGITAL_MENU" | "TOTEM" | "COUNTER"
```

## GET /settings/printing

Rota real:

```http
GET /settings/printing
Authorization: Bearer <jwt>
x-organization-id: <organizationId> // somente SUPER_ADMIN ou quando aplicavel
```

Status:

- Sucesso: `200 OK`
- Sem auth: `401`
- Tenant invalido/ausente: `400`, `403` ou `404`
- Erros de service: `400` ou `404` via `handleSettingsError`

Controller retorna:

```ts
{
  settings: OrganizationPrintingSettings | null,
  effective: EffectivePrintingSettings,
  source: "ORGANIZATION_PRINTING_SETTINGS" | "DEFAULT"
}
```

### Resposta completa quando existe registro persistido

Exemplo seguro. Datas sao serializadas como ISO JSON pelo Fastify.

```json
{
  "settings": {
    "id": "clxprinting00000000000000001",
    "organizationId": "clxorganization0000000000001",
    "printingEnabled": true,
    "autoPrintEnabled": true,
    "allowReprint": true,
    "splitBySector": false,
    "mergeCopies": true,
    "defaultPrinterDeviceId": "clxdevice000000000000000001",
    "kitchenPrinterDeviceId": "clxdevice000000000000000002",
    "barPrinterDeviceId": null,
    "expeditionPrinterDeviceId": null,
    "paperSize": "80mm",
    "showLogo": false,
    "showPrices": true,
    "showQrCode": false,
    "showPayment": true,
    "showOrderSource": true,
    "showOrderNotes": true,
    "showItemNotes": true,
    "showOptions": true,
    "sources": {
      "ONLINE_STORE": {
        "enabled": true,
        "autoPrint": true,
        "printMode": "FULL_ORDER"
      },
      "MANUAL_STORE": {
        "enabled": true,
        "autoPrint": false,
        "printMode": "FULL_ORDER"
      },
      "EVENT": {
        "enabled": true,
        "autoPrint": true,
        "printMode": "BY_SECTOR"
      },
      "MANUAL_EVENT": {
        "enabled": true,
        "autoPrint": true,
        "printMode": "FULL_ORDER"
      },
      "TOTEM": {
        "enabled": true,
        "autoPrint": true,
        "printMode": "FULL_ORDER"
      },
      "POS": {
        "enabled": true,
        "autoPrint": true,
        "printMode": "FULL_ORDER"
      },
      "API": {
        "enabled": true,
        "autoPrint": false,
        "printMode": "FULL_ORDER"
      },
      "WAITER": {
        "enabled": true,
        "autoPrint": true,
        "printMode": "FULL_ORDER"
      }
    },
    "sectors": {
      "COOK": {
        "enabled": true
      },
      "BAR": {
        "enabled": true
      },
      "GENERAL": {
        "enabled": true
      }
    },
    "createdAt": "2026-07-16T12:00:00.000Z",
    "updatedAt": "2026-07-16T12:30:00.000Z"
  },
  "effective": {
    "printingEnabled": true,
    "autoPrintEnabled": true,
    "allowReprint": true,
    "splitBySector": false,
    "mergeCopies": true,
    "defaultPrinterDeviceId": "clxdevice000000000000000001",
    "kitchenPrinterDeviceId": "clxdevice000000000000000002",
    "barPrinterDeviceId": null,
    "expeditionPrinterDeviceId": null,
    "paperSize": "80mm",
    "showLogo": false,
    "showPrices": true,
    "showQrCode": false,
    "showPayment": true,
    "showOrderSource": true,
    "showOrderNotes": true,
    "showItemNotes": true,
    "showOptions": true,
    "sources": {
      "ONLINE_STORE": {
        "enabled": true,
        "autoPrint": true,
        "printMode": "FULL_ORDER"
      },
      "MANUAL_STORE": {
        "enabled": true,
        "autoPrint": false,
        "printMode": "FULL_ORDER"
      },
      "EVENT": {
        "enabled": true,
        "autoPrint": true,
        "printMode": "BY_SECTOR"
      },
      "MANUAL_EVENT": {
        "enabled": true,
        "autoPrint": true,
        "printMode": "FULL_ORDER"
      },
      "TOTEM": {
        "enabled": true,
        "autoPrint": true,
        "printMode": "FULL_ORDER"
      },
      "POS": {
        "enabled": true,
        "autoPrint": true,
        "printMode": "FULL_ORDER"
      },
      "API": {
        "enabled": true,
        "autoPrint": false,
        "printMode": "FULL_ORDER"
      },
      "WAITER": {
        "enabled": true,
        "autoPrint": true,
        "printMode": "FULL_ORDER"
      }
    },
    "sectors": {
      "COOK": {
        "enabled": true
      },
      "BAR": {
        "enabled": true
      },
      "GENERAL": {
        "enabled": true
      }
    },
    "source": "ORGANIZATION_PRINTING_SETTINGS",
    "fallback": {
      "used": false,
      "reason": null
    }
  },
  "source": "ORGANIZATION_PRINTING_SETTINGS"
}
```

### Resposta quando nao existe registro

`settings` e `source` mudam. `effective` volta com defaults completos.

```json
{
  "settings": null,
  "effective": {
    "printingEnabled": false,
    "autoPrintEnabled": false,
    "allowReprint": true,
    "splitBySector": false,
    "mergeCopies": true,
    "defaultPrinterDeviceId": null,
    "kitchenPrinterDeviceId": null,
    "barPrinterDeviceId": null,
    "expeditionPrinterDeviceId": null,
    "paperSize": "80mm",
    "showLogo": false,
    "showPrices": true,
    "showQrCode": false,
    "showPayment": true,
    "showOrderSource": true,
    "showOrderNotes": true,
    "showItemNotes": true,
    "showOptions": true,
    "sources": {
      "ONLINE_STORE": {
        "enabled": true,
        "autoPrint": true,
        "printMode": "FULL_ORDER"
      },
      "MANUAL_STORE": {
        "enabled": true,
        "autoPrint": true,
        "printMode": "FULL_ORDER"
      },
      "EVENT": {
        "enabled": true,
        "autoPrint": true,
        "printMode": "FULL_ORDER"
      },
      "MANUAL_EVENT": {
        "enabled": true,
        "autoPrint": true,
        "printMode": "FULL_ORDER"
      },
      "TOTEM": {
        "enabled": true,
        "autoPrint": true,
        "printMode": "FULL_ORDER"
      },
      "POS": {
        "enabled": true,
        "autoPrint": true,
        "printMode": "FULL_ORDER"
      },
      "API": {
        "enabled": true,
        "autoPrint": true,
        "printMode": "FULL_ORDER"
      },
      "WAITER": {
        "enabled": true,
        "autoPrint": true,
        "printMode": "FULL_ORDER"
      }
    },
    "sectors": {
      "COOK": {
        "enabled": true
      },
      "BAR": {
        "enabled": true
      },
      "GENERAL": {
        "enabled": true
      }
    },
    "source": "DEFAULT",
    "fallback": {
      "used": false,
      "reason": null
    }
  },
  "source": "DEFAULT"
}
```

### Campos obrigatorios e nullable na resposta

No wrapper:

- `settings`: obrigatorio, pode ser `null`.
- `effective`: obrigatorio, nunca `null`.
- `source`: obrigatorio.

Em `settings` quando existe:

- Obrigatorios nao nullable: `id`, `organizationId`, booleans, `paperSize`, `sources`, `sectors`, `createdAt`, `updatedAt`.
- Nullable: `defaultPrinterDeviceId`, `kitchenPrinterDeviceId`, `barPrinterDeviceId`, `expeditionPrinterDeviceId`.
- `sources` e `sectors` sao `Json?` no Prisma, mas o service persiste objetos completos no PATCH. Se dados antigos estiverem nulos ou incompletos, `effective` normaliza.
- Nao existe `version` em `GET /settings/printing`.
- `updatedAt` existe dentro de `settings`; nao existe dentro de `effective`.

## PATCH /settings/printing

Rota real:

```http
PATCH /settings/printing
Authorization: Bearer <jwt>
Content-Type: application/json
```

Status:

- Sucesso: `200 OK`
- Body invalido: normalmente `400`
- Device vinculado inexistente ou fora da organizacao: `400` com `message: "One or more printer devices were not found"`
- Sem auth: `401`
- Tenant invalido/ausente: `400`, `403` ou `404`

### Body exato aceito pelo Zod

Todos os campos top-level sao opcionais. Body vazio `{}` e aceito; o service ainda faz upsert e grava `sources`/`sectors` efetivos atuais/defaults.

```ts
{
  printingEnabled?: boolean
  autoPrintEnabled?: boolean
  allowReprint?: boolean
  splitBySector?: boolean
  mergeCopies?: boolean

  defaultPrinterDeviceId?: string | null // cuid ou null
  kitchenPrinterDeviceId?: string | null // cuid ou null
  barPrinterDeviceId?: string | null // cuid ou null
  expeditionPrinterDeviceId?: string | null // cuid ou null

  paperSize?: "58mm" | "80mm"

  showLogo?: boolean
  showPrices?: boolean
  showQrCode?: boolean
  showPayment?: boolean
  showOrderSource?: boolean
  showOrderNotes?: boolean
  showItemNotes?: boolean
  showOptions?: boolean

  sources?: {
    ONLINE_STORE?: {
      enabled?: boolean
      autoPrint?: boolean
      printMode?: "FULL_ORDER" | "BY_SECTOR" | "BOTH"
    }
    MANUAL_STORE?: {
      enabled?: boolean
      autoPrint?: boolean
      printMode?: "FULL_ORDER" | "BY_SECTOR" | "BOTH"
    }
    EVENT?: {
      enabled?: boolean
      autoPrint?: boolean
      printMode?: "FULL_ORDER" | "BY_SECTOR" | "BOTH"
    }
    MANUAL_EVENT?: {
      enabled?: boolean
      autoPrint?: boolean
      printMode?: "FULL_ORDER" | "BY_SECTOR" | "BOTH"
    }
    TOTEM?: {
      enabled?: boolean
      autoPrint?: boolean
      printMode?: "FULL_ORDER" | "BY_SECTOR" | "BOTH"
    }
    POS?: {
      enabled?: boolean
      autoPrint?: boolean
      printMode?: "FULL_ORDER" | "BY_SECTOR" | "BOTH"
    }
    API?: {
      enabled?: boolean
      autoPrint?: boolean
      printMode?: "FULL_ORDER" | "BY_SECTOR" | "BOTH"
    }
    WAITER?: {
      enabled?: boolean
      autoPrint?: boolean
      printMode?: "FULL_ORDER" | "BY_SECTOR" | "BOTH"
    }
  }

  sectors?: {
    COOK?: {
      enabled?: boolean
    }
    BAR?: {
      enabled?: boolean
    }
    GENERAL?: {
      enabled?: boolean
    }
  }
}
```

### Semantica de `undefined`, campo omitido e `null`

- Campo omitido / `undefined`: nao altera scalar correspondente.
- `sources` omitido: mantem `current.effective.sources`.
- `sources.<KEY>` omitido: mantem aquela origem.
- `sources.<KEY>.<field>` omitido: mantem o campo daquela origem.
- `sectors` omitido: mantem `current.effective.sectors`.
- `sectors.<KEY>` omitido: mantem aquele setor.
- `sectors.<KEY>.enabled` omitido: mantem aquele boolean.
- `null` e aceito somente para:
  - `defaultPrinterDeviceId`
  - `kitchenPrinterDeviceId`
  - `barPrinterDeviceId`
  - `expeditionPrinterDeviceId`
- `null` nesses device IDs remove o vinculo.
- `null` em booleans, `paperSize`, `sources`, source field, `sectors` ou sector field e invalido pelo schema Zod.

### Validacoes e limites

- Device IDs: `z.string().cuid().nullable().optional()`.
- Quando device ID nao e `null`, service valida se todos os IDs pertencem a mesma organizacao.
- `paperSize`: somente `"58mm"` ou `"80mm"`.
- `printMode`: somente `"FULL_ORDER"`, `"BY_SECTOR"` ou `"BOTH"`.
- Booleans: somente boolean real JSON.
- `sources`: objeto com chaves conhecidas; cada origem e parcial.
- `sectors`: objeto com chaves conhecidas; cada setor e parcial.
- Nao ha limites numericos porque nao ha campos numericos nesse PATCH.

### Exemplos de PATCH

#### Patch parcial de toggle

```json
{
  "printingEnabled": true,
  "autoPrintEnabled": true
}
```

#### Vincular device

```json
{
  "defaultPrinterDeviceId": "clxdevice000000000000000001",
  "kitchenPrinterDeviceId": "clxdevice000000000000000002"
}
```

#### Remover device com null

```json
{
  "barPrinterDeviceId": null,
  "expeditionPrinterDeviceId": null
}
```

#### Atualizar uma origem

```json
{
  "sources": {
    "ONLINE_STORE": {
      "enabled": true,
      "autoPrint": true,
      "printMode": "FULL_ORDER"
    }
  }
}
```

Tambem aceita parcial dentro da origem:

```json
{
  "sources": {
    "API": {
      "autoPrint": false
    }
  }
}
```

#### Atualizar layout

```json
{
  "paperSize": "80mm",
  "showLogo": true,
  "showPrices": true,
  "showQrCode": false,
  "showPayment": true,
  "showOrderSource": true,
  "showOrderNotes": true,
  "showItemNotes": true,
  "showOptions": true
}
```

#### Atualizar setores

```json
{
  "sectors": {
    "COOK": {
      "enabled": true
    },
    "BAR": {
      "enabled": true
    },
    "GENERAL": {
      "enabled": false
    }
  }
}
```

## Resposta do PATCH

Controller retorna `reply.send(result)` do service. Status de sucesso: `200 OK`.

Nao e `204`. Nao retorna wrapper `data`. Retorna objeto completo:

```ts
{
  settings: OrganizationPrintingSettings,
  effective: EffectivePrintingSettings
}
```

Exemplo seguro de JSON:

```json
{
  "settings": {
    "id": "clxprinting00000000000000001",
    "organizationId": "clxorganization0000000000001",
    "printingEnabled": true,
    "autoPrintEnabled": true,
    "allowReprint": true,
    "splitBySector": false,
    "mergeCopies": true,
    "defaultPrinterDeviceId": "clxdevice000000000000000001",
    "kitchenPrinterDeviceId": "clxdevice000000000000000002",
    "barPrinterDeviceId": null,
    "expeditionPrinterDeviceId": null,
    "paperSize": "80mm",
    "showLogo": true,
    "showPrices": true,
    "showQrCode": false,
    "showPayment": true,
    "showOrderSource": true,
    "showOrderNotes": true,
    "showItemNotes": true,
    "showOptions": true,
    "sources": {
      "ONLINE_STORE": {
        "enabled": true,
        "autoPrint": true,
        "printMode": "FULL_ORDER"
      },
      "MANUAL_STORE": {
        "enabled": true,
        "autoPrint": true,
        "printMode": "FULL_ORDER"
      },
      "EVENT": {
        "enabled": true,
        "autoPrint": true,
        "printMode": "FULL_ORDER"
      },
      "MANUAL_EVENT": {
        "enabled": true,
        "autoPrint": true,
        "printMode": "FULL_ORDER"
      },
      "TOTEM": {
        "enabled": true,
        "autoPrint": true,
        "printMode": "FULL_ORDER"
      },
      "POS": {
        "enabled": true,
        "autoPrint": true,
        "printMode": "FULL_ORDER"
      },
      "API": {
        "enabled": true,
        "autoPrint": false,
        "printMode": "FULL_ORDER"
      },
      "WAITER": {
        "enabled": true,
        "autoPrint": true,
        "printMode": "FULL_ORDER"
      }
    },
    "sectors": {
      "COOK": {
        "enabled": true
      },
      "BAR": {
        "enabled": true
      },
      "GENERAL": {
        "enabled": false
      }
    },
    "createdAt": "2026-07-16T12:00:00.000Z",
    "updatedAt": "2026-07-16T12:45:00.000Z"
  },
  "effective": {
    "printingEnabled": true,
    "autoPrintEnabled": true,
    "allowReprint": true,
    "splitBySector": false,
    "mergeCopies": true,
    "defaultPrinterDeviceId": "clxdevice000000000000000001",
    "kitchenPrinterDeviceId": "clxdevice000000000000000002",
    "barPrinterDeviceId": null,
    "expeditionPrinterDeviceId": null,
    "paperSize": "80mm",
    "showLogo": true,
    "showPrices": true,
    "showQrCode": false,
    "showPayment": true,
    "showOrderSource": true,
    "showOrderNotes": true,
    "showItemNotes": true,
    "showOptions": true,
    "sources": {
      "ONLINE_STORE": {
        "enabled": true,
        "autoPrint": true,
        "printMode": "FULL_ORDER"
      },
      "MANUAL_STORE": {
        "enabled": true,
        "autoPrint": true,
        "printMode": "FULL_ORDER"
      },
      "EVENT": {
        "enabled": true,
        "autoPrint": true,
        "printMode": "FULL_ORDER"
      },
      "MANUAL_EVENT": {
        "enabled": true,
        "autoPrint": true,
        "printMode": "FULL_ORDER"
      },
      "TOTEM": {
        "enabled": true,
        "autoPrint": true,
        "printMode": "FULL_ORDER"
      },
      "POS": {
        "enabled": true,
        "autoPrint": true,
        "printMode": "FULL_ORDER"
      },
      "API": {
        "enabled": true,
        "autoPrint": false,
        "printMode": "FULL_ORDER"
      },
      "WAITER": {
        "enabled": true,
        "autoPrint": true,
        "printMode": "FULL_ORDER"
      }
    },
    "sectors": {
      "COOK": {
        "enabled": true
      },
      "BAR": {
        "enabled": true
      },
      "GENERAL": {
        "enabled": false
      }
    },
    "source": "ORGANIZATION_PRINTING_SETTINGS",
    "fallback": {
      "used": false,
      "reason": null
    }
  }
}
```

## sources

Shape real em `effective` e no dado persistido depois do PATCH:

```ts
Record<PrintingSource, {
  enabled: boolean
  autoPrint: boolean
  printMode: "FULL_ORDER" | "BY_SECTOR" | "BOTH"
}>
```

Confirmacoes:

- Nao e array.
- E objeto/record indexado pelos valores de `PrintingSource`.
- Em `effective`, todas as origens sao sempre retornadas.
- No PATCH, todas as origens sao opcionais.
- No PATCH, cada origem aceita objeto parcial.
- PATCH nao exige objeto completo.
- Service mergeia o patch parcial com `current.effective.sources`.
- Persistencia via PATCH grava `sources` completo resultante do merge.
- Se dado antigo no banco estiver nulo/incompleto, `effective` normaliza usando defaults.

## sectors

Shape real em `effective` e no dado persistido depois do PATCH:

```ts
Record<PrintingSector, {
  enabled: boolean
}>
```

Confirmacoes:

- Nao e array.
- Nao e derivado/read-only.
- E campo persistido em `OrganizationPrintingSettings.sectors` como `Json?`.
- PATCH aceita atualizacao parcial por setor.
- Service mergeia com `current.effective.sectors`.
- Em `effective`, todos os setores sao sempre retornados.

## Devices para /admin/devices

Rota real de listagem:

```http
GET /devices
Authorization: Bearer <jwt>
x-organization-id: <organizationId> // somente SUPER_ADMIN ou quando aplicavel
```

Pre handlers:

- `verifyJWT`
- `requireTenantContext`

Filtros:

- Nao ha query params de filtro no controller/service atual.
- O filtro real e apenas `organizationId` do tenant.
- Ordenacao: `createdAt desc`.

Service:

```ts
prisma.device.findMany({
  where: { organizationId },
  include: {
    event: {
      select: {
        id: true,
        name: true
      }
    }
  },
  orderBy: {
    createdAt: "desc"
  }
})
```

Resposta:

```ts
{
  devices: Array<Device & {
    event: {
      id: string
      name: string
    } | null
  }>
}
```

JSON seguro:

```json
{
  "devices": [
    {
      "id": "clxdevice000000000000000001",
      "organizationId": "clxorganization0000000000001",
      "eventId": null,
      "storeId": "clxstore000000000000000001",
      "name": "Impressora Cozinha",
      "code": "PRINTER-KITCHEN-01",
      "locationName": "Cozinha",
      "type": "PRINTER",
      "status": "ACTIVE",
      "authStatus": "ACTIVE",
      "tokenHash": null,
      "deviceSecretHash": null,
      "appVersion": "1.0.0",
      "lastSeenAt": "2026-07-16T12:10:00.000Z",
      "lastHeartbeatAt": "2026-07-16T12:11:00.000Z",
      "lastActivatedAt": "2026-07-16T10:00:00.000Z",
      "lastIpAddress": "192.0.2.10",
      "lastUserAgent": "ExampleDevice/1.0",
      "metadata": {
        "sector": "COOK",
        "paperSize": "80mm"
      },
      "createdAt": "2026-07-16T10:00:00.000Z",
      "updatedAt": "2026-07-16T12:11:00.000Z",
      "event": null
    }
  ]
}
```

Campos pedidos:

- `id`: retornado.
- `name`: retornado.
- `type`: retornado.
- `status`: retornado.
- `authStatus`: retornado.
- `storeId`: retornado porque `include` sem `select` retorna todos os campos do model `Device`.
- `eventId`: retornado.
- `lastHeartbeatAt`: retornado.
- `metadata`: retornado.
- Campos de display disponiveis: `name`, `code`, `locationName`, `type`, `status`, `authStatus`, `appVersion`, `lastSeenAt`, `lastHeartbeatAt`, `event?.name`.

Atencao de seguranca: o DTO atual de `GET /devices` retorna `tokenHash` e `deviceSecretHash` porque usa `include` sem `select`. O frontend nao deve exibir esses campos.

Rota de detalhe:

```http
GET /devices/:id
```

Retorna:

```ts
{
  device: Device & { event: Event | null }
}
```

## GET /settings/effective

Rota real:

```http
GET /settings/effective?storeId=<cuid>&eventId=<cuid>&deviceId=<cuid>&channel=ALL&date=2026-07-16
Authorization: Bearer <jwt>
```

Query params aceitos pelo schema:

- `storeId?: string.cuid()`
- `eventId?: string.cuid()`
- `deviceId?: string.cuid()`
- `channel?: "ALL" | "DELIVERY" | "PICKUP" | "DIGITAL_MENU" | "TOTEM" | "COUNTER"`
- `date?: Date` via `z.coerce.date()`

Nao existe query param `context`, `contextType` ou outro nome para esta rota.

Resposta do controller:

```ts
{
  effective: {
    // outros blocos...
    printing: EffectivePrintingSettings
    // legacyAdapters fora do bloco printing
  }
}
```

Somente bloco real `printing`:

```json
{
  "effective": {
    "printing": {
      "printingEnabled": true,
      "autoPrintEnabled": true,
      "allowReprint": true,
      "splitBySector": false,
      "mergeCopies": true,
      "defaultPrinterDeviceId": "clxdevice000000000000000001",
      "kitchenPrinterDeviceId": "clxdevice000000000000000002",
      "barPrinterDeviceId": null,
      "expeditionPrinterDeviceId": null,
      "paperSize": "80mm",
      "showLogo": false,
      "showPrices": true,
      "showQrCode": false,
      "showPayment": true,
      "showOrderSource": true,
      "showOrderNotes": true,
      "showItemNotes": true,
      "showOptions": true,
      "sources": {
        "ONLINE_STORE": {
          "enabled": true,
          "autoPrint": true,
          "printMode": "FULL_ORDER"
        },
        "MANUAL_STORE": {
          "enabled": true,
          "autoPrint": true,
          "printMode": "FULL_ORDER"
        },
        "EVENT": {
          "enabled": true,
          "autoPrint": true,
          "printMode": "FULL_ORDER"
        },
        "MANUAL_EVENT": {
          "enabled": true,
          "autoPrint": true,
          "printMode": "FULL_ORDER"
        },
        "TOTEM": {
          "enabled": true,
          "autoPrint": true,
          "printMode": "FULL_ORDER"
        },
        "POS": {
          "enabled": true,
          "autoPrint": true,
          "printMode": "FULL_ORDER"
        },
        "API": {
          "enabled": true,
          "autoPrint": true,
          "printMode": "FULL_ORDER"
        },
        "WAITER": {
          "enabled": true,
          "autoPrint": true,
          "printMode": "FULL_ORDER"
        }
      },
      "sectors": {
        "COOK": {
          "enabled": true
        },
        "BAR": {
          "enabled": true
        },
        "GENERAL": {
          "enabled": true
        }
      },
      "source": "ORGANIZATION_PRINTING_SETTINGS",
      "fallback": {
        "used": false,
        "reason": null
      }
    }
  }
}
```

### Valores efetivos, source e fallback

Prioridade real:

1. Se existe `OrganizationPrintingSettings`, `printing` vem de `PrintingSettingsService.toEffective(printingSettings)`.
   - `source`: `"ORGANIZATION_PRINTING_SETTINGS"`
   - `fallback.used`: `false`
   - `fallback.reason`: `null`
2. Se nao existe settings de organizacao, o resolver tenta legado:
   - `event` da query
   - `device.event`
   - `store`
   - `device.store`
3. Se existe contexto legado, monta `legacyPrintingFallback`.
   - `source`: `"LEGACY_FALLBACK"`
   - `fallback.used`: `true`
   - `fallback.reason`: `"EVENT_LEGACY" | "ONLINE_STORE_LEGACY" | "DEVICE_EVENT_LEGACY" | "DEVICE_STORE_LEGACY"`
4. Sem contexto legado:
   - `source`: `"DEFAULT"`
   - `fallback.used`: `false`
   - `fallback.reason`: `null`

Device resolvido:

- O device e buscado por `deviceId` e `organizationId`, com `event` e `store` incluidos.
- O device pode influenciar fallback legado se nao existir `OrganizationPrintingSettings`.
- O objeto do device resolvido nao aparece dentro de `effective.printing`.
- O objeto resumido aparece fora, em `effective.legacyAdapters.device`.

## Divergencias da spec conceitual enviada ao Lovable

| Campo da spec | Existe? | Nome real | Diferenca |
| --- | --- | --- | --- |
| `sources.ONLINE_STORE.enabled` | Sim | `sources.ONLINE_STORE.enabled` | E boolean dentro de Record, parcial no PATCH, completo no effective. |
| `sources.ONLINE_STORE.autoPrint` | Sim | `sources.ONLINE_STORE.autoPrint` | E por origem; tambem existe `autoPrintEnabled` global. |
| `sources.ONLINE_STORE.printMode` | Sim | `sources.ONLINE_STORE.printMode` | Enum real: `FULL_ORDER`, `BY_SECTOR`, `BOTH`. |
| `sources` como array | Nao | `sources` | Real e objeto/Record, nao array. |
| Todas as origens obrigatorias no PATCH | Nao | `sources?: { ... }` | PATCH aceita parcial; service mergeia com effective atual. |
| Todas as origens obrigatorias no GET | Sim em `effective` | `effective.sources` | `settings.sources` bruto pode refletir JSON persistido; `effective.sources` e normalizado completo. |
| `sectors` como array de enum | Nao | `sectors` | Real e objeto/Record por setor com `{ enabled }`. |
| `sectors` read-only/derivado | Nao | `sectors` | Campo persistido via PATCH em `OrganizationPrintingSettings.sectors`. |
| `paperSize` enum Prisma | Nao | `paperSize` | Prisma e `String`; Zod PATCH limita a `"58mm"` ou `"80mm"`. |
| `updatedAt` no bloco `effective` | Nao | `settings.updatedAt` | `GET /settings/printing` tem `settings.updatedAt` quando existe row; `effective` nao tem data. |
| `version` em `/settings/printing` | Nao | N/A | `version` existe em `GET /settings`, nao em `GET /settings/printing`. |
| Device resolvido dentro de `printing` | Nao | N/A | `printing` traz apenas IDs de device; device resolvido aparece em rotas de devices ou `legacyAdapters` fora do bloco printing em `/settings/effective`. |
| Filtros em `GET /devices` | Nao | N/A | Listagem filtra somente por tenant; nao ha query schema. |
| `channel` em `/settings/printing` | Nao | N/A | `channel` so existe em `GET /settings/effective` e outras rotas de business/online settings. |

## Resumo para Lovable

Shape do GET `/settings/printing`:

```ts
{
  settings: OrganizationPrintingSettings | null,
  effective: EffectivePrintingSettings,
  source: "ORGANIZATION_PRINTING_SETTINGS" | "DEFAULT"
}
```

Shape do PATCH `/settings/printing`:

```ts
Partial<{
  printingEnabled: boolean
  autoPrintEnabled: boolean
  allowReprint: boolean
  splitBySector: boolean
  mergeCopies: boolean
  defaultPrinterDeviceId: string | null
  kitchenPrinterDeviceId: string | null
  barPrinterDeviceId: string | null
  expeditionPrinterDeviceId: string | null
  paperSize: "58mm" | "80mm"
  showLogo: boolean
  showPrices: boolean
  showQrCode: boolean
  showPayment: boolean
  showOrderSource: boolean
  showOrderNotes: boolean
  showItemNotes: boolean
  showOptions: boolean
  sources: Partial<Record<PrintingSource, Partial<{
    enabled: boolean
    autoPrint: boolean
    printMode: "FULL_ORDER" | "BY_SECTOR" | "BOTH"
  }>>>
  sectors: Partial<Record<PrintingSector, Partial<{
    enabled: boolean
  }>>>
}>
```

Endpoint de devices:

```http
GET /devices
```

Retorna `{ devices: [...] }`, sem filtros de query; filtra por tenant.

Divergencias importantes:

- `sources` e `sectors` sao objetos/Records, nao arrays.
- PATCH aceita parcial em todos os niveis.
- `null` so remove device IDs; nao usar `null` em booleans/layout/sources/sectors.
- Resposta do PATCH e `200 OK` com `{ settings, effective }`.
- `GET /settings/effective` retorna wrapper `{ effective: { printing, ... } }`; device resolvido nao fica dentro de `printing`.

Documento: `docs/api/printing-settings-contracts.md`
