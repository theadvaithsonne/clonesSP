// Country name / ISO-2 → flag emoji. Shared by the leaderboard list rows and
// the affiliate-details drawer (the public analytics API returns full country
// names like "India", so we map those to ISO codes before building the flag).

export const COUNTRY_NAME_TO_CODE: Record<string, string> = {
  afghanistan: "AF", albania: "AL", algeria: "DZ", argentina: "AR",
  armenia: "AM", australia: "AU", austria: "AT", azerbaijan: "AZ",
  bahamas: "BS", bahrain: "BH", bangladesh: "BD", barbados: "BB",
  belarus: "BY", belgium: "BE", belize: "BZ", bhutan: "BT", bolivia: "BO",
  "bosnia and herzegovina": "BA", botswana: "BW", brazil: "BR", brunei: "BN",
  bulgaria: "BG", cambodia: "KH", cameroon: "CM", canada: "CA", chile: "CL",
  china: "CN", colombia: "CO", "costa rica": "CR", croatia: "HR", cuba: "CU",
  cyprus: "CY", "czech republic": "CZ", czechia: "CZ", denmark: "DK",
  "dominican republic": "DO", ecuador: "EC", egypt: "EG", "el salvador": "SV",
  estonia: "EE", ethiopia: "ET", fiji: "FJ", finland: "FI", france: "FR",
  georgia: "GE", germany: "DE", ghana: "GH", greece: "GR", guatemala: "GT",
  guyana: "GY", haiti: "HT", honduras: "HN", "hong kong": "HK", hungary: "HU",
  iceland: "IS", india: "IN", indonesia: "ID", iran: "IR", iraq: "IQ",
  ireland: "IE", israel: "IL", italy: "IT", "ivory coast": "CI", jamaica: "JM",
  japan: "JP", jordan: "JO", kazakhstan: "KZ", kenya: "KE", kuwait: "KW",
  latvia: "LV", lebanon: "LB", libya: "LY", lithuania: "LT", luxembourg: "LU",
  malaysia: "MY", maldives: "MV", malta: "MT", mexico: "MX", moldova: "MD",
  mongolia: "MN", montenegro: "ME", morocco: "MA", mozambique: "MZ",
  myanmar: "MM", namibia: "NA", nepal: "NP", netherlands: "NL",
  "new zealand": "NZ", nicaragua: "NI", nigeria: "NG", "north macedonia": "MK",
  norway: "NO", oman: "OM", pakistan: "PK", palestine: "PS", panama: "PA",
  paraguay: "PY", peru: "PE", philippines: "PH", poland: "PL", portugal: "PT",
  qatar: "QA", romania: "RO", russia: "RU", rwanda: "RW", "saudi arabia": "SA",
  senegal: "SN", serbia: "RS", singapore: "SG", slovakia: "SK", slovenia: "SI",
  "south africa": "ZA", "south korea": "KR", spain: "ES", "sri lanka": "LK",
  sudan: "SD", sweden: "SE", switzerland: "CH", syria: "SY", taiwan: "TW",
  tanzania: "TZ", thailand: "TH", "trinidad and tobago": "TT", tunisia: "TN",
  turkey: "TR", turkmenistan: "TM", uganda: "UG", ukraine: "UA",
  "united arab emirates": "AE", "united kingdom": "GB", "united states": "US",
  uruguay: "UY", uzbekistan: "UZ", venezuela: "VE", vietnam: "VN", yemen: "YE",
  zambia: "ZM", zimbabwe: "ZW",
};

export function getCountryFlag(nameOrCode: string | null): string {
  if (!nameOrCode) return "🌍";
  const toFlag = (iso: string) =>
    String.fromCodePoint(
      ...[...iso.toUpperCase()].map((c) => 0x1f1e6 + c.charCodeAt(0) - 65),
    );
  if (nameOrCode.length === 2) return toFlag(nameOrCode);
  const iso = COUNTRY_NAME_TO_CODE[nameOrCode.toLowerCase()];
  return iso ? toFlag(iso) : "🌍";
}
