# Operação e evolução individual

A Visão geral da operação inclui indicadores consolidados, comparação entre lojas e pontos de atenção para o mês e a loja selecionados. Cada loja abre a Evolução da equipe. Os alertas cobrem ausência de meta, ausência de lançamentos e mês encerrado abaixo da meta; o mês em andamento não recebe um diagnóstico de atraso sem planejamento diário.

Evolução permite acompanhar a equipe ou selecionar um vendedor. A opção Minha evolução é uma prévia local, somente para consulta, sem autenticação ou restrição real dos demais menus. Quando houver login, o servidor vinculará o vendedor autenticado aos seus resultados; o gestor registrará e corrigirá os resultados da sua loja.

## Indicadores e períodos

- Vendas em centavos, atingimento de meta individual, valor restante, ticket médio e peças por atendimento.
- Comparação com o mês anterior: mês encerrado completo; mês atual até o dia atual, limitado ao último dia do mês anterior. Ausência de base anterior é explícita.
- Gráfico por dia, semana (blocos 1–7 etc.) ou seis meses. Mês atual parcial. Dias sem lançamentos são exibidos como zero e identificados na legenda descritiva.
- Pontos acessíveis por mouse, toque, foco e Enter/Espaço.
- Última atualização usa o horário registrado na criação/edição dos lançamentos. Registros antigos não recebem horários inventados.

## Metas e compatibilidade

Metas individuais são cadastradas e editadas em Metas, por vendedor e mês. Elas não substituem nem somam automaticamente à meta da loja. `admin.sellerGoals` guarda `sellerId`, `month` e `cents`; valida referências, unicidade e limites. Os lançamentos aceitam `updatedAt` opcional. Backups antigos continuam aceitos, e novos backups preservam as metas individuais e os horários.

## Verificação

`node scripts/schema.test.cjs` e `node scripts/evolution.test.cjs` verificam migração, backup, validação de vínculos, metas individuais, totais, meses anteriores, ano novo, ano bissexto, base anterior zero e agrupamentos.

Na interface local foram conferidos: loja → equipe → vendedor, três agrupamentos, detalhe do gráfico por Enter, cadastro de vendedor e meta individual, lançamento de R$ 250 com meta de R$ 1.000 (25%, R$ 750 restantes, TM R$ 125 e PA 2,5), horário de atualização e layout das três páginas em 320, 390, 820 e 1440 px. Sem rolagem horizontal da página ou erros de console nessa execução. Os registros de teste ficaram em localhost.

## Próxima etapa: banco de dados

Vincular as tabelas de lojas, vendedores, usuários/perfis, lançamentos, metas de loja, metas individuais e histórico por identificadores estáveis. Migrar os nomes históricos de loja e vendedor dos lançamentos para esses vínculos, preservando nomes para consulta. Aplicar autorização no servidor: administrador na operação, gestor na própria loja, vendedor somente leitura dos próprios resultados. A prévia do navegador não é uma barreira de segurança.
