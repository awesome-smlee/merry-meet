-- Run once in Supabase SQL Editor. No anonymous database access is granted.
create table if not exists public.meeting_rooms(id text primary key, data jsonb not null default '{"members":[],"confirmed":null}'::jsonb);
alter table public.meeting_rooms enable row level security;
revoke all on public.meeting_rooms from anon, authenticated;
create or replace function public.meeting_action(p_room text,p_action text,p_token text,p_nickname text default null,p_slots jsonb default '[]'::jsonb,p_slot text default null,p_admin boolean default false)
returns jsonb language plpgsql security definer set search_path=public as $$
declare s jsonb; ms jsonb; idx integer; member jsonb; result jsonb; places jsonb; votes jsonb; mid text; selected_votes jsonb;
begin
 insert into meeting_rooms(id) values(p_room) on conflict do nothing;
 select data into s from meeting_rooms where id=p_room for update;
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
  elsif p_action='reset' then
   select coalesce(jsonb_agg((value - 'votedAt') || jsonb_build_object('slots','[]'::jsonb,'responded',false)),'[]'::jsonb) into ms from jsonb_array_elements(ms);
   s:=s || jsonb_build_object('confirmed',null,'confirmedPlace',null,'places','[]'::jsonb,'placeVotes','{}'::jsonb,'regionVotes','{}'::jsonb,'resetVersion',gen_random_uuid()::text);
  elsif p_action='save' then
   if s->'confirmed'<>'null'::jsonb then raise exception '확정된 약속은 수정할 수 없어요.'; end if;
   ms:=jsonb_set(ms,array[idx::text,'slots'],p_slots);ms:=jsonb_set(ms,array[idx::text,'responded'],'true');
   ms:=jsonb_set(ms,array[idx::text,'votedAt'],to_jsonb(clock_timestamp()));
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
 s:=jsonb_set(s,'{members}',ms);update meeting_rooms set data=s where id=p_room;
 select coalesce(jsonb_agg(value-'token'),'[]') into result from jsonb_array_elements(ms);
 return jsonb_build_object('members',result,'confirmed',s->'confirmed','me',(select value->>'id' from jsonb_array_elements(ms) where value->>'token'=p_token),'places',coalesce(s->'places','[]'),'regionVotes',coalesce(s->'regionVotes','{}'),'placeVotes',coalesce(s->'placeVotes','{}'),'confirmedPlace',s->'confirmedPlace','resetVersion',s->'resetVersion');
end;$$;
revoke all on function public.meeting_action(text,text,text,text,jsonb,text,boolean) from public,anon,authenticated;
grant execute on function public.meeting_action(text,text,text,text,jsonb,text,boolean) to service_role;
