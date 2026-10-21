create type public.app_role as enum ('admin','doctor');
create type public.doctor_status as enum ('pending','approved','rejected');
create type public.booking_status as enum ('pending','confirmed','cancelled','completed');
create type public.payment_method as enum ('instapay','clinic');

-- roles
create table public.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  role public.app_role not null,
  unique (user_id, role)
);
grant select on public.user_roles to authenticated;
grant all on public.user_roles to service_role;
alter table public.user_roles enable row level security;

create or replace function public.has_role(_user_id uuid, _role public.app_role)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.user_roles where user_id = _user_id and role = _role)
$$;

create policy "own roles readable" on public.user_roles for select to authenticated
  using (user_id = auth.uid() or public.has_role(auth.uid(),'admin'));

-- specialties
create table public.specialties (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  icon text not null default 'stethoscope',
  sort int not null default 100,
  created_at timestamptz not null default now()
);
grant select on public.specialties to anon, authenticated;
grant insert, update, delete on public.specialties to authenticated;
grant all on public.specialties to service_role;
alter table public.specialties enable row level security;
create policy "specialties public read" on public.specialties for select to anon, authenticated using (true);
create policy "admin manage specialties ins" on public.specialties for insert to authenticated with check (public.has_role(auth.uid(),'admin'));
create policy "admin manage specialties upd" on public.specialties for update to authenticated using (public.has_role(auth.uid(),'admin'));
create policy "admin manage specialties del" on public.specialties for delete to authenticated using (public.has_role(auth.uid(),'admin'));

insert into public.specialties (name, icon, sort) values
('باطنة','stethoscope',1),('أطفال','baby',2),('نساء وتوليد','heart-pulse',3),('عظام','bone',4),
('جلدية','sparkles',5),('أسنان','smile',6),('أنف وأذن وحنجرة','ear',7),('عيون','eye',8),
('قلب','heart',9),('مخ وأعصاب','brain',10),('مسالك بولية','droplet',11),('نفسية','brain-circuit',12),
('تغذية','apple',13),('جراحة عامة','scissors',14);

-- doctors (id = auth user id)
create table public.doctors (
  id uuid primary key,
  full_name text not null,
  title text not null default '',
  phone text not null default '',
  specialty_id uuid references public.specialties(id) on delete set null,
  bio text not null default '',
  fee int not null default 0 check (fee >= 0 and fee <= 100000),
  slot_minutes int not null default 20 check (slot_minutes between 5 and 180),
  accepts_instapay boolean not null default true,
  accepts_clinic boolean not null default true,
  status public.doctor_status not null default 'pending',
  created_at timestamptz not null default now()
);
grant select on public.doctors to anon, authenticated;
grant update on public.doctors to authenticated;
grant all on public.doctors to service_role;
alter table public.doctors enable row level security;
create policy "approved doctors public" on public.doctors for select to anon, authenticated using (status = 'approved');
create policy "doctor reads self" on public.doctors for select to authenticated using (id = auth.uid());
create policy "admin reads doctors" on public.doctors for select to authenticated using (public.has_role(auth.uid(),'admin'));
create policy "doctor updates self" on public.doctors for update to authenticated using (id = auth.uid());
create policy "admin updates doctors" on public.doctors for update to authenticated using (public.has_role(auth.uid(),'admin'));

create or replace function public.doctors_guard()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  new.id := old.id;
  if not public.has_role(auth.uid(),'admin') then
    new.status := old.status;
  end if;
  new.full_name := left(btrim(new.full_name), 100);
  new.title := left(new.title, 100);
  new.phone := left(new.phone, 20);
  new.bio := left(new.bio, 1000);
  return new;
end $$;
create trigger doctors_guard before update on public.doctors for each row execute function public.doctors_guard();

