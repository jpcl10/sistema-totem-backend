# ADR-002: Bootstrap para Canais Publicos

Status: Proposed

Data: 2026-07-14

## Contexto

Cardapio Digital, Checkout, Totem, Android, Evento Publico e API publica carregam dados por endpoints diferentes. O backend atual possui rotas separadas como:

- `GET /public/stores/:slug`
- `GET /public/events/:slug/menu`
- `GET /public/events/:slug/catalog-menu`
- `GET /events/:eventId/checkout-payment-settings`
- `GET /devices/me/config`

Essas rotas resolvem branding, catalogo, pagamentos, horarios, dispositivos e impressao de formas diferentes.

## Opcoes Consideradas

| Opcao | Descricao |
| --- | --- |
| `GET /public/bootstrap` | Endpoint unico com contexto via query/body. |
| `GET /public/bootstrap/:slug` | Endpoint unico por slug, mas ambiguo entre store/event. |
| `GET /public/channels/:channel/bootstrap` | Endpoint explicito por canal. |
| Endpoints atuais usando `BootstrapService` interno | Mantem contratos e centraliza logica aos poucos. |

## Decisao Atual

Proposta: iniciar com um `BootstrapService` interno reutilizado pelos endpoints atuais. Nao criar rota publica unica ate aprovar contrato, cache, seguranca e contexto.

## Consequencias

- Preserva contratos atuais.
- Permite migrar um canal por vez.
- Evita quebrar Lovable, Totem ou Android.
- Depois de estabilizar, um endpoint unico pode ser exposto.

## Riscos

- Se a rota unica for criada cedo demais, o contrato pode congelar errado.
- Slug pode ser ambiguo entre loja e evento.
- Device/Android precisa de contexto autenticado diferente de cardapio publico.

## Proximos Passos

- Corrigir `selectedOptions` no pedido publico de evento.
- Resolver catalogo vazio por ausencia de `EventProduct`.
- Definir DTO interno de contexto.
- Implementar `BootstrapService` interno em uma fase futura.
