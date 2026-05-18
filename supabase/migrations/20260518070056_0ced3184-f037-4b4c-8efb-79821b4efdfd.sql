
-- Enums
create type public.app_role as enum ('admin', 'dosen', 'mahasiswa');
create type public.attendance_status as enum ('Hadir', 'Izin', 'Sakit', 'Alpa');

-- Profiles
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text unique not null,
  nama text not null,
  nim text unique,
  created_at timestamptz not null default now()
);

-- Roles
create table public.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  role public.app_role not null,
  unique (user_id, role)
);

-- has_role helper (SECURITY DEFINER, avoids RLS recursion)
create or replace function public.has_role(_user_id uuid, _role public.app_role)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.user_roles
    where user_id = _user_id and role = _role
  )
$$;

-- Attendance sessions (kode = isi QR code)
create table public.attendance_sessions (
  id uuid primary key default gen_random_uuid(),
  judul text not null,
  kode text unique not null,
  created_by uuid references auth.users(id) on delete set null,
  closed boolean not null default false,
  created_at timestamptz not null default now()
);

-- Attendances
create table public.attendances (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.attendance_sessions(id) on delete cascade,
  student_id uuid not null references auth.users(id) on delete cascade,
  status public.attendance_status not null default 'Hadir',
  keterangan text,
  created_at timestamptz not null default now(),
  unique (session_id, student_id)
);

-- RLS
alter table public.profiles enable row level security;
alter table public.user_roles enable row level security;
alter table public.attendance_sessions enable row level security;
alter table public.attendances enable row level security;

-- profiles
create policy "profiles_select_auth" on public.profiles
  for select to authenticated using (true);
create policy "profiles_admin_all" on public.profiles
  for all to authenticated
  using (public.has_role(auth.uid(), 'admin'))
  with check (public.has_role(auth.uid(), 'admin'));
create policy "profiles_self_update" on public.profiles
  for update to authenticated using (id = auth.uid());

-- user_roles
create policy "roles_select_auth" on public.user_roles
  for select to authenticated using (true);
create policy "roles_admin_all" on public.user_roles
  for all to authenticated
  using (public.has_role(auth.uid(), 'admin'))
  with check (public.has_role(auth.uid(), 'admin'));

-- sessions
create policy "sessions_select_auth" on public.attendance_sessions
  for select to authenticated using (true);
create policy "sessions_insert_dosen_admin" on public.attendance_sessions
  for insert to authenticated
  with check (
    public.has_role(auth.uid(), 'dosen') or public.has_role(auth.uid(), 'admin')
  );
create policy "sessions_update_owner_admin" on public.attendance_sessions
  for update to authenticated
  using (created_by = auth.uid() or public.has_role(auth.uid(), 'admin'));
create policy "sessions_delete_owner_admin" on public.attendance_sessions
  for delete to authenticated
  using (created_by = auth.uid() or public.has_role(auth.uid(), 'admin'));

-- attendances
create policy "attendances_select_auth" on public.attendances
  for select to authenticated using (true);
create policy "attendances_self_insert" on public.attendances
  for insert to authenticated with check (student_id = auth.uid());
create policy "attendances_self_update" on public.attendances
  for update to authenticated using (student_id = auth.uid());
create policy "attendances_staff_all" on public.attendances
  for all to authenticated
  using (public.has_role(auth.uid(), 'dosen') or public.has_role(auth.uid(), 'admin'))
  with check (public.has_role(auth.uid(), 'dosen') or public.has_role(auth.uid(), 'admin'));
