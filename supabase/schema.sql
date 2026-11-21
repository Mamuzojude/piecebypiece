-- PieceByPiece database foundation
-- Run in Supabase SQL Editor only after creating a new project.
-- This schema intentionally does NOT expose participant tokens or reveal writes to anon users.

create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.experiences (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  title text not null check (char_length(title) between 1 and 120),
  image_path text,
  image_width integer check (image_width is null or image_width > 0),
  image_height integer check (image_height is null or image_height > 0),
  piece_count integer not null default 5 check (piece_count between 2 and 1000),
  grid_rows integer check (grid_rows is null or grid_rows between 1 and 100),
  grid_columns integer check (grid_columns is null or grid_columns between 1 and 100),
  assignment_mode text not null default 'automatic' check (assignment_mode in ('automatic','manual')),
  reveal_mode text not null default 'direct' check (reveal_mode in ('direct','challenge')),
  challenge_prompt text,
  completion_message text,
  show_participant_names boolean not null default false,
  branding_mode text not null default 'piecebypiece' check (branding_mode in ('piecebypiece','custom')),
  status text not null default 'draft' check (status in ('draft','active','completed','expired','archived')),
  expires_at timestamptz,
  launched_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.participants (
  id uuid primary key default gen_random_uuid(),
  experience_id uuid not null references public.experiences(id) on delete cascade,
  display_name text not null check (char_length(display_name) between 1 and 80),
  token_hash text not null unique,
  invitation_status text not null default 'pending' check (invitation_status in ('pending','sent','revoked')),
  created_at timestamptz not null default now(),
  revoked_at timestamptz
);

create table if not exists public.puzzle_pieces (
  id uuid primary key default gen_random_uuid(),
  experience_id uuid not null references public.experiences(id) on delete cascade,
  participant_id uuid references public.participants(id) on delete set null,
  piece_number integer not null check (piece_number >= 1),
  grid_row integer not null check (grid_row >= 0),
  grid_column integer not null check (grid_column >= 0),
  image_x integer not null default 0,
  image_y integer not null default 0,
  image_width integer not null check (image_width > 0),
  image_height integer not null check (image_height > 0),
  image_piece_path text,
  revealed_at timestamptz,
  created_at timestamptz not null default now(),
  unique (experience_id, piece_number),
  unique (participant_id, piece_number)
);

create table if not exists public.reveal_events (
  id uuid primary key default gen_random_uuid(),
  experience_id uuid not null references public.experiences(id) on delete cascade,
  participant_id uuid references public.participants(id) on delete set null,
  piece_id uuid references public.puzzle_pieces(id) on delete set null,
  event_type text not null check (event_type in ('participant_reveal','organizer_reveal','participant_revoked','piece_reassigned','expiry_extended','experience_completed')),
  actor_user_id uuid references auth.users(id) on delete set null,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

alter table public.reveal_events drop constraint if exists reveal_events_event_type_check;
alter table public.reveal_events add constraint reveal_events_event_type_check
  check (event_type in ('participant_reveal','organizer_reveal','participant_revoked','participant_added','piece_reassigned','expiry_extended','experience_launched','experience_completed'));

alter table public.experiences add column if not exists grid_rows integer;
alter table public.experiences add column if not exists grid_columns integer;
alter table public.experiences drop constraint if exists experiences_grid_rows_check;
alter table public.experiences add constraint experiences_grid_rows_check check (grid_rows is null or grid_rows between 1 and 100);
alter table public.experiences drop constraint if exists experiences_grid_columns_check;
alter table public.experiences add constraint experiences_grid_columns_check check (grid_columns is null or grid_columns between 1 and 100);

create index if not exists experiences_owner_created_idx on public.experiences(owner_id, created_at desc);
create index if not exists experiences_status_expiry_idx on public.experiences(status, expires_at);
create index if not exists participants_experience_idx on public.participants(experience_id);
create index if not exists puzzle_pieces_experience_idx on public.puzzle_pieces(experience_id);
alter table public.puzzle_pieces add column if not exists image_piece_path text;

create index if not exists reveal_events_experience_created_idx on public.reveal_events(experience_id, created_at desc);

-- Automatically create a profile row when a person signs up.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'display_name', ''))
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute procedure public.handle_new_user();

