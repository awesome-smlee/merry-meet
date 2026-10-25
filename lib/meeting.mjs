export const TIMES=Array.from({length:30},(_,i)=>`${String(9+Math.floor(i/2)).padStart(2,'0')}:${i%2?'30':'00'}`);
export function koreaToday(now=new Date()){return new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Seoul',year:'numeric',month:'2-digit',day:'2-digit'}).format(now)}
export function validSlot(s,today=koreaToday()){if(typeof s!=='string'||!/^\d{4}-\d{2}-\d{2}\|\d{2}:\d{2}$/.test(s))return false;const[d,t]=s.split('|');const parsed=new Date(d+'T00:00:00Z');if(!Number.isFinite(parsed.getTime()))return false;return d>=today&&d<=`${Number(today.slice(0,4))+2}-12-31`&&parsed.toISOString().slice(0,10)===d&&TIMES.includes(t)}
export function rankSlots(members,today=koreaToday()){const counts=new Map();for(const m of members.filter(m=>m.responded))for(const slot of new Set(m.slots||[])){if(!validSlot(slot,today))continue;counts.set(slot,(counts.get(slot)||0)+1)}return [...counts].map(([slot,count])=>({slot,count})).sort((a,b)=>b.count-a.count||a.slot.localeCompare(b.slot))}
export function dateLabel(d){return new Intl.DateTimeFormat('ko-KR',{month:'long',day:'numeric',weekday:'short',timeZone:'Asia/Seoul'}).format(new Date(d+'T12:00:00+09:00'))}

export function voteAgeLabel(value,now=Date.now()){
 if(!value)return '응답 시각 정보 없음';
 const timestamp=Date.parse(value);if(!Number.isFinite(timestamp))return '응답 시각 정보 없음';
 const minutes=Math.floor(Math.max(0,now-timestamp)/60000);
 if(minutes<1)return '방금 응답';
 if(minutes<60)return minutes+'분 전에 응답';
 if(minutes<1440)return Math.floor(minutes/60)+'시간 전에 응답';
 return Math.floor(minutes/1440)+'일 전에 응답';
}
export function availableDays(slots,today){
 const dates=[...new Set(slots.filter(s=>validSlot(s,today)).map(s=>s.slice(0,10)))];
 const weekdays=[...new Set(dates.map(d=>new Date(d+'T12:00:00+09:00').getUTCDay()))].sort();
 return {count:dates.length,weekdays:weekdays.map(i=>['일','월','화','수','목','금','토'][i])};
}
export function avatarSeed(id){let hash=2166136261;for(const char of id)hash=Math.imul(hash^char.charCodeAt(0),16777619);return hash>>>0}
