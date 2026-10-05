// FacebookLeadsIntegration.js
import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import Cookies from 'js-cookie';
// import { SearchableSelect } from '@components/searchableSelect/searchable-select';
import { buildExternalUrl } from '@/lib/api-config';
import { authenticatedFetch } from '@/utils/api';
import { DEALS_CRM_STATS_REFRESH_EVENT, dispatchDealsLeadsRefresh } from '@/lib/deals-events';
import { toast } from 'sonner';
import { jwtDecode } from 'jwt-decode';
import { addLeadNotification } from '@/utils/leadNotifications';
import { ArrowLeft, Search, ChevronDown, Download, CheckCircle2, Check, Loader2, RefreshCw } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useTheme } from 'next-themes';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const FacebookLeadsIntegration = ({ activeTab = "facebook-leads", setActiveTab }) => {
  const router = useRouter();
  const { theme, resolvedTheme: nextResolvedTheme } = useTheme();
  const isInlineDealsMode =
    typeof window !== "undefined" && Boolean(window.__garageDealsInline);
  const resolvedTheme =
    theme === "color"
      ? "color"
      : theme === "dark" || nextResolvedTheme === "dark" || isInlineDealsMode
        ? "dark"
        : "light";
  const mutedTextColor =
    resolvedTheme === "color"
      ? "rgba(0,255,255,0.6)"
      : resolvedTheme === "dark"
        ? "#9ca3af"
        : "#6b7280";

  // Storage keys
  const STORAGE_KEY = 'facebook_leads_integration';
  const LEADS_CACHE_STORAGE_KEY = 'facebook_leads_integration_leads_cache';

  const buildLeadsCacheKey = (pageId, leadFormsList) => {
    const formIds = (leadFormsList || []).map((f) => f.id).sort().join('|');
    return `${pageId || ''}::${formIds}`;
  };

  const saveLeadsToSessionCache = (payload) => {
    try {
      sessionStorage.setItem(LEADS_CACHE_STORAGE_KEY, JSON.stringify(payload));
    } catch (error) {
      console.warn('Could not cache Facebook leads in session:', error);
    }
  };

  const loadLeadsFromSessionCache = () => {
    try {
      const raw = sessionStorage.getItem(LEADS_CACHE_STORAGE_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch (error) {
      console.error('Error loading Facebook leads cache:', error);
      return null;
    }
  };

  const clearLeadsSessionCache = () => {
    try {
      sessionStorage.removeItem(LEADS_CACHE_STORAGE_KEY);
    } catch (error) {
      console.error('Error clearing Facebook leads cache:', error);
    }
  };

  const getInitialLeadsFromCache = () => {
    if (typeof window === 'undefined') {
      return { leads: [], totalLeadsCount: 0, hydrated: false };
    }
    const stored = (() => {
      try {
        const raw = localStorage.getItem(STORAGE_KEY);
        return raw ? JSON.parse(raw) : null;
      } catch {
        return null;
      }
    })();
    const cache = loadLeadsFromSessionCache();
    if (!stored?.selectedPage?.id || !cache?.leads?.length) {
      return { leads: [], totalLeadsCount: 0, hydrated: false };
    }
    const cacheKey = buildLeadsCacheKey(stored.selectedPage.id, stored.leadForms);
    if (cache.cacheKey !== cacheKey) {
      return { leads: [], totalLeadsCount: 0, hydrated: false };
    }
    return {
      leads: cache.leads,
      totalLeadsCount: cache.totalLeadsCount ?? cache.leads.length,
      hydrated: true,
    };
  };

  const persistLeadsCache = (page, leadFormsList, leadsList) => {
    if (!page?.id || !leadFormsList?.length || !leadsList?.length) return;
    saveLeadsToSessionCache({
      cacheKey: buildLeadsCacheKey(page.id, leadFormsList),
      pageId: page.id,
      leads: leadsList,
      totalLeadsCount: leadsList.length,
      fetchedAt: Date.now(),
    });
  };

  // Helper functions for localStorage (cache)
  const saveToStorage = (data) => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    } catch (error) {
      console.error('Error saving to localStorage:', error);
    }
  };

  const loadFromStorage = () => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      return stored ? JSON.parse(stored) : null;
    } catch (error) {
      console.error('Error loading from localStorage:', error);
      return null;
    }
  };

  const clearStorage = () => {
    try {
      localStorage.removeItem(STORAGE_KEY);
      clearLeadsSessionCache();
    } catch (error) {
      console.error('Error clearing localStorage:', error);
    }
  };

  // Backend cookie may truncate pages/forms — never let that wipe richer localStorage cache
  const mergeFacebookSession = (local, remote) => {
    if (!remote) return local || null;
    if (!local) return remote;
    return {
      ...local,
      ...remote,
      accessToken: remote.accessToken || local.accessToken,
      tokenExpiresAt: remote.tokenExpiresAt || local.tokenExpiresAt,
      tokenIsLongLived:
        typeof remote.tokenIsLongLived === 'boolean'
          ? remote.tokenIsLongLived
          : local.tokenIsLongLived,
      pages: remote.pages?.length ? remote.pages : local.pages,
      leadForms: remote.leadForms?.length ? remote.leadForms : local.leadForms,
      selectedPage: remote.selectedPage || local.selectedPage,
      userInfo: remote.userInfo || local.userInfo,
      selectedForm: remote.selectedForm || local.selectedForm,
    };
  };

  const pickPageWithFreshToken = (pagesList, preferredPage) => {
    if (!pagesList?.length) return preferredPage || null;
    if (preferredPage?.id) {
      return pagesList.find((p) => p.id === preferredPage.id) || preferredPage;
    }
    return pagesList[0];
  };

  const syncTokenHealthFromStorage = () => {
    const stored = loadFromStorage();
    if (!stored?.accessToken) {
      setTokenHealth({ expiresAt: null, isLongLived: null });
      return;
    }
    const expiresAt = stored.tokenExpiresAt || null;
    let isLongLived = stored.tokenIsLongLived;
    if (typeof isLongLived !== 'boolean' && expiresAt) {
      isLongLived = expiresAt - Date.now() > 24 * 60 * 60 * 1000;
    }
    setTokenHealth({ expiresAt, isLongLived: typeof isLongLived === 'boolean' ? isLongLived : null });
  };

  // Custom fetch for Facebook session that doesn't auto-redirect on 401
  const fetchFacebookSession = async (url, options) => {
    // Ensure we use absolute URL if relative
    const fullUrl = url.startsWith('http') ? url : `${window.location.origin}${url}`;

    // Get auth token - prioritize localStorage (httpOnly cookies can't be read by JS)
    // But still send credentials: 'include' so httpOnly cookies are sent automatically
    let authToken = null;
    if (typeof window !== "undefined") {
      authToken = localStorage.getItem("auth-token");
    }
    // Fallback to cookie if localStorage doesn't have it (for non-httpOnly cookies)
    if (!authToken) {
      authToken = Cookies.get("auth-token");
    }
    const userData = localStorage.getItem("garage_tok")
    const payload = jwtDecode(userData)
    //  const userData = localStorage.getItem("garage_tok");

    console.log('🔍 Facebook session fetch:', {
      url: fullUrl,
      hasAuthToken: !!authToken,
      hasUserData: !!payload,
      tokenSource: authToken ? (localStorage.getItem("auth-token") ? 'localStorage' : 'cookie') : 'none',
      cookies: document.cookie
    });

    const headers = {
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    };

    // Add Authorization header if we have a token (for Bearer auth)
    // This is important because httpOnly cookies might not be sent due to domain/path/SameSite issues
    if (authToken) {
      headers['Authorization'] = `Bearer ${authToken}`;
      console.log('🔐 Added Authorization header with Bearer token');
    } else {
      console.warn('⚠️ No auth token found - relying on httpOnly cookies only');
    }

    try {
      const response = await fetch(fullUrl, {
        ...options,
        headers,
        credentials: 'include', // This ensures cookies are sent (including httpOnly ones)
        mode: 'cors', // Explicitly set CORS mode
      });

      // Handle 401 gracefully - don't redirect, just return the response
      if (response.status === 401) {
        // Clone response before reading to preserve body for caller
        const clonedResponse = response.clone();
        let errorText = '';
        try {
          errorText = await clonedResponse.text();
        } catch (e) {
          errorText = 'Could not read error response';
        }
        console.warn('❌ Facebook session API returned 401:', {
          status: response.status,
          statusText: response.statusText,
          error: errorText,
          url: fullUrl,
          hasAuthHeader: !!headers['Authorization'],
          hasCredentials: true
        });
        return response; // Return original response so caller can handle it
      }

      return response;
    } catch (error) {
      console.error('Network error fetching Facebook session:', error);
      throw error;
    }
  };

  // Backend sync functions (cross-device support)
  const saveToBackend = async (data) => {
    try {
      console.log('💾 saveToBackend: Attempting to save session data:', {
        hasAccessToken: !!data?.accessToken,
        hasUserInfo: !!data?.userInfo,
        pagesCount: data?.pages?.length || 0
      });

      const response = await fetchFacebookSession('/api/facebook/session', {
        method: 'POST',
        body: JSON.stringify({ sessionData: data }),
      });

      console.log('💾 saveToBackend: Response status:', response.status);

      if (response.ok) {
        // Clone response before reading to avoid "body already read" issues
        const result = await response.clone().json();
        if (result.success) {
          console.log('✅ Facebook session saved to backend successfully');
          // Also save to localStorage as cache
          saveToStorage(data);
          return true;
        } else {
          console.warn('⚠️ Backend returned ok but not success:', result);
        }
      } else if (response.status === 401) {
        // 401 means authentication failed - don't save to backend but don't trigger logout
        console.warn('❌ Cannot save Facebook session to backend - authentication issue (401). Using localStorage only.');
        // Still save to localStorage as fallback
        saveToStorage(data);
        return false;
      } else {
        // Other error status
        console.warn('⚠️ saveToBackend: Unexpected response status:', response.status);
        try {
          const errorData = await response.clone().json();
          console.warn('⚠️ saveToBackend: Error details:', errorData);
        } catch (e) {
          console.warn('⚠️ saveToBackend: Could not parse error response');
        }
      }
      // Fallback to localStorage
      saveToStorage(data);
      return false;
    } catch (error) {
      console.error('❌ Error saving to backend (non-critical):', error);
      // Fallback: save to localStorage only
      saveToStorage(data);
      return false;
    }
  };

  // Helper to save to both backend and localStorage
  const saveSession = async (data) => {
    // Preserve token metadata from existing storage if not in new data
    const existing = loadFromStorage();
    if (!data.tokenExpiresAt && existing?.tokenExpiresAt) {
      data.tokenExpiresAt = existing.tokenExpiresAt;
    }
    if (typeof data.tokenIsLongLived !== 'boolean' && typeof existing?.tokenIsLongLived === 'boolean') {
      data.tokenIsLongLived = existing.tokenIsLongLived;
    }
    // Save to backend (for cross-device sync)
    await saveToBackend(data);
    // saveToBackend already saves to localStorage, but we ensure it's saved
    saveToStorage(data);
  };

  const loadFromBackend = async () => {
    try {
      const response = await fetchFacebookSession('/api/facebook/session', {
        method: 'GET',
      });

      if (response.ok) {
        const result = await response.json();
        if (result.success && result.session) {
          console.log('Facebook session loaded from backend');
          const local = loadFromStorage();
          const merged = mergeFacebookSession(local, result.session);
          saveToStorage(merged);
          return merged;
        }
      } else if (response.status === 401) {
        // 401 means no Facebook session exists yet, not that user is logged out
        console.log('No Facebook session found in backend (401) - this is normal for first-time users');
        return null;
      }
      return null;
    } catch (error) {
      console.error('Error loading from backend (non-critical):', error);
      // Fallback: try localStorage
      return loadFromStorage();
    }
  };

  const clearBackend = async () => {
    try {
      const response = await fetchFacebookSession('/api/facebook/session', {
        method: 'DELETE',
      });

      if (response.ok || response.status === 401) {
        // 401 is okay - means session doesn't exist anyway
        console.log('Facebook session cleared from backend');
      }
      // Also clear localStorage
      clearStorage();
    } catch (error) {
      console.error('Error clearing backend:', error);
      // Still clear localStorage
      clearStorage();
    }
  };

  const [accessToken, setAccessToken] = useState(null);
  const [tokenHealth, setTokenHealth] = useState({ expiresAt: null, isLongLived: null });
  const [userInfo, setUserInfo] = useState(null);
  const [pages, setPages] = useState([]);
  const [selectedPage, setSelectedPage] = useState(null);
  const [leadForms, setLeadForms] = useState([]);
  const [selectedForm, setSelectedForm] = useState(null);
  const initialLeadsCache = getInitialLeadsFromCache();
  const [leads, setLeads] = useState(initialLeadsCache.leads);
  const leadsHydratedRef = useRef(initialLeadsCache.hydrated);
  const prevActiveTabRef = useRef(activeTab);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [nextPageUrl, setNextPageUrl] = useState(null);
  const [hasMoreLeads, setHasMoreLeads] = useState(false);
  const [totalLeadsCount, setTotalLeadsCount] = useState(initialLeadsCache.totalLeadsCount);

  const [sdkLoaded, setSdkLoaded] = useState(false);

  // Import leads state
  const [selectedLeadIds, setSelectedLeadIds] = useState([]);
  const [isImportDialogOpen, setIsImportDialogOpen] = useState(false);
  const [salesFunnels, setSalesFunnels] = useState([]);
  const [selectedFunnelId, setSelectedFunnelId] = useState("");
  const [isImporting, setIsImporting] = useState(false);
  const [isLoadingFunnels, setIsLoadingFunnels] = useState(false);
  const [isFunnelDropdownOpen, setIsFunnelDropdownOpen] = useState(false);
  const [ownerOptions, setOwnerOptions] = useState([]);
  const [selectedOwnerId, setSelectedOwnerId] = useState("");
  const [isLoadingOwners, setIsLoadingOwners] = useState(false);
  const [isOwnerDropdownOpen, setIsOwnerDropdownOpen] = useState(false);

  // Field mapping state
  const [fieldMappings, setFieldMappings] = useState({
    leadName: "",
    contactName: "",
    email: "",
    phone: "",
    company: "",
    jobTitle: "",
    source: "",
    notes: ""
  });
  const [availableFacebookFields, setAvailableFacebookFields] = useState([]);

  // Search and filter state
  const [searchTerm, setSearchTerm] = useState("");
  const [filteredLeads, setFilteredLeads] = useState([]);
  const [isPageDropdownOpen, setIsPageDropdownOpen] = useState(false);
  const [isFormDropdownOpen, setIsFormDropdownOpen] = useState(false);

  // Filter state
  const [isFilterDialogOpen, setIsFilterDialogOpen] = useState(false);
  const [filterSelectedPage, setFilterSelectedPage] = useState(null);
  const [filterSelectedForms, setFilterSelectedForms] = useState([]);
  const [filterStartDate, setFilterStartDate] = useState("");
  const [filterEndDate, setFilterEndDate] = useState("");
  const [filterPageForms, setFilterPageForms] = useState([]);
  const [isLoadingFilterForms, setIsLoadingFilterForms] = useState(false);
  const [appliedFilters, setAppliedFilters] = useState({
    page: null,
    forms: [],
    startDate: "",
    endDate: "",
  });


  // Filter leads based on search term and applied filters
  useEffect(() => {
    let filtered = [...leads];

    // Note: Page filter is handled by switching pages in handleApplyFilters
    // So we only need to filter by forms and date here

    // Apply form and date filters
    if (appliedFilters.forms.length > 0 || appliedFilters.startDate || appliedFilters.endDate) {
      if (appliedFilters.forms.length > 0) {
        filtered = filtered.filter(lead => {
          const formName = lead.formName || "";
          return appliedFilters.forms.some(formId => {
            const form = leadForms.find(f => f.id === formId);
            return form && form.name === formName;
          });
        });
      }

      if (appliedFilters.startDate) {
        filtered = filtered.filter(lead => {
          const leadDate = new Date(lead.created_time);
          const startDate = new Date(appliedFilters.startDate);
          startDate.setHours(0, 0, 0, 0);
          return leadDate >= startDate;
        });
      }

      if (appliedFilters.endDate) {
        filtered = filtered.filter(lead => {
          const leadDate = new Date(lead.created_time);
          const endDate = new Date(appliedFilters.endDate);
          endDate.setHours(23, 59, 59, 999);
          return leadDate <= endDate;
        });
      }
    }

    // Then apply search term filter
    if (searchTerm.trim()) {
      const searchLower = searchTerm.toLowerCase();
      filtered = filtered.filter(lead => {
        const name = getLeadName(lead).toLowerCase();
        const email = getLeadEmail(lead).toLowerCase();
        const phone = getLeadPhone(lead).toLowerCase();
        const company = getLeadCompany(lead).toLowerCase();
        const formName = (lead.formName || '').toLowerCase();

        return name.includes(searchLower) ||
          email.includes(searchLower) ||
          phone.includes(searchLower) ||
          company.includes(searchLower) ||
          formName.includes(searchLower);
      });
    }

    setFilteredLeads(filtered);
  }, [searchTerm, leads, appliedFilters, leadForms]);

  // Close dropdowns when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (!event.target.closest('[data-dropdown]')) {
        setIsPageDropdownOpen(false);
        setIsFormDropdownOpen(false);
      }
    };

    if (isPageDropdownOpen || isFormDropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => {
        document.removeEventListener('mousedown', handleClickOutside);
      };
    }
  }, [isPageDropdownOpen, isFormDropdownOpen]);

  // Close dropdown when dialog closes
  useEffect(() => {
    if (!isImportDialogOpen) {
      setIsFunnelDropdownOpen(false);
    }
  }, [isImportDialogOpen]);

  // Auto-fetch all leads when leadForms are loaded (skip if already hydrated from cache)
  useEffect(() => {
    if (leadForms && leadForms.length > 0 && selectedPage && selectedPage.access_token) {
      if (leadsHydratedRef.current || leads.length > 0) {
        return;
      }

      const timeoutId = setTimeout(() => {
        if (!leadsHydratedRef.current && leads.length === 0) {
          fetchAllLeadsFromForms();
        }
      }, 100);

      return () => clearTimeout(timeoutId);
    }
  }, [leadForms, selectedPage, leads.length]);

  // Helper function to fetch all leads from all forms (extracted for reuse)
  const fetchAllLeadsFromForms = async (pageOverride, formsOverride) => {
    const page = pageOverride || selectedPage;
    const forms = formsOverride || leadForms;
    if (!page || !forms || forms.length === 0) {
      return;
    }

    setLoading(true);
    setError(null);

    try {
      let allLeads = [];
      const pageToken = page.access_token;

      // Fetch leads from all forms
      for (const form of forms) {
        try {
          const formLeads = await fetchLeads(form.id, pageToken, form.name, 100, true);
          allLeads = [...allLeads, ...formLeads];
        } catch (error) {
          console.error(`Error fetching leads from form ${form.name}:`, error);
          // Continue with other forms even if one fails
        }
      }

      // Sort by created_time (newest first)
      allLeads.sort((a, b) => {
        const dateA = new Date(a.created_time).getTime();
        const dateB = new Date(b.created_time).getTime();
        return dateB - dateA;
      });

      console.log(`Total leads fetched from all forms: ${allLeads.length}`);
      setLeads(allLeads);
      setTotalLeadsCount(allLeads.length);
      setHasMoreLeads(false);
      setNextPageUrl(null);
      leadsHydratedRef.current = true;
      persistLeadsCache(page, forms, allLeads);
      setLoading(false);
    } catch (error) {
      console.error('Error fetching all leads:', error);
      setError('Failed to fetch leads: ' + (error.response?.data?.error?.message || error.message));
      setLoading(false);
    }
  };

  // Initialize Facebook SDK
  useEffect(() => {
    // Check if SDK is already loaded
    if (window.FB) {
      setSdkLoaded(true);
      return;
    }

    window.fbAsyncInit = function () {
      try {
        window.FB.init({
          appId: '1389133145656991', // Your specific app ID
          cookie: true,
          xfbml: true,
          version: 'v23.0'
        });
        setSdkLoaded(true);
      } catch (error) {
        console.error('Facebook SDK initialization error:', error);
        setError('Facebook SDK initialization failed. Please try the OAuth redirect method instead.');
      }
    };

    // Load Facebook SDK script
    (function (d, s, id) {
      var js, fjs = d.getElementsByTagName(s)[0];
      if (d.getElementById(id)) return;
      js = d.createElement(s);
      js.id = id;
      js.src = "https://connect.facebook.net/en_US/sdk.js";
      fjs.parentNode.insertBefore(js, fjs);
    }(document, 'script', 'facebook-jssdk'));
  }, []);

  // Facebook Login using FB SDK popup (simpler alternative)
  const handleFacebookLogin = () => {
    if (!window.FB || !sdkLoaded) {
      setError('Facebook SDK not ready. Please wait a moment and try again.');
      return;
    }

    setLoading(true);
    setError(null);

    // Use Facebook SDK popup
    window.FB.login((response) => {
      console.log('=== DEBUG: Facebook login response ===', JSON.stringify(response, null, 2));

      if (response.authResponse) {
        const token = response.authResponse.accessToken;
        const grantedScopes = response.authResponse.grantedScopes;
        console.log('=== DEBUG: Granted scopes ===', grantedScopes);
        console.log('=== DEBUG: Full authResponse ===', JSON.stringify(response.authResponse, null, 2));

        // Check if pages_show_list is granted
        if (grantedScopes && !grantedScopes.includes('pages_show_list')) {
          setError('Required permission "pages_show_list" was not granted. Please try again and make sure to grant all permissions.');
          setLoading(false);
          return;
        }

        verifyAndSetToken(token, response.authResponse.expiresIn);
      } else {
        setError('Facebook login failed or was cancelled');
        setLoading(false);
      }
    }, {
      scope: 'pages_read_engagement,leads_retrieval,pages_manage_metadata,pages_show_list,pages_manage_ads,pages_read_user_content,business_management',
      auth_type: 'rerequest', // Force re-authorization
      return_scopes: true // Return granted scopes in response
    });
  };

  // Fallback OAuth redirect login method
  const handleOAuthRedirectLogin = () => {
    const appId = '1389133145656991';
    const redirectUri = encodeURIComponent(window.location.origin + window.location.pathname);
    const scope = 'pages_read_engagement,leads_retrieval,pages_manage_metadata,pages_show_list,pages_manage_ads,pages_read_user_content';

    const oauthUrl = `https://www.facebook.com/v23.0/dialog/oauth?client_id=${appId}&redirect_uri=${redirectUri}&scope=${scope}&response_type=token&auth_type=rerequest`;

    window.location.href = oauthUrl;
  };

  // Restore state from backend (with localStorage fallback) on component mount
  useEffect(() => {
    const restoreState = async () => {
      console.log('=== Starting Facebook state restoration ===');

      // First try backend (for cross-device sync)
      let stored = await loadFromBackend();
      const source = stored ? 'backend' : 'localStorage';

      // If backend fails or returns null, try localStorage as fallback
      if (!stored) {
        console.log('Backend returned no data, trying localStorage...');
        stored = loadFromStorage();
      }

      if (stored && stored.accessToken) {
        const tokenExpiresAt = stored.tokenExpiresAt || 0;
        const now = Date.now();
        const msUntilExpiry = tokenExpiresAt - now;
        const daysUntilExpiry = Math.round(msUntilExpiry / (1000 * 60 * 60 * 24));

        console.log('=== Restoring Facebook state ===', {
          source: source,
          hasToken: !!stored.accessToken,
          hasUserInfo: !!stored.userInfo,
          pagesCount: stored.pages?.length ?? 'undefined',
          pagesType: Array.isArray(stored.pages) ? 'array' : typeof stored.pages,
          hasSelectedPage: !!stored.selectedPage,
          hasLeadForms: stored.leadForms?.length || 0,
          tokenExpiresAt: tokenExpiresAt ? new Date(tokenExpiresAt).toISOString() : 'unknown',
          daysUntilExpiry: tokenExpiresAt ? daysUntilExpiry : 'unknown',
        });

        // If token is already expired, attempt automatic refresh
        if (tokenExpiresAt && msUntilExpiry <= 0) {
          console.log('[FB Auto-Refresh] Token expired on restore - attempting background refresh...');
          const result = await refreshTokenInBackground(stored.accessToken);
          if (result.success) {
            // Token refreshed - update local var so rest of restoration uses new token
            stored.accessToken = result.token;
            stored.tokenExpiresAt = result.tokenExpiresAt;
          } else if (!result.pageTokenValid) {
            console.warn('[FB Auto-Refresh] Could not refresh expired token - clearing session.');
            setError('Your Facebook session has expired and could not be refreshed automatically. Please reconnect to continue.');
            clearStorage();
            return;
          }
          // If pageTokenValid, continue with existing page tokens
        }

        // If token expires within 7 days, proactively refresh in background
        if (tokenExpiresAt && daysUntilExpiry <= 7 && daysUntilExpiry > 0) {
          console.log(`[FB Auto-Refresh] Token expires in ${daysUntilExpiry} day(s) - refreshing proactively...`);
          refreshTokenInBackground(stored.accessToken).then((result) => {
            if (result.success) {
              console.log('[FB Auto-Refresh] Proactive refresh succeeded');
            } else {
              console.warn('[FB Auto-Refresh] Proactive refresh failed - will retry later');
            }
          });
        }

        setAccessToken(stored.accessToken);
        if (stored.userInfo) setUserInfo(stored.userInfo);

        // Handle pages restoration with edge case handling
        let restoredPages = [];

        if (stored.pages !== undefined && Array.isArray(stored.pages)) {
          restoredPages = stored.pages;
          console.log(`Restoring ${restoredPages.length} pages from ${source}`);
        } else {
          console.warn('⚠️ Pages in storage is invalid or undefined:', typeof stored.pages);
        }

        // Edge case: If pages is empty but selectedPage exists, reconstruct pages array
        // This handles data inconsistency from previous race conditions
        if (restoredPages.length === 0 && stored.selectedPage) {
          console.log('🔧 Reconstructing pages array from selectedPage');
          restoredPages = [stored.selectedPage];
          // Save the corrected data back to storage
          const correctedData = {
            ...stored,
            pages: restoredPages
          };
          saveToStorage(correctedData);
          console.log('✅ Corrected pages array saved to storage');
        }

        setPages(restoredPages);

        if (restoredPages.length === 0) {
          console.warn('⚠️ Pages array is empty - user may need to reconnect');
        } else {
          console.log('✅ Pages restored successfully:', restoredPages.map(p => p.name || p.id));
        }

        if (stored.selectedPage) {
          console.log('Restoring selected page:', stored.selectedPage.name || stored.selectedPage.id);
          const restoredPage = pickPageWithFreshToken(restoredPages, stored.selectedPage);
          setSelectedPage(restoredPage);
          // Restore lead forms if available
          if (stored.leadForms && stored.leadForms.length > 0) {
            console.log('Restoring lead forms:', stored.leadForms.length);
            setLeadForms(stored.leadForms);
          }
        } else if (restoredPages.length > 0) {
          // Auto-select first page if no page is selected
          console.log('Auto-selecting first page:', restoredPages[0].name || restoredPages[0].id);
          setSelectedPage(restoredPages[0]);
          // Fetch lead forms for the first page
          if (restoredPages[0].access_token) {
            fetchLeadForms(restoredPages[0].id, restoredPages[0].access_token);
          }
        }
        if (stored.selectedForm) {
          console.log('Restoring selected form:', stored.selectedForm.name || stored.selectedForm.id);
          setSelectedForm(stored.selectedForm);
        }

        syncTokenHealthFromStorage();

        const leadsCache = loadLeadsFromSessionCache();
        if (
          stored.selectedPage?.id &&
          stored.leadForms?.length > 0 &&
          leadsCache?.leads?.length > 0
        ) {
          const cacheKey = buildLeadsCacheKey(stored.selectedPage.id, stored.leadForms);
          if (leadsCache.cacheKey === cacheKey) {
            console.log(`Restoring ${leadsCache.leads.length} cached Facebook leads`);
            setLeads(leadsCache.leads);
            setTotalLeadsCount(leadsCache.totalLeadsCount ?? leadsCache.leads.length);
            setHasMoreLeads(false);
            setNextPageUrl(null);
            leadsHydratedRef.current = true;
          }
        }

        // User token can look healthy while page tokens/forms are stale — refresh in background
        if (!stored.leadForms?.length && stored.accessToken) {
          console.log('[FB Restore] Missing lead forms — refreshing pages and forms');
          fetchPages(stored.accessToken);
        }
      } else {
        console.log('❌ No stored Facebook state found - user needs to connect');
      }
    };

    restoreState();
  }, []);

  // When switching back to Facebook Leads, refresh page tokens + forms (page tokens expire independently)
  useEffect(() => {
    const switchedToFacebook =
      activeTab === 'facebook-leads' && prevActiveTabRef.current !== 'facebook-leads';
    prevActiveTabRef.current = activeTab;

    if (!switchedToFacebook || !accessToken) return;

    console.log('[FB Tab] Switched to Facebook Leads — refreshing pages and forms');
    fetchPages(accessToken);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, accessToken]);

  // Check for access token in URL on component mount
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.hash.substring(1));
    const accessToken = urlParams.get('access_token');
    const expiresIn = Number(urlParams.get('expires_in') || 0);

    if (accessToken) {
      // Verify the token belongs to our app
      verifyAndSetToken(accessToken, expiresIn);

      // Clean URL
      window.history.replaceState({}, document.title, window.location.pathname);
    }
  }, []);

  // Exchange short-lived token for long-lived token (~60 days) via backend API
  const exchangeForLongLivedToken = async (shortLivedToken, shortLivedExpiresIn = 3600) => {
    try {
      const response = await axios.post('/api/facebook/exchange-token', {
        shortLivedToken: shortLivedToken
      });

      if (response.data.success && response.data.accessToken) {
        const expiresInSeconds = response.data.expiresIn || 5184000; // default 60 days
        const tokenExpiresAt = Date.now() + expiresInSeconds * 1000;
        console.log('Token exchanged successfully. Expires in:', expiresInSeconds, 'seconds (~' + Math.round(expiresInSeconds / 86400) + ' days)');
        return { token: response.data.accessToken, tokenExpiresAt, isLongLived: true };
      } else {
        console.warn('Token exchange returned unexpected format, falling back to short-lived token');
        return {
          token: shortLivedToken,
          tokenExpiresAt: Date.now() + shortLivedExpiresIn * 1000,
          isLongLived: false
        };
      }
    } catch (error) {
      console.error('Error exchanging token:', error);
      return {
        token: shortLivedToken,
        tokenExpiresAt: Date.now() + shortLivedExpiresIn * 1000,
        isLongLived: false
      };
    }
  };

  // Refresh long-lived token in background - Facebook allows exchanging
  // a still-valid long-lived token for a fresh one (new 60-day expiry).
  const refreshTokenInBackground = async (currentToken) => {
    try {
      console.log('[FB Auto-Refresh] Attempting background token refresh...');

      const response = await axios.post('/api/facebook/refresh-token', {
        currentToken: currentToken
      });

      if (response.data.success && response.data.accessToken) {
        const expiresInSeconds = response.data.expiresIn || 5184000;
        const tokenExpiresAt = Date.now() + expiresInSeconds * 1000;

        console.log(`[FB Auto-Refresh] Token refreshed successfully. New expiry: ~${Math.round(expiresInSeconds / 86400)} days`);

        // Update in-memory state
        setAccessToken(response.data.accessToken);

        // Update stored data with new token + expiry
        const stored = loadFromStorage() || {};
        const updatedData = {
          ...stored,
          accessToken: response.data.accessToken,
          tokenExpiresAt,
          tokenIsLongLived: true,
        };
        await saveSession(updatedData);
        syncTokenHealthFromStorage();

        // Re-fetch pages to get fresh page tokens
        await fetchPages(response.data.accessToken);

        toast.success('Facebook connection refreshed automatically');
        return { success: true, token: response.data.accessToken, tokenExpiresAt };
      }

      console.warn('[FB Auto-Refresh] Unexpected response format:', response.data);
      return { success: false };
    } catch (error) {
      const reason = error?.response?.data?.reason;
      console.warn('[FB Auto-Refresh] Refresh failed:', reason || error.message);

      if (reason === 'invalid_token' || reason === 'expired') {
        // Token is dead - check if we still have working page tokens
        const stored = loadFromStorage();
        if (stored?.selectedPage?.access_token) {
          try {
            await axios.get(`https://graph.facebook.com/v23.0/${stored.selectedPage.id}`, {
              params: { access_token: stored.selectedPage.access_token, fields: 'id' }
            });
            console.log('[FB Auto-Refresh] User token expired but page token still works - continuing with page token');
            toast.info('Facebook user session expired, but your page data is still accessible.');
            return { success: false, pageTokenValid: true };
          } catch {
            console.warn('[FB Auto-Refresh] Page token also invalid');
          }
        }
      }

      return { success: false, pageTokenValid: false };
    }
  };

  const isFacebookTokenError = (error) => {
    const errData = error?.response?.data?.error;
    if (!errData) return false;
    return (
      errData.code === 190 ||
      errData.message?.includes('expired') ||
      errData.message?.includes('Invalid OAuth') ||
      errData.message?.includes('Session has expired') ||
      errData.message?.includes('Error validating access token')
    );
  };

  const handleTokenExpired = async () => {
    console.warn('[FB Auto-Refresh] Token expired - attempting automatic refresh before prompting user.');

    const stored = loadFromStorage();
    if (stored?.accessToken) {
      const result = await refreshTokenInBackground(stored.accessToken);
      if (result.success) return;
      if (result.pageTokenValid) return;

      // Both user token and page token are dead - user must reconnect
      console.warn('[FB Auto-Refresh] All tokens invalid - prompting user to reconnect.');
      saveToStorage({ ...stored, tokenExpiresAt: 0 });
    }

    setError('Your Facebook session has expired and could not be refreshed automatically. Please disconnect and reconnect to restore access.');
  };

  // Verify token belongs to our app and set it
  const verifyAndSetToken = async (token, shortLivedExpiresIn = 3600) => {
    try {
      setLoading(true);

      // Check if token belongs to our app
      const appCheckResponse = await axios.get('https://graph.facebook.com/v23.0/app', {
        params: {
          access_token: token
        }
      });

      const expectedAppId = '1389133145656991'; // Your specific app ID

      if (appCheckResponse.data.id === expectedAppId) {
        // Exchange for long-lived token (~60 days)
        const { token: finalToken, tokenExpiresAt, isLongLived } = await exchangeForLongLivedToken(
          token,
          shortLivedExpiresIn
        );

        setAccessToken(finalToken);

        // Persist expiration so we can check on restore
        const stored = loadFromStorage() || {};
        saveToStorage({ ...stored, accessToken: finalToken, tokenExpiresAt, tokenIsLongLived: isLongLived });
        syncTokenHealthFromStorage();

        if (!isLongLived) {
          toast.warning('Could not secure a long-lived Facebook token. This connection may expire soon.');
        }

        // Get user info and pages
        await fetchUserInfo(finalToken);
        await fetchPages(finalToken);
      } else {
        setError(`Token is for app ID ${appCheckResponse.data.id}, but expected ${expectedAppId}. Please make sure you're logging in through the correct Facebook app.`);
      }

      setLoading(false);
    } catch (error) {
      console.error('Error verifying token:', error);
      setError('Failed to verify access token. Please try logging in again.');
      setLoading(false);
    }
  };

  // TEMPORARY: Use Graph API Explorer token for testing
  // const handleUseTestToken = () => {
  //   const testToken = 'EAAOZCDIES2NMBOwW1HBeNLz7AqTiXj0ldplXl9lvQsFSF2'; // From your Graph API Explorer
  //   verifyAndSetToken(testToken);
  // };
  const fetchUserInfo = async (token) => {
    try {
      const response = await axios.get('https://graph.facebook.com/v23.0/me', {
        params: {
          access_token: token,
          fields: 'name,email'
        }
      });
      setUserInfo(response.data);

      // Update backend and localStorage
      const stored = loadFromStorage();
      if (stored) {
        const updatedData = {
          ...stored,
          userInfo: response.data
        };
        await saveSession(updatedData);
      }
    } catch (error) {
      console.error('Error fetching user info:', error);
      if (isFacebookTokenError(error)) {
        handleTokenExpired();
      }
    }
  };

  // Fetch Facebook Pages - me/accounts returns ALL pages user is admin of (including Business Manager pages)
  const fetchPages = async (token) => {
    try {
      setLoading(true);
      setError(null);

      // Step 1: Verify permissions and log detailed info
      try {
        const debugResponse = await axios.get('https://graph.facebook.com/v23.0/me/permissions', {
          params: {
            access_token: token
          }
        });
        console.log('=== DEBUG: User permissions ===', JSON.stringify(debugResponse.data, null, 2));

        const permissions = debugResponse.data.data || [];
        const hasPagesShowList = permissions.some(p => p.permission === 'pages_show_list' && p.status === 'granted');
        console.log('Has pages_show_list permission:', hasPagesShowList);

        if (!hasPagesShowList) {
          setError('The "pages_show_list" permission is required but was not granted. Please disconnect and reconnect, making sure to grant all permissions.');
          // Don't clear pages if we have stored pages - keep them visible
          const stored = loadFromStorage();
          if (!stored || !stored.pages || stored.pages.length === 0) {
            setPages([]);
          }
          setLoading(false);
          return;
        }
      } catch (permError) {
        console.warn('Could not check permissions:', permError);
      }

      // Step 2: Get user info to verify token is working
      try {
        const userInfoResponse = await axios.get('https://graph.facebook.com/v23.0/me', {
          params: {
            access_token: token,
            fields: 'id,name,email'
          }
        });
        console.log('=== DEBUG: User info ===', JSON.stringify(userInfoResponse.data, null, 2));
      } catch (userError) {
        console.error('Error fetching user info:', userError.response?.data || userError.message);
      }

      // Step 3: Try me/accounts endpoint (primary method)
      let pagesData = [];
      try {
        console.log('=== DEBUG: Attempting me/accounts API call ===');
        const response = await axios.get('https://graph.facebook.com/v23.0/me/accounts', {
          params: {
            access_token: token,
            fields: 'id,name,access_token,category',
            limit: 100
          }
        });

        console.log('=== DEBUG: me/accounts full response ===', JSON.stringify(response.data, null, 2));
        pagesData = response.data.data || [];
        console.log(`Found ${pagesData.length} pages via me/accounts`);

        if (pagesData.length > 0) {
          setPages(pagesData);

          // IMPORTANT: Save session before returning!
          // This was the bug - early return was bypassing the saveSession at the end
          console.log('💾 Saving session after me/accounts success');
          const stored = loadFromStorage() || {};

          // Auto-select first page if no page is selected
          let pageToSelect = pickPageWithFreshToken(pagesData, stored.selectedPage);
          if (pageToSelect) {
            console.log('Using page with fresh token:', pageToSelect.name || pageToSelect.id);
            setSelectedPage(pageToSelect);
            if (pageToSelect.access_token) {
              fetchLeadForms(pageToSelect.id, pageToSelect.access_token);
            }
          }

          const updatedData = {
            accessToken: stored.accessToken || token,
            userInfo: stored.userInfo || null,
            pages: pagesData,
            selectedPage: pageToSelect,
            leadForms: stored.leadForms || [],
            selectedForm: stored.selectedForm || null
          };
          await saveSession(updatedData);
          console.log('✅ Session saved after me/accounts');

          setLoading(false);
          return;
        }
      } catch (accountsError) {
        console.error('=== DEBUG: me/accounts error ===', {
          message: accountsError.message,
          response: accountsError.response?.data,
          status: accountsError.response?.status
        });
      }

      // Step 4: Try alternative endpoint with nested query
      if (pagesData.length === 0) {
        try {
          console.log('=== DEBUG: Trying alternative endpoint (me with accounts field) ===');
          const altResponse = await axios.get('https://graph.facebook.com/v23.0/me', {
            params: {
              access_token: token,
              fields: 'accounts{id,name,access_token,category}'
            }
          });
          console.log('=== DEBUG: Alternative endpoint response ===', JSON.stringify(altResponse.data, null, 2));

          if (altResponse.data.accounts && altResponse.data.accounts.data) {
            pagesData = altResponse.data.accounts.data;
            console.log(`Found ${pagesData.length} pages via alternative method`);
            setPages(pagesData);

            // Save session before returning
            console.log('💾 Saving session after alternative method success');
            const stored = loadFromStorage() || {};
            const pageToSelect = pickPageWithFreshToken(pagesData, stored.selectedPage);
            if (pageToSelect) {
              setSelectedPage(pageToSelect);
              if (pageToSelect.access_token) {
                fetchLeadForms(pageToSelect.id, pageToSelect.access_token);
              }
            }
            const updatedData = {
              accessToken: stored.accessToken || token,
              userInfo: stored.userInfo || null,
              pages: pagesData,
              selectedPage: pageToSelect,
              leadForms: stored.leadForms || [],
              selectedForm: stored.selectedForm || null
            };
            await saveSession(updatedData);
            console.log('✅ Session saved after alternative method');

            setLoading(false);
            return;
          }
        } catch (altError) {
          console.error('=== DEBUG: Alternative method error ===', {
            message: altError.message,
            response: altError.response?.data,
            status: altError.response?.status
          });
        }
      }

      // Step 5: Try with different field combinations
      if (pagesData.length === 0) {
        try {
          console.log('=== DEBUG: Trying with expanded fields ===');
          const expandedResponse = await axios.get('https://graph.facebook.com/v23.0/me/accounts', {
            params: {
              access_token: token,
              fields: 'id,name,access_token,category,link,about',
              limit: 100
            }
          });
          console.log('=== DEBUG: Expanded fields response ===', JSON.stringify(expandedResponse.data, null, 2));
          pagesData = expandedResponse.data.data || [];

          if (pagesData.length > 0) {
            setPages(pagesData);

            // Save session before returning
            console.log('💾 Saving session after expanded fields success');
            const stored = loadFromStorage() || {};

            // Auto-select first page if no page is selected
            let pageToSelect = pickPageWithFreshToken(pagesData, stored.selectedPage);
            if (pageToSelect) {
              console.log('Using page with fresh token:', pageToSelect.name || pageToSelect.id);
              setSelectedPage(pageToSelect);
              if (pageToSelect.access_token) {
                fetchLeadForms(pageToSelect.id, pageToSelect.access_token);
              }
            }

            const updatedData = {
              accessToken: stored.accessToken || token,
              userInfo: stored.userInfo || null,
              pages: pagesData,
              selectedPage: pageToSelect,
              leadForms: stored.leadForms || [],
              selectedForm: stored.selectedForm || null
            };
            await saveSession(updatedData);
            console.log('✅ Session saved after expanded fields');

            setLoading(false);
            return;
          }
        } catch (expandedError) {
          console.error('=== DEBUG: Expanded fields error ===', expandedError.response?.data || expandedError.message);
        }
      }

      // Step 6: Try Business Manager API (for pages accessed through Business Manager)
      if (pagesData.length === 0) {
        try {
          console.log('=== DEBUG: me/accounts returned empty. Trying Business Manager API ===');

          // Try to get Business Manager accounts
          try {
            const businessesResponse = await axios.get('https://graph.facebook.com/v23.0/me/businesses', {
              params: {
                access_token: token,
                fields: 'id,name',
                limit: 100
              }
            });
            console.log('=== DEBUG: Business Manager accounts ===', JSON.stringify(businessesResponse.data, null, 2));

            const businesses = businessesResponse.data.data || [];
            console.log(`Found ${businesses.length} Business Manager accounts`);

            // For each Business Manager, try to get pages
            for (const business of businesses) {
              try {
                const businessPagesResponse = await axios.get(`https://graph.facebook.com/v23.0/${business.id}/owned_pages`, {
                  params: {
                    access_token: token,
                    fields: 'id,name,access_token,category',
                    limit: 100
                  }
                });

                const businessPages = businessPagesResponse.data.data || [];
                console.log(`=== DEBUG: Found ${businessPages.length} pages in Business Manager "${business.name}" ===`, JSON.stringify(businessPages, null, 2));

                if (businessPages.length > 0) {
                  // Add business name to each page
                  const pagesWithBusiness = businessPages.map(page => ({
                    ...page,
                    businessName: business.name,
                    businessId: business.id
                  }));
                  pagesData = [...pagesData, ...pagesWithBusiness];
                }
              } catch (businessPagesError) {
                console.warn(`Could not fetch pages for business ${business.name}:`, businessPagesError.response?.data || businessPagesError.message);
              }
            }
          } catch (businessError) {
            // business_management permission might not be granted
            const errorData = businessError.response?.data?.error || {};
            console.warn('=== DEBUG: Business Manager API error ===', {
              message: businessError.message,
              error_code: errorData.code,
              error_message: errorData.message,
              error_type: errorData.type,
              response: businessError.response?.data,
              status: businessError.response?.status
            });

            // If error is about missing permission, provide helpful message
            if (errorData.code === 200 || errorData.type === 'OAuthException') {
              console.error('=== DEBUG: business_management permission is required for Business Manager pages ===');
              setError('To access pages in Business Manager, you need to grant "business_management" permission. Please: 1) Add this permission to your Facebook App, 2) Request Advanced Access, 3) Disconnect and reconnect your Facebook account.');
            }
          }
        } catch (bmError) {
          console.error('=== DEBUG: Business Manager fetch error ===', bmError);
        }
      }

      // Step 7: Final check and error message
      if (pagesData.length === 0) {
        console.error('=== DEBUG: All methods failed. No pages found. ===');
        // Don't clear pages if we have stored pages - keep them visible
        const stored = loadFromStorage();
        if (!stored || !stored.pages || stored.pages.length === 0) {
          setPages([]);
          setError('No pages found. The page you selected is likely in a Business Manager. To access Business Manager pages, you need to: 1) Add "business_management" permission to your Facebook App, 2) Request Advanced Access for it, 3) Reconnect your Facebook account. Alternatively, ensure the user is a direct Admin (not just through Business Manager) of the page.');
        } else {
          // Keep existing pages and show a warning instead
          setError('Unable to refresh pages. Using cached pages. If you see outdated information, please disconnect and reconnect.');
        }
      } else {
        // Remove duplicates
        const uniquePages = [];
        const seenIds = new Set();
        for (const page of pagesData) {
          if (!seenIds.has(page.id)) {
            seenIds.add(page.id);
            uniquePages.push(page);
          }
        }
        console.log(`=== DEBUG: Final result: ${uniquePages.length} unique pages found ===`);
        setPages(uniquePages);

        // Update backend and localStorage - ALWAYS save, even if stored is null
        const stored = loadFromStorage() || {};
        console.log('Saving pages to backend and localStorage:', uniquePages.length);

        // Auto-select first page if no page is selected
        let pageToSelect = pickPageWithFreshToken(uniquePages, stored.selectedPage);
        if (pageToSelect) {
          console.log('Using page with fresh token:', pageToSelect.name || pageToSelect.id);
          setSelectedPage(pageToSelect);
          if (pageToSelect.access_token) {
            fetchLeadForms(pageToSelect.id, pageToSelect.access_token);
          }
        }

        const updatedData = {
          accessToken: stored.accessToken || token,
          userInfo: stored.userInfo || null,
          pages: uniquePages, // This is the new pages array
          selectedPage: pageToSelect,
          leadForms: stored.leadForms || [],
          selectedForm: stored.selectedForm || null
        };
        await saveSession(updatedData);
        console.log('✅ Pages saved successfully to backend and localStorage');
      }

      setLoading(false);
    } catch (error) {
      console.error('=== DEBUG: Unexpected error in fetchPages ===', error);

      if (isFacebookTokenError(error)) {
        handleTokenExpired();
      } else {
        setError('An unexpected error occurred while fetching pages. Please check the browser console (F12) for details.');
      }

      // Don't clear pages from state if we have stored pages - keep them visible
      // Only clear if we don't have stored pages
      const stored = loadFromStorage();
      if (!stored || !stored.pages || stored.pages.length === 0) {
        setPages([]);
      }
      // Otherwise, keep the stored pages visible even if API call fails

      setLoading(false);
      // Don't clear storage - let user stay "logged in" until they explicitly disconnect
    }
  };

  // Fetch Lead Forms for selected page with updated API
  const fetchLeadForms = async (pageId, pageToken, isRetry = false) => {
    setLoading(true);
    setError(null);

    try {
      const response = await axios.get(`https://graph.facebook.com/v23.0/${pageId}/leadgen_forms`, {
        params: {
          access_token: pageToken,
          fields: 'id,name,status,leads_count,created_time'
        }
      });
      setLeadForms(response.data.data);

      // Update backend and localStorage
      const stored = loadFromStorage();
      if (stored) {
        const updatedData = {
          ...stored,
          leadForms: response.data.data
        };
        await saveSession(updatedData);
      }

      setLoading(false);
    } catch (error) {
      console.error('Error fetching lead forms:', error);

      if (isFacebookTokenError(error) && !isRetry) {
        const stored = loadFromStorage();
        if (stored?.accessToken) {
          console.log('[FB] Page token failed — refreshing pages before retrying forms fetch');
          await fetchPages(stored.accessToken);
          const updated = loadFromStorage();
          const freshPage =
            updated?.pages?.find((p) => p.id === pageId) ||
            (updated?.selectedPage?.id === pageId ? updated.selectedPage : null);
          if (freshPage?.access_token && freshPage.access_token !== pageToken) {
            return fetchLeadForms(pageId, freshPage.access_token, true);
          }
        }
        await handleTokenExpired();
      } else if (isFacebookTokenError(error)) {
        await handleTokenExpired();
      } else {
        setError('Failed to fetch lead forms: ' + (error.response?.data?.error?.message || error.message));
      }

      setLoading(false);
      // Don't clear storage - let user stay "logged in" until they explicitly disconnect
    }
  };

  // Fetch Leads from selected form with pagination options (helper function - doesn't manage loading state)
  const fetchLeads = async (formId, pageToken, formName = '', limit = 100, loadAll = true) => {
    try {
      if (loadAll) {
        // Load ALL leads at once
        let allLeads = [];
        let nextPageUrl = null;
        let hasNextPage = true;

        // Initial request
        let response = await axios.get(`https://graph.facebook.com/v23.0/${formId}/leads`, {
          params: {
            access_token: pageToken,
            fields: 'id,created_time,field_data',
            limit: limit
          }
        });

        allLeads = [...response.data.data];
        nextPageUrl = response.data.paging?.next;

        // Fetch all pages
        while (nextPageUrl && hasNextPage) {
          console.log(`Fetching page... Current leads: ${allLeads.length}`);

          try {
            const nextResponse = await axios.get(nextPageUrl);
            allLeads = [...allLeads, ...nextResponse.data.data];
            nextPageUrl = nextResponse.data.paging?.next;

            // Optional: Limit total leads to prevent infinite loading
            if (allLeads.length >= 2000) {
              console.log('Reached 2000 leads limit, stopping pagination');
              break;
            }
          } catch (error) {
            console.error('Error fetching next page:', error);
            hasNextPage = false;
          }
        }

        // Add form name to each lead
        const leadsWithFormName = allLeads.map(lead => ({
          ...lead,
          formName: formName
        }));

        console.log(`Total leads fetched: ${leadsWithFormName.length}`);
        return leadsWithFormName;

      } else {
        // Load leads in batches (manual pagination)
        const response = await axios.get(`https://graph.facebook.com/v23.0/${formId}/leads`, {
          params: {
            access_token: pageToken,
            fields: 'id,created_time,field_data',
            limit: limit
          }
        });

        const leadsWithFormName = response.data.data.map(lead => ({
          ...lead,
          formName: formName
        }));

        return leadsWithFormName;
      }
    } catch (error) {
      console.error('Error fetching leads:', error);
      throw error;
    }
  };

  // Fetch all leads from all forms
  const fetchAllLeads = async () => {
    if (!selectedPage || !leadForms || leadForms.length === 0) {
      return;
    }

    setLoading(true);
    setError(null);

    try {
      let allLeads = [];
      const pageToken = selectedPage.access_token;

      // Fetch leads from all forms
      for (const form of leadForms) {
        try {
          const formLeads = await fetchLeads(form.id, pageToken, form.name, 100, true);
          allLeads = [...allLeads, ...formLeads];
        } catch (error) {
          console.error(`Error fetching leads from form ${form.name}:`, error);
          // Continue with other forms even if one fails
        }
      }

      // Sort by created_time (newest first)
      allLeads.sort((a, b) => {
        const dateA = new Date(a.created_time).getTime();
        const dateB = new Date(b.created_time).getTime();
        return dateB - dateA;
      });

      console.log(`Total leads fetched from all forms: ${allLeads.length}`);
      setLeads(allLeads);
      setTotalLeadsCount(allLeads.length);
      setHasMoreLeads(false);
      setNextPageUrl(null);
      leadsHydratedRef.current = true;
      persistLeadsCache(selectedPage, leadForms, allLeads);
      setLoading(false);
    } catch (error) {
      console.error('Error fetching all leads:', error);
      setError('Failed to fetch leads: ' + (error.response?.data?.error?.message || error.message));
      setLoading(false);
    }
  };

  // Load more leads (for manual pagination)
  const loadMoreLeads = async () => {
    if (!nextPageUrl || loading) return;

    setLoading(true);
    try {
      const response = await axios.get(nextPageUrl);
      setLeads(prevLeads => [...prevLeads, ...response.data.data]);
      setNextPageUrl(response.data.paging?.next || null);
      setHasMoreLeads(!!response.data.paging?.next);
      setTotalLeadsCount(prev => prev + response.data.data.length);
      setLoading(false);
    } catch (error) {
      console.error('Error loading more leads:', error);
      setError('Failed to load more leads');
      setLoading(false);
    }
  };

  // Handle Page Selection
  const handlePageSelect = async (page) => {
    setSelectedPage(page);
    setSelectedForm(null);
    leadsHydratedRef.current = false;
    clearLeadsSessionCache();
    setLeads([]);
    setLeadForms([]);

    // Update backend and localStorage
    const stored = loadFromStorage();
    if (stored) {
      const updatedData = {
        ...stored,
        selectedPage: page,
        selectedForm: null,
        leadForms: []
      };
      await saveSession(updatedData);
    }

    // CRITICAL: Subscribe page to webhook for leadgen events
    // This is required for Facebook to send lead notifications to our webhook
    try {
      console.log('=== Subscribing page to webhook ===');
      console.log('Page ID:', page.id);

      const subscribeResponse = await axios.post(
        `https://graph.facebook.com/v23.0/${page.id}/subscribed_apps`,
        null,
        {
          params: {
            access_token: page.access_token,
            subscribed_fields: 'leadgen'
          }
        }
      );

      console.log('✅ Page successfully subscribed to webhook:', subscribeResponse.data);
      toast.success('Page subscribed to receive lead notifications!');
    } catch (subscribeError) {
      console.error('❌ Failed to subscribe page to webhook:', {
        message: subscribeError.message,
        response: subscribeError.response?.data,
        status: subscribeError.response?.status
      });

      // Show error but don't block - leads can still be fetched manually
      const errorMessage = subscribeError.response?.data?.error?.message || 'Unknown error';
      toast.error(`Could not enable automatic lead notifications: ${errorMessage}`);
    }

    fetchLeadForms(page.id, page.access_token).then(() => {
      // After forms are loaded, fetch all leads from all forms
      // We'll do this in a useEffect that watches leadForms
    });
  };

  // Handle Form Selection (now optional - for filtering)
  const handleFormSelect = async (form) => {
    setSelectedForm(form);
    setLeads([]);
    setNextPageUrl(null);
    setHasMoreLeads(false);
    setTotalLeadsCount(0);
    setLoading(true);

    // Update backend and localStorage
    const stored = loadFromStorage();
    if (stored) {
      const updatedData = {
        ...stored,
        selectedForm: form
      };
      await saveSession(updatedData);
    }

    try {
      // Load all leads by default (change to false for manual pagination)
      const leads = await fetchLeads(form.id, selectedPage.access_token, form.name, 100, true);
      setLeads(leads);
      setTotalLeadsCount(leads.length);
      setHasMoreLeads(false);
      setNextPageUrl(null);
    } catch (error) {
      console.error('Error fetching leads:', error);
      setError('Failed to fetch leads: ' + (error.response?.data?.error?.message || error.message));
    } finally {
      setLoading(false);
    }
  };

  // Format Lead Data for display
  const formatLeadData = (lead) => {
    const data = {};
    if (lead.field_data) {
      lead.field_data.forEach(field => {
        data[field.name] = field.values && field.values[0] ? field.values[0] : '';
      });
    }
    return data;
  };

  // Extract specific lead fields for table display
  const getLeadField = (lead, fieldName) => {
    if (!lead.field_data) return '';
    const field = lead.field_data.find(f =>
      f.name && f.name.toLowerCase().includes(fieldName.toLowerCase())
    );
    return field && field.values && field.values[0] ? field.values[0] : '';
  };

  // Get lead name (first_name + last_name or full_name or name)
  const getLeadName = (lead) => {
    const leadData = formatLeadData(lead);
    if (leadData.full_name) return leadData.full_name;
    if (leadData.name) return leadData.name;
    const firstName = leadData.first_name || '';
    const lastName = leadData.last_name || '';
    return `${firstName} ${lastName}`.trim() || 'N/A';
  };

  // Get lead email
  const getLeadEmail = (lead) => {
    return getLeadField(lead, 'email') || '';
  };

  // Get lead phone
  const getLeadPhone = (lead) => {
    return getLeadField(lead, 'phone') || '';
  };

  // Get lead company
  const getLeadCompany = (lead) => {
    return getLeadField(lead, 'company') || '';
  };

  // Logout function
  const handleLogout = async () => {
    if (window.FB) {
      window.FB.logout();
    }
    setAccessToken(null);
    setUserInfo(null);
    setPages([]);
    setSelectedPage(null);
    setLeadForms([]);
    setSelectedForm(null);
    setLeads([]);
    setError(null);

    // Clear backend and localStorage
    await clearBackend();
  };

  // Refresh leads - fetch all leads from all forms (or refresh forms first if missing)
  const refreshLeads = async () => {
    if (!selectedPage) return;

    if (!leadForms?.length) {
      const stored = loadFromStorage();
      if (stored?.accessToken) {
        await fetchPages(stored.accessToken);
      } else if (selectedPage.access_token) {
        await fetchLeadForms(selectedPage.id, selectedPage.access_token);
      }
      return;
    }

    leadsHydratedRef.current = false;
    clearLeadsSessionCache();
    setLeads([]);
    setNextPageUrl(null);
    setHasMoreLeads(false);
    setTotalLeadsCount(0);
    setSelectedLeadIds([]);
    fetchAllLeads();
  };

  const refreshFacebookData = async () => {
    if (loading) return;

    leadsHydratedRef.current = false;
    clearLeadsSessionCache();
    setLeads([]);
    setNextPageUrl(null);
    setHasMoreLeads(false);
    setTotalLeadsCount(0);
    setSelectedLeadIds([]);

    const stored = loadFromStorage();
    if (stored?.accessToken) {
      await fetchPages(stored.accessToken);
      const latest = loadFromStorage();
      const page = latest?.selectedPage;
      const forms = latest?.leadForms;
      if (page?.access_token && forms?.length) {
        await fetchAllLeadsFromForms(page, forms);
      }
      return;
    }

    if (selectedPage?.access_token) {
      await fetchLeadForms(selectedPage.id, selectedPage.access_token);
      const latest = loadFromStorage();
      if (latest?.leadForms?.length && latest?.selectedPage) {
        await fetchAllLeadsFromForms(latest.selectedPage, latest.leadForms);
      }
    }
  };

  // Auto-select first page when pages are loaded and no page is selected
  useEffect(() => {
    if (pages.length > 0 && !selectedPage && accessToken) {
      console.log('Auto-selecting first page:', pages[0].name || pages[0].id);
      const firstPage = pages[0];
      setSelectedPage(firstPage);

      // Update storage
      const stored = loadFromStorage();
      if (stored) {
        const updatedData = {
          ...stored,
          selectedPage: firstPage,
        };
        saveSession(updatedData);
      }

      // Fetch lead forms for the first page
      if (firstPage.access_token) {
        fetchLeadForms(firstPage.id, firstPage.access_token);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pages.length, accessToken]);

  // Auto-fetch all leads when leadForms are loaded (only if not already cached)
  useEffect(() => {
    if (
      selectedPage &&
      leadForms &&
      leadForms.length > 0 &&
      leads.length === 0 &&
      !loading &&
      !leadsHydratedRef.current
    ) {
      fetchAllLeads();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [leadForms?.length, selectedPage?.id, leads.length, loading]);

  // Validate & auto-refresh token on window focus - catches sessions that expired or are near expiry while tab was idle
  useEffect(() => {
    if (!accessToken) return;

    let isRefreshing = false;

    const validateAndRefreshOnFocus = async () => {
      if (isRefreshing) return;
      const stored = loadFromStorage();
      if (!stored?.tokenExpiresAt) return;

      const msUntilExpiry = stored.tokenExpiresAt - Date.now();
      const daysUntilExpiry = Math.round(msUntilExpiry / (1000 * 60 * 60 * 24));

      if (msUntilExpiry <= 0) {
        // Token expired - try auto-refresh
        isRefreshing = true;
        await handleTokenExpired();
        isRefreshing = false;
      } else if (daysUntilExpiry <= 7) {
        // Near expiry - proactive background refresh
        isRefreshing = true;
        console.log(`[FB Auto-Refresh] Focus: token expires in ${daysUntilExpiry}d - refreshing...`);
        await refreshTokenInBackground(stored.accessToken);
        isRefreshing = false;
      }
    };

    window.addEventListener('focus', validateAndRefreshOnFocus);
    return () => window.removeEventListener('focus', validateAndRefreshOnFocus);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accessToken]);

  // Keep corner token-health label in sync while connected
  useEffect(() => {
    if (!accessToken) {
      setTokenHealth({ expiresAt: null, isLongLived: null });
      return;
    }
    syncTokenHealthFromStorage();
    const intervalId = setInterval(syncTokenHealthFromStorage, 60 * 1000);
    return () => clearInterval(intervalId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accessToken]);

  // Periodic background token refresh - checks every 12 hours while the app is open
  useEffect(() => {
    if (!accessToken) return;

    const TWELVE_HOURS = 12 * 60 * 60 * 1000;

    const checkAndRefresh = async () => {
      const stored = loadFromStorage();
      if (!stored?.tokenExpiresAt || !stored?.accessToken) return;

      const daysUntilExpiry = Math.round((stored.tokenExpiresAt - Date.now()) / (1000 * 60 * 60 * 24));

      if (daysUntilExpiry <= 7) {
        console.log(`[FB Auto-Refresh] Periodic check: token expires in ${daysUntilExpiry}d - refreshing...`);
        await refreshTokenInBackground(stored.accessToken);
      }
    };

    const intervalId = setInterval(checkAndRefresh, TWELVE_HOURS);
    return () => clearInterval(intervalId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accessToken]);

  // Fetch forms for filter page
  useEffect(() => {
    const fetchFormsForFilterPage = async () => {
      if (filterSelectedPage && isFilterDialogOpen) {
        setIsLoadingFilterForms(true);
        try {
          const page = pages.find(p => p.id === filterSelectedPage);
          if (page && page.access_token) {
            const response = await axios.get(`https://graph.facebook.com/v23.0/${page.id}/leadgen_forms`, {
              params: {
                access_token: page.access_token,
                fields: 'id,name,status,leads_count,created_time'
              }
            });
            const fetchedForms = response.data.data || [];
            setFilterPageForms(fetchedForms);
            // Reset selected forms if they don't belong to the new page
            setFilterSelectedForms(prev => {
              const formIds = fetchedForms.map((f) => f.id);
              return prev.filter(id => formIds.includes(id));
            });
          } else {
            setFilterPageForms([]);
            setFilterSelectedForms([]);
          }
        } catch (error) {
          console.error('Error fetching forms for filter page:', error);
          setFilterPageForms([]);
          setFilterSelectedForms([]);
        } finally {
          setIsLoadingFilterForms(false);
        }
      } else if (!filterSelectedPage && isFilterDialogOpen) {
        // If no page selected, show forms from currently selected page
        setFilterPageForms(leadForms);
      }
    };

    fetchFormsForFilterPage();
  }, [filterSelectedPage, isFilterDialogOpen, pages, leadForms]);

  const getLoggedInUserId = () => {
    try {
      const userData = localStorage.getItem("garage_tok");
      if (!userData) return "";
      const parsed = jwtDecode(userData);
      return String(parsed.userId || parsed.id || parsed.sub || "");
    } catch {
      return "";
    }
  };

  const fetchOwners = async () => {
    setIsLoadingOwners(true);
    const loggedInId = getLoggedInUserId();
    try {
      const response = await authenticatedFetch(
        buildExternalUrl("/users?limit=1000"),
        { method: "GET" }
      );

      if (response.ok) {
        const data = await response.json();
        const list = data?.data?.users || data?.users || data?.data || data || [];
        const options = (Array.isArray(list) ? list : [])
          .map((user) => {
            const id = user._id || user.id || user.userId || "";
            const name =
              user.name ||
              `${user.firstName || ""} ${user.lastName || ""}`.trim() ||
              user.email ||
              "Unknown";
            return { id: String(id), name: String(name) };
          })
          .filter((o) => o.id && o.name);

        setOwnerOptions(options);

        const defaultOwner =
          options.find((o) => o.id === loggedInId)?.id ||
          options[0]?.id ||
          loggedInId ||
          "";
        setSelectedOwnerId(defaultOwner);
      } else {
        console.warn("Failed to load owners for Facebook import:", response.status);
        if (loggedInId) {
          setOwnerOptions([{ id: loggedInId, name: "You (current user)" }]);
          setSelectedOwnerId(loggedInId);
        }
      }
    } catch (error) {
      console.error("Error fetching owners:", error);
      if (loggedInId) {
        setOwnerOptions([{ id: loggedInId, name: "You (current user)" }]);
        setSelectedOwnerId(loggedInId);
      }
    } finally {
      setIsLoadingOwners(false);
    }
  };

  // Fetch sales funnels
  const fetchSalesFunnels = async () => {
    setIsLoadingFunnels(true);
    try {
      const response = await authenticatedFetch(
        buildExternalUrl("/crm/funnels?skip=0&limit=100"),
        { method: "GET" }
      );

      if (response.ok) {
        const data = await response.json();
        const funnelsData = data.funnels || data.data || data || [];
        setSalesFunnels(funnelsData);
        if (funnelsData.length > 0 && !selectedFunnelId) {
          setSelectedFunnelId(funnelsData[0]._id || funnelsData[0].id || "");
        }
      }
    } catch (error) {
      console.error("Error fetching sales funnels:", error);
      toast.error("Failed to fetch sales funnels");
    } finally {
      setIsLoadingFunnels(false);
    }
  };

  // Calculate estimated value based on rules
  const calculateEstimatedValue = (leadData) => {
    // Look for estimated value or budget fields in the lead data
    const valueFields = [
      'estimated_value', 'estimated value', 'budget', 'budget_range',
      'expected_budget', 'expected budget', 'investment', 'investment_range'
    ];

    let value = 0;
    for (const field of valueFields) {
      const fieldValue = leadData[field] || leadData[field.toLowerCase()] || leadData[field.toUpperCase()];
      if (fieldValue) {
        // Extract numeric value (remove currency symbols, commas, etc.)
        const numericValue = parseFloat(fieldValue.toString().replace(/[^\d.]/g, ''));
        if (!isNaN(numericValue)) {
          value = numericValue;
          break;
        }
      }
    }

    // Apply business rules
    // If value is in lakhs (Indian numbering system)
    // 1 lakh = 100,000
    if (value > 0) {
      // If value is less than or equal to 2 lakh (200,000)
      if (value <= 200000) {
        return 200000; // 2,00,000
      }
      // If value is between 2 lakh and 5 lakh (200,000 to 500,000)
      else if (value > 200000 && value <= 500000) {
        return 500000; // 5,00,000
      }
      // If value is greater than 5 lakh, return as is
      else {
        return value;
      }
    }

    // Default to 200000 if no value found
    return 200000;
  };

  // Extract contact information from lead data
  const extractContactInfo = (leadData) => {
    // Common field name variations
    const nameFields = ['full_name', 'full name', 'name', 'contact_name', 'contact name'];
    const emailFields = ['work_email', 'work email', 'email', 'email_address', 'email address'];
    const phoneFields = ['phone_number', 'phone number', 'phone', 'mobile', 'mobile_number', 'mobile number'];

    let fullName = '';
    let email = '';
    let phone = '';

    // Find name
    for (const field of nameFields) {
      const value = leadData[field] || leadData[field.toLowerCase()] || leadData[field.toUpperCase()];
      if (value && value.trim()) {
        fullName = value.trim();
        break;
      }
    }

    // Find email
    for (const field of emailFields) {
      const value = leadData[field] || leadData[field.toLowerCase()] || leadData[field.toUpperCase()];
      if (value && value.trim()) {
        email = value.trim();
        break;
      }
    }

    // Find phone
    for (const field of phoneFields) {
      const value = leadData[field] || leadData[field.toLowerCase()] || leadData[field.toUpperCase()];
      if (value && value.trim()) {
        phone = value.trim();
        break;
      }
    }

    // Split name into first and last name
    const nameParts = fullName.split(/\s+/);
    const firstName = nameParts[0] || '';
    const lastName = nameParts.slice(1).join(' ') || '';

    return { firstName, lastName, email, phone, fullName };
  };

  // Handle lead selection
  const handleLeadSelect = (leadId) => {
    setSelectedLeadIds(prev => {
      if (prev.includes(leadId)) {
        return prev.filter(id => id !== leadId);
      } else {
        return [...prev, leadId];
      }
    });
  };

  // Handle select all leads
  const handleSelectAll = () => {
    if (selectedLeadIds.length === leads.length) {
      setSelectedLeadIds([]);
    } else {
      setSelectedLeadIds(leads.map(lead => lead.id));
    }
  };

  // Open import dialog
  // Extract all available Facebook fields from selected leads
  const extractAvailableFacebookFields = () => {
    const selectedLeads = leads.filter(lead => selectedLeadIds.includes(lead.id));
    const allFields = new Set();

    selectedLeads.forEach(lead => {
      if (lead.field_data && Array.isArray(lead.field_data)) {
        lead.field_data.forEach(field => {
          if (field.name) {
            allFields.add(field.name);
          }
        });
      }
    });

    return Array.from(allFields).sort();
  };

  // Auto-map common fields
  const autoMapFields = (facebookFields) => {
    const mappings = {
      leadName: "",
      contactName: "",
      email: "",
      phone: "",
      company: "",
      jobTitle: "",
      source: "",
      notes: ""
    };

    // Common field name patterns
    const namePatterns = ['full_name', 'full name', 'name', 'contact_name', 'contact name', 'first_name', 'first name', 'last_name', 'last name'];
    const emailPatterns = ['email', 'work_email', 'work email', 'email_address', 'email address'];
    const phonePatterns = ['phone', 'phone_number', 'phone number', 'mobile', 'mobile_number', 'mobile number'];
    const companyPatterns = ['company', 'company_name', 'company name', 'organization', 'org'];
    const jobTitlePatterns = ['job_title', 'job title', 'position', 'role', 'designation'];
    const sourcePatterns = ['source', 'lead_source', 'lead source', 'referral_source'];

    const findMatchingField = (patterns, fields) => {
      for (const pattern of patterns) {
        const lowerPattern = pattern.toLowerCase();
        const match = fields.find(f => f.toLowerCase() === lowerPattern || f.toLowerCase().includes(lowerPattern));
        if (match) return match;
      }
      return "";
    };

    mappings.contactName = findMatchingField(namePatterns, facebookFields) || "";
    mappings.email = findMatchingField(emailPatterns, facebookFields) || "";
    mappings.phone = findMatchingField(phonePatterns, facebookFields) || "";
    mappings.company = findMatchingField(companyPatterns, facebookFields) || "";
    mappings.jobTitle = findMatchingField(jobTitlePatterns, facebookFields) || "";
    mappings.source = findMatchingField(sourcePatterns, facebookFields) || "";

    // Use contact name for lead name by default
    mappings.leadName = mappings.contactName;

    return mappings;
  };

  const handleOpenImportDialog = () => {
    if (selectedLeadIds.length === 0) {
      toast.error("Please select at least one lead to import");
      return;
    }

    // Extract available Facebook fields
    const facebookFields = extractAvailableFacebookFields();
    setAvailableFacebookFields(facebookFields);

    // Auto-map common fields
    const autoMapped = autoMapFields(facebookFields);
    setFieldMappings(autoMapped);

    fetchSalesFunnels();
    fetchOwners();
    setIsImportDialogOpen(true);
  };

  // Import selected leads
  const handleImportLeads = async () => {
    if (!selectedFunnelId) {
      toast.error("Please select a sales funnel");
      return;
    }

    if (!selectedOwnerId) {
      toast.error("Please select an owner");
      return;
    }

    if (selectedLeadIds.length === 0) {
      toast.error("Please select at least one lead to import");
      return;
    }

    setIsImporting(true);
    const loadingToast = toast.loading(`Importing ${selectedLeadIds.length} lead(s)...`);

    try {
      const selectedLeads = leads.filter(lead => selectedLeadIds.includes(lead.id));
      let successCount = 0;
      let errorCount = 0;
      const errors = [];

      for (const lead of selectedLeads) {
        try {
          const leadData = formatLeadData(lead);

          // Extract values using field mappings
          const getMappedValue = (mappingKey) => {
            const mappedField = fieldMappings[mappingKey];
            if (!mappedField || mappedField === "__dont_map__") return "";
            return leadData[mappedField] || "";
          };

          // Get mapped values
          const leadName = getMappedValue("leadName")?.trim() || "";
          const contactName = getMappedValue("contactName")?.trim() || "";
          const email = getMappedValue("email")?.trim() || "";
          const phone = getMappedValue("phone")?.trim() || "";
          const company = getMappedValue("company")?.trim() || "";
          const jobTitle = getMappedValue("jobTitle")?.trim() || "";
          const source = getMappedValue("source")?.trim() || "";

          // Validate required fields
          if (!leadName) {
            errors.push(`Lead ${lead.id}: Lead name is required`);
            errorCount++;
            continue;
          }
          if (!contactName) {
            errors.push(`Lead ${lead.id}: Contact name is required`);
            errorCount++;
            continue;
          }
          if (!email) {
            errors.push(`Lead ${lead.id}: Email is required`);
            errorCount++;
            continue;
          }

          // Split contact name into first and last name
          const nameParts = contactName.split(/\s+/);
          const firstName = nameParts[0] || "";
          const lastName = nameParts.slice(1).join(" ") || "";

          // Calculate estimated value
          const estimatedValue = calculateEstimatedValue(leadData);

          // Build contact info from mappings
          const contactInfo = {
            firstName,
            lastName,
            email,
            phone,
            fullName: contactName
          };

          // Step 1: Find existing contact or create a new one (email/phone aware)
          let contactId = null;
          try {
            // 1A. Try to find an existing contact via search API (by email/phone/name)
            const searchTerm = contactInfo.email || contactInfo.phone || contactInfo.fullName;
            if (searchTerm && searchTerm.trim()) {
              try {
                const params = new URLSearchParams({ q: searchTerm.trim() });
                const searchResponse = await authenticatedFetch(
                  buildExternalUrl(`crm/searchcontact?${params.toString()}`),
                  { method: "GET" }
                );

                if (searchResponse.ok) {
                  const searchData = await searchResponse.json();
                  const searchResults = Array.isArray(searchData.contacts)
                    ? searchData.contacts
                    : Array.isArray(searchData)
                      ? searchData
                      : [];

                  const normalizePhone = (value) =>
                    (value || "").replace(/[\s\-()+]/g, "");

                  const targetEmail = (contactInfo.email || "").toLowerCase();
                  const targetPhone = normalizePhone(contactInfo.phone);

                  const existingContact = searchResults.find((c) => {
                    const cEmail = (c.email || "").toLowerCase();
                    const cPhone = normalizePhone(c.phoneNumber || c.phone);

                    if (targetEmail && cEmail === targetEmail) return true;
                    if (targetPhone && cPhone && cPhone === targetPhone) return true;
                    return false;
                  });

                  if (existingContact) {
                    contactId =
                      existingContact._id ||
                      existingContact.id ||
                      existingContact.contactId;
                  }
                }
              } catch (searchError) {
                console.warn("Error searching existing contact, will try create:", searchError);
              }
            }

            // 1B. Create contact only if we didn't find an existing one
            if (!contactId) {
              const contactData = {
                firstName: contactInfo.firstName,
                lastName: contactInfo.lastName,
                email: contactInfo.email || undefined,
                phoneNumber: contactInfo.phone || undefined,
              };

              const contactResponse = await authenticatedFetch(
                buildExternalUrl("/crm/contacts"),
                {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify(contactData),
                }
              );

              if (contactResponse.ok) {
                const contactResult = await contactResponse.json();
                contactId =
                  contactResult.contact?._id ||
                  contactResult._id ||
                  contactResult.id ||
                  contactResult.contactId;
              } else {
                const errorData = await contactResponse
                  .json()
                  .catch(() => ({}));
                throw new Error(errorData.message || "Failed to create contact");
              }
            }
          } catch (contactError) {
            errors.push(
              `Lead ${lead.id}: ${contactError.message || "Failed to create or fetch contact"
              }`
            );
            errorCount++;
            continue;
          }

          if (!contactId) {
            errors.push(`Lead ${lead.id}: Failed to get contact ID`);
            errorCount++;
            continue;
          }

          // Step 2: Create lead (owner from import dialog selection)
          const userData = localStorage.getItem("garage_tok");

          // Build notes from mapped notes field and unmapped fields
          let notes = `Imported from Facebook Lead Form: ${lead.formName || "Unknown"}\n\n`;

          // Add mapped notes field if available
          const mappedNotes = getMappedValue("notes");
          if (mappedNotes && mappedNotes.trim()) {
            notes += `${mappedNotes}\n\n`;
          }

          // Get all mapped field names
          const mappedFieldNames = Object.values(fieldMappings).filter(f => f && f.trim());

          // Add unmapped fields to notes
          const unmappedFields = Object.keys(leadData).filter(key => {
            return !mappedFieldNames.includes(key) && leadData[key] && leadData[key].trim();
          });

          if (unmappedFields.length > 0) {
            notes += 'Additional Information:\n';
            unmappedFields.forEach(field => {
              const value = leadData[field];
              if (value && value.trim()) {
                notes += `${field}: ${value}\n`;
              }
            });
          }

          // Get the first stage of the selected funnel
          const selectedFunnel = salesFunnels.find(f => (f._id || f.id) === selectedFunnelId);
          const funnelStages = selectedFunnel?.funnelStage || selectedFunnel?.stages || [];
          const firstStage = Array.isArray(funnelStages) && funnelStages.length > 0
            ? (typeof funnelStages[0] === 'string' ? funnelStages[0] : (funnelStages[0].name || funnelStages[0].stage || "Prospects"))
            : "Prospects";

          const leadPayload = {
            contactId: contactId,
            leadName: leadName,
            estimatedValue: estimatedValue,
            salesFunnel: selectedFunnelId,
            stage: firstStage,
            quantity: 1,
            pricing: estimatedValue,
            negotiatedPricing: estimatedValue,
            MaxDiscPrice: estimatedValue,
            assignedTo: selectedOwnerId,
            source: source || "Facebook Lead Ads",
            notes: notes.trim(),
            company: company || undefined,
            email: email,
            phone: phone,
          };

          const leadResponse = await authenticatedFetch(
            buildExternalUrl("/crm/leads"),
            {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(leadPayload),
            }
          );

          if (leadResponse.ok) {
            successCount++;

            // Send immediate notification for the imported Facebook lead
            try {
              const leadResult = await leadResponse.clone().json().catch(() => ({}));
              const createdLeadId = leadResult.lead?._id || leadResult._id || leadResult.id || '';

              // Get user email for notification
              let userEmail = '';
              let userName = '';
              if (userData) {
                try {
                  const parsedUserData = jwtDecode<JwtPayload>(userData);
                  userEmail = parsedUserData.email || parsedUserData.email_id || '';
                  userName = parsedUserData.name || parsedUserData.firstName || 'User';
                } catch (e) {
                  console.error("Error parsing user data for notification:", e);
                }
              }

              // Add to bell icon notification dropdown
              addLeadNotification({
                type: 'facebook_lead',
                leadId: createdLeadId,
                leadName: leadName,
                estimatedValue: estimatedValue,
                source: source || 'Facebook Lead Ads',
                stage: firstStage,
                message: `New lead imported from Facebook: ${leadName}`,
              });

              // Send email notification if user email is available
              if (userEmail) {
                fetch("/api/notifications/lead-email", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({
                    to: userEmail,
                    leadName: leadName,
                    estimatedValue: estimatedValue,
                    stage: firstStage,
                    source: source || "Facebook Lead Ads",
                    leadId: createdLeadId,
                    userName: userName,
                  }),
                }).catch(emailError => {
                  console.error("Error sending lead notification email:", emailError);
                });
              }
            } catch (notificationError) {
              console.error("Error sending notification for imported lead:", notificationError);
              // Don't fail the import if notification fails
            }
          } else {
            const errorData = await leadResponse.json().catch(() => ({}));
            errors.push(`Lead ${lead.id}: ${errorData.message || "Failed to create lead"}`);
            errorCount++;
          }
        } catch (leadError) {
          errors.push(`Lead ${lead.id}: ${leadError.message || "Failed to import lead"}`);
          errorCount++;
        }
      }

      // Show results
      if (successCount > 0) {
        toast.success(`Successfully imported ${successCount} lead(s)`, { id: loadingToast });
        window.dispatchEvent(new CustomEvent(DEALS_CRM_STATS_REFRESH_EVENT));
        dispatchDealsLeadsRefresh();
      }
      if (errorCount > 0) {
        toast.error(`Failed to import ${errorCount} lead(s). Check console for details.`, { id: loadingToast });
        console.error("Import errors:", errors);
      }

      // Clear selections and close dialog
      setSelectedLeadIds([]);
      setIsImportDialogOpen(false);
      setSelectedFunnelId("");
    } catch (error) {
      console.error("Error importing leads:", error);
      toast.error("Failed to import leads. Please try again.", { id: loadingToast });
    } finally {
      setIsImporting(false);
    }
  };

  // If not connected to Facebook
  if (!accessToken) {
    const fbBgColor = resolvedTheme === "color" ? "rgba(0,0,0,0.3)" : resolvedTheme === "dark" ? "#2a2a2a" : "#fff";
    const imgIcon = `data:image/svg+xml,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><circle cx="12" cy="12" r="12" fill="${fbBgColor}"/><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.469h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.469h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" fill="#1877f2"/></svg>`)}`;
    const imgIcon1 = "data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAyNCAyNCIgZmlsbD0ibm9uZSIgc3Ryb2tlPSIjMjJjNTVlIiBzdHJva2Utd2lkdGg9IjIiIHN0cm9rZS1saW5lY2FwPSJyb3VuZCIgc3Ryb2tlLWxpbmVqb2luPSJyb3VuZCI+PGNpcmNsZSBjeD0iMTIiIGN5PSIxMiIgcj0iMTAiLz48cGF0aCBkPSJtOSAxMiAyIDIgNC00Ii8+PC9zdmc+";
    const imgIcon2 = "data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAyNCAyNCIgZmlsbD0id2hpdGUiPjxwYXRoIGQ9Ik0yNCAxMi4wNzNjMC02LjYyNy01LjM3My0xMi0xMi0xMnMtMTIgNS4zNzMtMTIgMTJjMCA1Ljk5IDQuMzg4IDEwLjk1NCAxMC4xMjUgMTEuODU0di04LjM4NUg3LjA3OHYtMy40NjloMy4wNDdWOS40M2MwLTMuMDA3IDEuNzkyLTQuNjY5IDQuNTMzLTQuNjY5IDEuMzEyIDAgMi42ODYuMjM1IDIuNjg2LjIzNXYyLjk1M0gxNS44M2MtMS40OTEgMC0xLjk1Ni45MjUtMS45NTYgMS44NzR2Mi4yNWgzLjMyOGwtLjUzMiAzLjQ2OWgtMi43OTZ2OC4zODVDMTkuNjEyIDIzLjAyNyAyNCAxOC4wNjIgMjQgMTIuMDczeiIvPjwvc3ZnPg==";

    return (
      <div className="w-full flex flex-col">
        {/* Top Header Bar mimicking Leads List header */}
        <div
          className={isInlineDealsMode
            ? "bg-[#121215] w-full border-b border-[#2a2d3a] px-[20px] pt-[20px] pb-[15px]"
            : `border-b min-h-[64.667px] relative shrink-0 w-full max-w-full flex items-center px-6 py-3 ${
                resolvedTheme === "color"
                  ? "border-[rgba(0,255,255,0.2)] bg-[#0A0E27]"
                  : "border-[#e5e7eb] dark:border-[#3a3a3a] bg-white dark:bg-[#1a1a1a]"
              }`
          }
        >
          <div className="flex items-center justify-between overflow-clip w-full">
            <div className="flex items-center gap-[12px] min-w-0">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="outline"
                    className={isInlineDealsMode
                      ? "h-[32px] pl-[12px] pr-[10px] py-[6px] rounded-[6px] border border-[#2a2d3a] bg-[#181818] text-white text-[12px] font-semibold shadow-none hover:bg-[#181818]"
                      : `h-[32px] px-[10px] rounded-[6px] text-[12px] font-bold shadow-none border ${
                          resolvedTheme === "color"
                            ? "border-[rgba(0,255,255,0.2)] bg-[rgba(0,0,0,0.3)] text-white hover:bg-[rgba(0,255,255,0.05)]"
                            : resolvedTheme === "dark"
                              ? "border-[#3a3a3a] bg-[#2a2a2a] text-[#e5e5e5] hover:bg-[#333]"
                              : "border-[#e5e7eb] bg-white text-[#1f1f1f] hover:bg-muted/50"
                        }`
                    }
                  >
                    Facebook Leads
                    <img
                      alt=""
                      src="/figma/deals/leads/chevron-down.svg"
                      className="h-[14px] w-[14px] ml-[8px]"
                    />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent
                  align="start"
                  className={resolvedTheme === "color" ? "bg-[#0A0E27] border-[rgba(0,255,255,0.2)]" : resolvedTheme === "dark" ? "bg-[#1a1a1a] border-[#3a3a3a]" : "bg-white border-[#e5e7eb]"}
                >
                  <DropdownMenuItem
                    className={`h-[28px] px-2 rounded-[4px] hover:bg-muted/50 ${resolvedTheme === "color" ? "text-white" : resolvedTheme === "dark" ? "text-[#e5e5e5]" : "text-[#1f1f1f]"}`}
                    onClick={() => {
                      if (setActiveTab) {
                        setActiveTab("leads");
                      } else {
                        router.push("/deals/leads");
                      }
                    }}
                  >
                    <span className="text-[12px] leading-[16px] pl-6">CRM Leads</span>
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    className={`h-[28px] px-2 rounded-[4px] hover:bg-muted/50 ${resolvedTheme === "color" ? "text-white" : resolvedTheme === "dark" ? "text-[#e5e5e5]" : "text-[#1f1f1f]"}`}
                    onClick={() => {
                      if (setActiveTab) {
                        setActiveTab("facebook-leads");
                      }
                    }}
                  >
                    <div className="flex items-center gap-2 pl-2">
                      <Check className={`h-4 w-4 ${resolvedTheme === "color" ? "text-white" : resolvedTheme === "dark" ? "text-white" : "text-black"}`} />
                      <span className="text-[12px] leading-[16px]">Facebook Leads</span>
                    </div>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        </div>

        {/* Centered Connection Card */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            width: "100%",
            maxWidth: "400px",
            margin: "80px auto",
            padding: "20px",
            gap: "24px",
          }}
        >
        {/* Facebook Icon */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            borderRadius: "50%",
            width: "80px",
            height: "80px",
            flexShrink: 0,
            marginTop: "12px",
            backgroundColor: resolvedTheme === "color" ? "rgba(0,0,0,0.3)" : resolvedTheme === "dark" ? "#2a2a2a" : "#fff",
            boxShadow: "0 8px 16px rgba(0, 0, 0, 0.06)",
            border: resolvedTheme === "color" ? "1px solid rgba(0,255,255,0.2)" : resolvedTheme === "dark" ? "1px solid #3a3a3a" : "1px solid #f0f2f5",
          }}
        >
          <img
            alt="Facebook Icon"
            src={imgIcon}
            style={{
              width: "52px",
              height: "52px",
              display: "block"
            }}
          />
        </div>

        {/* Heading and Description */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: "8px",
            alignItems: "center",
            width: "100%",
            color: "inherit",
          }}
        >
          <p
            style={{
              fontFamily: "Arial, sans-serif",
              fontWeight: "bold",
              lineHeight: "28px",
              color: "inherit",
              fontSize: "18px",
              textAlign: "center",
              margin: 0,
            }}
          >
            Connect Facebook Lead Ads
          </p>
          <p
            style={{
              fontFamily: "Arial, sans-serif",
              fontWeight: "normal",
              lineHeight: "20px",
              color: "var(--muted-foreground)",
              fontSize: "14px",
              textAlign: "center",
              whiteSpace: "pre-wrap",
              margin: 0,
            }}
          >
            Connect your Facebook account to import leads from your Facebook Lead Ad campaigns directly into your CRM.
          </p>
        </div>

        {/* Features List */}
        <div
          style={{
            backgroundColor: "rgba(15, 23, 42, 0.5)",
            display: "flex",
            flexDirection: "column",
            gap: "12px",
            alignItems: "flex-start",
            padding: "16px",
            borderRadius: "8px",
            width: "100%",
            border: "1px solid rgba(148, 163, 184, 0.4)",
          }}
        >
          <p
            style={{
              fontFamily: "Arial, sans-serif",
              fontWeight: "bold",
              lineHeight: "16px",
              color: "inherit",
              fontSize: "12px",
              margin: 0,
            }}
          >
            You&apos;ll be able to:
          </p>

          <div style={{ display: "flex", flexDirection: "column", gap: "12px", width: "100%" }}>
            {[
              "View all your Facebook Pages and Lead Forms",
              "Access leads from active campaigns",
              "Map form fields to CRM fields",
              "Import leads to your sales funnel"
            ].map((text, i) => (
              <div key={i} style={{ display: "flex", alignItems: "flex-start", gap: "8px", width: "100%" }}>
                <img alt="Check Icon" src={imgIcon1} style={{ flexShrink: 0, width: "16px", height: "16px", marginTop: "2px" }} />
                <p
                  style={{
                    fontFamily: "Arial, sans-serif",
                    fontWeight: "normal",
                    lineHeight: "20px",
                    color: "var(--muted-foreground)",
                    fontSize: "13px",
                    margin: 0,
                  }}
                >
                  {text}
                </p>
              </div>
            ))}
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: "12px", width: "100%", alignItems: "center" }}>
          {/* Connect Button */}
          <button
            onClick={handleFacebookLogin}
            disabled={loading}
            style={{
              backgroundColor: loading ? "#ccc" : "#1877f2",
              height: "40px",
              borderRadius: "6px",
              width: "100%",
              border: "none",
              cursor: loading ? "not-allowed" : "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "8px",
              padding: "0 16px",
              marginTop: "8px",
            }}
          >
            <img alt="Facebook Icon" src={imgIcon2} style={{ width: "18px", height: "18px", flexShrink: 0 }} />
            <span
              style={{
                fontFamily: "Arial, sans-serif",
                fontWeight: "bold",
                fontSize: "15px",
                color: "white",
              }}
            >
              {loading ? "Connecting..." : "Connect with Facebook"}
            </span>
          </button>

          {/* Disclaimer Text */}
          <p
            style={{
              fontFamily: "Arial, sans-serif",
              fontWeight: "normal",
              color: "var(--muted-foreground)",
              fontSize: "12px",
              textAlign: "center",
              margin: 0,
            }}
          >
            You&apos;ll be redirected to Facebook to authorize access
          </p>
          <p
            style={{
              fontFamily: "Arial, sans-serif",
              fontWeight: "normal",
              color: "var(--muted-foreground)",
              fontSize: "11px",
              lineHeight: "16px",
              textAlign: "center",
              margin: 0,
              opacity: 0.75,
            }}
          >
            After connecting, FB stable in the bottom corner means your link lasts about 60 days and
            renews automatically - even if you sign out of Garage. FB short means reconnect soon.
          </p>
        </div>

        {/* Error Display */}
        {error && (
          <div
            style={{
              width: "100%",
              backgroundColor: "#ffebee",
              color: "#c62828",
              padding: "15px",
              borderRadius: "5px",
              marginTop: "16px",
              border: "1px solid #ffcdd2",
            }}
          >
            <strong>Error:</strong> {error}
            {error.includes('JSSDK') && (
              <div style={{ marginTop: "10px", fontSize: "14px" }}>
                <p><strong>To fix this issue:</strong></p>
                <ol style={{ margin: "5px 0", paddingLeft: "20px" }}>
                  <li>Go to <a href="https://developers.facebook.com" target="_blank" rel="noopener noreferrer" style={{ color: "#1976d2" }}>developers.facebook.com</a></li>
                  <li>Select your app (ID: 1389133145656991)</li>
                  <li>Go to App Settings → Basic</li>
                  <li>Enable &quot;Login with JavaScript SDK&quot; option</li>
                  <li>Save the changes</li>
                </ol>
                <p style={{ marginTop: "10px" }}>
                  <strong>Alternative:</strong> Use the OAuth redirect method by clicking the button above.
                </p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
    );
  }

  // Filter handlers
  const handleOpenFilterDialog = () => {
    setFilterSelectedPage(appliedFilters.page || null);
    setFilterSelectedForms(appliedFilters.forms || []);
    setFilterStartDate(appliedFilters.startDate || "");
    setFilterEndDate(appliedFilters.endDate || "");
    setIsFilterDialogOpen(true);
  };

  const handleToggleFilterForm = (formId) => {
    setFilterSelectedForms(prev => {
      if (prev.includes(formId)) {
        return prev.filter(id => id !== formId);
      } else {
        return [...prev, formId];
      }
    });
  };

  const handleApplyFilters = async () => {
    // If a page is selected in filter, switch to that page first
    if (filterSelectedPage && filterSelectedPage !== selectedPage?.id) {
      const pageToSelect = pages.find(p => p.id === filterSelectedPage);
      if (pageToSelect) {
        await handlePageSelect(pageToSelect);
      }
    }

    setAppliedFilters({
      page: filterSelectedPage,
      forms: filterSelectedForms,
      startDate: filterStartDate,
      endDate: filterEndDate,
    });
    setIsFilterDialogOpen(false);
  };

  const handleClearFilters = () => {
    setFilterSelectedPage(null);
    setFilterSelectedForms([]);
    setFilterStartDate("");
    setFilterEndDate("");
    setAppliedFilters({
      page: null,
      forms: [],
      startDate: "",
      endDate: "",
    });
    setIsFilterDialogOpen(false);
  };

  // Handle page selection from dropdown
  const handlePageSelectFromDropdown = (page) => {
    handlePageSelect(page);
    setIsPageDropdownOpen(false);
  };

  // Handle form selection from dropdown
  const handleFormSelectFromDropdown = (form) => {
    handleFormSelect(form);
    setIsFormDropdownOpen(false);
  };

  const renderTokenHealthCorner = () => {
    if (!accessToken || !tokenHealth.expiresAt) return null;

    const msLeft = tokenHealth.expiresAt - Date.now();
    const daysLeft = Math.max(0, Math.round(msLeft / (1000 * 60 * 60 * 24)));
    const hoursLeft = Math.max(0, Math.round(msLeft / (1000 * 60 * 60)));
    const timeLabel =
      daysLeft >= 1 ? `${daysLeft}d` : hoursLeft >= 1 ? `${hoursLeft}h` : '<1h';
    const expiryDate = new Date(tokenHealth.expiresAt).toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
    const title = tokenHealth.isLongLived
      ? `Long-lived connection - expires ${expiryDate} (${timeLabel} left)`
      : `Short-lived token - expires soon (${timeLabel} left). Reconnect if sync stops.`;

    const mutedColor =
      resolvedTheme === 'color'
        ? 'rgba(0, 255, 255, 0.38)'
        : resolvedTheme === 'dark'
          ? 'rgba(156, 163, 175, 0.55)'
          : 'rgba(107, 114, 128, 0.62)';

    return (
      <div
        title={title}
        style={{
          position: 'absolute',
          bottom: 6,
          right: 8,
          zIndex: 2,
          fontSize: 10,
          lineHeight: '14px',
          fontFamily: 'Arial, sans-serif',
          color: mutedColor,
          opacity: 0.85,
          pointerEvents: 'auto',
          userSelect: 'none',
          letterSpacing: '0.01em',
        }}
      >
        FB {tokenHealth.isLongLived ? 'stable' : 'short'} · {timeLabel}
      </div>
    );
  };

  // Main dashboard
  return (
    <div
      className={
        isInlineDealsMode
          ? "relative min-h-full bg-[#0e0e0e]"
          : resolvedTheme === "color"
            ? "relative min-h-full bg-[#0A0E27]"
            : resolvedTheme === "dark"
              ? "relative min-h-full bg-[#1a1a1a]"
              : "relative min-h-full bg-white"
      }
    >
      {renderTokenHealthCorner()}
      {/* Header - Figma Design */}
      {accessToken && (
        <div
          className={`border-b border-l-0 border-r-0 border-t-0 flex flex-col items-start relative w-full ${
            isInlineDealsMode
              ? "bg-[#121215] border-[#2a2d3a] px-[20px] py-3"
              : resolvedTheme === "color"
                ? "border-[rgba(0,255,255,0.2)] px-6 py-3"
                : resolvedTheme === "dark"
                  ? "border-[#3a3a3a] px-6 py-3"
                  : "border-[#e5e7eb] px-6 py-3"
          }`}
        >
          <div
            style={{
              height: "36px",
              position: "relative",
              width: "100%",
              display: "flex",
              alignItems: "center",
              gap: "12px",
            }}
          >
            {/* Leads Type Dropdown (same pattern as leads list page) */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="outline"
                  className={`h-[32px] px-[10px] rounded-[6px] text-[12px] font-bold shadow-none border ${resolvedTheme === "color" ? "border-[rgba(0,255,255,0.2)] bg-[rgba(0,0,0,0.3)] text-white hover:bg-[rgba(0,255,255,0.05)]" : resolvedTheme === "dark" ? "border-[#3a3a3a] bg-[#2a2a2a] text-[#e5e5e5] hover:bg-[#333]" : "border-[#e5e7eb] bg-white text-[#1f1f1f] hover:bg-muted/50"}`}
                >
                  Facebook Leads
                  <ChevronDown className="h-4 w-4 ml-[6px]" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                align="start"
                className={resolvedTheme === "color" ? "bg-[#0A0E27] border-[rgba(0,255,255,0.2)]" : resolvedTheme === "dark" ? "bg-[#1a1a1a] border-[#3a3a3a]" : "bg-white border-[#e5e7eb]"}
              >
                <DropdownMenuItem
                  className={`h-[28px] px-2 rounded-[4px] hover:bg-muted/50 ${resolvedTheme === "color" ? "text-white" : resolvedTheme === "dark" ? "text-[#e5e5e5]" : "text-[#1f1f1f]"}`}
                  onClick={() => {
                    if (setActiveTab) {
                      setActiveTab("leads");
                    } else {
                      router.push("/deals/leads");
                    }
                  }}
                >
                  <Check className="h-4 w-4 mr-2 opacity-0" />
                  <span className="text-[12px] leading-[16px]">CRM Leads</span>
                </DropdownMenuItem>
                <DropdownMenuItem
                  className={`h-[28px] px-2 rounded-[4px] hover:bg-muted/50 ${resolvedTheme === "color" ? "text-white" : resolvedTheme === "dark" ? "text-[#e5e5e5]" : "text-[#1f1f1f]"}`}
                  onClick={() => {
                    if (setActiveTab) {
                      setActiveTab("facebook-leads");
                    } else {
                      router.push("/deals/leads?tab=facebook-leads");
                    }
                  }}
                >
                  <Check className="h-4 w-4 mr-2 opacity-100" />
                  <span className="text-[12px] leading-[16px]">Facebook Leads</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            {/* All Pages Dropdown */}
            <div style={{ position: "relative" }} data-dropdown="page">
              <button
                onClick={() => setIsPageDropdownOpen(!isPageDropdownOpen)}
                style={{
                  backgroundColor: resolvedTheme === "color" ? "rgba(0,0,0,0.3)" : resolvedTheme === "dark" ? "#2a2a2a" : "white",
                  border: resolvedTheme === "color" ? "0.667px solid rgba(0,255,255,0.2)" : resolvedTheme === "dark" ? "0.667px solid #3a3a3a" : "0.667px solid #e5e7eb",
                  borderRadius: "6px",
                  height: "36px",
                  width: "224px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  paddingLeft: "12.667px",
                  paddingRight: "12.667px",
                  cursor: "pointer",
                }}
              >
                <span
                  style={{
                    fontFamily: "Arial, sans-serif",
                    fontWeight: "normal",
                    lineHeight: "16px",
                    fontSize: "12px",
                    color: resolvedTheme === "color" ? "rgba(0,255,255,0.6)" : resolvedTheme === "dark" ? "#9ca3af" : "#6b7280",
                  }}
                >
                  {selectedPage ? selectedPage.name : "All Pages"}
                </span>
                <ChevronDown style={{ width: "16px", height: "16px", color: resolvedTheme === "color" ? "rgba(0,255,255,0.6)" : resolvedTheme === "dark" ? "#9ca3af" : "#6b7280" }} />
              </button>
              {isPageDropdownOpen && (
                <div
                  style={{
                    position: "absolute",
                    top: "100%",
                    left: 0,
                    marginTop: "4px",
                    backgroundColor: resolvedTheme === "color" ? "#0A0E27" : resolvedTheme === "dark" ? "#1a1a1a" : "white",
                    border: resolvedTheme === "color" ? "0.667px solid rgba(0,255,255,0.2)" : resolvedTheme === "dark" ? "0.667px solid #3a3a3a" : "0.667px solid #e5e7eb",
                    borderRadius: "6px",
                    boxShadow: "0px 4px 6px rgba(0, 0, 0, 0.1)",
                    zIndex: 1000,
                    minWidth: "224px",
                    maxHeight: "300px",
                    overflowY: "auto",
                  }}
                >
                  {pages.map((page) => (
                    <button
                      key={page.id}
                      onClick={() => handlePageSelectFromDropdown(page)}
                      style={{
                        width: "100%",
                        padding: "8px 12.667px",
                        textAlign: "left",
                        border: "none",
                        backgroundColor: selectedPage?.id === page.id ? (resolvedTheme === "color" ? "rgba(0,255,255,0.1)" : resolvedTheme === "dark" ? "#2a2a2a" : "#f3f4f6") : "transparent",
                        cursor: "pointer",
                        fontSize: "12px",
                        fontFamily: "Arial, sans-serif",
                        color: resolvedTheme === "color" ? "white" : resolvedTheme === "dark" ? "#e5e5e5" : "#1f1f1f",
                      }}
                      onMouseEnter={(e) => {
                        if (selectedPage?.id !== page.id) {
                          e.currentTarget.style.backgroundColor = resolvedTheme === "color" ? "rgba(0,255,255,0.05)" : resolvedTheme === "dark" ? "#333" : "#f9fafb";
                        }
                      }}
                      onMouseLeave={(e) => {
                        if (selectedPage?.id !== page.id) {
                          e.currentTarget.style.backgroundColor = "transparent";
                        }
                      }}
                    >
                      {page.name}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* All Forms Dropdown */}
            <div style={{ position: "relative" }} data-dropdown="form">
              <button
                onClick={() => setIsFormDropdownOpen(!isFormDropdownOpen)}
                disabled={!selectedPage}
                style={{
                  backgroundColor: resolvedTheme === "color" ? "rgba(0,0,0,0.3)" : resolvedTheme === "dark" ? "#2a2a2a" : "white",
                  border: resolvedTheme === "color" ? "0.667px solid rgba(0,255,255,0.2)" : resolvedTheme === "dark" ? "0.667px solid #3a3a3a" : "0.667px solid #e5e7eb",
                  borderRadius: "6px",
                  height: "36px",
                  width: "224px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  paddingLeft: "12.667px",
                  paddingRight: "12.667px",
                  cursor: selectedPage ? "pointer" : "not-allowed",
                  opacity: selectedPage ? 1 : 0.5,
                }}
              >
                <span
                  style={{
                    fontFamily: "Arial, sans-serif",
                    fontWeight: "normal",
                    lineHeight: "16px",
                    fontSize: "12px",
                    color: selectedForm ? (resolvedTheme === "color" ? "white" : resolvedTheme === "dark" ? "#e5e5e5" : "#1f1f1f") : (resolvedTheme === "color" ? "rgba(0,255,255,0.6)" : resolvedTheme === "dark" ? "#9ca3af" : "#6b7280"),
                  }}
                >
                  {selectedForm ? selectedForm.name : "All Forms"}
                </span>
                <ChevronDown style={{ width: "16px", height: "16px", color: resolvedTheme === "color" ? "rgba(0,255,255,0.6)" : resolvedTheme === "dark" ? "#9ca3af" : "#6b7280" }} />
              </button>
              {isFormDropdownOpen && selectedPage && (
                <div
                  style={{
                    position: "absolute",
                    top: "100%",
                    left: 0,
                    marginTop: "4px",
                    backgroundColor: resolvedTheme === "color" ? "#0A0E27" : resolvedTheme === "dark" ? "#1a1a1a" : "white",
                    border: resolvedTheme === "color" ? "0.667px solid rgba(0,255,255,0.2)" : resolvedTheme === "dark" ? "0.667px solid #3a3a3a" : "0.667px solid #e5e7eb",
                    borderRadius: "6px",
                    boxShadow: "0px 4px 6px rgba(0, 0, 0, 0.1)",
                    zIndex: 1000,
                    minWidth: "224px",
                    maxHeight: "300px",
                    overflowY: "auto",
                  }}
                >
                  <button
                    onClick={() => {
                      setSelectedForm(null);
                      setIsFormDropdownOpen(false);
                      setLeads([]);
                      setTotalLeadsCount(0);
                      fetchAllLeads();
                    }}
                    style={{
                      width: "100%",
                      padding: "8px 12.667px",
                      textAlign: "left",
                      border: "none",
                      backgroundColor: !selectedForm ? (resolvedTheme === "color" ? "rgba(0,255,255,0.1)" : resolvedTheme === "dark" ? "#2a2a2a" : "#f3f4f6") : "transparent",
                      cursor: "pointer",
                      fontSize: "12px",
                      fontFamily: "Arial, sans-serif",
                      color: resolvedTheme === "color" ? "white" : resolvedTheme === "dark" ? "#e5e5e5" : "#1f1f1f",
                    }}
                    onMouseEnter={(e) => {
                      if (selectedForm) {
                        e.currentTarget.style.backgroundColor = resolvedTheme === "color" ? "rgba(0,255,255,0.05)" : resolvedTheme === "dark" ? "#333" : "#f9fafb";
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (selectedForm) {
                        e.currentTarget.style.backgroundColor = "transparent";
                      }
                    }}
                  >
                    All Forms
                  </button>
                  {leadForms.map((form) => (
                    <button
                      key={form.id}
                      onClick={() => handleFormSelectFromDropdown(form)}
                      style={{
                        width: "100%",
                        padding: "8px 12.667px",
                        textAlign: "left",
                        border: "none",
                        backgroundColor: selectedForm?.id === form.id ? (resolvedTheme === "color" ? "rgba(0,255,255,0.1)" : resolvedTheme === "dark" ? "#2a2a2a" : "#f3f4f6") : "transparent",
                        cursor: "pointer",
                        fontSize: "12px",
                        fontFamily: "Arial, sans-serif",
                        color: resolvedTheme === "color" ? "white" : resolvedTheme === "dark" ? "#e5e5e5" : "#1f1f1f",
                      }}
                      onMouseEnter={(e) => {
                        if (selectedForm?.id !== form.id) {
                          e.currentTarget.style.backgroundColor = resolvedTheme === "color" ? "rgba(0,255,255,0.05)" : resolvedTheme === "dark" ? "#333" : "#f9fafb";
                        }
                      }}
                      onMouseLeave={(e) => {
                        if (selectedForm?.id !== form.id) {
                          e.currentTarget.style.backgroundColor = "transparent";
                        }
                      }}
                    >
                      {form.name}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Search Input */}
            <div
              style={{
                position: "relative",
                flex: 1,
                maxWidth: "384px",
                marginLeft: "auto",
              }}
            >
              <div
                style={{
                  backgroundColor: resolvedTheme === "color" ? "rgba(0,255,255,0.05)" : resolvedTheme === "dark" ? "rgba(58,58,58,0.3)" : "rgba(244, 245, 247, 0.5)",
                  borderRadius: "6px",
                  height: "32px",
                  display: "flex",
                  alignItems: "center",
                  paddingLeft: "32px",
                  paddingRight: "12px",
                }}
              >
                <Search
                  style={{
                    position: "absolute",
                    left: "10px",
                    width: "14px",
                    height: "14px",
                    color: resolvedTheme === "color" ? "rgba(0,255,255,0.6)" : resolvedTheme === "dark" ? "#9ca3af" : "#6b7280",
                  }}
                />
                <input
                  type="text"
                  placeholder="Search Facebook leads..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  style={{
                    width: "100%",
                    border: "none",
                    backgroundColor: "transparent",
                    outline: "none",
                    fontSize: "14px",
                    fontFamily: "Arial, sans-serif",
                    color: resolvedTheme === "color" ? "white" : resolvedTheme === "dark" ? "#e5e5e5" : "#1f1f1f",
                  }}
                />
              </div>
            </div>

            {/* Divider */}
            <div
              style={{
                backgroundColor: resolvedTheme === "color" ? "rgba(0,255,255,0.2)" : resolvedTheme === "dark" ? "#3a3a3a" : "#e5e7eb",
                height: "20px",
                width: "1px",
              }}
            />

            {/* Refresh Button */}
            <button
              type="button"
              onClick={refreshFacebookData}
              disabled={loading || !accessToken}
              aria-label="Refresh Facebook leads"
              title="Refresh Facebook leads"
              style={{
                backgroundColor: resolvedTheme === "color" ? "rgba(0,0,0,0.3)" : resolvedTheme === "dark" ? "#2a2a2a" : "white",
                border: resolvedTheme === "color" ? "0.667px solid rgba(0,255,255,0.2)" : resolvedTheme === "dark" ? "0.667px solid #3a3a3a" : "0.667px solid #e5e7eb",
                borderRadius: "6px",
                height: "32px",
                width: "32px",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                cursor: loading || !accessToken ? "not-allowed" : "pointer",
                opacity: loading || !accessToken ? 0.5 : 1,
                flexShrink: 0,
              }}
            >
              {loading ? (
                <Loader2
                  style={{
                    width: "15px",
                    height: "15px",
                    color: resolvedTheme === "color" ? "white" : resolvedTheme === "dark" ? "#e5e5e5" : "#1f1f1f",
                    animation: "fb-spin 0.9s linear infinite",
                  }}
                />
              ) : (
                <RefreshCw
                  style={{
                    width: "15px",
                    height: "15px",
                    color: resolvedTheme === "color" ? "white" : resolvedTheme === "dark" ? "#e5e5e5" : "#1f1f1f",
                  }}
                />
              )}
            </button>

            {/* Export to CRM Button */}
            <button
              onClick={handleOpenImportDialog}
              disabled={selectedLeadIds.length === 0 || loading || isImporting}
              style={{
                backgroundColor: resolvedTheme === "color" ? "rgba(0,0,0,0.3)" : resolvedTheme === "dark" ? "#2a2a2a" : "white",
                border: resolvedTheme === "color" ? "0.667px solid rgba(0,255,255,0.2)" : resolvedTheme === "dark" ? "0.667px solid #3a3a3a" : "0.667px solid #e5e7eb",
                borderRadius: "6px",
                height: "32px",
                width: "147.063px",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: "6px",
                cursor: selectedLeadIds.length === 0 || loading || isImporting ? "not-allowed" : "pointer",
                opacity: selectedLeadIds.length === 0 || loading || isImporting ? 0.5 : 1,
              }}
            >
              <Download style={{ width: "16px", height: "16px", color: resolvedTheme === "color" ? "white" : resolvedTheme === "dark" ? "#e5e5e5" : "#1f1f1f" }} />
              <span
                style={{
                  fontFamily: "Arial, sans-serif",
                  fontWeight: "bold",
                  lineHeight: "16px",
                  fontSize: "12px",
                  color: resolvedTheme === "color" ? "white" : resolvedTheme === "dark" ? "#e5e5e5" : "#1f1f1f",
                }}
              >
                Export to CRM ({selectedLeadIds.length})
              </span>
            </button>
          </div>
        </div>
      )}

      {/* Facebook Connected Status Bar - Figma Design */}
      {accessToken && (
        <div
          className={`border-b border-l-0 border-r-0 border-t-0 flex flex-col items-start relative w-full ${
            isInlineDealsMode
              ? "bg-[rgba(24,119,242,0.08)] border-[#2a2d3a] px-[20px] py-2"
              : resolvedTheme === "color"
                ? "bg-[rgba(0,255,255,0.03)] border-[rgba(0,255,255,0.2)] px-6 py-2"
                : resolvedTheme === "dark"
                  ? "bg-[rgba(24,119,242,0.08)] border-[#3a3a3a] px-6 py-2"
                  : "bg-[rgba(24,119,242,0.05)] border-[#e5e7eb] px-6 py-2"
          }`}
        >
          <div
            style={{
              display: "flex",
              height: "24px",
              alignItems: "center",
              justifyContent: "space-between",
              position: "relative",
              width: "100%",
              flexShrink: 0,
            }}
          >
            {/* Left side: Status info */}
            <div
              style={{
                height: "16px",
                position: "relative",
                width: "290.583px",
                flexShrink: 0,
                display: "flex",
                gap: "8px",
                alignItems: "center",
              }}
            >
              {/* Checkmark Icon */}
              <CheckCircle2
                style={{
                  width: "16px",
                  height: "16px",
                  color: "#10b981",
                  flexShrink: 0,
                }}
              />

              {/* Facebook Connected Text */}
              <span
                style={{
                  fontFamily: "Arial, sans-serif",
                  fontWeight: "bold",
                  lineHeight: "16px",
                  fontStyle: "normal",
                  color: resolvedTheme === "color" ? "white" : resolvedTheme === "dark" ? "#e5e5e5" : "#1f1f1f",
                  fontSize: "12px",
                  flexShrink: 0,
                }}
              >
                Facebook Connected
              </span>

              {/* Separator */}
              <span
                style={{
                  fontFamily: "Arial, sans-serif",
                  fontWeight: "normal",
                  lineHeight: "16px",
                  fontStyle: "normal",
                  color: mutedTextColor,
                  fontSize: "12px",
                  flexShrink: 0,
                  width: "4.875px",
                }}
              >
                |
              </span>

              {/* Pages Count */}
              <span
                style={{
                  fontFamily: "Arial, sans-serif",
                  fontWeight: "normal",
                  lineHeight: "16px",
                  fontStyle: "normal",
                  color: mutedTextColor,
                  fontSize: "12px",
                  flexShrink: 0,
                  width: "40.615px",
                }}
              >
                {pages.length} {pages.length === 1 ? "Page" : "Pages"}
              </span>

              {/* Separator */}
              <span
                style={{
                  fontFamily: "Arial, sans-serif",
                  fontWeight: "normal",
                  lineHeight: "16px",
                  fontStyle: "normal",
                  color: mutedTextColor,
                  fontSize: "12px",
                  flexShrink: 0,
                  width: "4.875px",
                }}
              >
                |
              </span>

              {/* Lead Forms Count */}
              <span
                style={{
                  fontFamily: "Arial, sans-serif",
                  fontWeight: "normal",
                  lineHeight: "16px",
                  fontStyle: "normal",
                  color: mutedTextColor,
                  fontSize: "12px",
                  flexShrink: 0,
                }}
              >
                {leadForms.length} {leadForms.length === 1 ? "Lead Form" : "Lead Forms"}
              </span>

              {/* Separator */}
              {totalLeadsCount > 0 && (
                <>
                  <span
                    style={{
                      fontFamily: "Arial, sans-serif",
                      fontWeight: "normal",
                      lineHeight: "16px",
                      fontStyle: "normal",
                      color: mutedTextColor,
                      fontSize: "12px",
                      flexShrink: 0,
                      width: "4.875px",
                    }}
                  >
                    |
                  </span>

                  {/* Facebook Leads Count */}
                  <span
                    style={{
                      fontFamily: "Arial, sans-serif",
                      fontWeight: "normal",
                      lineHeight: "16px",
                      fontStyle: "normal",
                      color: mutedTextColor,
                      fontSize: "12px",
                      flexShrink: 0,
                    }}
                  >
                    {totalLeadsCount} Facebook Leads
                  </span>
                </>
              )}
            </div>

            {/* Right side: Disconnect Button */}
            <button
              onClick={handleLogout}
              style={{
                height: "24px",
                position: "relative",
                borderRadius: "6px",
                flexShrink: 0,
                width: "84.083px",
                backgroundColor: "transparent",
                border: "none",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                paddingLeft: "12px",
                paddingRight: "12px",
                paddingTop: "0",
                paddingBottom: "0",
              }}
            >
              <span
                style={{
                  fontFamily: "Arial, sans-serif",
                  fontWeight: "bold",
                  lineHeight: "16px",
                  fontStyle: "normal",
                  color: resolvedTheme === "color" ? "rgba(0,255,255,0.6)" : resolvedTheme === "dark" ? "#9ca3af" : "#6b7280",
                  fontSize: "12px",
                  textAlign: "center",
                }}
              >
                Disconnect
              </span>
            </button>
          </div>
        </div>
      )}

      {/* Filter Dialog */}
      <Dialog open={isFilterDialogOpen} onOpenChange={setIsFilterDialogOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Filter Facebook Leads</DialogTitle>
            <DialogDescription>
              Filter leads by page, form, and date range
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-6 py-4">
            {/* Page Filter */}
            <div className="space-y-3">
              <Label className="text-sm font-bold">Page</Label>
              <Select
                value={filterSelectedPage || ""}
                onValueChange={(value) => setFilterSelectedPage(value || null)}
              >
                <SelectTrigger className="w-full h-9">
                  <SelectValue placeholder="All Pages" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">All Pages</SelectItem>
                  {pages.map((page) => (
                    <SelectItem key={page.id} value={page.id}>
                      {page.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Forms Filter */}
            <div className="space-y-3">
              <Label className="text-sm font-bold">Forms</Label>
              <div className="space-y-2 max-h-[200px] overflow-y-auto">
                {isLoadingFilterForms ? (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground py-1">
                    <Loader2 className="h-3.5 w-3.5 animate-spin shrink-0" />
                    <span>Loading forms…</span>
                  </div>
                ) : (filterPageForms.length === 0 && !filterSelectedPage ? (
                  <p className="text-sm text-muted-foreground">No forms available. Select a page first.</p>
                ) : filterPageForms.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No forms available for selected page.</p>
                ) : (
                  filterPageForms.map((form) => (
                    <div key={form.id} className="flex items-center space-x-2">
                      <Checkbox
                        id={`form-${form.id}`}
                        checked={filterSelectedForms.includes(form.id)}
                        onCheckedChange={() => handleToggleFilterForm(form.id)}
                      />
                      <label
                        htmlFor={`form-${form.id}`}
                        className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
                      >
                        {form.name}
                      </label>
                    </div>
                  ))
                ))}
              </div>
            </div>

            {/* Date Range Filter */}
            <div className="space-y-4">
              <Label className="text-sm font-bold">Date Range</Label>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="start-date" className="text-xs">
                    Start Date
                  </Label>
                  <Input
                    id="start-date"
                    type="date"
                    value={filterStartDate}
                    onChange={(e) => setFilterStartDate(e.target.value)}
                    className="h-9"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="end-date" className="text-xs">
                    End Date
                  </Label>
                  <Input
                    id="end-date"
                    type="date"
                    value={filterEndDate}
                    onChange={(e) => setFilterEndDate(e.target.value)}
                    className="h-9"
                  />
                </div>
              </div>
            </div>
          </div>
          <DialogFooter className="flex justify-between">
            <Button
              variant="outline"
              onClick={handleClearFilters}
              className="text-sm"
            >
              Clear All
            </Button>
            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={() => setIsFilterDialogOpen(false)}
                className="text-sm"
              >
                Cancel
              </Button>
              <Button
                onClick={handleApplyFilters}
                className="text-sm bg-[#7b68ee] hover:bg-[#6b58dd] text-white"
              >
                Apply Filters
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {error && (
        <div className={isInlineDealsMode ? "px-[20px] pt-4" : "px-6 pt-4"}>
          <div
            style={{
              backgroundColor: resolvedTheme === "color" ? "rgba(255,0,0,0.1)" : resolvedTheme === "dark" ? "rgba(198,40,40,0.2)" : "#ffebee",
              color: resolvedTheme === "color" ? "#ff6b6b" : resolvedTheme === "dark" ? "#ef5350" : "#c62828",
              padding: "15px",
              borderRadius: "5px",
              marginBottom: "20px",
              border: resolvedTheme === "color" ? "1px solid rgba(255,0,0,0.2)" : resolvedTheme === "dark" ? "1px solid rgba(198,40,40,0.3)" : "1px solid #ffcdd2",
            }}
          >
            <strong>Error:</strong> {error}
          </div>
        </div>
      )}

      {/* Loading Indicator */}
      {loading && (
        <div className={isInlineDealsMode ? "px-[20px] pt-4" : "px-6 pt-4"}>
        <div
          style={{
            backgroundColor: resolvedTheme === "color" ? "rgba(0,255,255,0.06)" : resolvedTheme === "dark" ? "rgba(25,118,210,0.12)" : "#e3f2fd",
            border: resolvedTheme === "color" ? "1px solid rgba(0,255,255,0.15)" : resolvedTheme === "dark" ? "1px solid rgba(25,118,210,0.25)" : "1px solid #90caf9",
            borderRadius: "8px",
            padding: "20px 24px",
            marginBottom: "20px",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: "12px",
          }}
        >
          <Loader2
            style={{
              width: "28px",
              height: "28px",
              color: resolvedTheme === "color" ? "rgba(0,255,255,0.9)" : resolvedTheme === "dark" ? "#64b5f6" : "#1976d2",
              animation: "fb-spin 0.9s linear infinite",
            }}
          />
          <span
            style={{
              fontSize: "14px",
              fontWeight: "500",
              color: resolvedTheme === "color" ? "rgba(0,255,255,0.8)" : resolvedTheme === "dark" ? "#64b5f6" : "#1565c0",
              letterSpacing: "0.01em",
            }}
          >
            Fetching Facebook leads…
          </span>
          <style>{`@keyframes fb-spin { to { transform: rotate(360deg); } }`}</style>
        </div>
        </div>
      )}

      {/* Summary and Leads Display */}
      {selectedPage && (
        <div
          className={
            isInlineDealsMode
              ? "relative bg-[#121215] pt-5 pb-6"
              : "pt-5 pb-6"
          }
          style={{
            paddingLeft: isInlineDealsMode ? "20px" : "24px",
            paddingRight: isInlineDealsMode ? "20px" : "24px",
          }}
        >

          {/* No Lead Forms Message */}
          {leadForms.length === 0 && !loading && (
            <div
              style={{
                backgroundColor: resolvedTheme === "color" ? "rgba(255,193,7,0.1)" : resolvedTheme === "dark" ? "rgba(133,100,4,0.2)" : "#fff3cd",
                color: resolvedTheme === "color" ? "#ffd54f" : resolvedTheme === "dark" ? "#ffb74d" : "#856404",
                padding: "15px",
                borderRadius: "5px",
                marginBottom: "20px",
                border: resolvedTheme === "color" ? "1px solid rgba(255,193,7,0.2)" : resolvedTheme === "dark" ? "1px solid rgba(133,100,4,0.3)" : "1px solid #ffeeba",
              }}
            >
              No lead forms found for &quot;{selectedPage.name}&quot;. Make sure you
              have active lead ad campaigns.
            </div>
          )}

          {/* Leads Table Header */}
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: "20px",
            }}
          >
            <h3 style={{
              margin: "0",
              color: resolvedTheme === "color" ? "white" : resolvedTheme === "dark" ? "#e5e5e5" : "#333",
              fontSize: "14px",
              fontWeight: "normal"
            }}>
              {totalLeadsCount} Facebook Leads
            </h3>
            <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
              {selectedLeadIds.length > 0 && (
                <button
                  onClick={handleOpenImportDialog}
                  disabled={loading || isImporting}
                  style={{
                    padding: "8px 16px",
                    backgroundColor: loading || isImporting ? "#ccc" : "#4CAF50",
                    color: "white",
                    border: "none",
                    borderRadius: "5px",
                    cursor: loading || isImporting ? "not-allowed" : "pointer",
                    fontWeight: "500",
                  }}
                >
                  Export to CRM ({selectedLeadIds.length})
                </button>
              )}
            </div>
          </div>

          {(searchTerm ? filteredLeads : leads).length === 0 && !loading && leadForms.length > 0 ? (
            <div
              style={{
                backgroundColor: resolvedTheme === "color" ? "rgba(0,255,255,0.1)" : resolvedTheme === "dark" ? "rgba(46,125,50,0.2)" : "#e8f5e8",
                color: resolvedTheme === "color" ? "rgba(0,255,255,0.9)" : resolvedTheme === "dark" ? "#81c784" : "#2e7d32",
                padding: "20px",
                borderRadius: "5px",
                textAlign: "center",
              }}
            >
              No leads found yet. Leads will appear here when people submit your lead forms.
            </div>
          ) : (searchTerm ? filteredLeads : leads).length > 0 ? (
            <div
              style={{
                overflow: "hidden",
                backgroundColor: resolvedTheme === "color" ? "#0A0E27" : resolvedTheme === "dark" ? "#1a1a1a" : "white",
              }}
            >
              <table
                style={{
                  width: "100%",
                  borderCollapse: "collapse",
                }}
              >
                <thead>
                  <tr style={{
                    backgroundColor: resolvedTheme === "color" ? "rgba(255,255,255,0.03)" : resolvedTheme === "dark" ? "rgba(42,42,42,0.5)" : "rgba(244, 245, 247, 0.5)",
                    borderBottom: resolvedTheme === "color" ? "0.667px solid rgba(0,255,255,0.2)" : resolvedTheme === "dark" ? "0.667px solid #3a3a3a" : "0.667px solid #e5e7eb",
                    height: "40.333px",
                  }}>
                    <th style={{
                      padding: "13.33px 0 13.33px 16px",
                      textAlign: "left",
                      width: "46px",
                    }}>
                      <input
                        type="checkbox"
                        checked={selectedLeadIds.length === (searchTerm ? filteredLeads : leads).length && (searchTerm ? filteredLeads : leads).length > 0}
                        onChange={handleSelectAll}
                        style={{
                          width: "14px",
                          height: "14px",
                          cursor: "pointer",
                          backgroundColor: resolvedTheme === "color" ? "rgba(0,0,0,0.3)" : resolvedTheme === "dark" ? "rgba(58,58,58,0.3)" : "white",
                          border: resolvedTheme === "color" ? "0.667px solid rgba(0,255,255,0.2)" : resolvedTheme === "dark" ? "0.667px solid #3a3a3a" : "0.667px solid #e5e7eb",
                          borderRadius: "4px",
                          boxShadow: "0px 1px 2px 0px rgba(0,0,0,0.05)",
                          margin: "0",
                        }}
                      />
                    </th>
                    <th style={{
                      padding: "11px 0 11px 12px",
                      textAlign: "left",
                      fontSize: "12px",
                      fontFamily: "Arial, sans-serif",
                      fontWeight: "bold",
                      lineHeight: "16px",
                      color: resolvedTheme === "color" ? "rgba(0,255,255,0.6)" : resolvedTheme === "dark" ? "#9ca3af" : "#6b7280",
                    }}>
                      Name
                    </th>
                    <th style={{
                      padding: "11px 0 11px 12px",
                      textAlign: "left",
                      fontSize: "12px",
                      fontFamily: "Arial, sans-serif",
                      fontWeight: "bold",
                      lineHeight: "16px",
                      color: resolvedTheme === "color" ? "rgba(0,255,255,0.6)" : resolvedTheme === "dark" ? "#9ca3af" : "#6b7280",
                    }}>
                      Email
                    </th>
                    <th style={{
                      padding: "11px 0 11px 12px",
                      textAlign: "left",
                      fontSize: "12px",
                      fontFamily: "Arial, sans-serif",
                      fontWeight: "bold",
                      lineHeight: "16px",
                      color: resolvedTheme === "color" ? "rgba(0,255,255,0.6)" : resolvedTheme === "dark" ? "#9ca3af" : "#6b7280",
                    }}>
                      Phone
                    </th>
                    <th style={{
                      padding: "11px 0 11px 12px",
                      textAlign: "left",
                      fontSize: "12px",
                      fontFamily: "Arial, sans-serif",
                      fontWeight: "bold",
                      lineHeight: "16px",
                      color: resolvedTheme === "color" ? "rgba(0,255,255,0.6)" : resolvedTheme === "dark" ? "#9ca3af" : "#6b7280",
                    }}>
                      Company
                    </th>
                    <th style={{
                      padding: "11px 0 11px 12px",
                      textAlign: "left",
                      fontSize: "12px",
                      fontFamily: "Arial, sans-serif",
                      fontWeight: "bold",
                      lineHeight: "16px",
                      color: resolvedTheme === "color" ? "rgba(0,255,255,0.6)" : resolvedTheme === "dark" ? "#9ca3af" : "#6b7280",
                    }}>
                      Form Name
                    </th>
                    <th style={{
                      padding: "11px 0 11px 12px",
                      textAlign: "left",
                      fontSize: "12px",
                      fontFamily: "Arial, sans-serif",
                      fontWeight: "bold",
                      lineHeight: "16px",
                      color: resolvedTheme === "color" ? "rgba(0,255,255,0.6)" : resolvedTheme === "dark" ? "#9ca3af" : "#6b7280",
                    }}>
                      Created
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {(searchTerm ? filteredLeads : leads).map((lead, index) => {
                    const name = getLeadName(lead);
                    const email = getLeadEmail(lead);
                    const phone = getLeadPhone(lead);
                    const company = getLeadCompany(lead);
                    const formName = lead.formName || 'N/A';
                    const createdDateObj = new Date(lead.created_time);
                    const year = createdDateObj.getFullYear();
                    const month = String(createdDateObj.getMonth() + 1).padStart(2, '0');
                    const day = String(createdDateObj.getDate()).padStart(2, '0');
                    const hours = String(createdDateObj.getHours()).padStart(2, '0');
                    const minutes = String(createdDateObj.getMinutes()).padStart(2, '0');
                    const createdDate = `${year}-${month}-${day} ${hours}:${minutes}`;

                    return (
                      <tr
                        key={lead.id}
                        style={{
                          borderBottom: resolvedTheme === "color" ? "0.667px solid rgba(0,255,255,0.2)" : resolvedTheme === "dark" ? "0.667px solid #3a3a3a" : "0.667px solid #e5e7eb",
                          borderTop: "none",
                          borderLeft: "none",
                          borderRight: "none",
                          height: "41.833px",
                          backgroundColor: selectedLeadIds.includes(lead.id)
                            ? (resolvedTheme === "color" ? "rgba(0,255,255,0.05)" : resolvedTheme === "dark" ? "rgba(58,58,58,0.2)" : "#f0f9ff")
                            : (resolvedTheme === "color" ? "transparent" : "transparent"),
                        }}
                      >
                        <td style={{
                          padding: "14.25px 0 14.25px 16px",
                          width: "46px",
                        }}>
                          <input
                            type="checkbox"
                            checked={selectedLeadIds.includes(lead.id)}
                            onChange={() => handleLeadSelect(lead.id)}
                            style={{
                              width: "14px",
                              height: "14px",
                              cursor: "pointer",
                              backgroundColor: resolvedTheme === "color" ? "rgba(0,0,0,0.3)" : resolvedTheme === "dark" ? "rgba(58,58,58,0.3)" : "white",
                              border: resolvedTheme === "color" ? "0.667px solid rgba(0,255,255,0.2)" : resolvedTheme === "dark" ? "0.667px solid #3a3a3a" : "0.667px solid #e5e7eb",
                              borderRadius: "4px",
                              boxShadow: "0px 1px 2px 0px rgba(0,0,0,0.05)",
                              margin: "0",
                            }}
                          />
                        </td>
                        <td style={{
                          padding: "12.25px 12px",
                          fontSize: "14px",
                          fontFamily: "Arial, sans-serif",
                          fontWeight: "bold",
                          color: resolvedTheme === "color" ? "white" : resolvedTheme === "dark" ? "#e5e5e5" : "#1f1f1f",
                          lineHeight: "20px",
                        }}>
                          {name}
                        </td>
                        <td style={{
                          padding: "12.25px 12px",
                          fontSize: "14px",
                          fontFamily: "Arial, sans-serif",
                          fontWeight: "normal",
                          color: resolvedTheme === "color" ? "rgba(0,255,255,0.6)" : resolvedTheme === "dark" ? "#9ca3af" : "#6b7280",
                          lineHeight: "20px",
                        }}>
                          {email || '-'}
                        </td>
                        <td style={{
                          padding: "12.25px 12px",
                          fontSize: "14px",
                          fontFamily: "Arial, sans-serif",
                          fontWeight: "normal",
                          color: resolvedTheme === "color" ? "rgba(0,255,255,0.6)" : resolvedTheme === "dark" ? "#9ca3af" : "#6b7280",
                          lineHeight: "20px",
                        }}>
                          {phone || '-'}
                        </td>
                        <td style={{
                          padding: "12.25px 12px",
                          fontSize: "14px",
                          fontFamily: "Arial, sans-serif",
                          fontWeight: "normal",
                          color: resolvedTheme === "color" ? "rgba(0,255,255,0.6)" : resolvedTheme === "dark" ? "#9ca3af" : "#6b7280",
                          lineHeight: "20px",
                        }}>
                          {company || '-'}
                        </td>
                        <td style={{
                          padding: "11.67px 12px",
                        }}>
                          <span
                            style={{
                              display: "inline-block",
                              backgroundColor: "rgba(24, 119, 242, 0.1)",
                              border: "0.667px solid rgba(24, 119, 242, 0.2)",
                              borderRadius: "6px",
                              height: "21.833px",
                              paddingLeft: "8px",
                              paddingRight: "8px",
                              paddingTop: "0.67px",
                              paddingBottom: "0",
                              overflow: "hidden",
                              fontFamily: "Arial, sans-serif",
                              fontWeight: "bold",
                              fontSize: "11px",
                              color: "#1877f2",
                              lineHeight: "16.5px",
                            }}
                          >
                            {formName}
                          </span>
                        </td>
                        <td style={{
                          padding: "12.25px 12px",
                          fontSize: "14px",
                          fontFamily: "Arial, sans-serif",
                          fontWeight: "normal",
                          color: resolvedTheme === "color" ? "rgba(0,255,255,0.6)" : resolvedTheme === "dark" ? "#9ca3af" : "#6b7280",
                          lineHeight: "20px",
                        }}>
                          {createdDate}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : null}
        </div>
      )}

      {/* Import Leads Dialog */}
      {isImportDialogOpen && (
        (() => {
          const imgIcon = "data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAyNCAyNCIgZmlsbD0ibm9uZSIgc3Ryb2tlPSIjNmI3MjgwIiBzdHJva2Utd2lkdGg9IjIiIHN0cm9rZS1saW5lY2FwPSJyb3VuZCIgc3Ryb2tlLWxpbmVqb2luPSJyb3VuZCI+PHBvbHlsaW5lIHBvaW50cz0iNiA5IDEyIDE1IDE4IDkiPjwvcG9seWxpbmU+PC9zdmc+";
          const imgIcon1 = "data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAyNCAyNCIgZmlsbD0ibm9uZSIgc3Ryb2tlPSIjOWNhM2FmIiBzdHJva2Utd2lkdGg9IjIiIHN0cm9rZS1saW5lY2FwPSJyb3VuZCIgc3Ryb2tlLWxpbmVqb2luPSJyb3VuZCI+PGxpbmUgeDE9IjUiIHkxPSIxMiIgeDI9IjE5IiB5Mj0iMTIiPjwvbGluZT48cG9seWxpbmUgcG9pbnRzPSIxMiA1IDE5IDEyIDEyIDE5Ij48L3BvbHlsaW5lPjwvc3ZnPg==";
          const imgIcon2 = "data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAyNCAyNCIgZmlsbD0ibm9uZSIgc3Ryb2tlPSIjZjU5ZTBiIiBzdHJva2Utd2lkdGg9IjIiIHN0cm9rZS1saW5lY2FwPSJyb3VuZCIgc3Ryb2tlLWxpbmVqb2luPSJyb3VuZCI+PGNpcmNsZSBjeD0iMTIiIGN5PSIxMiIgcj0iMTAiPjwvY2lyY2xlPjxsaW5lIHgxPSIxMiIgeTE9IjgiIHgyPSIxMiIgeTI9IjEyIj48L2xpbmU+PGxpbmUgeDE9IjEyIiB5MT0iMTYiIHgyPSIxMi4wMSIgeTI9IjE2Ij48L2xpbmU+PC9zdmc+";
          const imgIcon3 = "data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAyNCAyNCIgZmlsbD0ibm9uZSIgc3Ryb2tlPSIjMDAwMDAwIiBzdHJva2Utd2lkdGg9IjIiIHN0cm9rZS1saW5lY2FwPSJyb3VuZCIgc3Ryb2tlLWxpbmVqb2luPSJyb3VuZCI+PGxpbmUgeDE9IjE4IiB5MT0iNiIgeDI9IjYiIHkyPSIxOCI+PC9saW5lPjxsaW5lIHgxPSI2IiB5MT0iNiIgeDI9IjE4IiB5Mj0iMTgiPjwvbGluZT48L3N2Zz4=";

          return (
            <div
              style={{
                position: "fixed",
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                backgroundColor: "rgba(0, 0, 0, 0.5)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                zIndex: 1000,
              }}
              onClick={() => {
                if (!isImporting) {
                  setIsImportDialogOpen(false);
                  setIsFunnelDropdownOpen(false);
                  setIsOwnerDropdownOpen(false);
                }
              }}
            >
              <div
                style={{
                  backgroundColor: resolvedTheme === "color" ? "#0A0E27" : resolvedTheme === "dark" ? "#1a1a1a" : "white",
                  border: resolvedTheme === "color" ? "0.667px solid rgba(0,255,255,0.2)" : resolvedTheme === "dark" ? "0.667px solid #3a3a3a" : "0.667px solid #e5e7eb",
                  borderRadius: "8px",
                  boxShadow: "0px 10px 15px -3px rgba(0,0,0,0.1), 0px 4px 6px -4px rgba(0,0,0,0.1)",
                  position: "relative",
                  width: "510.667px",
                  maxWidth: "90%",
                  maxHeight: "90vh",
                  overflow: "hidden",
                  display: "flex",
                  flexDirection: "column",
                }}
                onClick={(e) => e.stopPropagation()}
              >
                {/* Close Button */}
                <button
                  onClick={() => {
                    if (!isImporting) {
                      setIsImportDialogOpen(false);
                      setIsFunnelDropdownOpen(false);
                      setIsOwnerDropdownOpen(false);
                    }
                  }}
                  style={{
                    position: "absolute",
                    left: "478.67px",
                    top: "16px",
                    width: "16px",
                    height: "16px",
                    background: "none",
                    border: "none",
                    cursor: isImporting ? "not-allowed" : "pointer",
                    padding: "0",
                    opacity: "0.7",
                  }}
                >
                  <img alt="Close" src={imgIcon3} style={{ width: "100%", height: "100%" }} />
                </button>

                {/* Header Section */}
                <div style={{ padding: "24px 24px 0 24px" }}>
                  <div style={{ marginBottom: "8px" }}>
                    <h2 style={{
                      margin: "0",
                      fontFamily: "Arial, sans-serif",
                      fontWeight: "bold",
                      fontSize: "18px",
                      lineHeight: "18px",
                      color: resolvedTheme === "color" ? "white" : resolvedTheme === "dark" ? "#e5e5e5" : "#1f1f1f",
                    }}>
                      Export to CRM
                    </h2>
                  </div>
                  <div style={{ marginBottom: "24px" }}>
                    <p style={{
                      margin: "0",
                      fontFamily: "Arial, sans-serif",
                      fontWeight: "normal",
                      fontSize: "14px",
                      lineHeight: "20px",
                      color: resolvedTheme === "color" ? "rgba(0,255,255,0.6)" : resolvedTheme === "dark" ? "#9ca3af" : "#6b7280",
                    }}>
                      Map Facebook Lead Ad fields to your CRM, select a sales funnel, and assign an owner
                    </p>
                  </div>
                </div>

                {/* Select Sales Funnel Section */}
                <div style={{ padding: "0 24px 16px 24px" }}>
                  <div style={{ marginBottom: "8px" }}>
                    <label
                      style={{
                        fontFamily: "Arial, sans-serif",
                        fontWeight: "bold",
                        fontSize: "14px",
                        lineHeight: "20px",
                        color: resolvedTheme === "color" ? "white" : resolvedTheme === "dark" ? "#e5e5e5" : "#1f1f1f",
                        display: "flex",
                        alignItems: "center",
                      }}
                    >
                      Select Sales Funnel <span style={{ color: "#ef4444", marginLeft: "4px" }}>*</span>
                    </label>
                  </div>
                  {isLoadingFunnels ? (
                    <div
                      style={{
                        padding: "20px",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        gap: "8px",
                        color: resolvedTheme === "color" ? "rgba(0,255,255,0.7)" : resolvedTheme === "dark" ? "#9ca3af" : "#6b7280",
                      }}
                    >
                      <Loader2
                        style={{
                          width: "16px",
                          height: "16px",
                          animation: "fb-spin 0.9s linear infinite",
                          flexShrink: 0,
                        }}
                      />
                      <span style={{ fontSize: "13px" }}>Loading funnels…</span>
                    </div>
                  ) : salesFunnels.length === 0 ? (
                    <div style={{ padding: "20px", textAlign: "center", color: "#666" }}>
                      No sales funnels found. Please create a funnel first.
                    </div>
                  ) : (
                    <div style={{ position: "relative" }}>
                      <div
                        onClick={() => {
                          if (isImporting) return;
                          setIsOwnerDropdownOpen(false);
                          setIsFunnelDropdownOpen(!isFunnelDropdownOpen);
                        }}
                        style={{
                          backgroundColor: resolvedTheme === "color" ? "rgba(0,0,0,0.3)" : resolvedTheme === "dark" ? "#2a2a2a" : "white",
                          border: resolvedTheme === "color" ? "0.667px solid rgba(0,255,255,0.2)" : resolvedTheme === "dark" ? "0.667px solid #3a3a3a" : "0.667px solid #e5e7eb",
                          borderRadius: "6px",
                          height: "36px",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "space-between",
                          padding: "0.667px 12.667px",
                          cursor: isImporting ? "not-allowed" : "pointer",
                        }}
                      >
                        <span
                          style={{
                            fontSize: "14px",
                            fontFamily: "Arial, sans-serif",
                            fontWeight: "normal",
                            color: selectedFunnelId ? (resolvedTheme === "color" ? "white" : resolvedTheme === "dark" ? "#e5e5e5" : "#1f1f1f") : (resolvedTheme === "color" ? "rgba(0,255,255,0.6)" : resolvedTheme === "dark" ? "#9ca3af" : "#6b7280"),
                            flex: 1,
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            whiteSpace: "nowrap",
                          }}
                        >
                          {selectedFunnelId
                            ? (() => {
                              const selectedFunnel = salesFunnels.find(
                                (f) => (f._id || f.id) === selectedFunnelId
                              );
                              if (selectedFunnel) {
                                const stages = selectedFunnel.funnelStage || selectedFunnel.stages || [];
                                const stageCount = Array.isArray(stages) ? stages.length : 0;
                                const funnelName = selectedFunnel.funnelName || selectedFunnel.name || "Unnamed Funnel";
                                return `${funnelName}${stageCount > 0 ? ` (${stageCount} stages)` : ""}`;
                              }
                              return "Choose a funnel";
                            })()
                            : "Choose a funnel"}
                        </span>
                        <img
                          alt="Dropdown"
                          src={imgIcon}
                          style={{
                            width: "16px",
                            height: "16px",
                            marginLeft: "8px",
                            transform: isFunnelDropdownOpen ? "rotate(180deg)" : "rotate(0deg)",
                            transition: "transform 0.2s ease",
                            flexShrink: 0,
                          }}
                        />
                      </div>
                      {isFunnelDropdownOpen && (
                        <div
                          style={{
                            position: "absolute",
                            top: "100%",
                            left: 0,
                            right: 0,
                            marginTop: "4px",
                            backgroundColor: resolvedTheme === "color" ? "#0A0E27" : resolvedTheme === "dark" ? "#1a1a1a" : "white",
                            border: resolvedTheme === "color" ? "0.667px solid rgba(0,255,255,0.2)" : resolvedTheme === "dark" ? "0.667px solid #3a3a3a" : "0.667px solid #e5e7eb",
                            borderRadius: "6px",
                            boxShadow: "0px 4px 6px -1px rgba(0, 0, 0, 0.1), 0px 2px 4px -1px rgba(0, 0, 0, 0.06)",
                            zIndex: 1001,
                            maxHeight: "300px",
                            overflowY: "auto",
                          }}
                          onClick={(e) => e.stopPropagation()}
                        >
                          {[
                            { value: "", label: "Choose a funnel", isPlaceholder: true },
                            ...salesFunnels.map((funnel) => {
                              const stages = funnel.funnelStage || funnel.stages || [];
                              const stageCount = Array.isArray(stages) ? stages.length : 0;
                              const funnelName = funnel.funnelName || funnel.name || "Unnamed Funnel";
                              const funnelId = funnel._id || funnel.id;
                              return {
                                value: funnelId,
                                label: `${funnelName}${stageCount > 0 ? ` (${stageCount} stages)` : ""}`,
                                isPlaceholder: false,
                              };
                            }),
                          ].map((option) => {
                            const isSelected = selectedFunnelId === option.value;
                            return (
                              <div
                                key={option.value || "placeholder"}
                                onClick={() => {
                                  setSelectedFunnelId(option.value);
                                  setIsFunnelDropdownOpen(false);
                                }}
                                onMouseEnter={(e) => {
                                  e.currentTarget.style.backgroundColor = "rgba(123, 104, 238, 0.1)";
                                }}
                                onMouseLeave={(e) => {
                                  e.currentTarget.style.backgroundColor = isSelected ? "rgba(123, 104, 238, 0.05)" : "transparent";
                                }}
                                style={{
                                  padding: "10px 12px",
                                  fontSize: "14px",
                                  fontFamily: "Arial, sans-serif",
                                  fontWeight: "normal",
                                  color: option.isPlaceholder && !isSelected ? (resolvedTheme === "color" ? "rgba(0,255,255,0.6)" : resolvedTheme === "dark" ? "#9ca3af" : "#6b7280") : (resolvedTheme === "color" ? "white" : resolvedTheme === "dark" ? "#e5e5e5" : "#1f1f1f"),
                                  cursor: "pointer",
                                  display: "flex",
                                  alignItems: "center",
                                  justifyContent: "space-between",
                                  backgroundColor: isSelected ? "rgba(123, 104, 238, 0.05)" : "transparent",
                                  transition: "background-color 0.15s ease",
                                }}
                              >
                                <span>{option.label}</span>
                                {isSelected && (
                                  <svg
                                    width="16"
                                    height="16"
                                    viewBox="0 0 16 16"
                                    fill="none"
                                    xmlns="http://www.w3.org/2000/svg"
                                    style={{ flexShrink: 0 }}
                                  >
                                    <path
                                      d="M13.8536 3.85355C14.0488 3.65829 14.0488 3.34171 13.8536 3.14645C13.6583 2.95118 13.3417 2.95118 13.1464 3.14645L5 11.2929L2.85355 9.14645C2.65829 8.95118 2.34171 8.95118 2.14645 9.14645C1.95118 9.34171 1.95118 9.65829 2.14645 9.85355L4.64645 12.3536C4.84171 12.5488 5.15829 12.5488 5.35355 12.3536L13.8536 3.85355Z"
                                      fill="#7b68ee"
                                    />
                                  </svg>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Select Owner Section */}
                <div style={{ padding: "0 24px 16px 24px" }}>
                  <div style={{ marginBottom: "8px" }}>
                    <label
                      style={{
                        fontFamily: "Arial, sans-serif",
                        fontWeight: "bold",
                        fontSize: "14px",
                        lineHeight: "20px",
                        color: resolvedTheme === "color" ? "white" : resolvedTheme === "dark" ? "#e5e5e5" : "#1f1f1f",
                        display: "flex",
                        alignItems: "center",
                      }}
                    >
                      Select Owner <span style={{ color: "#ef4444", marginLeft: "4px" }}>*</span>
                    </label>
                  </div>
                  {isLoadingOwners ? (
                    <div
                      style={{
                        padding: "20px",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        gap: "8px",
                        color: resolvedTheme === "color" ? "rgba(0,255,255,0.7)" : resolvedTheme === "dark" ? "#9ca3af" : "#6b7280",
                      }}
                    >
                      <Loader2
                        style={{
                          width: "16px",
                          height: "16px",
                          animation: "fb-spin 0.9s linear infinite",
                          flexShrink: 0,
                        }}
                      />
                      <span style={{ fontSize: "13px" }}>Loading owners…</span>
                    </div>
                  ) : ownerOptions.length === 0 ? (
                    <div style={{ padding: "12px", textAlign: "center", color: mutedTextColor, fontSize: "13px" }}>
                      No owners found. Please try again.
                    </div>
                  ) : (
                    <div style={{ position: "relative" }}>
                      <div
                        onClick={() => {
                          if (isImporting) return;
                          setIsFunnelDropdownOpen(false);
                          setIsOwnerDropdownOpen(!isOwnerDropdownOpen);
                        }}
                        style={{
                          backgroundColor: resolvedTheme === "color" ? "rgba(0,0,0,0.3)" : resolvedTheme === "dark" ? "#2a2a2a" : "white",
                          border: resolvedTheme === "color" ? "0.667px solid rgba(0,255,255,0.2)" : resolvedTheme === "dark" ? "0.667px solid #3a3a3a" : "0.667px solid #e5e7eb",
                          borderRadius: "6px",
                          height: "36px",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "space-between",
                          padding: "0.667px 12.667px",
                          cursor: isImporting ? "not-allowed" : "pointer",
                        }}
                      >
                        <span
                          style={{
                            fontSize: "14px",
                            fontFamily: "Arial, sans-serif",
                            fontWeight: "normal",
                            color: selectedOwnerId
                              ? resolvedTheme === "color"
                                ? "white"
                                : resolvedTheme === "dark"
                                  ? "#e5e5e5"
                                  : "#1f1f1f"
                              : mutedTextColor,
                            flex: 1,
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            whiteSpace: "nowrap",
                          }}
                        >
                          {(() => {
                            if (!selectedOwnerId) return "Choose an owner";
                            const loggedInId = getLoggedInUserId();
                            const owner = ownerOptions.find((o) => o.id === selectedOwnerId);
                            const label = owner?.name || "Unknown";
                            return owner?.id === loggedInId ? `${label} (You)` : label;
                          })()}
                        </span>
                        <img
                          alt="Dropdown"
                          src={imgIcon}
                          style={{
                            width: "16px",
                            height: "16px",
                            marginLeft: "8px",
                            transform: isOwnerDropdownOpen ? "rotate(180deg)" : "rotate(0deg)",
                            transition: "transform 0.2s ease",
                            flexShrink: 0,
                          }}
                        />
                      </div>
                      {isOwnerDropdownOpen && (
                        <div
                          style={{
                            position: "absolute",
                            top: "100%",
                            left: 0,
                            right: 0,
                            marginTop: "4px",
                            backgroundColor: resolvedTheme === "color" ? "#0A0E27" : resolvedTheme === "dark" ? "#1a1a1a" : "white",
                            border: resolvedTheme === "color" ? "0.667px solid rgba(0,255,255,0.2)" : resolvedTheme === "dark" ? "0.667px solid #3a3a3a" : "0.667px solid #e5e7eb",
                            borderRadius: "6px",
                            boxShadow: "0px 4px 6px -1px rgba(0, 0, 0, 0.1), 0px 2px 4px -1px rgba(0, 0, 0, 0.06)",
                            zIndex: 1001,
                            maxHeight: "220px",
                            overflowY: "auto",
                          }}
                          onClick={(e) => e.stopPropagation()}
                        >
                          {ownerOptions.map((owner) => {
                            const loggedInId = getLoggedInUserId();
                            const isSelected = selectedOwnerId === owner.id;
                            const label =
                              owner.id === loggedInId ? `${owner.name} (You)` : owner.name;
                            return (
                              <div
                                key={owner.id}
                                onClick={() => {
                                  setSelectedOwnerId(owner.id);
                                  setIsOwnerDropdownOpen(false);
                                }}
                                onMouseEnter={(e) => {
                                  e.currentTarget.style.backgroundColor = "rgba(123, 104, 238, 0.1)";
                                }}
                                onMouseLeave={(e) => {
                                  e.currentTarget.style.backgroundColor = isSelected
                                    ? "rgba(123, 104, 238, 0.05)"
                                    : "transparent";
                                }}
                                style={{
                                  padding: "10px 12px",
                                  fontSize: "14px",
                                  fontFamily: "Arial, sans-serif",
                                  color:
                                    resolvedTheme === "color"
                                      ? "white"
                                      : resolvedTheme === "dark"
                                        ? "#e5e5e5"
                                        : "#1f1f1f",
                                  cursor: "pointer",
                                  display: "flex",
                                  alignItems: "center",
                                  justifyContent: "space-between",
                                  backgroundColor: isSelected
                                    ? "rgba(123, 104, 238, 0.05)"
                                    : "transparent",
                                }}
                              >
                                <span>{label}</span>
                                {isSelected && (
                                  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" style={{ flexShrink: 0 }}>
                                    <path
                                      d="M13.8536 3.85355C14.0488 3.65829 14.0488 3.34171 13.8536 3.14645C13.6583 2.95118 13.3417 2.95118 13.1464 3.14645L5 11.2929L2.85355 9.14645C2.65829 8.95118 2.34171 8.95118 2.14645 9.14645C1.95118 9.34171 1.95118 9.65829 2.14645 9.85355L4.64645 12.3536C4.84171 12.5488 5.15829 12.5488 5.35355 12.3536L13.8536 3.85355Z"
                                      fill="#7b68ee"
                                    />
                                  </svg>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Field Mapping Section */}
                <div style={{ padding: "0 24px 16px 24px", flex: "1", overflowY: "auto", minHeight: "0" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" }}>
                    <h3 style={{
                      margin: "0",
                      fontFamily: "Arial, sans-serif",
                      fontWeight: "bold",
                      fontSize: "14px",
                      lineHeight: "20px",
                      color: resolvedTheme === "color" ? "white" : resolvedTheme === "dark" ? "#e5e5e5" : "#1f1f1f",
                    }}>
                      Field Mapping
                    </h3>
                    <span style={{
                      fontFamily: "Arial, sans-serif",
                      fontWeight: "normal",
                      fontSize: "12px",
                      lineHeight: "16px",
                      color: resolvedTheme === "color" ? "rgba(0,255,255,0.6)" : resolvedTheme === "dark" ? "#9ca3af" : "#6b7280",
                    }}>
                      {selectedLeadIds.length} lead{selectedLeadIds.length !== 1 ? 's' : ''} selected
                    </span>
                  </div>

                  <div style={{
                    border: resolvedTheme === "color" ? "0.667px solid rgba(0,255,255,0.2)" : resolvedTheme === "dark" ? "0.667px solid #3a3a3a" : "0.667px solid #e5e7eb",
                    borderRadius: "8px",
                    overflow: "hidden",
                    padding: "0.667px",
                  }}>
                    {/* Header Row */}
                    <div style={{
                      backgroundColor: resolvedTheme === "color" ? "rgba(255,255,255,0.03)" : resolvedTheme === "dark" ? "rgba(42,42,42,0.5)" : "rgba(244, 245, 247, 0.5)",
                      borderBottom: resolvedTheme === "color" ? "0.667px solid rgba(0,255,255,0.2)" : resolvedTheme === "dark" ? "0.667px solid #3a3a3a" : "0.667px solid #e5e7eb",
                      height: "32.667px",
                      display: "flex",
                      alignItems: "center",
                      padding: "0 16px",
                    }}>
                      <div style={{ width: "125.771px" }}>
                        <span style={{
                          fontFamily: "Arial, sans-serif",
                          fontWeight: "bold",
                          fontSize: "12px",
                          lineHeight: "16px",
                          color: "#6b7280",
                        }}>
                          CRM Field
                        </span>
                      </div>
                      <div style={{ width: "125.781px", display: "flex", justifyContent: "center" }}>
                        <img alt="Arrow" src={imgIcon1} style={{ width: "16px", height: "16px" }} />
                      </div>
                      <div style={{ width: "125.781px" }}>
                        <span style={{
                          fontFamily: "Arial, sans-serif",
                          fontWeight: "bold",
                          fontSize: "12px",
                          lineHeight: "16px",
                          color: "#6b7280",
                        }}>
                          Facebook Field
                        </span>
                      </div>
                    </div>

                    {/* Field Rows */}
                    {[
                      { key: "leadName", label: "Lead Name", required: true, topPadding: "12px" },
                      { key: "contactName", label: "Contact Name", required: true, topPadding: "12px" },
                      { key: "email", label: "Email", required: true, topPadding: "20px" },
                      { key: "phone", label: "Phone", required: false, topPadding: "20px" },
                      { key: "company", label: "Company", required: false, topPadding: "20px" },
                      { key: "jobTitle", label: "Job Title", required: false, topPadding: "20px" },
                      { key: "source", label: "Source", required: false, topPadding: "20px" },
                      { key: "notes", label: "Notes", required: false, topPadding: "20px" },
                    ].map((field, index) => (
                      <div
                        key={field.key}
                        style={{
                          borderBottom: index < 7 ? (resolvedTheme === "color" ? "0.667px solid rgba(0,255,255,0.2)" : resolvedTheme === "dark" ? "0.667px solid #3a3a3a" : "0.667px solid #e5e7eb") : "none",
                          display: "flex",
                          alignItems: "center",
                          padding: `${field.topPadding} 16px`,
                          minHeight: field.required ? "64.667px" : "60.667px",
                        }}
                      >
                        {/* CRM Field Column */}
                        <div style={{
                          width: "125.771px",
                          display: "flex",
                          gap: "8px",
                          alignItems: field.required ? "flex-start" : "center",
                          flexDirection: field.required ? "row" : "row",
                        }}>
                          <span style={{
                            fontFamily: "Arial, sans-serif",
                            fontWeight: "normal",
                            fontSize: "14px",
                            lineHeight: "20px",
                            color: resolvedTheme === "color" ? "white" : resolvedTheme === "dark" ? "#e5e5e5" : "#1f1f1f",
                          }}>
                            {field.label}
                          </span>
                          {field.required && (
                            <span style={{
                              backgroundColor: "rgba(239, 68, 68, 0.1)",
                              border: "0.667px solid rgba(239, 68, 68, 0.2)",
                              borderRadius: "6px",
                              height: "16px",
                              paddingLeft: "6.667px",
                              paddingRight: "6.667px",
                              paddingTop: "0.667px",
                              paddingBottom: "0.667px",
                              fontFamily: "Arial, sans-serif",
                              fontWeight: "bold",
                              fontSize: "10px",
                              lineHeight: "15px",
                              color: "#ef4444",
                              display: "inline-flex",
                              alignItems: "center",
                              flexShrink: 0,
                              marginTop: field.required ? "2px" : "0",
                            }}>
                              Required
                            </span>
                          )}
                        </div>

                        {/* Arrow Column */}
                        <div style={{
                          width: "125.781px",
                          display: "flex",
                          justifyContent: "center",
                          alignItems: "center",
                        }}>
                          <img alt="Arrow" src={imgIcon1} style={{ width: "16px", height: "16px" }} />
                        </div>

                        {/* Facebook Field Column */}
                        <div style={{ width: "125.781px", position: "relative" }}>
                          <select
                            value={fieldMappings[field.key] || ""}
                            onChange={(e) => setFieldMappings(prev => ({ ...prev, [field.key]: e.target.value }))}
                            disabled={isImporting}
                            style={{
                              width: "100%",
                              height: "36px",
                              border: resolvedTheme === "color" ? "0.667px solid rgba(0,255,255,0.2)" : resolvedTheme === "dark" ? "0.667px solid #3a3a3a" : "0.667px solid #e5e7eb",
                              borderRadius: "6px",
                              backgroundColor: isImporting ? (resolvedTheme === "color" ? "rgba(0,0,0,0.2)" : resolvedTheme === "dark" ? "#333" : "#f5f5f5") : (resolvedTheme === "color" ? "rgba(0,0,0,0.3)" : resolvedTheme === "dark" ? "#2a2a2a" : "white"),
                              fontSize: "12px",
                              fontFamily: "Arial, sans-serif",
                              fontWeight: "normal",
                              color: fieldMappings[field.key] ? (resolvedTheme === "color" ? "white" : resolvedTheme === "dark" ? "#e5e5e5" : "#1f1f1f") : (resolvedTheme === "color" ? "rgba(0,255,255,0.6)" : resolvedTheme === "dark" ? "#9ca3af" : "#6b7280"),
                              padding: "0.667px 32px 0.667px 12.667px",
                              cursor: isImporting ? "not-allowed" : "pointer",
                              outline: "none",
                              appearance: "none",
                            }}
                          >
                            <option value="">Select field</option>
                            <option value="__dont_map__">Don&apos;t map</option>
                            {availableFacebookFields.map((fbField) => (
                              <option key={fbField} value={fbField}>
                                {fbField}
                              </option>
                            ))}
                          </select>
                          <img
                            alt="Dropdown"
                            src={imgIcon}
                            style={{
                              position: "absolute",
                              right: "12.667px",
                              top: "50%",
                              transform: "translateY(-50%)",
                              width: "16px",
                              height: "16px",
                              pointerEvents: "none",
                            }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Before importing section */}
                <div style={{
                  backgroundColor: resolvedTheme === "color" ? "rgba(0,255,255,0.03)" : resolvedTheme === "dark" ? "rgba(42,42,42,0.3)" : "rgba(244, 245, 247, 0.5)",
                  borderRadius: "8px",
                  padding: "12px",
                  margin: "0 24px 16px 24px",
                  display: "flex",
                  gap: "12px",
                }}>
                  <img alt="Info Icon" src={imgIcon2} style={{ width: "16px", height: "16px", flexShrink: 0, marginTop: "2px" }} />
                  <div style={{ flex: 1 }}>
                    <p style={{
                      margin: "0 0 4px 0",
                      fontFamily: "Arial, sans-serif",
                      fontWeight: "bold",
                      fontSize: "12px",
                      lineHeight: "16px",
                      color: "#6b7280",
                    }}>
                      Before importing:
                    </p>
                    <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
                      <p style={{
                        margin: "0",
                        fontFamily: "Arial, sans-serif",
                        fontWeight: "normal",
                        fontSize: "12px",
                        lineHeight: "16px",
                        color: "#6b7280",
                      }}>
                        Leads will be added to the selected funnel&apos;s first stage
                      </p>
                      <p style={{
                        margin: "0",
                        fontFamily: "Arial, sans-serif",
                        fontWeight: "normal",
                        fontSize: "12px",
                        lineHeight: "16px",
                        color: "#6b7280",
                      }}>
                        Imported leads will be assigned to the selected owner (defaults to you)
                      </p>
                      <p style={{
                        margin: "0",
                        fontFamily: "Arial, sans-serif",
                        fontWeight: "normal",
                        fontSize: "12px",
                        lineHeight: "16px",
                        color: "#6b7280",
                      }}>
                        Duplicate detection will run based on email address
                      </p>
                      <p style={{
                        margin: "0",
                        fontFamily: "Arial, sans-serif",
                        fontWeight: "normal",
                        fontSize: "12px",
                        lineHeight: "16px",
                        color: "#6b7280",
                      }}>
                        Unmapped fields will be added to notes
                      </p>
                    </div>
                  </div>
                </div>

                {/* Footer Buttons */}
                <div
                  style={{
                    borderTop: resolvedTheme === "color" ? "0.667px solid rgba(0,255,255,0.2)" : resolvedTheme === "dark" ? "0.667px solid #3a3a3a" : "0.667px solid #e5e7eb",
                    display: "flex",
                    gap: "8px",
                    justifyContent: "flex-end",
                    padding: "16.667px 24px 24px 24px",
                  }}
                >
                  <button
                    onClick={() => setIsImportDialogOpen(false)}
                    disabled={isImporting}
                    style={{
                      height: "32px",
                      padding: "0 12.667px",
                      backgroundColor: resolvedTheme === "color" ? "rgba(0,0,0,0.3)" : resolvedTheme === "dark" ? "#2a2a2a" : "white",
                      border: resolvedTheme === "color" ? "0.667px solid rgba(0,255,255,0.2)" : resolvedTheme === "dark" ? "0.667px solid #3a3a3a" : "0.667px solid #e5e7eb",
                      borderRadius: "6px",
                      fontFamily: "Arial, sans-serif",
                      fontWeight: "bold",
                      fontSize: "14px",
                      lineHeight: "20px",
                      color: resolvedTheme === "color" ? "white" : resolvedTheme === "dark" ? "#e5e5e5" : "#1f1f1f",
                      cursor: isImporting ? "not-allowed" : "pointer",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleImportLeads}
                    disabled={isImporting || !selectedFunnelId || !selectedOwnerId || isLoadingFunnels || isLoadingOwners || !fieldMappings.leadName || !fieldMappings.contactName || !fieldMappings.email}
                    style={{
                      height: "32px",
                      padding: "0 12px",
                      backgroundColor: "#7b68ee",
                      opacity: isImporting || !selectedFunnelId || !selectedOwnerId || isLoadingFunnels || isLoadingOwners || !fieldMappings.leadName || !fieldMappings.contactName || !fieldMappings.email
                        ? 0.5
                        : 1,
                      border: "none",
                      borderRadius: "6px",
                      fontFamily: "Arial, sans-serif",
                      fontWeight: "bold",
                      fontSize: "14px",
                      lineHeight: "20px",
                      color: "white",
                      cursor:
                        isImporting || !selectedFunnelId || !selectedOwnerId || isLoadingFunnels || isLoadingOwners || !fieldMappings.leadName || !fieldMappings.contactName || !fieldMappings.email
                          ? "not-allowed"
                          : "pointer",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    {isImporting ? (
                      <>
                        <Loader2
                          style={{
                            width: "14px",
                            height: "14px",
                            marginRight: "6px",
                            animation: "fb-spin 0.9s linear infinite",
                            flexShrink: 0,
                          }}
                        />
                        Importing…
                      </>
                    ) : `Import ${selectedLeadIds.length} Lead${selectedLeadIds.length !== 1 ? 's' : ''}`}
                  </button>
                </div>
              </div>
            </div>
          );
        })()
      )}
    </div>
  );
};

export default FacebookLeadsIntegration;