-- Enable row-level security everywhere. Only authenticated owners can access
-- their own experiences and the related organizer-side records.
alter table public.profiles enable row level security;
alter table public.experiences enable row level security;
alter table public.participants enable row level security;
alter table public.puzzle_pieces enable row level security;
alter table public.reveal_events enable row level security;

drop policy if exists "Users read own profile" on public.profiles;
create policy "Users read own profile" on public.profiles
for select to authenticated using (id = (select auth.uid()));

drop policy if exists "Users update own profile" on public.profiles;
create policy "Users update own profile" on public.profiles
for update to authenticated using (id = (select auth.uid())) with check (id = (select auth.uid()));

drop policy if exists "Owners manage own experiences" on public.experiences;
create policy "Owners manage own experiences" on public.experiences
for all to authenticated using (owner_id = (select auth.uid())) with check (owner_id = (select auth.uid()));

drop policy if exists "Owners read participants for own experiences" on public.participants;
create policy "Owners read participants for own experiences" on public.participants
for select to authenticated using (
  exists (select 1 from public.experiences e where e.id = experience_id and e.owner_id = (select auth.uid()))
);

drop policy if exists "Owners manage participants for own experiences" on public.participants;
create policy "Owners manage participants for own experiences" on public.participants
for all to authenticated using (
  exists (select 1 from public.experiences e where e.id = experience_id and e.owner_id = (select auth.uid()))
) with check (
  exists (select 1 from public.experiences e where e.id = experience_id and e.owner_id = (select auth.uid()))
);

drop policy if exists "Owners read pieces for own experiences" on public.puzzle_pieces;
create policy "Owners read pieces for own experiences" on public.puzzle_pieces
for select to authenticated using (
  exists (select 1 from public.experiences e where e.id = experience_id and e.owner_id = (select auth.uid()))
);

drop policy if exists "Owners manage pieces for own experiences" on public.puzzle_pieces;
create policy "Owners manage pieces for own experiences" on public.puzzle_pieces
for all to authenticated using (
  exists (select 1 from public.experiences e where e.id = experience_id and e.owner_id = (select auth.uid()))
) with check (
  exists (select 1 from public.experiences e where e.id = experience_id and e.owner_id = (select auth.uid()))
);

drop policy if exists "Owners read activity for own experiences" on public.reveal_events;
create policy "Owners read activity for own experiences" on public.reveal_events
for select to authenticated using (
  exists (select 1 from public.experiences e where e.id = experience_id and e.owner_id = (select auth.uid()))
);

-- Deliberately no anonymous policies and no client-side insert/update policy
-- for reveal_events. Participant access will be mediated by secure server code.

-- Private image storage. Each organizer may manage only files under their own
-- auth user ID folder: <user-id>/<experience-id>/<filename>.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('experience-images', 'experience-images', false, 8388608, array['image/jpeg','image/png','image/webp'])
on conflict (id) do update set public = false, file_size_limit = 8388608,
  allowed_mime_types = array['image/jpeg','image/png','image/webp'];

-- Cropped participant tiles are private too. Only trusted server functions use the service-role key.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('experience-pieces', 'experience-pieces', false, 8388608, array['image/webp'])
on conflict (id) do update set public = false, file_size_limit = 8388608,
  allowed_mime_types = array['image/webp'];

drop policy if exists "Organizers upload own experience images" on storage.objects;
create policy "Organizers upload own experience images" on storage.objects
for insert to authenticated with check (
  bucket_id = 'experience-images' and (storage.foldername(name))[1] = (select auth.uid())::text
);
drop policy if exists "Organizers read own experience images" on storage.objects;
create policy "Organizers read own experience images" on storage.objects
for select to authenticated using (
  bucket_id = 'experience-images' and (storage.foldername(name))[1] = (select auth.uid())::text
);
drop policy if exists "Organizers delete own experience images" on storage.objects;
create policy "Organizers delete own experience images" on storage.objects
for delete to authenticated using (
  bucket_id = 'experience-images' and (storage.foldername(name))[1] = (select auth.uid())::text
);

