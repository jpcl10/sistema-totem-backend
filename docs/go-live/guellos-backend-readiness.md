# Resumo executivo

Status recomendado: **NO-GO para producao hoje**.

A Guellos Pizza tem catalogo publico e catalogo de Totem em estado utilizavel no banco local: `organizationId=cmra0xvea000rvwasonliufxu`, `storeId=cmra0xven000xvwashub9xwug`, `slug=guellos-pizza`, evento ativo `cmrgkw4ev0001vwg89j5y35mz`, e 22 `EventProduct` ativos para o Totem. Nao ha preco zero vendavel nos menus publicos auditados.

Os bloqueios estao em configuracao operacional: nao ha dispositivos cadastrados, nao ha impressoras, impressao esta desligada na loja e no evento, nao ha `OnlineStoreSettings` persistido, nao ha regras de delivery, nao ha configuracao de provedor de pagamento, e `prisma generate` falhou por `EPERM` local. Alem disso, horarios sao avaliados em UTC no runtime, o que pode deslocar abertura/fechamento em Sao Paulo.

# Estado atual

- Organizacao: Guello's Pizza, slug `guellos-pizza`, id `cmra0xvea000rvwasonliufxu`.
- Loja online: id `cmra0xven000xvwashub9xwug`, ativa e marcada como aberta, mas `printingEnabled=false`, `autoPrintEnabled=false`, sem `OnlineStoreSettings`, sem regras de delivery.
- Evento ativo usado pelo Totem: id `cmrgkw4ev0001vwg89j5y35mz`, slug `joao-pedro-cardoso-lopes`, ativo e aberto, com 22 `EventProduct`, sem dispositivos e sem impressoras.
- Dispositivos vinculados: nenhum.
- Impressoras: nenhuma `EventPrinter`; nenhum `Device` do tipo `PRINTER` ou `SK210`.
- Modulos ativos: ONLINE_ORDERS, TOTEM, EVENTS, PAYMENTS, PRINTING, NFC_CASHLESS, FINANCIAL, DEVICES, REPORTS, DELIVERY, WHATSAPP, LOYALTY.
- Catalogo: 6 categorias, 5 ativas; 26 produtos, 25 ativos; 22 produtos vendaveis na loja publica; 22 EventProducts no Totem; 28 optionGroups; 104 options; 0 imagens de produto.
- Settings: sem `OrganizationSettings`; com `OrganizationBranding`; loja usa fallbacks/defaults.
- Pagamentos: sem `PaymentProviderSettings` para a Guellos.
- Usuarios operacionais: 1 usuario ADMIN, dominio de email corporativo; sem exibir email completo.
- Banco local: Postgres `event_system`, 13 MB, 39 tabelas, 157 indices, 77 FKs, 52 migrations aplicadas.
- Workspace: havia muitas alteracoes nao commitadas antes desta auditoria; nao foram revertidas.

# P0  Bloqueia producao

## P0-1: Nenhum dispositivo/impressora cadastrado para Guellos

- Severidade: P0.
- Causa: o banco nao tem `Device` nem `EventPrinter` vinculados a organizacao/evento/loja da Guellos.
- Arquivo: `prisma/schema.prisma` modelos `Device`, `EventPrinter`, `EventPrintJob`; `src/modules/print-jobs/services/order-print-orchestrator-service.ts`.
- Impacto: Totem, venda manual de evento e loja online nao imprimem em producao; pedidos pagos podem ficar sem ficha.
- Correcao recomendada: cadastrar pelo painel/dispositivo os devices necessarios antes do Go-Live: 1 Totem, 1 impressora/SK210 para loja (`storeId`), 1 impressora/SK210 para evento (`eventId`) se os fluxos forem separados.
- Esforco estimado: 1-2 h com device fisico em maos.
- Risco de regressao: baixo, se feito via rotas existentes e validado por polling.

## P0-2: Impressao desligada na loja e no evento ativo

