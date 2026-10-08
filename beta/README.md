# Gestão de indicadores

O painel online usa autenticação e dados do Supabase. O iframe conserva `sandbox="allow-scripts"` e sua CSP; somente a página principal acessa o serviço. Alterações são validadas e confirmadas antes de indicar sucesso. Permissões e vínculos permanecem protegidos pelo banco.

## Uso

- Administrador: e-mail ou usuário e senha; gerencia usuários, lojas, vendedores e metas. Backup fica na Administração.
- Gestor: usuário e senha; acompanha sua loja e registra resultados diários ou acumulados do bloco semanal.
- Vendedor: consulta somente a própria evolução, conforme o vínculo autorizado.
- Exemplo: dados fictícios em memória, sem gravação. Também pode ser explorado na tela de login.

## Cálculos e calendário

Valores financeiros são mantidos em centavos inteiros. TM = vendas / atendimentos; PA = peças / atendimentos. Divisor zero mostra “—”. Semanas são blocos de sete dias úteis, sem domingos, calculados para cada mês. O bloco em andamento aceita acumulados e atualização do mesmo registro. Totais semanais não são distribuídos artificialmente entre os dias.

`statusFor` centraliza a classificação: abaixo de 50% Crítico; de 50% até menos de 80% Atenção; a partir de 80% Atingida. Sem meta, sem dados e períodos futuros ficam neutros. Metas individuais não alteram a meta da loja. A distribuição 25/33/24/18% é apenas uma sugestão informativa.

## Apresentação

O redesign utiliza superfícies neutras translúcidas, marca azul, destaque preto para vendas, gráfico acumulado com referência linear da meta e evolução diária em barras. Os detalhes dos gráficos funcionam por toque, mouse e teclado. Formulários existentes são preservados pelos controles segmentados.

A navegação mobile tem quatro itens; Administração fica no perfil. A equipe vira cartões no celular. Temas claro/escuro e preferência por movimento reduzido são mantidos.

## Desenvolvimento

Edite os módulos em `beta/`. Execute `python scripts/build.py` para gerar `design/prototipo.html` e `docs/index.html`. `npm test` verifica esquema, cálculos, calendário, permissões, contas e classificação de metas. Testes visuais usam dados isolados, sem criar contas ou modificar registros de produção.
