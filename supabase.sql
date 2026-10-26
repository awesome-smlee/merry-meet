-- Run once in Supabase SQL Editor. No anonymous database access is granted.
create table if not exists public.meeting_rooms(id text primary key, data jsonb not null default '{"members":[],"confirmed":null}'::jsonb);
alter table public.meeting_rooms add column if not exists owner_token_hash text;
alter table public.meeting_rooms add column if not exists delete_after timestamptz;
create index if not exists meeting_rooms_delete_after on public.meeting_rooms(delete_after) where delete_after is not null;
-- Keep only revoked codes after purging, so old invitations cannot recreate a room.
create table if not exists public.deleted_meeting_codes(id text primary key);
alter table public.deleted_meeting_codes enable row level security;
revoke all on public.deleted_meeting_codes from public, anon, authenticated;
alter table public.meeting_rooms enable row level security;
revoke all on public.meeting_rooms from anon, authenticated;
create or replace function public.meeting_action(p_room text,p_action text,p_token text,p_nickname text default null,p_slots jsonb default '[]'::jsonb,p_slot text default null,p_admin boolean default false)
returns jsonb language plpgsql security definer set search_path=public as $$
declare s jsonb; ms jsonb; idx integer; member jsonb; result jsonb; places jsonb; votes jsonb; mid text; selected_votes jsonb; events jsonb; event_idx integer; event_date date; before_state jsonb; old_place jsonb; new_place jsonb; changes jsonb;
begin
 if exists(select 1 from deleted_meeting_codes where id=p_room) then raise exception '삭제 요청된 모임이에요.'; end if;
 insert into meeting_rooms(id) values(p_room) on conflict do nothing;
 select data into s from meeting_rooms where id=p_room for update;
 if exists(select 1 from meeting_rooms where id=p_room and delete_after is not null) then raise exception '삭제 요청된 모임이에요.'; end if;
 before_state:=s;
 ms:=s->'members';
 select (ordinality-1)::integer into idx from jsonb_array_elements(ms) with ordinality where value->>'token'=p_token;
 if p_action='join' then
  if exists(select 1 from jsonb_array_elements(ms) where lower(value->>'nickname')=lower(p_nickname)) then raise exception '이미 사용 중인 닉네임이에요.'; end if;
  member:=jsonb_build_object('id',gen_random_uuid()::text,'nickname',p_nickname,'token',p_token,'responded',false,'slots','[]'::jsonb);
  ms:=ms||jsonb_build_array(member);
 else
  if idx is null then raise exception '참여 정보를 찾을 수 없어요. 다시 입장해 주세요.'; end if;
  if p_action='profile' then
   if coalesce(length(trim(p_nickname)),0) not between 1 and 12 then raise exception '닉네임은 1~12자로 입력해 주세요.'; end if;
   if coalesce(p_slots->>'avatar','') not in ('cat','dog','bear','rabbit','fox','panda','koala','pig','tiger','lion','frog','penguin') then raise exception '프로필 이미지를 다시 선택해 주세요.'; end if;
   if exists(select 1 from jsonb_array_elements(ms) with ordinality where ordinality-1<>idx and lower(value->>'nickname')=lower(trim(p_nickname))) then raise exception '이미 사용 중인 닉네임이에요.'; end if;
   ms:=jsonb_set(ms,array[idx::text,'nickname'],to_jsonb(trim(p_nickname)));
   ms:=jsonb_set(ms,array[idx::text,'avatar'],p_slots->'avatar');
  elsif p_action in ('event-add','event-update','event-delete') then
   mid:=ms->idx->>'id'; events:=coalesce(s->'events','[]'::jsonb);
   if p_action<>'event-add' then
    select (ordinality-1)::integer into event_idx from jsonb_array_elements(events) with ordinality where value->>'id'=p_slots->>'id';
    if event_idx is null then raise exception '이벤트가 삭제되었어요. 목록을 다시 확인해 주세요.'; end if;
    if events->event_idx->>'addedBy' is distinct from mid then raise exception '등록한 사람만 수정하거나 삭제할 수 있어요.'; end if;
   end if;
   if p_action='event-delete' then
    events:=events-event_idx;
   else
    if jsonb_typeof(p_slots->'title') is distinct from 'string' or coalesce(length(trim(p_slots->>'title')),0) not between 1 and 40 then raise exception '이벤트명은 1~40자로 입력해 주세요.'; end if;
    if coalesce(p_slots->>'date','') !~ '^(20[0-9]{2}|2100)-[0-9]{2}-[0-9]{2}$' then raise exception '날짜를 확인해 주세요.'; end if;
    event_date:=(p_slots->>'date')::date;
    if to_char(event_date,'YYYY-MM-DD')<>p_slots->>'date' then raise exception '날짜를 확인해 주세요.'; end if;
    if (p_slots ? 'memo' and jsonb_typeof(p_slots->'memo') is distinct from 'string') or length(coalesce(p_slots->>'memo',''))>500 then raise exception '메모는 500자 이내로 입력해 주세요.'; end if;
    member:=jsonb_build_object('title',trim(p_slots->>'title'),'date',p_slots->>'date','memo',trim(coalesce(p_slots->>'memo','')),'addedBy',mid);
    if p_action='event-add' then
     if jsonb_array_length(events)>=200 then raise exception '이벤트는 모임당 최대 200개까지 등록할 수 있어요.'; end if;
     events:=events||jsonb_build_array(member||jsonb_build_object('id',gen_random_uuid()::text));
    else
     events:=jsonb_set(events,array[event_idx::text],member||jsonb_build_object('id',p_slots->>'id'));
    end if;
   end if;
   s:=jsonb_set(s,'{events}',events);
  elsif p_action='deadline-set' then
   if jsonb_typeof(p_slots->'allowLateResponses') is distinct from 'boolean' then raise exception '마감 후 수정 허용 여부를 선택해 주세요.'; end if;
   if p_slots->'responseDeadline' is distinct from 'null'::jsonb then
    if coalesce(p_slots->>'responseDeadline','') !~ '^(20[0-9]{2}|2100)-[0-9]{2}-[0-9]{2}$' then raise exception '마감일을 확인해 주세요.'; end if;
    event_date:=(p_slots->>'responseDeadline')::date;
    if to_char(event_date,'YYYY-MM-DD')<>p_slots->>'responseDeadline' then raise exception '마감일을 확인해 주세요.'; end if;
   end if;
   s:=s||jsonb_build_object('responseDeadline',p_slots->'responseDeadline','allowLateResponses',p_slots->'allowLateResponses');
  elsif p_action='reset' then
   select coalesce(jsonb_agg((value - 'votedAt') || jsonb_build_object('slots','[]'::jsonb,'responded',false)),'[]'::jsonb) into ms from jsonb_array_elements(ms);
   s:=s || jsonb_build_object('confirmed',null,'confirmedPlace',null,'places','[]'::jsonb,'placeVotes','{}'::jsonb,'regionVotes','{}'::jsonb,'resetVersion',gen_random_uuid()::text);
  elsif p_action='save' then
   if s->>'responseDeadline' is not null and (clock_timestamp() at time zone 'Asia/Seoul')::date>(s->>'responseDeadline')::date and not coalesce((s->>'allowLateResponses')::boolean,false) then raise exception '응답이 마감되어 시간을 수정할 수 없어요.'; end if;
   if s->'confirmed'<>'null'::jsonb and p_slot is null then raise exception '확정된 약속은 수정할 수 없어요.'; end if;
   if p_slot is not null and (s->>'confirmed') is distinct from p_slot then raise exception '일정이 변경되었어요. 다시 확인해 주세요.'; end if;
   ms:=jsonb_set(ms,array[idx::text,'slots'],p_slots);ms:=jsonb_set(ms,array[idx::text,'responded'],'true');
   ms:=jsonb_set(ms,array[idx::text,'votedAt'],to_jsonb(clock_timestamp()));
  elsif p_action='reschedule' then
   if s->>'confirmed' is null or (s->>'confirmed') is distinct from (p_slots->>'expectedConfirmed') then raise exception '일정이 변경되었어요. 다시 확인해 주세요.'; end if;
   if coalesce(p_slot,'') !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}\|(09|1[0-9]|2[0-3]):(00|30)$' then raise exception '변경할 날짜와 시간을 확인해 주세요.'; end if;
   event_date:=split_part(p_slot,'|',1)::date;
   if to_char(event_date,'YYYY-MM-DD')<>split_part(p_slot,'|',1) or event_date<(clock_timestamp() at time zone 'Asia/Seoul')::date or extract(year from event_date)>extract(year from (clock_timestamp() at time zone 'Asia/Seoul'))+2 then raise exception '변경할 날짜와 시간을 확인해 주세요.'; end if;
   s:=jsonb_set(s,'{confirmed}',to_jsonb(p_slot));
  elsif p_action in ('confirm','unconfirm') then
   -- Every authenticated room member can confirm or reopen the meeting.
   if p_action='confirm' then
    if s->'confirmed'<>'null'::jsonb then raise exception '이미 확정된 약속이에요. 먼저 확정을 취소해 주세요.'; end if;
    if not exists(select 1 from jsonb_array_elements(ms) m, jsonb_array_elements_text(m->'slots') slot where slot=p_slot and (m->>'responded')::boolean) then raise exception '응답이 있는 후보를 선택해 주세요.'; end if;
    s:=jsonb_set(s,'{confirmed}',to_jsonb(p_slot));
   else s:=jsonb_set(jsonb_set(s,'{confirmed}','null'),'{confirmedPlace}','null'); end if;
  elsif p_action in ('region-vote','place-add','place-vote','place-confirm','place-unconfirm') then
   if coalesce(s->'confirmed','null')='null'::jsonb then raise exception '시간을 먼저 확정해 주세요.'; end if;
   if coalesce(s->'confirmedPlace','null')<>'null'::jsonb and p_action<>'place-unconfirm' then raise exception '장소 확정을 먼저 취소해 주세요.'; end if;
   mid:=ms->idx->>'id'; places:=coalesce(s->'places','[]');
   if p_action='region-vote' then
    if coalesce(length(trim(p_slots->>'region')),0) not between 1 and 30 then raise exception '지역을 확인해 주세요.'; end if;
    votes:=coalesce(s->'regionVotes','{}');
    s:=jsonb_set(s,'{regionVotes}',jsonb_set(votes,array[mid],p_slots->'region'));
   elsif p_action='place-add' then
    if jsonb_array_length(places)>=50 then raise exception '장소 후보는 최대 50개까지 등록할 수 있어요.'; end if;
    if coalesce(length(trim(p_slots->>'region')),0) not between 1 and 30 or coalesce(length(trim(p_slots->>'name')),0) not between 1 and 60 or coalesce(length(trim(p_slots->>'address')),0) not between 1 and 160 or coalesce(length(p_slots->>'url'),0) not between 1 and 500 or (p_slots->>'url') !~ '^https://(map[.]naver[.]com|naver[.]me|m[.]place[.]naver[.]com|pcmap[.]place[.]naver[.]com)/' then raise exception '장소 정보를 확인해 주세요.'; end if;
    places:=places||jsonb_build_array(jsonb_build_object('id',gen_random_uuid()::text,'region',p_slots->>'region','name',p_slots->>'name','address',p_slots->>'address','url',p_slots->>'url','addedBy',mid));
    s:=jsonb_set(s,'{places}',places);
   elsif p_action in ('place-vote','place-confirm') then
    if not exists(select 1 from jsonb_array_elements(places) where value->>'id'=p_slots->>'id') then raise exception '장소 후보를 다시 선택해 주세요.'; end if;
    if p_action='place-vote' then
     votes:=coalesce(s->'placeVotes','{}');
     selected_votes:=jsonb_build_array(p_slots->>'id');
     s:=jsonb_set(s,'{placeVotes}',jsonb_set(votes,array[mid],selected_votes));
    else s:=jsonb_set(s,'{confirmedPlace}',p_slots->'id'); end if;
   else s:=jsonb_set(s,'{confirmedPlace}','null'); end if;
  elsif p_action<>'read' then raise exception 'Invalid action'; end if;
 end if;
 if (before_state->>'confirmed') is distinct from (s->>'confirmed') or (before_state->>'confirmedPlace') is distinct from (s->>'confirmedPlace') then
  select value into old_place from jsonb_array_elements(coalesce(before_state->'places','[]')) where value->>'id'=before_state->>'confirmedPlace';
  select value into new_place from jsonb_array_elements(coalesce(s->'places','[]')) where value->>'id'=s->>'confirmedPlace';
  changes:=jsonb_build_array(jsonb_build_object('id',gen_random_uuid()::text,'from',jsonb_build_object('slot',before_state->>'confirmed','place',old_place),'to',jsonb_build_object('slot',s->>'confirmed','place',new_place),'changedBy',ms->idx->>'id','changedByName',ms->idx->>'nickname','createdAt',clock_timestamp()))||coalesce(s->'changes','[]');
  select jsonb_agg(value order by ordinality) into changes from jsonb_array_elements(changes) with ordinality where ordinality<=30;
  s:=jsonb_set(s,'{changes}',changes);
 end if;
 s:=jsonb_set(s,'{members}',ms);update meeting_rooms set data=s where id=p_room;
 select coalesce(jsonb_agg(value-'token'),'[]') into result from jsonb_array_elements(ms);
 return jsonb_build_object('members',result,'confirmed',s->'confirmed','me',(select value->>'id' from jsonb_array_elements(ms) where value->>'token'=p_token),'responseDeadline',s->'responseDeadline','allowLateResponses',coalesce(s->'allowLateResponses','false'::jsonb),'changes',coalesce(s->'changes','[]'),'events',coalesce(s->'events','[]'),'places',coalesce(s->'places','[]'),'regionVotes',coalesce(s->'regionVotes','{}'),'placeVotes',coalesce(s->'placeVotes','{}'),'confirmedPlace',s->'confirmedPlace','resetVersion',s->'resetVersion');
