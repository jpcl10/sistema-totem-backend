
# AUDITORIA DE RECUPERAÇÃO DE DADOS - Empresa Teste

## Data: 2026-07-06
## Objetivo: Verificar possibilidade de recuperar dados antigos da Empresa Teste, eventos, NFC, pedidos, produtos e módulos.

---

## 1. Verificação do Ambiente

### 1.1 DATABASE_URL Atual
- Arquivo: `backend/.env`
- Conteúdo: Template `postgresql://USER:PASSWORD@localhost:5432/DATABASE?schema=public`
- Observação: Credenciais de banco de dados são placeholders; não é possível conectar diretamente.

### 1.2 Projeto
- Projeto não é um repositório Git (não há `.git/`); histórico de commits não disponível.
- Arquivo `.gitignore` ignora `.env` e `.env.*`, exceto `.env.example`.

---

## 2. Arquivos e Backups no Projeto

### 2.1 Arquivos de Backup/Dump
- Nenhum arquivo `.sql`, `.dump`, `backup*` encontrado na estrutura do projeto.
- Verificação em: `backend/`, `backend/prisma/`, e subdiretórios.

### 2.2 Scripts de Seed
- Arquivo `backend/prisma/seed.ts`: Atualmente cria apenas `Defumar Events` e `Guello's Pizza`; nenhuma referência a "Empresa Teste".

### 2.3 Migrações
- Migrações em `backend/prisma/migrations/`: Todas as migrações do Prisma presentes; nenhuma migração de reset de dados encontrada.
- Diretório `old_migrations/`: Contém migração não aplicada `20260707015702_add_customers_addresses/migration.sql`.

---

## 3. Possíveis Recuperações (Limitadas)

### 3.1 Verificações Pendentes (Requer Credenciais do Banco)
Para continuar a auditoria, é necessário configurar `DATABASE_URL` com credenciais válidas para:
- Listar todas as bases de dados PostgreSQL disponíveis
- Consultar tabela `_prisma_migrations`
- Verificar registros atuais em:
  - `Organization`
  - `Event`
  - `NfcCard` / `NfcCardTransaction`
  - `Order` / `OrderItem`
  - `CatalogCategory` / `CatalogProduct`
  - `OrganizationModule`
  - `OnlineStore` / `OnlineOrder`

---

## 4. Conclusões Preliminares

| Item | Situação |
|------|----------|
| Backups/dumps no projeto | ❌ Não encontrados |
| Histórico Git | ❌ Não disponível |
| Scripts antigos com "Empresa Teste" | ❌ Não encontrados |
| Migrações de reset de dados | ❌ Não encontradas |
| Verificação direta do banco | ⚠️ Requer credenciais válidas em `.env` |

---

## 5. Recomendações

1. **Configurar credenciais do banco**: Atualize `backend/.env` com `DATABASE_URL` válido para permitir consultas diretas.
2. **Verificar backups externos**: Verificar se existem backups do PostgreSQL em servidores/cloud (ex.: AWS RDS, Docker volumes, etc.).
3. **Executar script de auditoria**: Após configurar credenciais, execute `npx tsx prisma/audit-db.ts` para verificar registros atuais no banco.
