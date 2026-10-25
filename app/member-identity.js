import { memberAvatar } from '../lib/avatars.mjs';

export default function MemberIdentity({ member, children }) {
  return <span className="member-identity">
    <img className="member-avatar" src={memberAvatar(member)} width="28" height="28" alt="" decoding="async" />
    <span>{member.nickname}{children}</span>
  </span>;
}
