# Gestão de indicadores — beta local

## Uso

1. Em **Metas**, cadastre o mês, a loja e a meta de vendas.
2. Em **Lançamentos**, informe o total diário por vendedor e loja: vendas líquidas, atendimentos e peças.
3. Consulte o painel usando os filtros de mês e loja. Edite ou exclua registros pelo histórico; a exclusão pede confirmação.
4. Em **Backup**, baixe uma cópia JSON periodicamente. A restauração valida o arquivo e exibe um resumo antes de substituir os dados.

O painel começa vazio. **Ver exemplo** usa dados fictícios somente em memória; não os grava nem mistura com seus registros.

## Persistência

Sem banco de dados ou envio dos lançamentos ao servidor. A página principal salva em `localStorage`, chave `gestao-indicadores:beta:v1`, e confirma a gravação antes de mostrar sucesso. O iframe continua em `sandbox="allow-scripts"`; a CSP foi preservada. A comunicação de persistência aceita apenas mensagens do iframe esperado, valida o formato e usa revisões para detectar conflitos entre abas. Backup é baixado pela página principal.

Dados disponíveis somente no mesmo navegador, perfil, aparelho e endereço do site. Limpar dados do site ou usar navegação privada pode causar perda. Manter backups é responsabilidade do usuário. Não há autenticação interna, sincronização, trilha de auditoria ou criptografia adicional da base local. O acesso privado existente do Sites permanece.

Limites da beta: 5.000 lançamentos, 1.000 metas, backup até 2 MB. Um registro por vendedor, loja e dia no formulário. Vendas não negativas e valores monetários em centavos inteiros. Entradas usam formato brasileiro, como `1.250,50`. Vendas devem estar líquidas de devoluções e cancelamentos; ajustes negativos independentes não são suportados.

## Cálculos

- Vendas, peças e atendimentos: somas dos lançamentos filtrados.
- Ticket médio: vendas ÷ atendimentos. PA: peças ÷ atendimentos. Com divisor zero, mostrar “—”.
- Meta: soma das metas das lojas selecionadas. Se existir loja com vendas sem meta, não classificar o total.
- Mês encerrado: abaixo de 80% vermelho `#FF0000`; de 80% até menos de 100% amarelo `#FFE100`; a partir de 100% verde `#00FF00`. Faixas propostas, ainda a validar.
- Mês atual/futuro: percentual acumulado com estado neutro; não há planejamento diário para avaliar ritmo.
- Gráfico: vendas acumuladas por dia, com detalhes por mouse, toque, foco e Enter. Cor representa o estado geral do período. Sem dados não é convertido em diagnóstico de urgência.
- Semanas: blocos de dias 1–7, 8–14, 15–21, 22–28 e restante do mês.
- Tabela: totais por vendedor. Metas individuais e distribuição semanal de metas não fazem parte desta beta.

## Tela e moldura

O fundo externo permanece claro mesmo com o navegador em tema escuro. Em monitores largos, o conteúdo pode crescer até 1680 px; em telas pequenas, ocupa a largura disponível sem margem externa.

## Interações e validação

Transições curtas em botões, cards e gráficos; foco visível, resposta ao salvar, confirmação de exclusão, movimento reduzido e superfícies alternativas para transparência reduzida. Formulários funcionam sem liberar navegação de formulários no sandbox.

Verificado em Edge/Chromium: cadastro de meta e lançamento, recarga persistente, edição e exclusão, duplicidades, cálculos, três cores, exportação real de backup, restauração válida e rejeição de arquivo inválido, aviso de conflito entre abas, armazenamento bloqueado, responsividade de 320 a 1440 px e movimento reduzido.

## Fontes

`design/beta.html`, `beta.css`, `beta.js`: interface. `beta-schema.js`: validação comum. `beta-bridge.js`: persistência e download na página principal. `dist/index.html`: documento publicado, com scripts incorporados. `design/painel-fragment.html`: conteúdo incorporado no iframe.
