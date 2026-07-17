# ADR-003: Contexto Device, Store e Event

Status: Proposed

Data: 2026-07-14

## Contexto

`Device` possui `organizationId` e `eventId`, mas nao possui `storeId`. Isso atende bem ao Totem de evento, impressoras de evento e SK210 vinculado a evento. A plataforma agora tambem precisa operar loja permanente/operacao diaria sem evento.

## Opcoes Consideradas

| Opcao | Consequencias |
| --- | --- |
| Manter `Device.eventId` apenas | Simples, mas Totem de loja fica sem contexto formal. |
| Adicionar `storeId` em `Device` | Resolve loja permanente, exige migration e regras de precedencia. |
| Criar `DeviceContext` separado | Mais flexivel, mais complexo. |
| Resolver loja via metadata | Evita migration, mas perpetua JSON fraco e risco de tenant. |

## Decisao Atual

Pendente. Ate aprovacao, `Device.eventId` permanece o vinculo operacional real. `storeId` em dispositivo e contexto misto Store/Event nao devem ser implementados sem ADR aprovada.

## Consequencias

- Totem de operacao diaria sem evento nao tem contexto completo hoje.
- `SettingsResolverService` ja aceita `storeId`, `eventId`, `deviceId`, mas `Device` ainda nao carrega store.
- Android deve continuar usando `eventSlug` quando depender de Totem de evento.

## Riscos

- Confundir `organizationId` com `storeId`.
- Criar device settings em `metadata` sem tipagem.
- Duplicar comportamento entre Event Totem e Store Totem.

## Proximos Passos

- Documentar casos reais: Totem de evento, Totem de loja, SK210, impressora, tela de chamada.
- Definir se `Device` tera `storeId` ou relacionamento contextual separado.
- So entao criar migration aditiva.
