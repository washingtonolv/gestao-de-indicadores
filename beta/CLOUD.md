# Integração Supabase

O painel exige e-mail ou nome de usuário e senha para administradores, ou usuário e senha para gestores/vendedores, de uma conta cadastrada no Supabase Auth e um vínculo ativo em `gi_profiles`. O SDK oficial é empacotado no documento; somente a chave publicável está no cliente. A sessão usa `sessionStorage`, permanece após recarregar a mesma aba e tem renovação automática. Senhas não são gravadas pela aplicação. Dados antigos da beta local permanecem no armazenamento original, sem envio automático.

O documento pai faz autenticação e requisições. O iframe mantém `sandbox="allow-scripts"` e sua CSP original; a CSP do pai libera somente o endpoint HTTPS do projeto para a nova conexão. Tokens nunca são enviados ao iframe. A ponte verifica origem opaca e a janela de origem.

Lojas, vendedores, resultados e metas são lidos conforme RLS. Administradores têm visão geral, gestores trabalham na própria loja, vendedores abrem Minha evolução e apenas consultam. Nenhuma seleção visual de perfil substitui as políticas do banco.

O salvamento calcula diferenças em relação aos registros carregados e envia apenas alterações à função `gi_apply_changes`. Ela é SECURITY INVOKER e preserva RLS, com lista fechada de tabelas/colunas. Todas as alterações de uma operação são atômicas. Edições e exclusões com `updated_at` divergente falham, preservando a alteração concorrente. Renomeações mantêm vínculos por UUID. Após confirmação, o painel relê o banco. Falha na releitura exige atualizar antes de repetir a operação.

## Uso

1. Entre com a conta cadastrada.
2. O administrador cadastra lojas e vendedores em Admin.
3. Administrador ou gestor registra resultados e metas.
4. Em outro dispositivo, entre com a mesma conta. Use **Atualizar dados** para buscar alterações de outras sessões. Não há atualização em tempo real nesta versão.
5. **Sair** encerra a sessão desta aba. Backup exporta somente os dados permitidos ao perfil.

## Limitações explícitas

- Administradores criam contas em Admin → Usuários e perfis. Administrador exige e-mail e nome de usuário; gestor/vendedor exigem nome de usuário. Login de 3–40 caracteres. Senha de 8–128 caracteres. Mudanças de perfil/status de contas existentes e recuperação de senha ainda são feitas pelo proprietário no Supabase. Não há cadastro público nem envio de convites.
- Restauração/importação de backups está desativada no modo online. Na tela de login, **Baixar meus dados da beta local** aparece quando há dados antigos naquele navegador. A migração depende de revisão e conversão de IDs locais; não foi realizada.
- O painel não funciona offline. Uma falha de rede não é exibida como salvamento confirmado.
- A consulta traz o histórico acessível dentro dos limites da beta; paginação por período no servidor será necessária para volumes maiores.

## Verificação desta entrega

- `npm test`: testes anteriores, 70 verificações de PostgreSQL/PGlite e testes de conversão/diferenças do adaptador.
- `supabase/verify-save.sql`: gravação pela função com o papel autenticado e auditoria, em transação revertida; nenhum cadastro de teste fica salvo.
- Login real do administrador confirmado no navegador local. Sessão persistiu ao recarregar a aba.
- Fluxos dos demais papéis verificados em PostgreSQL local com usuários fictícios; contas reais de gestor e vendedor ainda não foram cadastradas para um teste ponta a ponta.

Construção: `npm ci --ignore-scripts`, `python scripts/build.py`. O build inclui o SDK e o adaptador no HTML publicado, sem CDN de autenticação em tempo de execução.


## Cadastro de contas no painel

A Edge Function `manage-users` valida o token pelo Supabase Auth (`getUser`) e consulta o perfil ativo de administrador antes de usar a API privilegiada de criação. A chave de serviço permanece no ambiente do servidor. O perfil é inserido com o JWT do administrador para respeitar RLS e registrar o autor na auditoria. Falha no vínculo tenta remover somente a conta recém-criada; nenhuma senha é gravada em `gi_profiles`, no histórico ou nos logs da função.

Gestores e vendedores recebem internamente um identificador de autenticação no domínio reservado `.invalid`; não precisam de e-mail e nenhum e-mail é enviado. A função resolve o nome de usuário no servidor e autentica com Supabase Auth, retornando somente a sessão após validar senha e perfil ativo. `login_name` guarda apenas o identificador exibido na lista, nunca a senha.

A verificação antiga do gateway, restrita ao segredo JWT legado, fica desativada; a criação de contas exige e valida a sessão diretamente no Auth e verifica o papel no banco. O caminho action=login aceita usuário e senha sem sessão anterior; falhas retornam a mesma mensagem genérica, sem expor e-mail. Criação por perfis não administradores recebe 403. As origens permitidas são o GitHub Pages e o endereço local de teste. Código e configuração ficam em `supabase/functions/manage-users` e `supabase/config.toml`.

Verificação: testes locais de administrador/gestor/vendedor, conta bloqueada, campos por perfil, loja/vendedor inativos, duplicidade e falha de vínculo. Endpoint publicado respondeu 401 ao teste anônimo. Nenhuma conta real foi criada automaticamente durante esses testes; o primeiro cadastro com senha deve ser feito pelo administrador.
