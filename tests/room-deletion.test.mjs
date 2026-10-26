import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { PGlite } from '@electric-sql/pglite';
import { POST } from '../app/api/rooms/route.js';

test('only new room owners can schedule deletion; data is retained for ten days and revoked codes cannot reopen', async t => {
  const db = new PGlite();
  const env = { ...process.env }, originalFetch = globalThis.fetch;
  t.after(async () => { process.env = env; globalThis.fetch = originalFetch; await db.close(); });
  Object.assign(process.env, { SUPABASE_URL: 'https://database.example', SUPABASE_SERVICE_ROLE_KEY: 'secret' });
  delete process.env.MEETING_ID;
  await db.exec('create role anon; create role authenticated; create role service_role;');
  await db.exec(await readFile(new URL('../supabase.sql', import.meta.url), 'utf8'));
  globalThis.fetch = async (input, options) => {
    const url = new URL(input);
    const body = options.body ? JSON.parse(options.body) : null;
    try {
      if (url.pathname.endsWith('/rpc/schedule_meeting_deletion')) {
        const result = await db.query('select schedule_meeting_deletion($1,$2) as value', [body.p_room, body.p_owner_token_hash]);
        return Response.json(result.rows[0].value);
      }
      if (options.method === 'POST') {
        await db.query('insert into meeting_rooms(id,data,owner_token_hash) values($1,$2,$3)', [body.id, body.data, body.owner_token_hash]);
        return new Response(null, { status: 201 });
      }
      const code = url.searchParams.get('id').slice(3);
      const result = url.pathname.endsWith('/deleted_meeting_codes')
        ? await db.query('select id from deleted_meeting_codes where id=$1', [code])
        : await db.query('select id,data,delete_after from meeting_rooms where id=$1', [code]);
      return Response.json(result.rows);
    } catch (error) { return Response.json({ message: error.message }, { status: 400 }); }
  };
  const call = async (body, origin = 'http://localhost') => {
    const response = await POST(new Request('http://localhost/api/rooms', { method: 'POST', headers: { origin }, body: JSON.stringify(body) }));
    return { status: response.status, ...(await response.json()) };
  };
  const room = await call({ action: 'create', name: '삭제 테스트' });
  assert.match(room.ownerToken, /^[a-f0-9]{64}$/);
  const stored = (await db.query('select * from meeting_rooms where id=$1', [room.room])).rows[0];
  assert.equal(stored.owner_token_hash, createHash('sha256').update(room.ownerToken).digest('hex'));
  assert.equal((await call({ action: 'lookup', code: room.room })).ownerToken, undefined);
  const request = { action: 'delete', code: room.room, ownerToken: room.ownerToken };
  assert.equal((await call(request, 'https://other.example')).status, 403);
  assert.equal((await call({ ...request, ownerToken: undefined })).status, 403);
  assert.equal((await call({ ...request, ownerToken: 'a'.repeat(64) })).status, 403);
  await db.query('insert into meeting_rooms(id) values($1)', ['legacy-room']);
  assert.equal((await call({ ...request, code: 'legacy-room' })).status, 403);
  const start = Date.now();
  const deleted = await call(request);
  assert.equal(deleted.status, 200);
  const delay = Date.parse(deleted.deleteAfter) - start;
  assert.ok(delay >= 10 * 86400000 && delay < 10 * 86400000 + 5000);
  assert.equal((await call(request)).deleteAfter, deleted.deleteAfter);
  assert.match((await call({ action: 'lookup', code: room.room })).error, /삭제/);
  await assert.rejects(db.query("select meeting_action($1,'join','participant','친구')", [room.room]), /삭제/);
  assert.equal((await db.query('select purge_deleted_meetings() as count')).rows[0].count, 0);
  assert.equal((await db.query('select data from meeting_rooms where id=$1', [room.room])).rows[0].data.name, '삭제 테스트');
  await db.query("update meeting_rooms set delete_after=clock_timestamp()-interval '1 second' where id=$1", [room.room]);
  assert.equal((await db.query('select purge_deleted_meetings() as count')).rows[0].count, 1);
  assert.equal((await db.query('select * from meeting_rooms where id=$1', [room.room])).rows.length, 0);
  assert.equal((await db.query("select * from meeting_rooms where id='legacy-room'")).rows.length, 1);
  assert.match((await call({ action: 'lookup', code: room.room })).error, /삭제/);
  await assert.rejects(db.query("select meeting_action($1,'join','participant','친구')", [room.room]), /삭제/);
  const permissions = await db.query("select has_function_privilege('anon','public.schedule_meeting_deletion(text,text)','execute') as deletion, has_function_privilege('authenticated','public.purge_deleted_meetings()','execute') as purge");
  assert.deepEqual(permissions.rows[0], { deletion: false, purge: false });
});
