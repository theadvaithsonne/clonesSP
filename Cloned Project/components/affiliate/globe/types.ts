// Affiliate Globe View Types

export interface AffiliateLocation {
  city?: string;
  state?: string;
  country?: string;
  latitude?: number;
  longitude?: number;
}

export interface AffiliateOffice {
  orgId: string;
  name: string;
  icon: string;
  slug: string;
  role: "founder" | "stakeholder";
  // Guest member of this org. role stays "stakeholder" because that's the only
  // non-founder enum value — guest is a separate flag that gates UI access and
  // changes the displayed label from "Stakeholder" to "Guest".
  guest?: boolean;
  joinedAt: string;
}

export interface AffiliateUserPurchases {
  unilevelPlus: boolean;
  basicPlan: boolean;
  proPlan: boolean;
}

export interface AffiliateUser {
  id: string;
  name: string;
  email: string;
  phone?: string;
  avatar: string;
  affiliateId?: string;
  joinedAt: string;
  status: "active" | "inactive";
  userType: "founder" | "stakeholder";
  // Root-level guest flag (matches User.guest in the backend). Displayed as
  // "Guest" instead of "Stakeholder" in the profile header.
  guest?: boolean;
  isPaidFounder?: boolean;
  purchases?: AffiliateUserPurchases;
  directReferrals: number;
  totalReferrals?: number;
  officesJoined?: number;
  offices?: AffiliateOffice[];
  hasChildren: boolean;
  location: AffiliateLocation;
  referrer?: {
    id: string;
    name: string;
    avatar: string;
    email?: string;
  };
}

export interface GlobeMarkerData {
  id: string;
  name: string;
  avatar: string;
  latitude: number;
  longitude: number;
  directReferrals: number;
  hasChildren: boolean;
  userType: string;
  status: string;
  isFocused?: boolean;
  purchases?: AffiliateUserPurchases;
}

export interface AffiliateGlobeState {
  focusedUser: AffiliateUser | null;
  directChildren: AffiliateUser[];
  navigationHistory: AffiliateUser[];
  isLoading: boolean;
  error: string | null;
}

// API Response types
export interface DirectChildrenResponse {
  success: boolean;
  userId: string;
  children: AffiliateUser[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasMore: boolean;
  };
}

export interface UserInfoResponse {
  success: boolean;
  user: AffiliateUser;
}

export interface SearchDownlineByEmailResponse {
  success: boolean;
  found: boolean;
  isSelf?: boolean;
  message?: string;
  navigationPath?: AffiliateUser[];
  targetUser?: AffiliateUser;
}