-- availability
create table public.doctor_availability (
  id uuid primary key default gen_random_uuid(),
  doctor_id uuid not null references public.doctors(id) on delete cascade,
  weekday smallint not null check (weekday between 0 and 6),
  start_time time not null,
  end_time time not null,
  check (end_time > start_time)
);
grant select on public.doctor_availability to anon, authenticated;
grant insert, update, delete on public.doctor_availability to authenticated;
grant all on public.doctor_availability to service_role;
alter table public.doctor_availability enable row level security;
create policy "availability public" on public.doctor_availability for select to anon, authenticated using (true);
create policy "doctor manage availability ins" on public.doctor_availability for insert to authenticated with check (doctor_id = auth.uid());
create policy "doctor manage availability upd" on public.doctor_availability for update to authenticated using (doctor_id = auth.uid());
create policy "doctor manage availability del" on public.doctor_availability for delete to authenticated using (doctor_id = auth.uid());

-- days off
create table public.doctor_days_off (
  id uuid primary key default gen_random_uuid(),
  doctor_id uuid not null references public.doctors(id) on delete cascade,
  off_date date not null,
  unique (doctor_id, off_date)
);
grant select on public.doctor_days_off to anon, authenticated;
grant insert, delete on public.doctor_days_off to authenticated;
grant all on public.doctor_days_off to service_role;
alter table public.doctor_days_off enable row level security;
create policy "days off public" on public.doctor_days_off for select to anon, authenticated using (true);
create policy "doctor manage days off ins" on public.doctor_days_off for insert to authenticated with check (doctor_id = auth.uid());
create policy "doctor manage days off del" on public.doctor_days_off for delete to authenticated using (doctor_id = auth.uid());

-- bookings
create table public.bookings (
  id uuid primary key default gen_random_uuid(),
  doctor_id uuid not null references public.doctors(id) on delete cascade,
  booking_date date not null,
  start_time time not null,
  patient_name text not null,
  patient_phone text not null,
  notes text not null default '',
  payment_method public.payment_method not null,
  instapay_ref text not null default '',
  status public.booking_status not null default 'pending',
  created_at timestamptz not null default now()
);
create unique index bookings_active_slot on public.bookings (doctor_id, booking_date, start_time) where status in ('pending','confirmed','completed');
grant select, update, delete on public.bookings to authenticated;
grant all on public.bookings to service_role;
alter table public.bookings enable row level security;
create policy "doctor reads own bookings" on public.bookings for select to authenticated using (doctor_id = auth.uid() or public.has_role(auth.uid(),'admin'));
create policy "doctor updates own bookings" on public.bookings for update to authenticated using (doctor_id = auth.uid() or public.has_role(auth.uid(),'admin'));
create policy "admin deletes bookings" on public.bookings for delete to authenticated using (public.has_role(auth.uid(),'admin'));

create or replace function public.bookings_guard()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  -- only status may change after creation
  new.id := old.id; new.doctor_id := old.doctor_id; new.booking_date := old.booking_date;
  new.start_time := old.start_time; new.patient_name := old.patient_name; new.patient_phone := old.patient_phone;
  new.payment_method := old.payment_method; new.instapay_ref := old.instapay_ref; new.created_at := old.created_at;
  return new;
end $$;
create trigger bookings_guard before update on public.bookings for each row execute function public.bookings_guard();

-- public: taken slots (no patient data)
create or replace function public.get_taken_slots(_doctor uuid, _date date)
returns setof time language sql stable security definer set search_path = public as $$
  select start_time from public.bookings
  where doctor_id = _doctor and booking_date = _date and status in ('pending','confirmed','completed')
$$;

-- public: create booking with full validation
create or replace function public.create_booking(
  _doctor uuid, _date date, _time time, _name text, _phone text,
  _payment public.payment_method, _instapay_ref text, _notes text)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  d public.doctors;
  local_now timestamp := (now() at time zone 'Africa/Cairo');
  ok boolean;
  new_id uuid;
