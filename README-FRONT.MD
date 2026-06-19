# Painel Administrativo — Frontend
Interface visual e painel de controle do sistema de totem/eventos. Este projeto permite gerenciar eventos, catálogo de produtos, pedidos, dispositivos, impressão, financeiro e configurações operacionais de forma centralizada.
---
## 1. Visão geral do frontend
Este frontend é o centro de operação do sistema de totem/eventos. Ele oferece uma experiência administrativa moderna, responsiva e otimizada para operadores de eventos que precisam acompanhar vendas, pedidos, estoque, dispositivos e logs de auditoria em tempo real.
O painel é construído como uma **Single Page Application (SPA)** com React, TanStack Start e Vite, consumindo uma API REST construída em Fastify. Toda a autenticação é baseada em JWT, e as imagens são enviadas para o Cloudflare R2 via backend.
---
## 2. Tecnologias utilizadas
- **React 19** — biblioteca principal de interface
- **TanStack Start** — framework full-stack para rotas, SSR/SSG e server functions
- **TanStack Router** — roteamento tipado e baseado em arquivos
- **TanStack Query** — cache e sincronização de dados com o backend
- **Vite 7** — bundler e dev server
- **Tailwind CSS v4** — estilização utilitária e design tokens
- **shadcn/ui** — componentes de interface reutilizáveis
- **TypeScript** — tipagem estática e segurança de código
- **Zod** — validação de dados
- **Fastify backend** — API REST consumida pelo frontend
- **Cloudflare R2** — storage de imagens via backend
- **JWT** — autenticação e autorização
---
## 3. Principais telas
| Tela | Propósito |
| --- | --- |
| **Dashboard** | Visão geral do evento, métricas de vendas e acesso rápido |
| **Eventos** | Gestão de eventos ativos e inativos |
| **Catálogo** | Cadastro, edição e exclusão de produtos |
| **Produtos por evento** | Vinculação e configuração de produtos disponíveis em cada evento |
| **Pedidos** | Listagem, detalhes e acompanhamento de pedidos |
| **Financeiro** | Resumo de receitas, pagamentos e status financeiros |
| **Impressão** | Controle de fila de impressão e jobs pendentes |
| **Dispositivos** | Gerenciamento de totems, tablets e terminais |
| **Atividades / Audit Logs** | Histórico operacional completo com filtros e timeline |
| **Configurações de PIX** | Dados de chave PIX e integração |
| **Configurações de impressão** | Ajustes de impressoras, layout e fila |
| **Configurações do totem** | Comportamento e aparência do totem |
---
## 4. Fluxo de autenticação
1. O usuário acessa a tela de login e informa e-mail e senha.
2. O frontend envia as credenciais para o backend Fastify.
3. Em caso de sucesso, o backend retorna um token JWT.
4. O token é armazenado e utilizado em todas as requisições autenticadas via header `Authorization: Bearer <token>`.
5. Rotas administrativas verificam a presença do token e redirecionam para `/auth` quando necessário.
6. O token expira de acordo com a política configurada no backend e o usuário deve fazer login novamente.
> **Nunca armazene tokens ou credenciais em localStorage sem proteção adicional.** O projeto segue as práticas de segurança recomendadas para SPA.
---
## 5. Integração com backend
O frontend se comunica com o backend Fastify por meio de requisições HTTP autenticadas. A estrutura de integração segue os princípios:
- Cada domínio possui helpers de API em `src/lib/`, por exemplo:
  - `src/lib/audit-logs-api.ts`
  - `src/lib/orders-api.ts`
  - `src/lib/products-api.ts`