- Severidade: P0.
- Causa: `OnlineStore.printingEnabled=false`, `OnlineStore.autoPrintEnabled=false`, `Event.printingEnabled=false`, `Event.autoPrintEnabled=false`.
- Arquivo: `src/modules/print-jobs/services/order-print-orchestrator-service.ts:208` e `:350`.
- Impacto: mesmo com device cadastrado, o orquestrador retorna `printJobs: []`.
- Correcao recomendada: habilitar impressao e autoPrint no contexto correto depois de cadastrar impressoras/devices.
- Esforco estimado: 30 min.
- Risco de regressao: baixo.

## P0-3: Pedido online publico nao cria print job automatico

- Severidade: P0 se a loja online deve imprimir automaticamente.
- Causa: `CreateOnlineOrderService` cria pedido, calcula totais e emite Socket.IO, mas nao chama `OrderPrintOrchestratorService` para `ONLINE_ORDER`. A venda manual de loja chama em `src/modules/online-stores/services/create-manual-online-order-service.ts:318`.
- Arquivo: `src/modules/online-stores/services/create-online-order-service.ts`.
- Impacto: pedidos de `POST /public/stores/:slug/orders` nao geram ficha mesmo se a loja estiver com impressao habilitada, salvo fluxo externo posterior inexistente no codigo auditado.
- Correcao recomendada: apos criar pedido publico, chamar o orquestrador quando `paymentStatus` for `PAID` ou `NOT_REQUIRED`, ou criar job quando pagamento pendente virar pago para `OnlineOrder`.
- Esforco estimado: 2-4 h com testes.
- Risco de regressao: medio, por envolver idempotencia e regra de pagamento.

## P0-4: Sem configuracao persistida de delivery/checkout

- Severidade: P0 para abertura de delivery.
- Causa: Guellos nao tem `OnlineStoreSettings` nem `DeliveryFeeRule`; o runtime cai em defaults.
- Arquivo: `src/modules/settings/services/online-store-settings-service.ts:445`.
- Impacto: delivery fica desabilitado por default; regras por bairro, minimo, taxa e frete gratis nao estao prontos.
- Correcao recomendada: configurar settings da loja e regras de delivery via painel/API antes de abrir.
- Esforco estimado: 1-2 h.
- Risco de regressao: baixo.

## P0-5: Horarios calculados em UTC

- Severidade: P0/P1 conforme configuracao de horario.
- Causa: `resolveOperation` usa `getUTCDay()` e `getUTCHours()` em vez de converter para timezone da organizacao/loja.
- Arquivo: `src/modules/settings/services/online-store-settings-service.ts:477` e `:572`.
- Impacto: loja pode abrir/fechar 3 horas deslocada em `America/Sao_Paulo`; pedidos podem ser bloqueados ou aceitos fora do horario.
- Correcao recomendada: resolver horario no timezone configurado, usando `OrganizationSettings.timezone` com fallback `America/Sao_Paulo`.
- Esforco estimado: 4-6 h com testes de borda.
- Risco de regressao: medio.

## P0-6: Pagamento online automatico nao cobre OnlineOrder

- Severidade: P0 se PIX automatico/Mercado Pago forem exigidos na loja online.
- Causa: `PaymentTransaction` referencia `Order` de evento; servicos Mercado Pago/PIX atualizam `Order`, nao `OnlineOrder`.
- Arquivo: `src/modules/payments/services/mercado-pago-webhook-service.ts`, `src/modules/payments/services/create-public-pix-automatic-payment-service.ts`.
- Impacto: loja online tem `PIX`, `CARD_ON_DELIVERY`, `CASH` no schema, mas PIX automatico nao esta pronto de ponta a ponta para `OnlineOrder`.
- Correcao recomendada: manter PIX automatico fora do frontend da loja ate implementar pagamento para OnlineOrder, ou estender modelo/servicos com cuidado.
- Esforco estimado: 1-3 dias.
- Risco de regressao: alto.

# P1  Corrigir antes da abertura

## P1-1: `GET /devices/me/config` nao retorna `storeId`

