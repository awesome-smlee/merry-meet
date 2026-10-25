'use client';
import { useEffect, useRef, useState } from 'react';
import { ANIMAL_AVATARS, memberAvatar } from '../lib/avatars.mjs';
const names = ['고양이', '강아지', '곰', '토끼', '여우', '판다', '코알라', '돼지', '호랑이', '사자', '개구리', '펭귄'];

export default function ProfileEditor({ member, onSave, onClose }) {
  const dialog = useRef(null);
  const [nickname, setNickname] = useState(member.nickname);
  const [avatar, setAvatar] = useState(() => memberAvatar(member).split('/').pop().replace('.svg', ''));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const pending = useRef(false);
  useEffect(() => {
    const element = dialog.current;
    const overflow = document.body.style.overflow;
    element.showModal();
    document.body.style.overflow = 'hidden';
    return () => { element.close(); document.body.style.overflow = overflow; };
  }, []);
  async function submit(event) {
    event.preventDefault();
    if (pending.current) return;
    pending.current = true;
    setSaving(true);
    setError('');
    try { await onSave({ nickname: nickname.trim(), avatar }); onClose(); }
    catch (err) { setError(err.message); }
    finally { pending.current = false; setSaving(false); }
  }
  return <dialog ref={dialog} className="modal profile-modal" aria-labelledby="profile-title" onCancel={event => { event.preventDefault(); if (!pending.current) onClose(); }}>
    <form onSubmit={submit}>
      <h2 id="profile-title">내 정보 수정</h2>
     
      <img className="profile-preview" src={`/avatars/${avatar}.svg`} alt="선택한 프로필 이미지" width="80" height="80" />
      <fieldset disabled={saving} className="profile-avatar-picker">
        <legend>프로필 이미지</legend>
        <div className="profile-avatar-grid">{ANIMAL_AVATARS.map((item, index) => <button key={item} type="button" aria-label={names[index]} aria-pressed={avatar === item} onClick={() => setAvatar(item)}><img src={`/avatars/${item}.svg`} alt="" width="44" height="44" /></button>)}</div>
      </fieldset>
      <div className="profile-nickname-field">
      <label htmlFor="profile-nickname">닉네임</label>
      <input id="profile-nickname" autoFocus autoComplete="nickname" maxLength={12} required value={nickname} disabled={saving} onChange={event => setNickname(event.target.value)} aria-describedby={error ? 'profile-error' : undefined} />
      </div>
      {error && <p id="profile-error" className="form-error" role="alert">{error}</p>}
      <div className="profile-actions"><button type="button" className="outline-button" disabled={saving} onClick={onClose}>취소</button><button className="primary" disabled={saving || !nickname.trim()}>{saving ? '저장 중…' : '저장하기'}</button></div>
    </form>
  </dialog>;
}
