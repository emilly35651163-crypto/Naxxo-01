-- Os dados de cada pessoa: um registro por "caixinha" do app (lançamentos, contas, metas, mercado…).
-- Cada pessoa só lê e escreve as próprias linhas (Row Level Security).
create table if not exists public.dados (
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  chave text not null,
  valor jsonb not null,
  atualizado_em timestamptz not null default now(),
  primary key (user_id, chave)
);

alter table public.dados enable row level security;

create policy "ver os próprios dados" on public.dados for select to authenticated using (user_id = (select auth.uid()));
create policy "criar os próprios dados" on public.dados for insert to authenticated with check (user_id = (select auth.uid()));
create policy "mudar os próprios dados" on public.dados for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "apagar os próprios dados" on public.dados for delete to authenticated using (user_id = (select auth.uid()));

-- A tabela não fica exposta automaticamente: libera só para quem está logado (as regras acima limitam às próprias linhas)
grant select, insert, update, delete on public.dados to authenticated;