// Country coordinates for fallback positioning
export const COUNTRY_COORDINATES: Record<string, { lat: number; lng: number }> = {
  "Afghanistan": { lat: 33.94, lng: 67.71 },
  "Albania": { lat: 41.15, lng: 20.17 },
  "Algeria": { lat: 28.03, lng: 1.66 },
  "Argentina": { lat: -38.42, lng: -63.62 },
  "Australia": { lat: -25.27, lng: 133.78 },
  "Austria": { lat: 47.52, lng: 14.55 },
  "Bangladesh": { lat: 23.68, lng: 90.36 },
  "Belgium": { lat: 50.50, lng: 4.47 },
  "Brazil": { lat: -14.24, lng: -51.93 },
  "Canada": { lat: 56.13, lng: -106.35 },
  "Chile": { lat: -35.68, lng: -71.54 },
  "China": { lat: 35.86, lng: 104.20 },
  "Colombia": { lat: 4.57, lng: -74.30 },
  "Czech Republic": { lat: 49.82, lng: 15.47 },
  "Denmark": { lat: 56.26, lng: 9.50 },
  "Egypt": { lat: 26.82, lng: 30.80 },
  "Finland": { lat: 61.92, lng: 25.75 },
  "France": { lat: 46.23, lng: 2.21 },
  "Germany": { lat: 51.17, lng: 10.45 },
  "Greece": { lat: 39.07, lng: 21.82 },
  "Hong Kong": { lat: 22.40, lng: 114.11 },
  "Hungary": { lat: 47.16, lng: 19.50 },
  "India": { lat: 20.59, lng: 78.96 },
  "Indonesia": { lat: -0.79, lng: 113.92 },
  "Iran": { lat: 32.43, lng: 53.69 },
  "Iraq": { lat: 33.22, lng: 43.68 },
  "Ireland": { lat: 53.14, lng: -7.69 },
  "Israel": { lat: 31.05, lng: 34.85 },
  "Italy": { lat: 41.87, lng: 12.57 },
  "Japan": { lat: 36.20, lng: 138.25 },
  "Kenya": { lat: -0.02, lng: 37.91 },
  "Malaysia": { lat: 4.21, lng: 101.98 },
  "Mexico": { lat: 23.63, lng: -102.55 },
  "Morocco": { lat: 31.79, lng: -7.09 },
  "Nepal": { lat: 28.39, lng: 84.12 },
  "Netherlands": { lat: 52.13, lng: 5.29 },
  "New Zealand": { lat: -40.90, lng: 174.89 },
  "Nigeria": { lat: 9.08, lng: 8.68 },
  "Norway": { lat: 60.47, lng: 8.47 },
  "Pakistan": { lat: 30.38, lng: 69.35 },
  "Peru": { lat: -9.19, lng: -75.02 },
  "Philippines": { lat: 12.88, lng: 121.77 },
  "Poland": { lat: 51.92, lng: 19.15 },
  "Portugal": { lat: 39.40, lng: -8.22 },
  "Romania": { lat: 45.94, lng: 24.97 },
  "Russia": { lat: 61.52, lng: 105.32 },
  "Saudi Arabia": { lat: 23.89, lng: 45.08 },
  "Singapore": { lat: 1.35, lng: 103.82 },
  "South Africa": { lat: -30.56, lng: 22.94 },
  "South Korea": { lat: 35.91, lng: 127.77 },
  "Spain": { lat: 40.46, lng: -3.75 },
  "Sri Lanka": { lat: 7.87, lng: 80.77 },
  "Sweden": { lat: 60.13, lng: 18.64 },
  "Switzerland": { lat: 46.82, lng: 8.23 },
  "Taiwan": { lat: 23.70, lng: 121.00 },
  "Thailand": { lat: 15.87, lng: 100.99 },
  "Turkey": { lat: 38.96, lng: 35.24 },
  "Ukraine": { lat: 48.38, lng: 31.17 },
  "United Arab Emirates": { lat: 23.42, lng: 53.85 },
  "United Kingdom": { lat: 55.38, lng: -3.44 },
  "United States": { lat: 37.09, lng: -95.71 },
  "Vietnam": { lat: 14.06, lng: 108.28 },
};

// Helper function to add jitter to coordinates to prevent overlap
function addJitter(coord: number, range: number = 3): number {
  return coord + (Math.random() - 0.5) * range;
}

// Assign fallback coordinates for users without location data
export function assignFallbackCoordinates(user: AffiliateUser): AffiliateUser {
  // If user already has valid coordinates, return as-is
  if (
    user.location.latitude !== undefined &&
    user.location.latitude !== null &&
    user.location.longitude !== undefined &&
    user.location.longitude !== null &&
    !isNaN(user.location.latitude) &&
    !isNaN(user.location.longitude)
  ) {
    return user;
  }

  // Try to use country-based default
  const country = user.location.country || "";
  const defaultCoords = COUNTRY_COORDINATES[country];

  if (defaultCoords) {
    return {
      ...user,
      location: {
        ...user.location,
        latitude: addJitter(defaultCoords.lat),
        longitude: addJitter(defaultCoords.lng),
      },
    };
  }

  // Fallback to random position near equator
  return {
    ...user,
    location: {
      ...user.location,
      latitude: addJitter(0, 60),
      longitude: addJitter(0, 180),
    },
  };
}

// Check if coordinates are valid
export function isValidCoordinate(lat?: number, lng?: number): boolean {
  if (lat === undefined || lng === undefined) return false;
  if (isNaN(lat) || isNaN(lng)) return false;
  if (lat < -90 || lat > 90) return false;
  if (lng < -180 || lng > 180) return false;
  return true;
}

// Get location display string
export function getLocationString(location: AffiliateLocation): string {
  const parts = [location.city, location.state, location.country].filter(Boolean);
  return parts.join(", ") || "Unknown Location";
}
