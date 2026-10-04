# Gestão de indicadores — Design system

Versão 0.5 • Proposta visual • 03/10/2026

## Refinamento pelas referências de dashboard

As duas imagens fornecidas pelo usuário orientam a composição: navegação lateral compacta, cartões claros, números com hierarquia, gráfico principal amplo, medidor semicircular e módulos alinhados. A nova referência define preto #171717, laranja #FF5E2C, cinza-escuro #4D4D4D e cinza-claro #DEDEDE. Fundos claros, cartões translúcidos, bordas brancas e gradientes suaves dão leveza ao painel. O laranja fica restrito aos destaques e ações. Gráficos usam a paleta de indicadores: vermelho, amarelo e verde.

O painel passa a abrir primeiro. A navegação lateral mantém Painel, Design e Estados; em telas pequenas, transforma-se em navegação horizontal. Os cartões superiores mostram meta mensal, vendas, TM e PA. O valor faltante acompanha o medidor para evitar duplicar o atingimento em dois lugares.

O gráfico alterna entre as metas semanais e seu acumulado: R$ 32.000,00; R$ 74.240,00; R$ 104.960,00; R$ 128.000,00. Esses valores são planejamento, não uma série de vendas realizadas. Não foram inventados históricos diários, comparativos com meses anteriores, novas categorias ou novos resultados.

A versão mantém os dados, os status propostos, o sandbox do iframe e a CSP. Revisada em larguras de 320, 360, 768, 1280 e 1440 px, com navegação, alternância do gráfico e estados locais verificados. Não inclui conexão com dados reais.

## Escopo desta etapa

Definir identidade visual, componentes, organização do painel e estados de interface antes de implementar a aplicação. O protótipo usa dados fictícios da planilha `Indicadores_Rosa_Design.xlsx` e a estrutura do esboço fornecido. Não há integração, autenticação ou código de aplicação nesta entrega. O HTML é apenas um documento navegável para revisar o design.

## Direção visual

Interface clara e leve. A preferência atual pela nova paleta e transparência substitui a distribuição anterior de cores sólidas. Preto para números e títulos; cinza-escuro para apoio; cinza-claro e branco translúcido nas superfícies. Vermelho, amarelo e verde continuam reservados ao significado dos resultados. O laranja da marca não indica atenção ou urgência.

## Cores

| Token | HEX | Uso |
| --- | --- | --- |
| text | #171717 | Títulos, valores e controles |
| text-support | #4D4D4D | Informações de apoio |
| canvas | #DEDEDE | Base cinza-clara, suavizada com branco em gradiente |
| surface | #FFFFFFCC → #FFFFFF85 | Cartões translúcidos, com desfoque de fundo de 18 px |
| brand | #FF5E2C | Identidade, ações e pequenos destaques |
| border | #FFFFFFE0 | Contorno suave dos cartões |
| control-border | #4D4D4D | Controles interativos |
| urgent-mark | #FF0000 | Marca gráfica de urgência |
| urgent-surface | #FEE2E2 | Fundo do estado Urgente; texto preto profundo |
| attention-mark | #FFE100 | Amarelo solicitado para atenção, acompanhado de contorno e rótulo |
| attention-surface | #FEF3C7 | Fundo amarelo do estado Atenção; texto preto profundo |
| good-mark | #00FF00 | Marca gráfica de bom resultado |
| good-surface | #DCFCE7 | Fundo do estado Bom resultado; texto preto profundo |
| neutral-surface | #F3F4F6 | Sem meta, sem comparação e dados indisponíveis |
| neutral-mark | #4D4D4D | Marca de estado neutro |

Não colocar texto sobre vermelho ou verde escuros. Usar texto preto profundo sobre as superfícies claras e marcas escuras para pontos, barras e ícones. Usar #4D4D4D sólido no texto de apoio. A transparência se aplica às superfícies, não aos números ou textos. Alertas mantêm fundos semitransparentes apenas onde não prejudicam a leitura; badges têm fundos opacos.

## Tipografia e composição

