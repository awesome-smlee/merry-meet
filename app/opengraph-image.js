import { ImageResponse } from 'next/og';

export const alt = 'Meet Soon — 함께 시간을 고르고 만날 장소를 정해요.';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

export default function OpenGraphImage() {
  return new ImageResponse(
    <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', padding: 80, background: '#eaf2ff', color: '#173461', fontFamily: 'sans-serif' }}>
      <div style={{ display: 'flex', flexDirection: 'column', width: 660 }}>
        <div style={{ display: 'flex', fontSize: 22, letterSpacing: 5, color: '#3674db', marginBottom: 26 }}>GOOD TIMES, TOGETHER</div>
        <div style={{ display: 'flex', fontSize: 96, fontWeight: 700, letterSpacing: -5 }}>Meet Soon</div>
        <div style={{ display: 'flex', fontSize: 30, color: '#567197', marginTop: 24 }}>Pick a time. Find a place.</div>
        <div style={{ display: 'flex', fontSize: 30, color: '#567197', marginTop: 8 }}>See you soon.</div>
        <div style={{ display: 'flex', marginTop: 44, background: '#3674db', color: 'white', borderRadius: 40, padding: '16px 28px', fontSize: 22, alignSelf: 'flex-start' }}>You’re invited!</div>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', width: 330, height: 330, background: 'white', borderRadius: 36, overflow: 'hidden', boxShadow: '0 18px 45px #c9d9f2', transform: 'rotate(6deg)' }}>
        <div style={{ display: 'flex', background: '#3674db', height: 80, alignItems: 'center', justifyContent: 'center', color: 'white', fontSize: 24, letterSpacing: 4 }}>LET’S MEET</div>
        <div style={{ display: 'flex', flexWrap: 'wrap', padding: 25, gap: 16 }}>
          {Array.from({ length: 9 }, (_, index) => (
            <div key={index} style={{ display: 'flex', width: 76, height: 52, borderRadius: 14, background: index === 4 ? '#d8f5e9' : '#edf3fc', alignItems: 'center', justifyContent: 'center' }}>
              {index === 4 && <svg width="36" height="36" viewBox="0 0 36 36"><path d="M8 18l7 7L28 11" fill="none" stroke="#209b76" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" /></svg>}
            </div>
          ))}
        </div>
      </div>
    </div>,
    size,
  );
}
