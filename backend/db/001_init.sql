create table if not exists users(id bigserial primary key,username text unique,created_at timestamptz not null default now());
create table if not exists orders(id bigserial primary key,public_id text unique not null,name text,telegram text,status text not null default 'new',total_from numeric not null default 0,created_at timestamptz not null default now());
create index if not exists orders_created_at_idx on orders(created_at desc);