begin
  select * into d from public.doctors where id = _doctor and status = 'approved';
  if not found then raise exception 'DOCTOR_UNAVAILABLE'; end if;
  _name := btrim(coalesce(_name,''));
  _phone := regexp_replace(coalesce(_phone,''), '\s', '', 'g');
  _instapay_ref := left(btrim(coalesce(_instapay_ref,'')), 100);
  _notes := left(btrim(coalesce(_notes,'')), 500);
  if length(_name) < 2 or length(_name) > 100 then raise exception 'INVALID_NAME'; end if;
  if _phone !~ '^\+?[0-9]{8,15}$' then raise exception 'INVALID_PHONE'; end if;
  if _date < local_now::date or _date > local_now::date + 60 then raise exception 'INVALID_DATE'; end if;
  if (_date + _time) <= local_now then raise exception 'SLOT_PASSED'; end if;
  if exists (select 1 from public.doctor_days_off where doctor_id = _doctor and off_date = _date) then
    raise exception 'DAY_OFF';
  end if;
  select exists (
    select 1 from public.doctor_availability a
    where a.doctor_id = _doctor
      and a.weekday = extract(dow from _date)::int
      and _time >= a.start_time
      and (extract(epoch from (a.end_time - _time)) / 60) >= d.slot_minutes
      and (extract(epoch from (_time - a.start_time)) / 60)::int % d.slot_minutes = 0
  ) into ok;
  if not ok then raise exception 'INVALID_SLOT'; end if;
  if _payment = 'instapay' then
    if not d.accepts_instapay then raise exception 'PAYMENT_DISABLED'; end if;
    if length(_instapay_ref) < 3 then raise exception 'INSTAPAY_REF_REQUIRED'; end if;
  else
    if not d.accepts_clinic then raise exception 'PAYMENT_DISABLED'; end if;
  end if;
  begin
    insert into public.bookings (doctor_id, booking_date, start_time, patient_name, patient_phone, notes, payment_method, instapay_ref)
    values (_doctor, _date, _time, _name, _phone, _notes, _payment, _instapay_ref)
    returning id into new_id;
  exception when unique_violation then
    raise exception 'SLOT_TAKEN';
  end;
  return new_id;
end $$;

-- public: check booking status by id + phone
create or replace function public.get_booking_status(_id uuid, _phone text)
returns table (status public.booking_status, booking_date date, start_time time, doctor_name text, payment_method public.payment_method)
language sql stable security definer set search_path = public as $$
  select b.status, b.booking_date, b.start_time, d.full_name, b.payment_method
  from public.bookings b join public.doctors d on d.id = b.doctor_id
  where b.id = _id and b.patient_phone = regexp_replace(coalesce(_phone,''), '\s', '', 'g')
$$;

grant execute on function public.get_taken_slots(uuid, date) to anon, authenticated;
grant execute on function public.create_booking(uuid, date, time, text, text, public.payment_method, text, text) to anon, authenticated;
grant execute on function public.get_booking_status(uuid, text) to anon, authenticated;
grant execute on function public.has_role(uuid, public.app_role) to authenticated;

-- signup: first user = owner (admin, auto-approved); others become pending doctors
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  is_first boolean;
  spec uuid;
begin
  select not exists (select 1 from public.user_roles where role = 'admin') into is_first;
  if is_first then
    insert into public.user_roles (user_id, role) values (new.id, 'admin');
  end if;
  insert into public.user_roles (user_id, role) values (new.id, 'doctor') on conflict do nothing;
  begin
    spec := nullif(new.raw_user_meta_data->>'specialty_id','')::uuid;
  exception when others then spec := null;
  end;
  insert into public.doctors (id, full_name, phone, specialty_id, status)
  values (
    new.id,
    left(coalesce(nullif(btrim(new.raw_user_meta_data->>'full_name'),''), split_part(new.email,'@',1)), 100),
    left(coalesce(new.raw_user_meta_data->>'phone',''), 20),
    spec,
    case when is_first then 'approved'::public.doctor_status else 'pending'::public.doctor_status end
  );
  return new;
end $$;
create trigger on_auth_user_created after insert on auth.users for each row execute function public.handle_new_user();