- Severidade: P1.
- Causa: device config e token payload exposto sao centrados em evento; o schema tem `Device.storeId`, mas o config nao informa esse contexto.
- Arquivo: `src/modules/devices/services/get-device-config-service.ts:36`, `src/modules/devices/services/activate-device-service.ts:152`.
- Impacto: device de impressao da loja pode nao saber que deve operar em contexto de loja.
- Correcao recomendada: incluir `storeId`, `storeSlug`, `storeName`, `printingEnabled` e `autoPrintEnabled` de loja quando aplicavel.
- Esforco estimado: 2-4 h.
- Risco de regressao: medio.

## P1-2: Central pode pular status de evento para DELIVERED

- Severidade: P1.
- Causa: `UpdateOrderStatusService` valida pagamento antes de status produtivo, mas nao valida transicoes sequenciais.
- Arquivo: `src/modules/orders/services/update-order-status-service.ts`.
- Impacto: botao/cliente pode enviar `DELIVERED` direto em pedido de evento pago.
- Correcao recomendada: criar fluxo explicito para `OrderStatus` de evento, equivalente ao `online-order-status-flow.ts`.
- Esforco estimado: 3-5 h.
- Risco de regressao: medio.

## P1-3: Pickup online publico pode seguir fluxo de delivery

- Severidade: P1.
- Causa: `isPickupOnlineOrder` identifica pickup apenas quando `source=ADMIN` e endereco snapshot de retirada, apesar de `fulfillmentType=PICKUP` existir.
- Arquivo: `src/modules/online-stores/services/online-order-status-flow.ts`.
- Impacto: pedido pickup publico pode expor proximo status `OUT_FOR_DELIVERY` apos `READY`.
- Correcao recomendada: usar `fulfillmentType === PICKUP` como criterio primario.
- Esforco estimado: 1-2 h.
- Risco de regressao: baixo.

## P1-4: Sem imagens de produto

- Severidade: P1/P2.
- Causa: 0 de 26 produtos tem `imageUrl`.
- Arquivo: dados `CatalogProduct.imageUrl`; upload em `src/modules/uploads`.
- Impacto: loja e Totem ficam pobres visualmente, especialmente para cardapio publico.
- Correcao recomendada: subir imagens otimizadas via pipeline R2 antes da campanha publica.
- Esforco estimado: 2-6 h, dependendo dos assets.
- Risco de regressao: baixo.

## P1-5: Sem `OrganizationSettings`

- Severidade: P1.
- Causa: Guellos nao tem registro em `OrganizationSettings`.
- Arquivo: `src/modules/settings/services/settings-resolver-service.ts`.
- Impacto: timezone, contato, documento, cidade e moeda dependem de defaults; auditoria fiscal/operacional fica incompleta.
- Correcao recomendada: persistir settings gerais da organizacao antes do deploy.
- Esforco estimado: 30-60 min.
- Risco de regressao: baixo.

## P1-6: `prisma generate` falhou localmente

- Severidade: P1 operacional.
- Causa: `EPERM` ao renomear `node_modules/.prisma/client/query_engine-windows.dll.node`, provavelmente arquivo travado.
- Arquivo: ambiente local/Windows.
- Impacto: pipeline de build/deploy pode falhar se o mesmo ocorrer no servidor ou CI.
- Correcao recomendada: fechar processos Node que usam Prisma e repetir; no deploy Linux, rodar generate em ambiente limpo.
- Esforco estimado: 15-30 min.
- Risco de regressao: baixo.

# P2  Pode entrar depois

## P2-1: `package.json#prisma` depreciado

- Severidade: P2.
- Causa: Prisma avisa que `package.json#prisma` sera removido no Prisma 7; `prisma.config.ts` ja existe e sobrepoe.
- Arquivo: `package.json`, `prisma.config.ts`.
- Impacto: ruido e risco futuro em upgrade.
- Correcao recomendada: migrar seed/config para `prisma.config.ts` e remover bloco legado do package.
- Esforco estimado: 30 min.
- Risco de regressao: baixo.

## P2-2: Worker de impressao embutido no processo HTTP

- Severidade: P2/P1 para escala.
- Causa: `setInterval` do worker roda dentro de `src/app.ts`.
- Arquivo: `src/app.ts`.
- Impacto: multiplas instancias podem competir no mesmo pool e imprimir legados em paralelo; tambem dificulta separar processo web/worker.
- Correcao recomendada: em producao, separar worker ou garantir singleton via PM2/systemd/lock.
- Esforco estimado: 0,5-1 dia.
- Risco de regressao: medio.

