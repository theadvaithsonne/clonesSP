// Globe View Types

// HQ Organization founder
export interface HQFounder {
  _id: string;
  name: string;
  email: string;
  country: string;
  state: string;
  city: string;
  latitude?: number;
  longitude?: number;
  joinedAt: string;
  profilePicture?: string;
}

// HQ Organization
export interface HQOrganization {
  _id: string;
  name: string;
  slug?: string;
  size?: string;
  location?: string;
  city?: string;
  state?: string;
  country?: string;
  latitude?: number;
  longitude?: number;
  description?: string;
  headingText?: string;
  subHeadingText?: string;
  icon?: string;
  coverPhoto?: string;
  promoVideoLink?: string;
  founders: HQFounder[];
  stakeholders?: number;
  communityMembers?: number;
  createdAt: string;
  updatedAt: string;
}

// Founder's organization association
export interface FounderOrganization {
  organization: {
    _id: string;
    name: string;
    size?: string;
    location?: string;
    icon?: string;
    description?: string;
    city?: string;
    country?: string;
    state?: string;
  };
  joinedAt: string;
}

// New Founder
export interface NewFounder {
  _id: string;
  name: string;
  email: string;
  country?: string;
  state?: string;
  city?: string;
  latitude?: number;
  longitude?: number;
  profilePicture?: string;
  organizations: FounderOrganization[];
}

// Stakeholder's organization association
export interface StakeholderOrganization {
  organization: {
    _id: string;
    name: string;
    size?: string;
    location?: string;
    icon?: string;
    description?: string;
    city?: string;
    country?: string;
    state?: string;
  };
  joinedAt: string;
}

// Stakeholder
export interface Stakeholder {
  _id: string;
  name: string;
  email: string;
  country?: string;
  state?: string;
  city?: string;
  latitude?: number;
  longitude?: number;
  profilePicture?: string;
  organizations: StakeholderOrganization[];
}

// Tab types
export type TabType = "hqs" | "founders" | "stakeholders";

// Union type for all entity types
export type EntityType = HQOrganization | NewFounder | Stakeholder;

// API Response types
export interface HQOrganizationsResponse {
  success: boolean;
  count: number;
  organizations: HQOrganization[];
}

export interface FoundersResponse {
  success: boolean;
  count: number;
  founders: NewFounder[];
}

export interface StakeholdersResponse {
  success: boolean;
  count: number;
  stakeholders: Stakeholder[];
}

// Ticker message type
export interface TickerMessage {
  id: string;
  message: string;
  icon?: string;
  name: string;
  companyName: string;
  locationText: string;
  latitude?: number;
  longitude?: number;
}

// Country group for sidebar
export interface CountryGroup {
  country: string;
  countryCode: string;
  items: EntityType[];
}

