# Arquitetura Defumar

Este diretorio concentra as decisoes oficiais de arquitetura da plataforma Defumar. O codigo em `src/` e `prisma/schema.prisma` continua sendo a fonte de verdade do estado implementado; estes documentos registram o estado atual, a arquitetura-alvo e o plano de migracao.

## Documentos

| Documento | Status | Conteudo |
| --- | --- | --- |
| [platform-architecture.md](./platform-architecture.md) | v1.0.0 | Arquitetura geral da plataforma, dominios, multi-tenant, pedidos, catalogo, settings, dispositivos, pagamentos, impressao, Socket.IO, seguranca e roadmap. |
| [settings-architecture.md](./settings-architecture.md) | v1.1.0 | Centro de Configuracoes, fontes de verdade, overrides, fallback legado, contratos de settings e plano de migracao por dominio. |
| [public-channels-architecture.md](./public-channels-architecture.md) | v1.0.0 | Arquitetura atual e alvo para Public Experience: Cardapio Digital, Checkout, Totem, PDV, Android, Evento Publico e API publica. |
| [experience-design.md](./experience-design.md) | v1.0.0 | Diretrizes de experiencia visual para canais publicos: tokens, layout, componentes, estados, motion e consistencia entre Cardapio, Checkout, Totem e Android. |

## ADRs

| ADR | Status | Decisao |
| --- | --- | --- |
| [ADR-001](./adr/ADR-001-settings-as-source-of-truth.md) | Accepted | Settings e SettingsResolverService sao a fonte oficial de leitura configuravel. |
| [ADR-002](./adr/ADR-002-public-channel-bootstrap.md) | Proposed | Bootstrap comum para canais publicos ainda depende de aprovacao de contrato. |
| [ADR-003](./adr/ADR-003-device-store-event-context.md) | Proposed | Contexto Device/Store/Event para Totem e Android ainda esta pendente. |
| [ADR-004](./adr/ADR-004-order-storage-vs-unified-view.md) | Accepted | `Order` e `OnlineOrder` permanecem separados; unificacao fica em DTO/adapters. |

## Regras de Manutencao

- Toda nova fase de Settings, Public Experience ou canais publicos deve atualizar estes documentos antes da implementacao.
- Nao declarar endpoints ou modelos como existentes sem confirmar em codigo.
- Registrar divergencias entre README/documentacao antiga e rotas reais.
- Nunca incluir tokens, secrets, credenciais, dados pessoais completos ou URLs privadas.