# Banco e migrations

Executado:

- `npx.cmd prisma validate`: passou.
- `npx.cmd prisma migrate status`: passou; 52 migrations; schema up to date.
- `npx.cmd tsc --noEmit`: passou.
- `npx.cmd prisma generate`: falhou com `EPERM` local, sem tocar dados.

Estado fisico auditado:

- Banco: `event_system`.
- Tamanho: 13 MB.
- Tabelas publicas: 39.
- Indices: 157.
- FKs: 77.
- Constraints PK: 39.
- Ultima migration aplicada: `20260714023000_extend_print_jobs_to_online_orders`.

Nao executar em producao:

- `prisma migrate dev`.
- Seeds destrutivos.
- Scripts corretivos da Guellos sem revisao (`scripts/fix-guellos-*`).

Comandos recomendados em producao:

```bash
npx prisma validate
npx prisma generate
npx prisma migrate status
npx prisma migrate deploy
```

# Impressao

Arquitetura atual:

- `OrderPrintOrchestratorService` cria jobs para evento e loja.
- Jobs com `deviceId` sao consumidos por APK/SK210 via polling.
- Jobs sem `deviceId` sao processados pelo worker legado TCP.
- Idempotencia existe por `EventPrintJob.idempotencyKey`.
- Worker legado processa apenas `PENDING` com `deviceId=null`.
- Pagamentos imprimiveis: `PAID` e `NOT_REQUIRED`.

Validacao por fluxo:

- Totem: codigo cria jobs para evento quando pedido nasce `PAID/NOT_REQUIRED` ou quando pagamento vira `PAID`; hoje Guellos bloqueada por falta de device e flags desligadas.
- Venda manual de evento: chama orquestrador; bloqueada por falta de device e flags desligadas.
- Venda manual de loja: chama orquestrador `ONLINE_ORDER`; bloqueada por falta de device de loja e flags desligadas.
- Pedido online publico: nao chama orquestrador; bloqueio funcional se precisa imprimir automaticamente.
- `PENDING` nao imprime: correto.
- `PENDING -> PAID` imprime para evento: correto.
- Reimpressao/retry: retry volta `ERROR/CANCELLED/PENDING` para `PENDING`; job `PRINTED` nao pode retry automatico, mas pode marcar manualmente como impresso.

Exemplo sanitizado de ficha:

```text
==============================
PEDIDO COMPLETO
==============================

Guello's Pizza
Origem: SANITIZED
Data: DD/MM/AAAA HH:mm:ss
Pedido: #123
Cliente: Cliente Exemplo
Pagamento: PAID / CASH

------------------------------
1x Portuguesa
  + Borda exemplo
  Obs: Sem dados reais
------------------------------

Total: R$ XX,XX
```

# Dispositivos

Estado atual:

- Nenhum device cadastrado para Guellos.
- Nenhum device para Totem.
- Nenhum device para loja.
- Nenhum SK210/PRINTER ativo.

Antes do Go-Live cadastrar:

- Totem: `Device.type=TOTEM`, `eventId=cmrgkw4ev0001vwg89j5y35mz`.
- Impressora evento/Totem: `Device.type=SK210` ou `PRINTER`, `eventId=cmrgkw4ev0001vwg89j5y35mz`.
- Impressora loja: `Device.type=SK210` ou `PRINTER`, `storeId=cmra0xven000xvwashub9xwug`.

Risco de conflito:

- O schema permite `eventId` e `storeId`; a auditoria recomenda nao reutilizar o mesmo device para loja e evento sem regra explicita, para evitar polling de jobs errados.

# Totem

Estado:

- Evento ativo existe e tem 22 EventProducts sincronizados.
- Totem menu nao contem itens internos nem preco zero vendavel.
- Evento esta com `printingEnabled=false` e `autoPrintEnabled=false`.
- Sem device Totem.
- Sem configuracao de pagamento Mercado Pago/PIX automatico no tenant.