- Fonte: Inter quando disponível; Arial e sans-serif como alternativas locais. Sem dependência externa no protótipo.
- Título de página: 28–32 px / peso 700. Seção: 20 px / 600.
- Valor principal: 28–36 px / 700, algarismos tabulares.
- Corpo e campos: 16 px / 400. Rótulos e tabela: 14 px. Apoio: mínimo 12 px.
- Entrelinha: 1,4–1,5. Números alinhados à direita em tabelas; rótulos à esquerda.
- Escala de espaços: 4, 8, 12, 16, 24, 32 e 48 px.
- Cartões: raio 16 px, preenchimento interno 20–24 px, borda estrutural de 1 px. Botões e campos: raio 10 px. Badges: raio máximo arredondado.
- Interações: área de toque de pelo menos 44 × 44 px como padrão do produto. Foco preto visível, afastado do controle.
- Gradientes suaves no fundo, cartões e barras, com sombras discretas e borda interna clara. Sem números piscando ou animações contínuas. Se o navegador não oferecer desfoque de fundo, usar superfícies quase opacas; respeitar a preferência de transparência reduzida.

## Organização do painel

1. Navegação compacta, título e período, com indicação de mês encerrado ou em andamento.
2. Quatro cartões: meta do mês, vendas realizadas, ticket médio e peças por atendimento.
3. Gráfico do planejamento semanal ao lado do medidor de atingimento, com o saldo faltante.
4. Tabela da equipe e distribuição semanal. O total semanal deve reconciliar com a meta mensal.
5. Origem, data de atualização e eventuais limitações dos dados em posição discreta, mas visível.

### Responsividade

- A partir de 960 px: quatro cartões de resumo; métricas auxiliares e tabela lado a lado.
- De 600 a 959 px: dois cartões por linha; a tabela ocupa a largura disponível.
- Abaixo de 600 px: uma coluna; vendedoras em registros empilhados com rótulos explícitos. Metas semanais em uma coluna quando duas não couberem.
- Testar 360, 768 e 1280 px, teclado e ampliação de texto. Não reduzir fontes para encaixar dados nem esconder os números principais em tooltips.

## Componentes

| Componente | Conteúdo e comportamento |
| --- | --- |
| Cartão de indicador | Nome por extenso, valor, unidade e contexto. Status apenas quando há meta aplicável. |
| Badge de resultado | Marca + rótulo: Urgente, Atenção ou Bom resultado. Neutro: Sem meta ou Sem dados. |
| Barra de progresso | Escala de 0 a 100%; número exato ao lado. Acima de 100%, preencher a barra e mostrar o percentual real. |
| Tabela de vendedoras | Nome, vendas, meta, percentual e status. Total separado, calculado por soma; não fazer média simples dos percentuais. |
| Meta semanal | Semana, participação planejada e valor. Não confundir distribuição da meta com desempenho realizado. |
| Botão | Rótulo com verbo. Primário laranja, secundário claro. Vermelho reservado a ação destrutiva explícita ou alerta. |
| Campo | Rótulo persistente, orientação curta e erro junto do campo. Placeholder não substitui rótulo. |
| Estado de sistema | Carregando, vazio, erro, dado desatualizado e sem meta com mensagens diferentes. |

## Significado dos estados

**As cores estão definidas pelo usuário. Os limites numéricos abaixo são uma proposta, ainda não uma regra de negócio aprovada.**

### Exemplo para metas de vendas de um mês encerrado

| Condição proposta | Estado |
| --- | --- |
| Atingimento abaixo de 80% | Urgente |
| De 80% até menos de 100% | Atenção |
| A partir de 100% | Bom resultado |
| Meta não informada ou inválida | Sem meta; percentual indisponível |
| Vendas ausentes | Sem dados; não converter ausência em zero |

Na demonstração, setembro é tratado como mês encerrado. R$ 108.350,19 / R$ 128.000,00 = 84,6%, portanto Atenção segundo a proposta. Todas as três vendedoras também ficam em Atenção. Os exemplos vermelho e verde na biblioteca de componentes são amostras isoladas; não alteram as vendas da planilha.

### Período em andamento

