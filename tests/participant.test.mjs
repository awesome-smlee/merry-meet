import test from 'node:test';
import assert from 'node:assert/strict';
import {voteAgeLabel,availableDays,avatarSeed} from '../lib/meeting.mjs';

test('vote age handles hours, days, legacy records and clock skew',()=>{
 const now=Date.parse('2026-10-23T12:00:00+09:00');
 const ago=minutes=>new Date(now-minutes*60000).toISOString();
 assert.equal(voteAgeLabel(ago(0),now),'방금 투표');
 assert.equal(voteAgeLabel(ago(59),now),'59분 전에 투표');
 assert.equal(voteAgeLabel(ago(60),now),'1시간 전에 투표');
 assert.equal(voteAgeLabel(ago(1439),now),'23시간 전에 투표');
 assert.equal(voteAgeLabel(ago(1440),now),'1일 전에 투표');
 assert.equal(voteAgeLabel(ago(2880),now),'2일 전에 투표');
 assert.equal(voteAgeLabel(ago(-1),now),'방금 투표');
 assert.equal(voteAgeLabel(null,now),'투표 시각 기록 없음');
 assert.equal(voteAgeLabel('invalid',now),'투표 시각 기록 없음');
});

test('availability counts distinct weekdays and future dates, not time slots',()=>{
 assert.deepEqual(availableDays(['2026-10-24|14:00','2026-10-24|14:30','2026-10-31|14:00','2026-10-25|14:00','2026-10-01|14:00'],'2026-10-23'),{count:3,weekdays:['일','토']});
 assert.deepEqual(availableDays([],'2026-10-23'),{count:0,weekdays:[]});
 assert.equal(avatarSeed('member-a'),avatarSeed('member-a'));
 assert.notEqual(avatarSeed('member-a'),avatarSeed('member-b'));
});
