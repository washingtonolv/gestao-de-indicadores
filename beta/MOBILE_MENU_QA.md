# Testes do menu mobile — 04/10/2026

Verificação na prévia local por interface de navegador Chromium, com dimensões de tela simuladas. Sem gravação de lançamentos ou metas.

| Dimensões | Painel | Lançamentos | Metas | Backup |
| --- | --- | --- | --- | --- |
| 320 × 568 | Passou | Passou | Passou | Passou |
| 390 × 844 | Passou | Passou | Passou | Passou |
| 430 × 932 | Passou | Passou | Passou | Passou |
| 844 × 390 (horizontal) | Passou | Passou | Passou | Passou |

Em cada combinação foram conferidos: seção visível, item ativo, barra fixa alinhada ao fim da tela, largura disponível, ausência de rolagem horizontal e espaço reservado abaixo do conteúdo.

As quatro seções também passaram pela rolagem até o final em 390 × 844: barra fixa e rodapé acima dela. Trocar de seção retorna ao topo e preserva os campos preenchidos. Ativação do Painel com Enter funcionou. No desktop de 1280 × 800, a navegação voltou à lateral de 92 px.

Correções encontradas durante a verificação: restaurada a codificação das entidades HTML no JavaScript incorporado, que causava erro de sintaxe; retorno ao topo ao trocar de seção no mobile; navegação inferior também em celulares na horizontal.

Os scripts da moldura e do iframe passaram pela verificação de sintaxe. Nenhum novo erro no console na execução local corrigida. CSP e sandbox preservados. Teclado virtual e área segura de aparelhos físicos não foram simulados nestes testes.
