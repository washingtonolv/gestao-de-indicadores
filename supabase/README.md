# Banco de dados — Gestão de indicadores

Projeto: `wyvtuvmsgncllwxxotjp` (Gestaoindicadores). Um negócio por projeto, com várias lojas. Login e persistência integrados ao painel. Consulte `beta/CLOUD.md` para uso, testes e limitações. A importação de dados da beta local continua pendente.

Migração inicial aplicada no projeto pelo SQL Editor e verificada em 04/10/2026 (São Paulo): sete tabelas, RLS ativo em todas, 22 políticas e nenhum privilégio de tabela para `anon`. A consulta reproduzível está em `verify.sql`. Posteriormente, o primeiro administrador foi habilitado com confirmação do proprietário. Nenhum dado local foi importado. Os 64 testes de autorização foram executados localmente em PGlite; a verificação remota conferiu a estrutura e os privilégios, ainda sem sessões reais do aplicativo.

## Estrutura

| Tabela | Conteúdo |
|---|---|
| `gi_stores` | Lojas e arquivamento |
| `gi_sellers` | Vendedores vinculados à loja |
| `gi_profiles` | Conta do Supabase Auth, perfil e vínculos autorizados |
| `gi_entries` | Resultado por vendedor/data: centavos, atendimentos e peças |
| `gi_store_goals` | Meta mensal da loja |
| `gi_seller_goals` | Meta mensal individual |
| `gi_audit` | Histórico de alterações gerado pelo banco |

IDs UUID e chaves estrangeiras substituem os nomes como vínculos. Valores monetários são inteiros em centavos. Metas usam o primeiro dia do mês e não podem duplicar o mesmo mês/loja ou mês/vendedor. Lançamentos múltiplos no mesmo dia permanecem permitidos para compatibilidade com a beta. Datas e valores seguem os limites do validador local.

## Permissões

| Perfil | Consultar | Alterar |
|---|---|---|
| Administrador ativo | Toda a operação e auditoria | Cadastros, perfis, resultados e metas |
| Gestor ativo | Vendedores, resultados e metas da própria loja | Resultados e metas da própria loja |
| Vendedor ativo | Seu cadastro, sua loja, seus resultados e metas individuais | Nada |
| Visitante, usuário sem perfil ou perfil bloqueado | Nenhum dado de negócio | Nada |

O vendedor não consulta metas agregadas da loja nem dados de colegas. Gestores não consultam perfis de acesso nem auditoria administrativa. Arquivar loja bloqueia os acessos de seus gestores/vendedores; arquivar vendedor bloqueia seu acesso e novos lançamentos para ele. O administrador continua consultando o histórico. Cadastros são arquivados, sem exclusão pelo aplicativo. Resultados/metas podem ser excluídos pelos responsáveis e ficam registrados na auditoria.

RLS está habilitado em todas as sete tabelas. Visitantes não têm privilégios de tabela. Funções auxiliares ficam no schema `gi_private`, com `search_path` fixo. As políticas consultam o vínculo ativo no banco, não campos editáveis do token. Cadastro no Auth não cria perfil nem promove alguém automaticamente. Auditoria usa `auth.uid()`; usuários do aplicativo não podem adulterá-la. O proprietário do projeto continua tendo acesso privilegiado ao PostgreSQL.

## Aplicação

Execute a migração `migrations/202610050001_initial.sql` uma vez no SQL Editor do projeto correto, ou pelo fluxo de migrations da CLI Supabase. A migração usa transação e falha caso a estrutura já exista; não apaga nem substitui tabelas preexistentes. O nome do arquivo usa UTC (2026-10-05), correspondente à noite de 04/10 em São Paulo.

Depois, confira sete tabelas com RLS, políticas e ausência de acesso `anon`. Não crie perfis reais antes de confirmar os usuários e seus vínculos.

## Provisionamento de contas

1. Configurar a URL do site e os redirecionamentos permitidos no Supabase Auth.
2. Criar a conta pelo fluxo de autenticação do Supabase. Senhas não pertencem a estas tabelas.
3. O proprietário do projeto associa explicitamente o UUID dessa conta a um perfil `admin`; não usar metadados enviados pelo cadastro para decidir esse papel.
4. Integrar login e consultas ao painel, respeitando o mesmo RLS. Convites exigem operação privilegiada no servidor, nunca `service_role` no HTML.
5. Validar sessões reais de administrador, gestor e vendedor antes de substituir a beta local.

Não há chave secreta no repositório. A URL do projeto e a chave publicável poderão ir ao cliente; a autorização depende do login e do RLS. A política CSP do documento e seu iframe sandbox devem ser mantidos; a futura conexão de rede precisa liberar apenas o endpoint necessário.

## Migração da beta local (etapa pendente)

Exportar backup antes de migrar. Validar com `validateDB`; apresentar resumo e resolver vínculos por loja/nome, convertendo IDs locais (`legacy-*` inclusive) para UUID. Preservar valores/datas e manter um mapa de IDs para impedir duplicação em novas tentativas. Não transformar pré-cadastros locais de usuários em acessos automaticamente, nem tratar o histórico "Operador local" como auditoria autenticada. Importação deve ser transacional, explícita e separada dos dados de exemplo. Nenhum backup foi enviado por esta mudança.

## Testes

`npm ci --ignore-scripts` e `npm test`.

`scripts/database.test.mjs` executa PostgreSQL via PGlite em memória com usuários fictícios e uma função `auth.uid()` de teste. Verifica anonimato, conta sem perfil, isolamento por loja/vendedor, bloqueio de escrita pelo vendedor, promoção indevida, criação/correção/exclusão pelo gestor, metadados de auditoria, arquivamento, valores e referências inválidas. Não acessa dados reais e não substitui o teste final do Supabase Auth/REST no projeto remoto.

Referência: [Supabase — Row Level Security](https://supabase.com/docs/guides/database/postgres/row-level-security).

A migração `202610050002_atomic_changes.sql` foi aplicada e o teste remoto `verify-save.sql` confirmou gravação e auditoria sob o papel authenticated, com rollback dos dados de teste.