Fluxo real existente:

- `POST /public/events/:slug/orders` cria `Order` de evento.
- Produto do Totem usa `EventProduct.id`.
- Total usa override `EventProduct.priceInCents` ou fallback `CatalogProduct.priceInCents`.
- Opcoes entram no snapshot e alteram preco.
- Estoque decrementa quando `trackStock=true`.

# Pagamentos

Classificacao:

- CASH: pronto para evento e venda manual; loja online usa `CASH` com troco, mas sem recebimento financeiro automatizado.
- CREDIT_CARD: pronto como metodo manual de evento; loja online publica usa `CARD_ON_DELIVERY`, nao `CREDIT_CARD`.
- DEBIT_CARD: pronto como metodo manual de evento.
- PIX manual: pronto para evento como metodo manual; loja online nao tem fluxo manual dedicado alem de enum `PIX`.
- PIX automatico: parcialmente implementado para evento/Totem via Mercado Pago; nao pronto para `OnlineOrder`.
- Mercado Pago: codigo existe para `Order` de evento; Guellos nao tem settings cadastrados.
- NFC balance: funcional somente evento, por `Order`; depende de cartoes/evento.
- NOT_REQUIRED: funcional para evento/printing; nao e metodo de pagamento de frontend publico.

Nao deve aparecer no frontend da loja hoje:

- PIX automatico/Mercado Pago para loja online, ate existir suporte real para `OnlineOrder`.
- NFC balance na loja online.
- COURTESY/OTHER para cliente final.

Secrets:

- Auditoria verificou apenas presenca booleana de campos sensiveis; valores nao foram exibidos.
- Guellos nao tem `PaymentProviderSettings` cadastrados.

# Seguranca

Pontos positivos:

- CORS tem allowlist e aceita `ngrok-skip-browser-warning` apenas como header permitido.
- Logs Fastify redigem authorization, cookie, token, password, secret e chaves.
- Tenant context barra usuario comum tentando selecionar outro `organizationId`.
- SUPER_ADMIN exige tenant explicito nas rotas tenant.
- Device JWT verifica `authStatus` e status `PAUSED/MAINTENANCE`.
- Rate limit existe nas rotas principais, embora nao global.

Riscos:

- `JWT_SECRET` e `MERCADO_PAGO_WEBHOOK_SECRET` precisam existir em producao; webhook Mercado Pago recusa sem secret.
- Query `organizationId` para impersonacao ainda e aceita como deprecated; preferir remover antes de exposicao ampla.
- Rotas publicas de cliente por telefone devem ser revisadas quanto a enumeracao de dados pessoais antes de publicidade.
- Upload/R2 precisam de validacao em ambiente de producao com limites e bucket privados/publicos corretos.
- Stack traces dependem do handler padrao do Fastify; confirmar `NODE_ENV=production`.

# Infraestrutura VPS

Plano real de deploy:

- Ubuntu 24.04 LTS.
- Node LTS 22 ou 24, fixado no servidor.
- PostgreSQL 16 local ou gerenciado.
- Nginx como reverse proxy.
- HTTPS via Certbot/Let's Encrypt.
- Dominio API: exemplo `https://api.defumarevents.com.br`.
- Processo web: PM2 ou systemd, porta interna `3333`.
- Socket.IO: mesmo host/porta HTTP; Nginx com upgrade headers.
- Worker de impressao: preferir processo separado; se mantido embutido, rodar uma unica instancia.
- Firewall: liberar 22, 80, 443; Postgres somente localhost/VPN.
- Backups: `pg_dump` diario, retencao 7/30 dias, teste de restore mensal.
- Logs: journald/PM2 logs + logrotate.
- Healthcheck: `GET /health` e raiz `/`.

Variaveis minimas:

```bash
NODE_ENV=production
DATABASE_URL=postgresql://...
JWT_SECRET=...
ALLOWED_ORIGINS=https://app.defumarevents.com.br,https://loja.guellos...
R2_ACCOUNT_ID=...
R2_ACCESS_KEY_ID=...
R2_SECRET_ACCESS_KEY=...
R2_BUCKET=...
R2_PUBLIC_URL=...
MERCADO_PAGO_WEBHOOK_SECRET=...
```