Não classificar o mês apenas pelo percentual da meta mensal: no início do mês, um percentual baixo pode ser adequado. Comparar as vendas com a meta acumulada planejada até a data de corte. Calendário de dias úteis, distribuição diária e faixas de tolerância precisam ser definidos antes da implementação. Sem esses parâmetros, mostrar o atingimento acumulado e o status neutro “Sem comparação de ritmo”.

### TM, PA e valor faltante

- Ticket médio e PA só recebem status se tiverem metas próprias configuradas; nesta referência não há essas metas, portanto permanecem neutros.
- O valor faltante é um saldo, não um diagnóstico de urgência. Mostrar neutro. Nunca marcar automaticamente um saldo alto como vermelho.
- Zero vendas com meta positiva é um resultado real; ausência de vendas é “Sem dados”. Meta igual a zero não permite divisão.
- Comparar o valor exato com as faixas antes de arredondar a exibição. Arredondar apenas os textos visíveis.

## Dados da referência

| Indicador | Exemplo |
| --- | --- |
| Meta mensal | R$ 128.000,00 |
| Vendas | R$ 108.350,19 |
| Falta | R$ 19.649,81 |
| Atingimento | 84,6% |
| Atendimentos | 1.009 |
| Peças | 2.280 |
| Ticket médio | R$ 107,38 |
| PA | 2,26 |
| Distribuição semanal | 25%, 33%, 24%, 18% |
| Metas semanais | R$ 32.000,00; R$ 42.240,00; R$ 30.720,00; R$ 23.040,00 |

Os valores da planilha são a referência dos números; o esboço orienta a estrutura. Isso evita reproduzir as inconsistências aritméticas da imagem. Moeda, percentuais e contagens devem usar a formatação pt-BR.

## Estados de interface

- Carregando: estrutura estável, mensagem “Carregando indicadores”, sem mostrar zeros provisórios.
- Vazio: “Nenhuma venda no período” quando a consulta completa retorna zero registros; disponibilizar ajuste de período na futura aplicação.
- Erro: “Não foi possível atualizar os indicadores”, sem substituir os últimos dados por zero. Nova tentativa explícita.
- Desatualizado: manter os últimos dados com data/hora e aviso “Dados desatualizados”.
- Sem meta: valor absoluto disponível, percentual “—” e explicação “Defina uma meta para comparar”.
- Acima da meta: mostrar o percentual real, por exemplo 104%, sem truncar o texto em 100%.

## Acessibilidade e critérios de revisão

Texto preto profundo nas superfícies claras. Cor acompanhada de rótulo e marca. Meta de contraste de pelo menos 4,5:1 para texto normal, 3:1 para texto grande e componentes essenciais. Teclado, foco visível, ordem de leitura lógica, rótulos persistentes e ausência de dependência exclusiva de hover. Alvos de 44 px são uma escolha do produto, acima do mínimo de 24 px com exceções da WCAG 2.2 AA.

Referência normativa: [WCAG 2.2 — W3C](https://www.w3.org/TR/WCAG22/), critérios 1.4.1, 1.4.3, 1.4.11, 2.4.7 e 2.5.8. Isto é uma especificação e uma revisão de protótipo, não uma declaração de conformidade de uma aplicação ainda não implementada.

## Antes do código da aplicação

Validar as faixas de status, a comparação por período, as metas próprias de TM/PA e a direção visual. Depois implementar os componentes e o acesso aos dados conforme esse contrato. O protótipo está publicado no Sites; a integração com dados reais permanece para uma etapa posterior.

## Cores dos gráficos

Vermelho #FF0000 para urgência, amarelo #FFE100 para atenção e verde #00FF00 para bom resultado. O medidor atual permanece amarelo (84,6%). A série de planejamento e as barras semanais usam verde como identificação visual, sem diagnosticar desempenho; o gráfico informa essa distinção. Nenhum gráfico usa o laranja da marca.

O medidor calcula a cor pelo percentual exato: abaixo de 80% vermelho, de 80% até menos de 100% amarelo, a partir de 100% verde. Faixas continuam propostas. Contorno cinza-escuro delimita o arco claro; texto preto e legenda acompanham a cor.
