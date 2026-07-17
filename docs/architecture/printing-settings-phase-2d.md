# Fase 2D - Printing Settings

## Auditoria do legado

- `Event` guardava `printingEnabled`, `autoPrintEnabled`, `printMode` e `printerPaperSize`.
- `OnlineStore` repetia os mesmos campos de impressao.
- `EventPrinter` guardava impressoras TCP/SK210 legadas por evento.
- `Device` guardava `eventId`, `storeId`, `type`, `organizationId` e metadados como `printerSector`, `connectionType` e `paperSize`.
- `OrderPrintOrchestratorService` decidia imprimir lendo `Event`/`OnlineStore` diretamente.
- `ProcessPrintJobsService` tambem bloqueava jobs lendo `Event`/`OnlineStore` diretamente.
- `SettingsResolverService` ainda nao tinha dominio oficial de impressao.

## Nova arquitetura

`OrganizationPrintingSettings` passa a ser a fonte oficial organizacional para:

- operacao: `printingEnabled`, `autoPrintEnabled`, `allowReprint`, `splitBySector`, `mergeCopies`;
- dispositivos: `defaultPrinterDeviceId`, `kitchenPrinterDeviceId`, `barPrinterDeviceId`, `expeditionPrinterDeviceId`;
- layout: `paperSize`, `showLogo`, `showPrices`, `showQrCode`, `showPayment`, `showOrderSource`, `showOrderNotes`, `showItemNotes`, `showOptions`;
- origens: `ONLINE_STORE`, `MANUAL_STORE`, `EVENT`, `MANUAL_EVENT`, `TOTEM`, `POS`, `API`, `WAITER`;
- setores: `COOK`, `BAR`, `GENERAL`.

Fluxo oficial:

```text
OrganizationPrintingSettings
  -> SettingsResolverService
  -> effective.printing
  -> OrderPrintOrchestratorService
  -> EventPrintJob
```

## Fluxo de decisao

1. O pedido informa o dominio: evento ou loja.
2. O orquestrador determina a origem:
   - evento com device TOTEM: `TOTEM`;
   - venda manual de evento: `MANUAL_EVENT`;
   - evento publico/API atual: `EVENT`;
   - venda manual de loja: `MANUAL_STORE`;
   - loja publica: `ONLINE_STORE`.
3. O orquestrador chama `SettingsResolverService`.
4. `effective.printing` decide:
   - impressao global habilitada;
   - auto print global habilitado;
   - origem habilitada;
   - auto print da origem habilitado;
   - `paymentStatus` imprimivel: `PAID` ou `NOT_REQUIRED`;
   - targets por device configurado ou fallback;
   - modo `FULL_ORDER`, `BY_SECTOR` ou `BOTH`;
   - idempotencia por `EventPrintJob.idempotencyKey`.

## Fallbacks

Enquanto o legado existir, o resolver usa:

- `OrganizationPrintingSettings`, quando existir;
- fallback `EVENT_LEGACY`, quando houver `eventId`;
- fallback `ONLINE_STORE_LEGACY`, quando houver `storeId`;
- fallback `DEVICE_EVENT_LEGACY` ou `DEVICE_STORE_LEGACY`, quando o contexto vier do device;
- default desligado quando nenhum contexto legado existir.

O orquestrador nao consulta mais `Event.printingEnabled`, `Event.autoPrintEnabled` ou `OnlineStore` diretamente para decidir imprimir. Esses campos so entram pelo resolver como fallback.

`EventPrinter` continua permitido como fallback de impressora legada para jobs sem `deviceId`.

## API

Novos endpoints:

- `GET /settings/printing`
- `PATCH /settings/printing`

Endpoints existentes atualizados:

- `GET /settings` retorna `printing`.
- `GET /settings/effective` retorna `effective.printing`.

## Compatibilidade

- `PrintJob` nao teve contrato alterado.
- `Device` manteve autenticação, heartbeat e pairing.
- `eventId` do Totem continua existindo.
- Totem continua sendo canal de evento; catalogo, preco e disponibilidade continuam no evento.
- Loja online nao depende de evento para imprimir.
- Campos legados de `Event` e `OnlineStore` continuam no schema e podem alimentar fallback.

## Frontend

O Centro de Configuracoes pode consumir:

- `GET /settings/printing` para tela de edicao;
- `PATCH /settings/printing` para persistencia;
- `GET /settings/effective?eventId=...`, `?storeId=...` ou `?deviceId=...` para preview do resultado efetivo.

Campos recomendados na tela:

- toggle de impressao habilitada;
- toggle de impressao automatica;
- toggle de reimpressao;
- seletores de devices por funcao;
- papel/layout;
- matriz de origens com enabled, autoPrint e printMode;
- setores `COOK`, `BAR`, `GENERAL`.
