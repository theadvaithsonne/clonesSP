interface AddressBlock {
  city: string | null;
  state: string | null;
  country: string | null;
  postalCode: string | null;
  formatted: string | null;
}
export interface PersonBlock {
  userId: string;
  name: string | null;
  email: string | null;
  phone: string | null;
  profilePicture: string | null;
  address: AddressBlock;
}
export interface CachedMember extends PersonBlock {
  role: string | null;
  guest: boolean;
  joinedAt: string | null;
  upline: PersonBlock | null;
}
export interface MembersApiResponse {
  success: boolean;
  office: { _id: string; name: string | null };
  totalMembers: number;
  members: CachedMember[];
}

const TTL = 60_000;

let _cache: MembersApiResponse | null = null;
let _at = 0;

export function getMembersCache(): MembersApiResponse | null {
  return _cache && Date.now() - _at < TTL ? _cache : null;
}

export function setMembersCache(data: MembersApiResponse) {
  _cache = data;
  _at    = Date.now();
}
