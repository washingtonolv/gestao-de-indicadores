# Movimentação de vendedores

Em Administração → Vendedores, os administradores têm as ações Transferir,
Desligar/arquivar, Reativar e Histórico. Toda alteração exige uma conferência
antes de confirmar. Gestores e vendedores não podem executar movimentações.

## Regras de negócio

- Transferência: a data é o primeiro dia na nova loja; o vínculo de origem
  termina no dia anterior. Vendas não são copiadas, distribuídas nem movidas.
- A pessoa mantém `person_id`; cada loja mantém seu próprio `gi_sellers.id`.
  Retornar a uma loja reutiliza o vínculo da mesma pessoa, sem duplicar o cadastro.
  Nomes iguais não unem identidades automaticamente.
- Desligamento/arquivamento: a data é o último dia na loja. O vendedor fica
  inativo e suas contas com perfil vendedor ficam bloqueadas. Resultados e metas
  permanecem. O acesso é negado pelas políticas que consultam o perfil atual,
  inclusive para tokens emitidos anteriormente.
- Reativação abre outro período e preserva os anteriores. Contas bloqueadas
  continuam bloqueadas até liberação explícita em Usuários e perfis.
- Na transferência, o ajuste de metas mensais é opcional e desmarcado inicialmente.
  Os valores informados são as metas totais do mês em cada vínculo; zero remove
  a meta correspondente. O histórico conserva os valores antes/depois.
  Metas de lojas e metas diárias não são redistribuídas automaticamente.
- Datas futuras não são agendadas. Uma mudança não pode cortar resultados ou
  blocos semanais existentes. Na semana da transferência, use lançamentos diários
  que respeitem os dias de cada vínculo. O sistema não inventa a divisão de um
  acumulado semanal.
- Cadastros sem resultados, metas, contas ou movimentações ainda podem ser
  excluídos. Movimentações e relações de histórico impedem exclusão definitiva.

## Banco e proteção

As migrations `seller_lifecycle` e `seller_period_index` adicionam identidade,
períodos e movimentações sem alterar as vendas ou metas existentes. Datas de
admissão antigas desconhecidas permanecem nulas; não se inventam datas históricas.

`gi_manage_seller` é um wrapper SECURITY INVOKER. A implementação privada
SECURITY DEFINER é necessária para atualizar vínculo, metas e conta na mesma
transação. Ela exige `auth.uid()` e um perfil administrador ativo consultado
no banco, possui `search_path=''`, e não aceita autorização por user_metadata.
As tabelas possuem RLS e não concedem escrita ao cliente. Contas anônimas não
podem executar a função. Identidades e alterações genéricas de status são
protegidas por permissões de coluna e gatilhos.

As alterações usam controle de versão e uma trava por pessoa; conflitos e falhas
cancelam a operação completa. Após falha na leitura de confirmação, o cliente
exige atualizar os dados antes de tentar novamente. Identidade, períodos e
movimentações são somente leitura no fluxo genérico `changesFor`.

## Verificação

- Testes PostgreSQL/PGlite com dados fictícios: transferência, volta à origem,
  ajuste de metas, desligamento, reativação, permissões, contas, datas, duplicidades,
  concorrência por versão, exclusão e rollback de falha injetada no fim da operação.
- Navegador conectado a banco isolado: conferência antes de salvar, erro/repetição,
  duplo clique, histórico, bloqueio da conta e retorno pelo celular.
- Inspeção visual de formulários, histórico e conferência em desktop/mobile e dark.
- Após aplicação, os lançamentos, totais de vendas, cadastros, perfis e metas
  individuais mantiveram seus hashes de conferência. Foram criados os períodos
  iniciais, sem registrar movimentações de pessoas reais.

Advisors do Supabase, em 15/10/2026: corrigido o índice composto da tabela nova.
Continuam avisos anteriores de [índices de chaves estrangeiras](https://supabase.com/docs/guides/database/database-linter?lint=0001_unindexed_foreign_keys)
em tabelas existentes e de [proteção contra senhas vazadas desativada](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection).
Índices recém-criados aparecem como ainda não usados até receberem tráfego.