// Country name to code mapping
export const COUNTRY_CODE_MAP: Record<string, string> = {
  "Afghanistan": "AF",
  "Albania": "AL",
  "Algeria": "DZ",
  "Andorra": "AD",
  "Angola": "AO",
  "Argentina": "AR",
  "Armenia": "AM",
  "Australia": "AU",
  "Austria": "AT",
  "Azerbaijan": "AZ",
  "Bahamas": "BS",
  "Bahrain": "BH",
  "Bangladesh": "BD",
  "Barbados": "BB",
  "Belarus": "BY",
  "Belgium": "BE",
  "Belize": "BZ",
  "Benin": "BJ",
  "Bhutan": "BT",
  "Bolivia": "BO",
  "Bosnia and Herzegovina": "BA",
  "Botswana": "BW",
  "Brazil": "BR",
  "Brunei": "BN",
  "Bulgaria": "BG",
  "Burkina Faso": "BF",
  "Burundi": "BI",
  "Cambodia": "KH",
  "Cameroon": "CM",
  "Canada": "CA",
  "Cape Verde": "CV",
  "Central African Republic": "CF",
  "Chad": "TD",
  "Chile": "CL",
  "China": "CN",
  "Colombia": "CO",
  "Comoros": "KM",
  "Congo": "CG",
  "Costa Rica": "CR",
  "Croatia": "HR",
  "Cuba": "CU",
  "Cyprus": "CY",
  "Czech Republic": "CZ",
  "Denmark": "DK",
  "Djibouti": "DJ",
  "Dominica": "DM",
  "Dominican Republic": "DO",
  "Ecuador": "EC",
  "Egypt": "EG",
  "El Salvador": "SV",
  "Equatorial Guinea": "GQ",
  "Eritrea": "ER",
  "Estonia": "EE",
  "Ethiopia": "ET",
  "Fiji": "FJ",
  "Finland": "FI",
  "France": "FR",
  "Gabon": "GA",
  "Gambia": "GM",
  "Georgia": "GE",
  "Germany": "DE",
  "Ghana": "GH",
  "Greece": "GR",
  "Grenada": "GD",
  "Guatemala": "GT",
  "Guinea": "GN",
  "Guinea-Bissau": "GW",
  "Guyana": "GY",
  "Haiti": "HT",
  "Honduras": "HN",
  "Hungary": "HU",
  "Iceland": "IS",
  "India": "IN",
  "Indonesia": "ID",
  "Iran": "IR",
  "Iraq": "IQ",
  "Ireland": "IE",
  "Israel": "IL",
  "Italy": "IT",
  "Jamaica": "JM",
  "Japan": "JP",
  "Jordan": "JO",
  "Kazakhstan": "KZ",
  "Kenya": "KE",
  "Kiribati": "KI",
  "Kuwait": "KW",
  "Kyrgyzstan": "KG",
  "Laos": "LA",
  "Latvia": "LV",
  "Lebanon": "LB",
  "Lesotho": "LS",
  "Liberia": "LR",
  "Libya": "LY",
  "Liechtenstein": "LI",
  "Lithuania": "LT",
  "Luxembourg": "LU",
  "Macedonia": "MK",
  "Madagascar": "MG",
  "Malawi": "MW",
  "Malaysia": "MY",
  "Maldives": "MV",
  "Mali": "ML",
  "Malta": "MT",
  "Marshall Islands": "MH",
  "Mauritania": "MR",
  "Mauritius": "MU",
  "Mexico": "MX",
  "Micronesia": "FM",
  "Moldova": "MD",
  "Monaco": "MC",
  "Mongolia": "MN",
  "Montenegro": "ME",
  "Morocco": "MA",
  "Mozambique": "MZ",
  "Myanmar": "MM",
  "Namibia": "NA",
  "Nauru": "NR",
  "Nepal": "NP",
  "Netherlands": "NL",
  "New Zealand": "NZ",
  "Nicaragua": "NI",
  "Niger": "NE",
  "Nigeria": "NG",
  "North Korea": "KP",
  "Norway": "NO",
  "Oman": "OM",
  "Pakistan": "PK",
  "Palau": "PW",
  "Palestine": "PS",
  "Panama": "PA",
  "Papua New Guinea": "PG",
  "Paraguay": "PY",
  "Peru": "PE",
  "Philippines": "PH",
  "Poland": "PL",
  "Portugal": "PT",
  "Qatar": "QA",
  "Romania": "RO",
  "Russia": "RU",
  "Rwanda": "RW",
  "Saint Kitts and Nevis": "KN",
  "Saint Lucia": "LC",
  "Saint Vincent and the Grenadines": "VC",
  "Samoa": "WS",
  "San Marino": "SM",
  "Sao Tome and Principe": "ST",
  "Saudi Arabia": "SA",
  "Senegal": "SN",
  "Serbia": "RS",
  "Seychelles": "SC",
  "Sierra Leone": "SL",
  "Singapore": "SG",
  "Slovakia": "SK",
  "Slovenia": "SI",
  "Solomon Islands": "SB",
  "Somalia": "SO",
  "South Africa": "ZA",
  "South Korea": "KR",
  "South Sudan": "SS",
  "Spain": "ES",
  "Sri Lanka": "LK",
  "Sudan": "SD",
  "Suriname": "SR",
  "Swaziland": "SZ",
  "Sweden": "SE",
  "Switzerland": "CH",
  "Syria": "SY",
  "Taiwan": "TW",
  "Tajikistan": "TJ",
  "Tanzania": "TZ",
  "Thailand": "TH",
  "Timor-Leste": "TL",
  "Togo": "TG",
  "Tonga": "TO",
  "Trinidad and Tobago": "TT",
  "Tunisia": "TN",
  "Turkey": "TR",
  "Turkmenistan": "TM",
  "Tuvalu": "TV",
  "Uganda": "UG",
  "Ukraine": "UA",
  "United Arab Emirates": "AE",
  "United Kingdom": "GB",
  "United States": "US",
  "Uruguay": "UY",
  "Uzbekistan": "UZ",
  "Vanuatu": "VU",
  "Vatican City": "VA",
  "Venezuela": "VE",
  "Vietnam": "VN",
  "Yemen": "YE",
  "Zambia": "ZM",
  "Zimbabwe": "ZW",
};

// Helper function to get country code
export function getCountryCode(countryName: string): string {
  return COUNTRY_CODE_MAP[countryName] || "XX";
}

// Helper function to validate coordinates
export function isValidCoordinate(lat?: number, lng?: number): boolean {
  if (lat === undefined || lng === undefined) return false;
  if (isNaN(lat) || isNaN(lng)) return false;
  if (lat < -90 || lat > 90) return false;
  if (lng < -180 || lng > 180) return false;
  return true;
}

// Helper to get entity name
export function getEntityName(entity: EntityType): string {
  return entity.name;
}

// Helper to get entity location string
export function getEntityLocation(entity: EntityType): string {
  const parts = [entity.city, entity.state, entity.country].filter(Boolean);
  return parts.join(", ") || "Unknown Location";
}

// Helper to check if entity is HQ Organization
export function isHQOrganization(entity: EntityType): entity is HQOrganization {
  return "founders" in entity;
}

// Helper to check if entity is Founder
export function isFounder(entity: EntityType): entity is NewFounder {
  return "organizations" in entity && !("stakeholders" in entity) && "email" in entity;
}

// Helper to check if entity is Stakeholder
export function isStakeholder(entity: EntityType): entity is Stakeholder {
  return "organizations" in entity && "email" in entity && !("founders" in entity);
}