- As requisições usam `fetch` ou abstrações baseadas em TanStack Query.
- Tokens JWT são enviados automaticamente em chamadas autenticadas.
- Respostas são validadas e normalizadas antes de chegar aos componentes.
- Erros de API são exibidos com mensagens amigáveis ao usuário.
Base da API: `https://<SUA_API_BACKEND>/api/v1`
> Substitua `<SUA_API_BACKEND>` pela URL real do backend no momento da configuração.
---
## 6. Variáveis de ambiente do frontend
As variáveis públicas do frontend começam com `VITE_` e são lidas em tempo de build.
```env
VITE_API_URL=https://<SUA_API_BACKEND>/api/v1
VITE_APP_NAME="Painel Administrativo"
```
Variáveis privadas (usadas apenas em server functions) não precisam do prefixo `VITE_` e devem ser configuradas no painel de secrets da plataforma.
> Nunca commit tokens, secrets, chaves de API ou URLs privadas no repositório.
---
## 7. Como rodar localmente
### Requisitos
- Node.js 20+ ou Bun
- Backend Fastify rodando e acessível
- Variáveis de ambiente configuradas
### Passos
1. Clone o repositório:
```bash
git clone https://github.com/<USUARIO>/<REPO>.git
cd <REPO>
```
2. Instale as dependências:
```bash
bun install
```
3. Configure as variáveis de ambiente criando um arquivo `.env` na raiz:
```env
VITE_API_URL=https://<SUA_API_BACKEND>/api/v1
```
4. Inicie o servidor de desenvolvimento:
```bash
bun dev
```
5. Acesse no navegador:
```
http://localhost:5173
```
---
## 8. Como configurar URL da API
A URL do backend é configurada via variável de ambiente:
```env
VITE_API_URL=https://<SUA_API_BACKEND>/api/v1
```
Para ambientes diferentes (desenvolvimento, staging, produção), configure a variável no painel de deploy ou no arquivo `.env` local.
Exemplo de uso no código:
```ts
const apiUrl = import.meta.env.VITE_API_URL;
```
> Verifique sempre se a URL termina com a versão correta da API (`/api/v1` ou conforme contrato do backend).
---
## 9. Como funciona upload de imagens
O upload de imagens é feito **via backend**, nunca diretamente para o Cloudflare R2.
1. O usuário seleciona uma imagem no frontend.
2. O frontend envia a imagem para o endpoint de upload do backend.
3. O backend valida o arquivo, faz o upload para o R2 e retorna a URL pública.
4. O frontend salva a URL retornada e a associa ao produto, evento ou configuração.
### Boas práticas
- Limite de tamanho e formato de arquivo são validados no backend.
- Imagens sensíveis ou privadas não devem ser expostas publicamente sem controle de acesso.
- URLs de imagem são armazenadas como strings no banco de dados.
---
## 10. Como funciona tela de Atividades
A tela **Atividades** exibe o histórico de auditoria operacional do evento selecionado.
- Dados obtidos via `GET /events/:eventId/audit-logs`.
- Apresentação em formato de timeline, com ícones, cores e descrições traduzidas para português.
- Filtros disponíveis: período, ação, entidade, usuário e dispositivo.
- Paginação controlada pelo backend.
- Metadados sensíveis (tokens, senhas, secrets) são automaticamente mascarados.
- Modal de detalhes permite visualizar informações completas de cada log.
Essa tela é essencial para rastrear mudanças, acompanhar operações e auditar ações dos operadores e dispositivos.
---
## 11. Como funciona Dashboard
O Dashboard é a tela inicial do painel administrativo. Ele apresenta:
- Visão geral do evento atualmente selecionado.
- Cards com métricas principais: pedidos, receita, vendas por categoria.
- Acesso rápido às principais funcionalidades.
- Status de dispositivos e fila de impressão.
- Gráficos e indicadores de performance operacional.
O objetivo é dar ao operador uma visão clara do estado do evento em poucos segundos.
---
## 12. Como funciona tela de Pedidos
A tela de Pedidos permite acompanhar todas as vendas realizadas no evento.
- Lista de pedidos com informações de cliente, valor, status e pagamento.
- Filtros por status, data, método de pagamento e termo de busca.
- Visualização de detalhes do pedido, itens, quantidades e valores.
- Ações de cancelamento, reembolso e atualização de status (quando permitido pelo backend).
- Atualização em tempo real quando integrado com websocket ou polling.
---
## 13. Como funciona Financeiro
A tela Financeiro concentra as informações monetárias do evento.
- Resumo de receita total e por forma de pagamento.
- Listagem de transações com status (aprovado, pendente, recusado, reembolsado).
- Filtros por período e tipo de pagamento.
- Integração com dados de PIX e futuras integrações com gateways.
- Exportação de dados para reconciliação financeira.
---
## 14. Como funciona Dispositivos
A tela Dispositivos gerencia os terminais físicos e lógicos do sistema.
- Lista de totems, tablets, impressoras e outros dispositivos vinculados ao evento.
- Status de conexão (online/offline) e última atividade.
- Vinculação de dispositivos a eventos específicos.
- Configuração de nome, localização e capacidade.
- Controle de acesso e permissões por dispositivo.
---
## 15. Como funciona Impressão
A tela Impressão controla a fila de jobs de impressão do evento.
- Lista de tarefas de impressão pendentes, em andamento e concluídas.
- Reimpressão de comandas, recibos e etiquetas.
- Configuração de impressoras vinculadas.
- Status de erro e reimpressão manual.
- Integração com comandos de impressão enviados pelo backend.
---
## 16. Como funciona configurações do Totem
A tela de Configurações do Totem permite personalizar o comportamento e a aparência dos totens de autoatendimento.
- Configuração de identidade visual (cores, logo, mensagens).
- Ajustes de tempo de inatividade e logout automático.
- Configuração de categorias e produtos exibidos no totem.
- Configuração de mensagens de boas-vindas e telas de espera.
- Vinculação de dispositivos totem a eventos e impressoras.
---
## 17. Boas práticas de UI/UX utilizadas
- **Design system consistente**: cores, tipografia e espaçamento definidos por tokens no Tailwind.
- **Componentes reutilizáveis**: shadcn/ui como base para formulários, tabelas, modais e cards.
- **Feedback visual**: estados de carregamento, erro e sucesso sempre comunicados ao usuário.
- **Responsividade**: layout adaptado para notebooks, desktops e tablets.
- **Acessibilidade**: contraste adequado, foco visível e semântica HTML.
- **Performance**: cache inteligente com TanStack Query, skeletons e lazy loading.
- **Segurança**: mascaramento de dados sensíveis, validação de entrada e autenticação JWT.
- **Internacionalização**: termos e mensagens em português, padronizados para o Brasil.
---
## 18. Estrutura de pastas
```
.
├── src/
│   ├── components/        # Componentes reutilizáveis e layouts
│   ├── hooks/             # Hooks customizados
│   ├── integrations/      # Integrações (ex: supabase, auth)
│   ├── lib/               # Helpers de API e utilitários
│   ├── routes/            # Rotas do TanStack Router
│   ├── styles.css         # Configuração do Tailwind e tokens
│   └── utils/             # Funções utilitárias gerais
├── .env                   # Variáveis de ambiente local (não commitar)
├── package.json           # Dependências e scripts
├── vite.config.ts         # Configuração do Vite
├── tsconfig.json          # Configuração do TypeScript
└── README.md              # Este arquivo
```
### Destaques
- `src/routes/`: cada arquivo representa uma rota da aplicação.
- `src/lib/`: funções de comunicação com o backend.
- `src/components/`: componentes compartilhados entre telas.
---
## 19. Checklist antes de publicar
- [ ] Variáveis de ambiente de produção configuradas corretamente.
- [ ] URL do backend apontada para o ambiente de produção.
- [ ] Build local executado sem erros: `bun run build`.
- [ ] TypeScript validado: `bunx tsc --noEmit`.
- [ ] Nenhum token, secret ou URL privada hardcoded no código.
- [ ] Imagens e assets otimizados para web.
- [ ] Testes de fluxo crítico realizados (login, pedidos, pagamento, impressão).
- [ ] Responsividade verificada em notebook, desktop e tablet.
- [ ] Console do navegador sem erros relevantes.
- [ ] README atualizado e refletindo a realidade do projeto.
---
## 20. Roadmap futuro
Funcionalidades planejadas para evoluir o sistema:
- **Comandas**: gestão de comandas individuais para mesas e áreas VIP.
- **Cashless**: sistema de pagamento sem dinheiro físico dentro do evento.
- **NFC**: leitura e escrita de tags NFC para acesso e pagamento.
- **Mercado Pago Point**: integração com maquininhas de cartão do Mercado Pago.
- **Melhorias mobile/tablet**: otimização completa da experiência para dispositivos menores.
- **Dashboard em tempo real**: atualização ao vivo de métricas e pedidos via websockets ou SSE.
---
## Contato e suporte
Para dúvidas, sugestões ou problemas, entre em contato com a equipe responsável pelo projeto ou abra uma issue no repositório.
> Este projeto foi criado e mantido com [Lovable](https://lovable.dev).