end;$$;
revoke all on function public.meeting_action(text,text,text,text,jsonb,text,boolean) from public,anon,authenticated;
grant execute on function public.meeting_action(text,text,text,text,jsonb,text,boolean) to service_role;

create or replace function public.schedule_meeting_deletion(p_room text, p_owner_token_hash text)
returns jsonb language plpgsql security definer set search_path=public as $$
declare target meeting_rooms%rowtype;
begin
 select * into target from meeting_rooms where id=p_room for update;
 if not found then raise exception '모임을 찾을 수 없어요.'; end if;
 if target.owner_token_hash is null or p_owner_token_hash is null or target.owner_token_hash<>p_owner_token_hash then
  raise exception '모임을 만든 기기에서만 삭제할 수 있어요.';
 end if;
 if target.delete_after is null then
  target.delete_after:=clock_timestamp()+interval '10 days';
  update meeting_rooms set delete_after=target.delete_after where id=p_room;
  insert into deleted_meeting_codes(id) values(p_room) on conflict do nothing;
 end if;
 return jsonb_build_object('deleteAfter',target.delete_after);
end;$$;
revoke all on function public.schedule_meeting_deletion(text,text) from public,anon,authenticated;
grant execute on function public.schedule_meeting_deletion(text,text) to service_role;

create or replace function public.purge_deleted_meetings()
returns bigint language plpgsql security definer set search_path=public as $$
declare removed bigint;
begin
 delete from meeting_rooms where delete_after<=clock_timestamp();
 get diagnostics removed=row_count;
 return removed;
end;$$;
revoke all on function public.purge_deleted_meetings() from public,anon,authenticated;
grant execute on function public.purge_deleted_meetings() to service_role;
