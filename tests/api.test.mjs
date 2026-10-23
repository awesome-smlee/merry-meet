import test from 'node:test';
import assert from 'node:assert/strict';
import {POST} from '../app/api/meeting/route.js';
import {koreaToday} from '../lib/meeting.mjs';

test('confirmation uses the participant token without an admin password', async t => {
 const originalEnv={...process.env}, originalFetch=globalThis.fetch;
 t.after(()=>{process.env=originalEnv;globalThis.fetch=originalFetch});
 Object.assign(process.env,{SUPABASE_URL:'https://database.example',SUPABASE_SERVICE_ROLE_KEY:'test-service-key',MEETING_ID:'test-room'});
 delete process.env.ADMIN_PASSWORD;
 const calls=[];
 globalThis.fetch=async(url,options)=>{
  calls.push(JSON.parse(options.body));
  return Response.json({members:[],confirmed:null,me:'member-1'});
 };
 const request=(payload,origin='http://localhost')=>new Request('http://localhost/api/meeting',{
  method:'POST',headers:{origin,'Content-Type':'application/json'},body:JSON.stringify({room:'test-room',...payload})
 });
 const token='a'.repeat(64),slot=koreaToday()+'|18:00';
 assert.equal((await POST(request({action:'confirm',token,slot}))).status,200);
 assert.equal(calls[0].p_action,'confirm');
 assert.notEqual(calls[0].p_token,token);
 assert.equal(calls[0].p_token.length,64);
 assert.equal((await POST(request({action:'unconfirm',token}))).status,200);
 assert.equal((await POST(request({action:'confirm',slot}))).status,401);
 assert.equal((await POST(request({action:'confirm',token,slot},'https://other.example'))).status,403);
 assert.equal((await POST(request({action:'confirm',token,slot:'invalid'}))).status,400);
 assert.equal(calls.length,2);
});
