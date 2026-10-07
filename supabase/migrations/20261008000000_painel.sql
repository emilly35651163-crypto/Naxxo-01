-- Painel de controle (localhost/painel): deixa a chave SECRETA (service_role) ler a tabela de dados
-- para mostrar quem está usando o app. A chave secreta só existe no .env.local do computador da dona.
grant select on public.dados to service_role;
