-- Run after supabase.sql in the Supabase SQL Editor.
create extension if not exists pg_cron;
-- Named jobs are updated on re-run. Expired data is removed within one minute.
select cron.schedule('purge-deleted-meetings', '* * * * *', 'select public.purge_deleted_meetings()');
