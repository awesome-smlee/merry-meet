import {randomBytes,createHash} from 'node:crypto';
import {koreaToday,validSlot} from '../../../lib/meeting.mjs';
import {PLACE_ACTIONS,validatePlacePayload} from '../../../lib/places.mjs';
import {parseRoomCode} from '../../../lib/rooms.mjs';
import {findRoom} from '../../../lib/room-store.js';
import {ANIMAL_AVATARS} from '../../../lib/avatars.mjs';
import {EVENT_ACTIONS,validateEventPayload} from '../../../lib/events.mjs';
import {validateDeadline,validateReschedule} from '../../../lib/meeting-updates.mjs';
export const dynamic='force-dynamic';
const hash=s=>createHash('sha256').update(s).digest('hex');
export async function POST(req){try{
 if(!process.env.SUPABASE_URL||!process.env.SUPABASE_SERVICE_ROLE_KEY)return Response.json({error:'DB 연결 설정이 필요합니다.'},{status:503});
 if(req.headers.get('origin')&&req.headers.get('origin')!==new URL(req.url).origin)return Response.json({error:'허용되지 않은 요청입니다.'},{status:403});
 const text=await req.text();if(text.length>100000)return Response.json({error:'요청이 너무 큽니다.'},{status:413});
 const b=JSON.parse(text);if(!parseRoomCode(b.room)||(b.room!==process.env.MEETING_ID&&!(await findRoom(b.room))))return Response.json({error:'유효한 모임 코드로 접속해 주세요.'},{status:403});
 const action=b.action;if(!['read','join','profile','save','confirm','unconfirm','reschedule','reset','deadline-set',...PLACE_ACTIONS,...EVENT_ACTIONS].includes(action))throw Error('잘못된 요청입니다.');
 if(action==='profile'){
  if(typeof b.nickname!=='string'||b.nickname.trim().length<1||b.nickname.trim().length>12)throw Error('닉네임은 1~12자로 입력해 주세요.');
  if(!ANIMAL_AVATARS.includes(b.avatar))throw Error('프로필 이미지를 다시 선택해 주세요.');
  b.slots={avatar:b.avatar};
 }
 if(PLACE_ACTIONS.includes(action))b.slots=validatePlacePayload(action,b.payload);
 if(EVENT_ACTIONS.includes(action))b.slots=validateEventPayload(action,b.payload);
 if(action==='reschedule'){const payload=validateReschedule(b.payload);b.slot=payload.slot;b.slots={expectedConfirmed:payload.expectedConfirmed};}
 if(action==='deadline-set')b.slots=validateDeadline(b.payload);
 let token=b.token;
 if(action==='join'){if(typeof b.nickname!=='string'||b.nickname.trim().length<1||b.nickname.trim().length>12)throw Error('닉네임은 1~12자로 입력해 주세요.');token=randomBytes(32).toString('hex');}
 else if(typeof token!=='string'||!/^[a-f0-9]{64}$/.test(token))return Response.json({error:'다시 입장해 주세요.'},{status:401});
 if(action==='save'&&(!Array.isArray(b.slots)||b.slots.length>2000||!b.slots.every(s=>validSlot(s))))throw Error('가능한 날짜와 시간을 다시 확인해 주세요.');
 if(action==='confirm'&&!validSlot(b.slot))throw Error('확정할 날짜와 시간을 확인해 주세요.');
 const response=await fetch(process.env.SUPABASE_URL+'/rest/v1/rpc/meeting_action',{method:'POST',headers:{apikey:process.env.SUPABASE_SERVICE_ROLE_KEY,Authorization:`Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,'Content-Type':'application/json'},body:JSON.stringify({p_room:b.room,p_action:action,p_token:hash(token),p_nickname:b.nickname?.trim()||null,p_slots:b.slots||[],p_slot:b.slot||null,p_admin:['confirm','unconfirm'].includes(action)}),cache:'no-store'});
 if(!response.ok){const err=await response.json();const closed=err.message==='응답이 마감되어 시간을 수정할 수 없어요.';const deleted=err.message==='삭제 요청된 모임이에요.';return Response.json({error:err.message||'저장하지 못했습니다.',...(closed?{code:'RESPONSE_CLOSED'}:{}),...(deleted?{code:'ROOM_DELETED'}:{})},{status:deleted?410:closed?409:400});}
 return Response.json({state:await response.json(),...(action==='join'?{token}:{ }),today:koreaToday()},{headers:{'Cache-Control':'no-store'}});
 }catch(e){const deleted=['삭제 요청된 모임이에요.','삭제된 모임이에요.'].includes(e.message);return Response.json({error:e instanceof SyntaxError?'잘못된 요청입니다.':e.message||'요청을 처리하지 못했습니다.',...(deleted?{code:'ROOM_DELETED'}:{})},{status:deleted?410:400})}}
