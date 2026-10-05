# Integração Supabase

O painel exige e-mail e senha de uma conta já cadastrada no Supabase Auth e um vínculo ativo em `gi_profiles`. O SDK oficial é empacotado no documento; somente a chave publicável está no cliente. A sessão usa `sessionStorage`, permanece após recarregar a mesma aba e tem renovação automática. Senhas não são gravadas pela aplicação. Dados antigos da beta local permanecem no armazenamento original, sem envio automático.

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

- Criação de contas, convites e mudanças de perfil/status de acesso continuam no Supabase, pelo proprietário. A aba Usuários exibe os perfis autorizados para consulta. Não há formulário de cadastro de conta público nem recuperação de senha no painel nesta entrega.
- Restauração/importação de backups está desativada no modo online. Na tela de login, **Baixar meus dados da beta local** aparece quando há dados antigos naquele navegador. A migração depende de revisão e conversão de IDs locais; não foi realizada.
- O painel não funciona offline. Uma falha de rede não é exibida como salvamento confirmado.
- A consulta traz o histórico acessível dentro dos limites da beta; paginação por período no servidor será necessária para volumes maiores.

## Verificação desta entrega

- `npm test`: testes anteriores, 70 verificações de PostgreSQL/PGlite e testes de conversão/diferenças do adaptador.
- `supabase/verify-save.sql`: gravação pela função com o papel autenticado e auditoria, em transação revertida; nenhum cadastro de teste fica salvo.
- Login real do administrador confirmado no navegador local. Sessão persistiu ao recarregar a aba.
- Fluxos dos demais papéis verificados em PostgreSQL local com usuários fictícios; contas reais de gestor e vendedor ainda não foram cadastradas para um teste ponta a ponta.

Construção: `npm ci --ignore-scripts`, `python scripts/build.py`. O build inclui o SDK e o adaptador no HTML publicado, sem CDN de autenticação em tempo de execução.
