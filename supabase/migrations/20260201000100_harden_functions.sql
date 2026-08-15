-- Hardening for the two trigger functions, flagged by the Supabase security
-- linter once the schema was applied to a real project.
--
-- 1. `touch_updated_at` had a mutable search_path. It only calls now(), so the
--    risk is theoretical, but a pinned search_path costs nothing.
-- 2. `handle_new_user` is SECURITY DEFINER and lives in `public`, which PostgREST
--    exposes — meaning any signed-in (or anonymous) caller could invoke it over
--    /rest/v1/rpc. It is only ever meant to run from the auth.users trigger.
--    PostgreSQL checks EXECUTE at CREATE TRIGGER time, not at fire time, so
--    revoking it leaves the trigger working while closing the RPC route.

create or replace function public.touch_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

revoke all on function public.handle_new_user() from public;
revoke all on function public.handle_new_user() from anon;
revoke all on function public.handle_new_user() from authenticated;

revoke all on function public.touch_updated_at() from public;
revoke all on function public.touch_updated_at() from anon;
revoke all on function public.touch_updated_at() from authenticated;