Ordem de deploy:

1. Provisionar servidor, firewall, usuario sem root e Node.
2. Criar banco e usuario Postgres.
3. Configurar `.env` de producao sem commitar secrets.
4. Subir release em diretorio versionado.
5. `npm ci`.
6. `npx prisma validate`.
7. `npx prisma generate`.
8. `npx prisma migrate status`.
9. Backup antes de migration.
10. `npx prisma migrate deploy`.
11. `npx tsc --noEmit` ou build equivalente.
12. Reiniciar processo web/worker.
13. Validar healthcheck, CORS, Socket.IO e rotas publicas.
14. Rodar checklist de homologacao.

Rollback:

- Manter release anterior.
- Se migration nao for reversivel, rollback de app deve ser compativel com schema novo; se nao for, restaurar backup em janela controlada.
- Nunca usar `migrate dev` em producao.

# Plano de execucao

1. Resolver P0 de configuracao: devices, impressoras, flags de impressao, settings de loja, delivery rules e payment settings.
2. Corrigir P0/P1 de runtime: impressao de pedido online publico, timezone, config de device com `storeId`, fluxo de status.
3. Preparar VPS e pipeline com `migrate deploy`.
4. Fazer homologacao com fixtures/controladas, sem pedidos reais de cliente.
5. Congelar release e abrir Go/No-Go.

# Checklist de homologacao

- Cardapio loja: `GET /public/stores/guellos-pizza` retorna 22 produtos vendaveis, sem internos, sem preco zero.
- Cardapio Totem: `GET /public/events/joao-pedro-cardoso-lopes/menu` retorna 22 EventProducts.
- Checkout delivery: calcula subtotal, adicional, taxa e total no backend.
- Checkout retirada: nao cobra delivery e segue fluxo pickup.
- Pedido abaixo do minimo: retorna erro e nao cria pedido parcial.
- Bairro nao atendido: retorna erro e nao cria pedido parcial.
- Loja fechada: bloqueia conforme `allowOrdersOutsideHours`.
- Quantidade 2: total dobra corretamente.
- Adicional: delta soma no unitario e multiplica por quantidade.
- Venda manual loja: aparece na Central, imprime se pago/elegivel.
- Venda manual evento: aparece na Central, imprime se pago/elegivel.
- Totem: cria pedido evento com snapshot de opcoes.
- Pagamento PENDING: nao imprime.
- PENDING -> PAID: imprime uma vez.
- PAID/NOT_REQUIRED: imprime uma vez.
- Status delivery: RECEIVED -> CONFIRMED -> PREPARING -> READY -> OUT_FOR_DELIVERY -> DELIVERED.
- Status pickup: RECEIVED -> CONFIRMED -> PREPARING -> READY -> DELIVERED.
- Nenhum botao pula direto para concluido.
- Socket.IO: duas abas recebem `unified-order-created/updated`.
- Polling: F5 nao duplica pedidos nem jobs.
- Impressora desligada: job permanece recuperavel/ERROR e retry funciona.
- API reiniciada: pedidos e jobs persistem.
- Banco reiniciado: app reconecta ou sobe apos Postgres.
- Worker: nao imprime duplicado com uma instancia.
- Device heartbeat: atualiza lastSeen/heartbeat.
- Device config: retorna contexto correto de loja/evento.

# Criterio de Go/No-Go

GO somente se todos forem verdadeiros:

- Guellos tem settings persistidos de loja, delivery e horarios.
- Timezone corrigido ou horario homologado explicitamente com compensacao conhecida.
- Devices e impressoras cadastrados, ativos, com `eventId/storeId` coerentes.
- Impressao automatica validada para os fluxos que serao abertos.
- Pagamentos exibidos no frontend correspondem somente aos metodos realmente prontos.
- `prisma generate`, `validate`, `migrate status` e typecheck passam no ambiente de deploy.
- VPS com HTTPS, CORS correto, logs, backup e rollback testados.
- Checklist de homologacao aprovado sem P0 aberto.

NO-GO se qualquer P0 permanecer aberto.