-- Trusted server-only helper: add a participant and move selected unrevealed
-- pieces to them as one database transaction. The function is not executable
-- by browser roles; Netlify Functions call it with the service-role key.
create or replace function public.add_participant_with_pieces(
  p_experience_id uuid,
  p_owner_id uuid,
  p_display_name text,
  p_token_hash text,
  p_piece_ids uuid[]
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  new_participant_id uuid;
  piece_id uuid;
begin
  if not exists (
    select 1 from public.experiences
    where id = p_experience_id and owner_id = p_owner_id
      and status in ('draft', 'active')
  ) then
    raise exception 'Experience not found or cannot be changed';
  end if;
  if p_display_name is null or char_length(trim(p_display_name)) < 1 or char_length(trim(p_display_name)) > 80 then
    raise exception 'Participant name must be between 1 and 80 characters';
  end if;
  if p_piece_ids is null or cardinality(p_piece_ids) < 1 then
    raise exception 'Select at least one unrevealed piece';
  end if;
  if (select count(distinct piece_id) from unnest(p_piece_ids) as selected(piece_id)) <> cardinality(p_piece_ids) then
    raise exception 'Duplicate piece selection';
  end if;
  perform 1 from public.puzzle_pieces
    where experience_id = p_experience_id and id = any(p_piece_ids)
    for update;
  if (
    select count(*) from public.puzzle_pieces
    where experience_id = p_experience_id
      and id = any(p_piece_ids)
      and revealed_at is null
  ) <> cardinality(p_piece_ids) then
    raise exception 'One or more selected pieces have already been revealed or do not belong to this experience';
  end if;

  insert into public.participants (experience_id, display_name, token_hash, invitation_status)
  values (p_experience_id, trim(p_display_name), p_token_hash,
    case when (select status from public.experiences where id=p_experience_id)='active' then 'sent' else 'pending' end)
  returning id into new_participant_id;

  insert into public.reveal_events (experience_id, participant_id, event_type, actor_user_id, details)
  values (p_experience_id, new_participant_id, 'participant_added', p_owner_id, jsonb_build_object('reason', 'organizer_added_participant'));

  update public.puzzle_pieces
  set participant_id = new_participant_id
  where experience_id = p_experience_id and id = any(p_piece_ids) and revealed_at is null;

  for piece_id in select unnest(p_piece_ids) loop
    insert into public.reveal_events (experience_id, participant_id, piece_id, event_type, actor_user_id, details)
    values (p_experience_id, new_participant_id, piece_id, 'piece_reassigned', p_owner_id,
      jsonb_build_object('reason', 'organizer_added_participant'));
  end loop;

  return new_participant_id;
end;
$$;

revoke all on function public.add_participant_with_pieces(uuid, uuid, text, text, uuid[]) from public, anon, authenticated;
grant execute on function public.add_participant_with_pieces(uuid, uuid, text, text, uuid[]) to service_role;

-- Trusted server-only helper: revoke a participant and move their unrevealed
-- pieces to another active participant. Revealed pieces can never be moved.
create or replace function public.revoke_participant_and_reassign(
  p_experience_id uuid,
  p_owner_id uuid,
  p_participant_id uuid,
  p_reassign_to uuid default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  unrevealed_count integer;
  revealed_count integer;
  moved_piece_id uuid;
begin
  if not exists (
    select 1 from public.experiences
    where id = p_experience_id and owner_id = p_owner_id
      and status in ('draft', 'active')
  ) then
    raise exception 'Experience not found or cannot be changed';
  end if;
  perform 1 from public.participants
    where id = p_participant_id and experience_id = p_experience_id
    for update;
  if not found then
    raise exception 'Participant not found';
  end if;
  if (select invitation_status from public.participants where id = p_participant_id) = 'revoked' then
    raise exception 'Participant is already removed';
  end if;
  perform 1 from public.puzzle_pieces
    where experience_id = p_experience_id and participant_id = p_participant_id
    for update;
  select count(*) into revealed_count from public.puzzle_pieces
    where experience_id = p_experience_id and participant_id = p_participant_id and revealed_at is not null;
  if revealed_count > 0 then
    raise exception 'A participant who has revealed a piece cannot be removed';
  end if;
  select count(*) into unrevealed_count from public.puzzle_pieces
    where experience_id = p_experience_id and participant_id = p_participant_id and revealed_at is null;
  if unrevealed_count > 0 then
    if p_reassign_to is null or p_reassign_to = p_participant_id or not exists (
      select 1 from public.participants where id = p_reassign_to and experience_id = p_experience_id and invitation_status <> 'revoked'
    ) then
      raise exception 'Choose another active participant to receive these pieces';
    end if;
    for moved_piece_id in select id from public.puzzle_pieces
      where experience_id = p_experience_id and participant_id = p_participant_id and revealed_at is null loop
      update public.puzzle_pieces set participant_id = p_reassign_to where id = moved_piece_id;
      insert into public.reveal_events (experience_id, participant_id, piece_id, event_type, actor_user_id, details)
      values (p_experience_id, p_reassign_to, moved_piece_id, 'piece_reassigned', p_owner_id,
        jsonb_build_object('reason', 'participant_removed', 'from_participant_id', p_participant_id));
    end loop;
  end if;
  update public.participants set invitation_status = 'revoked', revoked_at = now()
    where id = p_participant_id and experience_id = p_experience_id;
  insert into public.reveal_events (experience_id, participant_id, event_type, actor_user_id, details)
  values (p_experience_id, p_participant_id, 'participant_revoked', p_owner_id, jsonb_build_object('reason', 'organizer_removed_participant'));
end;
$$;

revoke all on function public.revoke_participant_and_reassign(uuid, uuid, uuid, uuid) from public, anon, authenticated;
grant execute on function public.revoke_participant_and_reassign(uuid, uuid, uuid, uuid) to service_role;

-- Trusted server-only helper for manual reassignment of unrevealed pieces.
create or replace function public.reassign_unrevealed_pieces(
  p_experience_id uuid,
  p_owner_id uuid,
  p_target_participant_id uuid,
  p_piece_ids uuid[]
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  moved_piece_id uuid;
  previous_participant_id uuid;
  moved_count integer := 0;
begin
  if not exists (select 1 from public.experiences where id=p_experience_id and owner_id=p_owner_id and status in ('draft','active')) then
    raise exception 'Experience not found or cannot be changed';
  end if;
  if not exists (select 1 from public.participants where id=p_target_participant_id and experience_id=p_experience_id and invitation_status<>'revoked') then
    raise exception 'Choose an active participant in this experience';
  end if;
  if p_piece_ids is null or cardinality(p_piece_ids)<1 then raise exception 'Select at least one piece'; end if;
  if (select count(distinct piece_id) from unnest(p_piece_ids) as selected(piece_id)) <> cardinality(p_piece_ids) then raise exception 'Duplicate piece selection'; end if;
  perform 1 from public.puzzle_pieces where experience_id=p_experience_id and id=any(p_piece_ids) for update;
  if (select count(*) from public.puzzle_pieces where experience_id=p_experience_id and id=any(p_piece_ids) and revealed_at is null) <> cardinality(p_piece_ids) then
    raise exception 'One or more selected pieces have already been revealed or do not belong to this experience';
  end if;
  foreach moved_piece_id in array p_piece_ids loop
    select participant_id into previous_participant_id from public.puzzle_pieces where id=moved_piece_id;
    if previous_participant_id is distinct from p_target_participant_id then
      update public.puzzle_pieces set participant_id=p_target_participant_id where id=moved_piece_id;
      insert into public.reveal_events (experience_id,participant_id,piece_id,event_type,actor_user_id,details)
      values (p_experience_id,p_target_participant_id,moved_piece_id,'piece_reassigned',p_owner_id,
        jsonb_build_object('from_participant_id',previous_participant_id,'reason','organizer_manual_assignment'));
      moved_count := moved_count + 1;
    end if;
  end loop;
  return moved_count;
end;
$$;

revoke all on function public.reassign_unrevealed_pieces(uuid, uuid, uuid, uuid[]) from public, anon, authenticated;
grant execute on function public.reassign_unrevealed_pieces(uuid, uuid, uuid, uuid[]) to service_role;
