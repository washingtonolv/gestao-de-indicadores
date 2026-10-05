# Administração local

O item **Admin** reúne lojas, vendedores, usuários e o histórico das últimas 200 alterações salvas. Cadastros existentes são recuperados dos lançamentos e metas da beta anterior.

- Lojas: cadastrar, pesquisar, editar, arquivar e reativar. Renomear atualiza os nomes nos resultados e metas relacionados.
- Vendedores: cadastrar por loja, pesquisar, editar, arquivar e reativar. Para transferir um vendedor, arquive o cadastro anterior e crie outro na nova loja, preservando o histórico.
- Usuários: pré-cadastro por nome e e-mail, perfil administrador/gestor/vendedor, vínculos com loja e vendedor e status ativo/bloqueado. Sem senhas, envio de convite, autenticação ou autorização real nesta etapa.
- Metas e lançamentos: atalhos para gestão e correções; cadastros ativos aparecem nas sugestões. Novos resultados de lojas ou vendedores arquivados são rejeitados.
- Histórico: ação e horário, identificados como Operador local. Não é uma trilha autenticada ou inviolável.
- Backup: inclui cadastros e histórico. Backups antigos são aceitos e reconstruídos a partir dos resultados; a restauração substitui também os cadastros administrativos, como informado na prévia.

## Responsabilidades dos perfis

O gestor registra e corrige os resultados dos vendedores de sua loja. O vendedor apenas consulta a evolução dos próprios resultados, sem criar, editar ou excluir lançamentos. O administrador mantém a gestão geral. Essa política será aplicada no servidor quando a autenticação for integrada.

## Construção

Execute `python scripts/build.py` para incorporar os fontes nos dois documentos publicados. O parser decodifica o atributo do iframe uma única vez para preservar entidades usadas pelo JavaScript. CSP e sandbox permanecem no documento original.

## Verificações

`node scripts/schema.test.cjs`: migração sem alteração de valores, ida e volta do backup, vínculos inválidos, duplicidades, arquivamento e validação do histórico.

Na interface local: criação de loja, vendedor e usuário vinculado; bloqueio do pré-cadastro; lançamento de venda; renomeação de loja refletida no histórico; arquivamento impedindo novo lançamento; reativação; duplicidade por nome; histórico e persistência após recarga. As quatro seções do Admin foram verificadas em viewports de 320, 390, 820 e 1440 px, sem rolagem horizontal. Sem erros de console nessa execução. Dados de teste permaneceram apenas no endereço localhost.
