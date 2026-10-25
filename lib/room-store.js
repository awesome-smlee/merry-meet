export async function roomStore(path, options = {}) {
  return fetch(process.env.SUPABASE_URL + '/rest/v1/meeting_rooms' + path, {
    ...options,
    headers: { apikey: process.env.SUPABASE_SERVICE_ROLE_KEY, Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`, 'Content-Type': 'application/json', ...options.headers },
    cache: 'no-store',
  });
}

export async function findRoom(code) {
  const response = await roomStore('?id=eq.' + encodeURIComponent(code) + '&select=id,data');
  if (!response.ok) throw Error('모임을 확인하지 못했어요. 잠시 후 다시 시도해 주세요.');
  return (await response.json())[0] || null;
}
