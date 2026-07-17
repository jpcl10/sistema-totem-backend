# ADR-001: Settings como Fonte de Verdade

Status: Accepted

Data: 2026-07-14

## Contexto

A plataforma acumulou configuracoes em `Event`, `OnlineStore`, `Device.metadata`, `PaymentProviderSettings` e campos especificos de impressao/pagamento. Isso criou duplicidade entre Evento, Loja Online, Totem e Cardapio Digital.

O modulo `settings` ja existe em `src/modules/settings` com:

- `OrganizationSettings`
- `OrganizationBranding`
- `BusinessHour`
- `BusinessHourException`
- `OnlineStoreSettings`
- `DeliveryFeeRule`
- `SettingsResolverService`
- `GET /settings`
- `GET /settings/effective`

## Opcoes Consideradas

| Opcao | Resultado |
| --- | --- |
| Manter cada modulo resolvendo sua propria configuracao | Mantem acoplamento e divergencias. |
| Centralizar tudo em um JSON generico | Rapido, mas fraco para validacao, auditoria e regras criticas. |
| Criar fontes tipadas por dominio e resolver centralizado | Mais trabalho inicial, melhor para SaaS multi-tenant. |

## Decisao

Settings e `SettingsResolverService` sao a fonte oficial para leituras configuraveis. Campos legados continuam apenas como fallback temporario ate migracao completa.

## Consequencias

- Endpoints publicos devem consumir configuracao efetiva, nao campos legados diretamente.
- Novas escritas devem ir para modelos de Settings ou dominios dedicados.
- Fallback e precedencia devem ficar em um ponto central.
- Cada novo dominio precisa atualizar `settings-architecture.md` e `platform-architecture.md`.

## Riscos

- Fallback legado pode virar permanente se nao houver roadmap.
- Consumidores esquecidos podem continuar lendo `Event`/`OnlineStore` diretamente.
- Settings ainda nao cobre pagamentos, impressao, producao e totem de forma tipada.

## Proximos Passos

- Migrar Delivery/Loja Online ja iniciado para consumo efetivo.
- Planejar Pagamentos, Impressao/Producao e Totem/Device em fases.
- Criar testes de resolver por dominio antes de remover legado.
