"use client";

import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import {
  Loader2,
  Search,
  Globe,
  Check,
  X,
  ShoppingCart,
  Trash2,
  RefreshCw,
  Settings,
  Lock,
  Unlock,
  Calendar,
  Server,
  Plus,
  ExternalLink,
  Copy,
  AlertCircle,
  CheckCircle,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import {
  searchDomains,
  getDomainSuggestions,
  getDomainPricing,
  purchaseDomain,
  verifyDomainPayment,
  listDomains,
  getDomain,
  syncDomain,
  getDnsRecords,
  createDnsRecord,
  updateDnsRecord,
  deleteDnsRecord,
  updateNameservers,
  setAutoRenew,
  setDomainLock,
  getAuthCode,
  renewDomain,
  verifyRenewalPayment,
  formatDomainPrice,
  getDaysUntilExpiry,
  getDomainStatusColor,
  generateDomainVariations,
  POPULAR_TLDS,
  type Domain,
  type DomainAvailability,
  type DomainContact,
  type DnsRecord,
} from "@/lib/domain-api";

declare global {
  interface Window {
    Razorpay: any;
  }
}

export default function DomainsPage() {
  // Search state
  const [searchQuery, setSearchQuery] = useState("");
  const [searching, setSearching] = useState(false);
  const [searchResults, setSearchResults] = useState<DomainAvailability[]>([]);

  // Cart state
  const [cart, setCart] = useState<DomainAvailability[]>([]);
  const [showCart, setShowCart] = useState(false);

  // My domains state
  const [domains, setDomains] = useState<Domain[]>([]);
  const [loadingDomains, setLoadingDomains] = useState(true);
  const [selectedDomain, setSelectedDomain] = useState<Domain | null>(null);

  // Purchase flow state
  const [purchasing, setPurchasing] = useState(false);
  const [showPurchaseDialog, setShowPurchaseDialog] = useState(false);
  const [purchaseYears, setPurchaseYears] = useState(1);
  const [contactInfo, setContactInfo] = useState<DomainContact>({
    firstName: "",
    lastName: "",
    email: "",
    phone: "",
    address1: "",
    city: "",
    state: "",
    zip: "",
    country: "US",
  });

  // DNS management state
  const [dnsRecords, setDnsRecords] = useState<DnsRecord[]>([]);
  const [loadingDns, setLoadingDns] = useState(false);
  const [showDnsDialog, setShowDnsDialog] = useState(false);
  const [newDnsRecord, setNewDnsRecord] = useState<Partial<DnsRecord>>({
    host: "",
    type: "A",
    answer: "",
    ttl: 300,
  });

  // Active tab
  const [activeTab, setActiveTab] = useState("search");

  // Load Razorpay script
  useEffect(() => {
    const script = document.createElement("script");
    script.src = "https://checkout.razorpay.com/v1/checkout.js";
    script.async = true;
    document.body.appendChild(script);
    return () => {
      document.body.removeChild(script);
    };
  }, []);

  // Load user's domains
  const loadDomains = useCallback(async () => {
    try {
      setLoadingDomains(true);
      const result = await listDomains();
      setDomains(result.domains || []);
    } catch (error: any) {
      console.error("Error loading domains:", error);
      toast.error(error.message || "Failed to load domains");
    } finally {
      setLoadingDomains(false);
    }
  }, []);

  useEffect(() => {
    loadDomains();
  }, [loadDomains]);

  // Search for domains
  const handleSearch = async () => {
    if (!searchQuery.trim()) return;

    setSearching(true);
    try {
      // Generate variations if it doesn't have a TLD
      const query = searchQuery.trim().toLowerCase();
      let domainsToCheck: string[];

      if (query.includes(".")) {
        domainsToCheck = [query];
      } else {
        domainsToCheck = generateDomainVariations(query, POPULAR_TLDS.slice(0, 10));
      }

      const result = await searchDomains(domainsToCheck);
      setSearchResults(result.results || []);
    } catch (error: any) {
      console.error("Error searching domains:", error);
      toast.error(error.message || "Failed to search domains");
    } finally {
      setSearching(false);
    }
  };

  // Add to cart
  const addToCart = (domain: DomainAvailability) => {
    if (!cart.find((d) => d.domainName === domain.domainName)) {
      setCart([...cart, domain]);
      toast.success(`${domain.domainName} added to cart`);
    }
  };

  // Remove from cart
  const removeFromCart = (domainName: string) => {
    setCart(cart.filter((d) => d.domainName !== domainName));
  };

  // Calculate cart total
  const cartTotal = cart.reduce((sum, d) => sum + (d.retailPrice || 0), 0);

  // Handle purchase
  const handlePurchase = async () => {
    if (cart.length === 0) return;

    // Validate contact info
    if (
      !contactInfo.firstName ||
      !contactInfo.lastName ||
      !contactInfo.email ||
      !contactInfo.phone ||
      !contactInfo.address1 ||
      !contactInfo.city ||
      !contactInfo.state ||
      !contactInfo.zip ||
      !contactInfo.country
    ) {
      toast.error("Please fill in all contact information");
      return;
    }

    setPurchasing(true);

    try {
      // Process each domain in cart
      for (const domain of cart) {
        const result = await purchaseDomain({
          domainName: domain.domainName,
          years: purchaseYears,
          contacts: {
            registrant: contactInfo,
          },
        });

        // Open Razorpay checkout
        const options = {
          key: process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID,
          amount: result.razorpayOrder.amount,
          currency: result.razorpayOrder.currency,
          name: "Domain Purchase",
          description: `Register ${domain.domainName} for ${purchaseYears} year(s)`,
          order_id: result.razorpayOrder.id,
          handler: async (response: any) => {
            try {
              const verifyResult = await verifyDomainPayment({
                domainId: result.domain._id,
                razorpayOrderId: response.razorpay_order_id,
                razorpayPaymentId: response.razorpay_payment_id,
                razorpaySignature: response.razorpay_signature,
              });

              toast.success(`${domain.domainName} registered successfully!`);
              removeFromCart(domain.domainName);
              loadDomains();
            } catch (error: any) {
              console.error("Payment verification failed:", error);
              toast.error(error.message || "Payment verification failed");
            }
          },
          prefill: {
            email: contactInfo.email,
            contact: contactInfo.phone,
          },
          theme: {
            color: "var(--brand)",
          },
        };

        // The SDK is appended on mount but loads async — a click before it
        // finishes (or with it blocked) would throw "window.Razorpay is not a
        // constructor". Wait for it briefly; fail with a message, not a crash.
        for (let i = 0; i < 50 && !window.Razorpay; i++) {
          await new Promise((r) => setTimeout(r, 100));
        }
        if (typeof window.Razorpay !== "function") {
          throw new Error("Couldn't load the payment gateway. Please try again.");
        }
        const rzp = new window.Razorpay(options);
        rzp.open();
      }
    } catch (error: any) {
      console.error("Error purchasing domain:", error);
      toast.error(error.message || "Failed to purchase domain");
    } finally {
      setPurchasing(false);
      setShowPurchaseDialog(false);
    }
  };

  // Load DNS records for a domain
  const loadDnsRecords = async (domainId: string) => {
    setLoadingDns(true);
    try {
      const result = await getDnsRecords(domainId);
      setDnsRecords(result.records || []);
    } catch (error: any) {
      console.error("Error loading DNS records:", error);
      toast.error(error.message || "Failed to load DNS records");
    } finally {
      setLoadingDns(false);
    }
  };

  // Create DNS record
  const handleCreateDnsRecord = async () => {
    if (!selectedDomain || !newDnsRecord.host || !newDnsRecord.answer) {
      toast.error("Please fill in all DNS record fields");
      return;
    }

    try {
      await createDnsRecord(selectedDomain._id, newDnsRecord as Omit<DnsRecord, "id">);
      toast.success("DNS record created");
      loadDnsRecords(selectedDomain._id);
      setNewDnsRecord({ host: "", type: "A", answer: "", ttl: 300 });
      setShowDnsDialog(false);
    } catch (error: any) {
      console.error("Error creating DNS record:", error);
      toast.error(error.message || "Failed to create DNS record");
    }
  };

  // Delete DNS record
  const handleDeleteDnsRecord = async (recordId: number) => {
    if (!selectedDomain) return;

    try {
      await deleteDnsRecord(selectedDomain._id, recordId);
      toast.success("DNS record deleted");
      loadDnsRecords(selectedDomain._id);
    } catch (error: any) {
      console.error("Error deleting DNS record:", error);
      toast.error(error.message || "Failed to delete DNS record");
    }
  };

  // Toggle domain lock
  const handleToggleLock = async (domain: Domain) => {
    try {
      await setDomainLock(domain._id, !domain.locked);
      toast.success(`Domain ${domain.locked ? "unlocked" : "locked"}`);
      loadDomains();
    } catch (error: any) {
      console.error("Error toggling domain lock:", error);
      toast.error(error.message || "Failed to toggle domain lock");
    }
  };

  // Toggle auto-renew
  const handleToggleAutoRenew = async (domain: Domain) => {
    try {
      await setAutoRenew(domain._id, !domain.autoRenew);
      toast.success(`Auto-renew ${domain.autoRenew ? "disabled" : "enabled"}`);
      loadDomains();
    } catch (error: any) {
      console.error("Error toggling auto-renew:", error);
      toast.error(error.message || "Failed to toggle auto-renew");
    }
  };

  // Copy auth code
  const handleGetAuthCode = async (domain: Domain) => {
    if (domain.locked) {
      toast.error("Domain must be unlocked to get auth code");
      return;
    }

    try {
      const result = await getAuthCode(domain._id);
      await navigator.clipboard.writeText(result.authCode);
      toast.success("Auth code copied to clipboard");
    } catch (error: any) {
      console.error("Error getting auth code:", error);
      toast.error(error.message || "Failed to get auth code");
    }
  };

  return (
    <div className="min-h-screen bg-[#0b0b0d] p-4 sm:p-6">
      <div className="max-w-6xl mx-auto space-y-4 sm:space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-3 sm:mb-4">
          <div className="flex items-center gap-2 sm:gap-3">
            <Globe className="w-6 h-6 sm:w-8 sm:h-8 text-brand" />
            <h1 className="text-xl sm:text-2xl font-bold text-white">Domains</h1>
          </div>
          <Button
            variant="outline"
            className="border-[#333] text-gray-300 hover:bg-[#1a1a1f] relative"
            onClick={() => setShowCart(true)}
          >
            <ShoppingCart className="w-4 h-4 mr-2" />
            Cart
            {cart.length > 0 && (
              <span className="absolute -top-2 -right-2 bg-brand text-brand-foreground text-xs w-5 h-5 rounded-full flex items-center justify-center">
                {cart.length}
              </span>
            )}
          </Button>
        </div>

        {/* Main Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4 sm:space-y-6">
          <TabsList className="bg-[#111116] border border-[#333] p-1 w-full sm:w-auto">
            <TabsTrigger
              value="search"
              className="data-[state=active]:bg-brand data-[state=active]:text-brand-foreground px-3 sm:px-6 text-xs sm:text-sm flex-1 sm:flex-none"
            >
              <Search className="w-3 h-3 sm:w-4 sm:h-4 mr-1 sm:mr-2" />
              Search & Register
            </TabsTrigger>
            <TabsTrigger
              value="my-domains"
              className="data-[state=active]:bg-brand data-[state=active]:text-brand-foreground px-3 sm:px-6 text-xs sm:text-sm flex-1 sm:flex-none"
            >
              <Globe className="w-3 h-3 sm:w-4 sm:h-4 mr-1 sm:mr-2" />
              My Domains
              {domains.length > 0 && (
                <span className="ml-2 text-xs">({domains.length})</span>
              )}
            </TabsTrigger>
          </TabsList>

          {/* Search Tab */}
          <TabsContent value="search" className="space-y-4 sm:space-y-6">
            {/* Search Box */}
            <Card className="bg-[#111116] border-[#222]">
              <CardContent className="pt-6">
                <div className="flex flex-col sm:flex-row gap-3">
                  <div className="flex-1">
                    <Input
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                      placeholder="Search for your perfect domain name..."
                      className="bg-[#1a1a1f] border-[#333] text-white text-lg h-12"
                    />
                  </div>
                  <Button
                    onClick={handleSearch}
                    disabled={searching || !searchQuery.trim()}
                    className="bg-brand hover:bg-[color:color-mix(in_srgb,var(--brand)_91%,black)] text-brand-foreground h-12 px-8"
                  >
                    {searching ? (
                      <Loader2 className="w-5 h-5 animate-spin" />
                    ) : (
                      <>
                        <Search className="w-5 h-5 mr-2" />
                        Search
                      </>
                    )}
                  </Button>
                </div>
                <p className="text-sm text-gray-500 mt-2">
                  Enter a domain name or keyword to check availability
                </p>
              </CardContent>
            </Card>

            {/* Search Results */}
            {searchResults.length > 0 && (
              <Card className="bg-[#111116] border-[#222]">
                <CardHeader>
                  <CardTitle className="text-white flex items-center gap-2">
                    <Search className="w-5 h-5 text-brand" />
                    Search Results
                    <span className="text-sm text-gray-500 font-normal">
                      ({searchResults.length} domains)
                    </span>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {searchResults.map((domain) => (
                      <div
                        key={domain.domainName}
                        className={`flex items-center justify-between p-4 rounded-lg border ${
                          domain.available
                            ? "bg-green-500/5 border-green-500/20"
                            : "bg-red-500/5 border-red-500/20"
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          {domain.available ? (
                            <CheckCircle className="w-5 h-5 text-green-500" />
                          ) : (
                            <X className="w-5 h-5 text-red-500" />
                          )}
                          <div>
                            <p className="text-white font-medium">{domain.domainName}</p>
                            {domain.premium && (
                              <Badge variant="outline" className="text-yellow-500 border-yellow-500/50 text-xs">
                                Premium
                              </Badge>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-4">
                          {domain.available && domain.retailPrice && (
                            <p className="text-brand font-bold">
                              {formatDomainPrice(domain.retailPrice)}/yr
                            </p>
                          )}
                          {domain.available && (
                            <Button
                              size="sm"
                              onClick={() => addToCart(domain)}
                              disabled={cart.some((d) => d.domainName === domain.domainName)}
                              className="bg-brand hover:bg-[color:color-mix(in_srgb,var(--brand)_91%,black)] text-brand-foreground"
                            >
                              {cart.some((d) => d.domainName === domain.domainName) ? (
                                <>
                                  <Check className="w-4 h-4 mr-1" />
                                  In Cart
                                </>
                              ) : (
                                <>
                                  <Plus className="w-4 h-4 mr-1" />
                                  Add to Cart
                                </>
                              )}
                            </Button>
                          )}
                          {!domain.available && (
                            <span className="text-red-400 text-sm">Taken</span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* My Domains Tab */}
          <TabsContent value="my-domains" className="space-y-4 sm:space-y-6">
            <Card className="bg-[#111116] border-[#222]">
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="text-white flex items-center gap-2">
                  <Globe className="w-5 h-5 text-brand" />
                  My Domains
                </CardTitle>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={loadDomains}
                  disabled={loadingDomains}
                  className="border-[#333] text-gray-300 hover:bg-[#1a1a1f]"
                >
                  <RefreshCw className={`w-4 h-4 mr-2 ${loadingDomains ? "animate-spin" : ""}`} />
                  Refresh
                </Button>
              </CardHeader>
              <CardContent>
                {loadingDomains ? (
                  <div className="flex items-center justify-center py-12">
                    <Loader2 className="w-8 h-8 animate-spin text-brand" />
                  </div>
                ) : domains.length === 0 ? (
                  <div className="text-center py-12 text-gray-400">
                    <Globe className="w-12 h-12 mx-auto mb-4 opacity-50" />
                    <p>No domains yet. Search and register your first domain!</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {domains.map((domain) => {
                      const daysUntilExpiry = domain.expiresAt
                        ? getDaysUntilExpiry(domain.expiresAt)
                        : null;
                      const statusColor = getDomainStatusColor(domain.status);

                      return (
                        <div
                          key={domain._id}
                          className="flex items-center justify-between p-4 rounded-lg bg-[#1a1a1f] border border-[#333] hover:border-[#444] transition-colors"
                        >
                          <div className="flex items-center gap-4">
                            <div className="w-10 h-10 rounded-full bg-brand/10 flex items-center justify-center">
                              <Globe className="w-5 h-5 text-brand" />
                            </div>
                            <div>
                              <p className="text-white font-medium">{domain.domainName}</p>
                              <div className="flex items-center gap-2 mt-1">
                                <Badge
                                  variant="outline"
                                  className={`text-xs ${
                                    statusColor === "green"
                                      ? "text-green-400 border-green-400/50"
                                      : statusColor === "yellow"
                                      ? "text-yellow-400 border-yellow-400/50"
                                      : statusColor === "red"
                                      ? "text-red-400 border-red-400/50"
                                      : "text-gray-400 border-gray-400/50"
                                  }`}
                                >
                                  {domain.status}
                                </Badge>
                                {domain.locked && (
                                  <Lock className="w-3 h-3 text-gray-500" />
                                )}
                                {domain.autoRenew && (
                                  <RefreshCw className="w-3 h-3 text-green-500" />
                                )}
                              </div>
                            </div>
                          </div>
                          <div className="flex items-center gap-4">
                            {daysUntilExpiry !== null && (
                              <div className="text-right">
                                <p className="text-xs text-gray-500">Expires in</p>
                                <p
                                  className={`text-sm font-medium ${
                                    daysUntilExpiry < 30
                                      ? "text-red-400"
                                      : daysUntilExpiry < 90
                                      ? "text-yellow-400"
                                      : "text-green-400"
                                  }`}
                                >
                                  {daysUntilExpiry} days
                                </p>
                              </div>
                            )}
                            <Button
                              variant="outline"
                              size="sm"
                              className="border-[#333] text-gray-300 hover:bg-[#1a1a1f]"
                              onClick={() => {
                                setSelectedDomain(domain);
                                loadDnsRecords(domain._id);
                              }}
                            >
                              <Settings className="w-4 h-4" />
                            </Button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* Cart Dialog */}
        <Dialog open={showCart} onOpenChange={setShowCart}>
          <DialogContent className="bg-[#111116] border-[#333] text-white max-w-lg">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <ShoppingCart className="w-5 h-5 text-brand" />
                Shopping Cart
              </DialogTitle>
            </DialogHeader>

            {cart.length === 0 ? (
              <div className="text-center py-8 text-gray-400">
                <ShoppingCart className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <p>Your cart is empty</p>
              </div>
            ) : (
              <>
                <div className="space-y-2 max-h-60 overflow-auto">
                  {cart.map((domain) => (
                    <div
                      key={domain.domainName}
                      className="flex items-center justify-between p-3 rounded-lg bg-[#1a1a1f]"
                    >
                      <div>
                        <p className="text-white font-medium">{domain.domainName}</p>
                        <p className="text-sm text-gray-400">1 year registration</p>
                      </div>
                      <div className="flex items-center gap-3">
                        <p className="text-brand font-bold">
                          {formatDomainPrice(domain.retailPrice || 0)}
                        </p>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => removeFromCart(domain.domainName)}
                          className="text-red-400 hover:text-red-300 hover:bg-red-500/10"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="border-t border-[#333] pt-4 mt-4">
                  <div className="flex items-center justify-between mb-4">
                    <p className="text-gray-400">Total</p>
                    <p className="text-2xl font-bold text-brand">
                      {formatDomainPrice(cartTotal)}
                    </p>
                  </div>
                  <Button
                    className="w-full bg-brand hover:bg-[color:color-mix(in_srgb,var(--brand)_91%,black)] text-brand-foreground"
                    onClick={() => {
                      setShowCart(false);
                      setShowPurchaseDialog(true);
                    }}
                  >
                    Proceed to Checkout
                  </Button>
                </div>
              </>
            )}
          </DialogContent>
        </Dialog>

        {/* Purchase Dialog */}
        <Dialog open={showPurchaseDialog} onOpenChange={setShowPurchaseDialog}>
          <DialogContent className="bg-[#111116] border-[#333] text-white max-w-2xl max-h-[90vh] overflow-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Globe className="w-5 h-5 text-brand" />
                Complete Your Purchase
              </DialogTitle>
            </DialogHeader>

            <div className="space-y-6">
              {/* Registration Period */}
              <div>
                <Label className="text-gray-300">Registration Period</Label>
                <Select
                  value={String(purchaseYears)}
                  onValueChange={(v) => setPurchaseYears(parseInt(v))}
                >
                  <SelectTrigger className="mt-2 bg-[#1a1a1f] border-[#333] text-white">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-[#111116] border-[#333]">
                    {[1, 2, 3, 5, 10].map((years) => (
                      <SelectItem key={years} value={String(years)} className="text-white">
                        {years} year{years > 1 ? "s" : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Contact Information */}
              <div className="space-y-4">
                <h3 className="text-white font-medium">Contact Information</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label className="text-gray-300">First Name</Label>
                    <Input
                      value={contactInfo.firstName}
                      onChange={(e) =>
                        setContactInfo({ ...contactInfo, firstName: e.target.value })
                      }
                      className="mt-1 bg-[#1a1a1f] border-[#333] text-white"
                    />
                  </div>
                  <div>
                    <Label className="text-gray-300">Last Name</Label>
                    <Input
                      value={contactInfo.lastName}
                      onChange={(e) =>
                        setContactInfo({ ...contactInfo, lastName: e.target.value })
                      }
                      className="mt-1 bg-[#1a1a1f] border-[#333] text-white"
                    />
                  </div>
                  <div>
                    <Label className="text-gray-300">Email</Label>
                    <Input
                      type="email"
                      value={contactInfo.email}
                      onChange={(e) =>
                        setContactInfo({ ...contactInfo, email: e.target.value })
                      }
                      className="mt-1 bg-[#1a1a1f] border-[#333] text-white"
                    />
                  </div>
                  <div>
                    <Label className="text-gray-300">Phone</Label>
                    <Input
                      value={contactInfo.phone}
                      onChange={(e) =>
                        setContactInfo({ ...contactInfo, phone: e.target.value })
                      }
                      placeholder="+1.1234567890"
                      className="mt-1 bg-[#1a1a1f] border-[#333] text-white"
                    />
                  </div>
                  <div className="col-span-2">
                    <Label className="text-gray-300">Address</Label>
                    <Input
                      value={contactInfo.address1}
                      onChange={(e) =>
                        setContactInfo({ ...contactInfo, address1: e.target.value })
                      }
                      className="mt-1 bg-[#1a1a1f] border-[#333] text-white"
                    />
                  </div>
                  <div>
                    <Label className="text-gray-300">City</Label>
                    <Input
                      value={contactInfo.city}
                      onChange={(e) =>
                        setContactInfo({ ...contactInfo, city: e.target.value })
                      }
                      className="mt-1 bg-[#1a1a1f] border-[#333] text-white"
                    />
                  </div>
                  <div>
                    <Label className="text-gray-300">State/Province</Label>
                    <Input
                      value={contactInfo.state}
                      onChange={(e) =>
                        setContactInfo({ ...contactInfo, state: e.target.value })
                      }
                      className="mt-1 bg-[#1a1a1f] border-[#333] text-white"
                    />
                  </div>
                  <div>
                    <Label className="text-gray-300">Postal Code</Label>
                    <Input
                      value={contactInfo.zip}
                      onChange={(e) =>
                        setContactInfo({ ...contactInfo, zip: e.target.value })
                      }
                      className="mt-1 bg-[#1a1a1f] border-[#333] text-white"
                    />
                  </div>
                  <div>
                    <Label className="text-gray-300">Country</Label>
                    <Input
                      value={contactInfo.country}
                      onChange={(e) =>
                        setContactInfo({ ...contactInfo, country: e.target.value })
                      }
                      placeholder="US"
                      className="mt-1 bg-[#1a1a1f] border-[#333] text-white"
                    />
                  </div>
                </div>
              </div>

              {/* Order Summary */}
              <div className="bg-[#1a1a1f] p-4 rounded-lg">
                <h3 className="text-white font-medium mb-3">Order Summary</h3>
                {cart.map((domain) => (
                  <div key={domain.domainName} className="flex justify-between text-sm mb-2">
                    <span className="text-gray-300">
                      {domain.domainName} x {purchaseYears} year(s)
                    </span>
                    <span className="text-white">
                      {formatDomainPrice((domain.retailPrice || 0) * purchaseYears)}
                    </span>
                  </div>
                ))}
                <div className="border-t border-[#333] mt-3 pt-3 flex justify-between">
                  <span className="text-gray-300 font-medium">Total</span>
                  <span className="text-brand font-bold text-lg">
                    {formatDomainPrice(cartTotal * purchaseYears)}
                  </span>
                </div>
              </div>
            </div>

            <DialogFooter>
              <DialogClose asChild>
                <Button variant="outline" className="border-[#333] text-gray-300">
                  Cancel
                </Button>
              </DialogClose>
              <Button
                onClick={handlePurchase}
                disabled={purchasing}
                className="bg-brand hover:bg-[color:color-mix(in_srgb,var(--brand)_91%,black)] text-brand-foreground"
              >
                {purchasing ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin mr-2" />
                    Processing...
                  </>
                ) : (
                  <>
                    <Check className="w-4 h-4 mr-2" />
                    Pay {formatDomainPrice(cartTotal * purchaseYears)}
                  </>
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Domain Management Dialog */}
        <Dialog open={!!selectedDomain} onOpenChange={(open) => !open && setSelectedDomain(null)}>
          <DialogContent className="bg-[#111116] border-[#333] text-white max-w-3xl max-h-[90vh] overflow-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Settings className="w-5 h-5 text-brand" />
                Manage {selectedDomain?.domainName}
              </DialogTitle>
            </DialogHeader>

            {selectedDomain && (
              <Tabs defaultValue="overview" className="space-y-4">
                <TabsList className="bg-[#1a1a1f] border border-[#333]">
                  <TabsTrigger value="overview" className="data-[state=active]:bg-[#333]">
                    Overview
                  </TabsTrigger>
                  <TabsTrigger value="dns" className="data-[state=active]:bg-[#333]">
                    DNS Records
                  </TabsTrigger>
                  <TabsTrigger value="settings" className="data-[state=active]:bg-[#333]">
                    Settings
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="overview" className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="bg-[#1a1a1f] p-4 rounded-lg">
                      <p className="text-gray-400 text-sm">Status</p>
                      <Badge
                        variant="outline"
                        className={`mt-1 ${
                          getDomainStatusColor(selectedDomain.status) === "green"
                            ? "text-green-400 border-green-400/50"
                            : "text-yellow-400 border-yellow-400/50"
                        }`}
                      >
                        {selectedDomain.status}
                      </Badge>
                    </div>
                    <div className="bg-[#1a1a1f] p-4 rounded-lg">
                      <p className="text-gray-400 text-sm">Expires</p>
                      <p className="text-white mt-1">
                        {selectedDomain.expiresAt
                          ? new Date(selectedDomain.expiresAt).toLocaleDateString()
                          : "N/A"}
                      </p>
                    </div>
                    <div className="bg-[#1a1a1f] p-4 rounded-lg">
                      <p className="text-gray-400 text-sm">Auto-Renew</p>
                      <p className="text-white mt-1">
                        {selectedDomain.autoRenew ? "Enabled" : "Disabled"}
                      </p>
                    </div>
                    <div className="bg-[#1a1a1f] p-4 rounded-lg">
                      <p className="text-gray-400 text-sm">Lock Status</p>
                      <p className="text-white mt-1 flex items-center gap-2">
                        {selectedDomain.locked ? (
                          <>
                            <Lock className="w-4 h-4" /> Locked
                          </>
                        ) : (
                          <>
                            <Unlock className="w-4 h-4" /> Unlocked
                          </>
                        )}
                      </p>
                    </div>
                  </div>

                  {selectedDomain.nameservers && selectedDomain.nameservers.length > 0 && (
                    <div className="bg-[#1a1a1f] p-4 rounded-lg">
                      <p className="text-gray-400 text-sm mb-2">Nameservers</p>
                      <div className="space-y-1">
                        {selectedDomain.nameservers.map((ns, i) => (
                          <p key={i} className="text-white font-mono text-sm">
                            {ns}
                          </p>
                        ))}
                      </div>
                    </div>
                  )}
                </TabsContent>

                <TabsContent value="dns" className="space-y-4">
                  <div className="flex justify-between items-center">
                    <p className="text-gray-400 text-sm">Manage DNS records for your domain</p>
                    <Button
                      size="sm"
                      onClick={() => setShowDnsDialog(true)}
                      className="bg-brand hover:bg-[color:color-mix(in_srgb,var(--brand)_91%,black)] text-brand-foreground"
                    >
                      <Plus className="w-4 h-4 mr-2" />
                      Add Record
                    </Button>
                  </div>

                  {loadingDns ? (
                    <div className="flex justify-center py-8">
                      <Loader2 className="w-6 h-6 animate-spin text-brand" />
                    </div>
                  ) : dnsRecords.length === 0 ? (
                    <div className="text-center py-8 text-gray-400">
                      <Server className="w-12 h-12 mx-auto mb-4 opacity-50" />
                      <p>No DNS records found</p>
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full">
                        <thead>
                          <tr className="border-b border-[#333]">
                            <th className="text-left py-2 px-3 text-gray-400 font-medium text-sm">
                              Type
                            </th>
                            <th className="text-left py-2 px-3 text-gray-400 font-medium text-sm">
                              Host
                            </th>
                            <th className="text-left py-2 px-3 text-gray-400 font-medium text-sm">
                              Value
                            </th>
                            <th className="text-left py-2 px-3 text-gray-400 font-medium text-sm">
                              TTL
                            </th>
                            <th className="text-right py-2 px-3 text-gray-400 font-medium text-sm">
                              Actions
                            </th>
                          </tr>
                        </thead>
                        <tbody>
                          {dnsRecords.map((record) => (
                            <tr key={record.id} className="border-b border-[#222]">
                              <td className="py-2 px-3">
                                <Badge variant="outline" className="text-xs">
                                  {record.type}
                                </Badge>
                              </td>
                              <td className="py-2 px-3 text-white font-mono text-sm">
                                {record.host || "@"}
                              </td>
                              <td className="py-2 px-3 text-gray-300 font-mono text-sm truncate max-w-xs">
                                {record.answer}
                              </td>
                              <td className="py-2 px-3 text-gray-400 text-sm">{record.ttl}</td>
                              <td className="py-2 px-3 text-right">
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => record.id && handleDeleteDnsRecord(record.id)}
                                  className="text-red-400 hover:text-red-300"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </Button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </TabsContent>

                <TabsContent value="settings" className="space-y-4">
                  <div className="space-y-3">
                    <div className="flex items-center justify-between p-4 bg-[#1a1a1f] rounded-lg">
                      <div>
                        <p className="text-white font-medium">Auto-Renew</p>
                        <p className="text-gray-400 text-sm">
                          Automatically renew before expiration
                        </p>
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleToggleAutoRenew(selectedDomain)}
                        className="border-[#333]"
                      >
                        {selectedDomain.autoRenew ? "Disable" : "Enable"}
                      </Button>
                    </div>

                    <div className="flex items-center justify-between p-4 bg-[#1a1a1f] rounded-lg">
                      <div>
                        <p className="text-white font-medium">Domain Lock</p>
                        <p className="text-gray-400 text-sm">Prevent unauthorized transfers</p>
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleToggleLock(selectedDomain)}
                        className="border-[#333]"
                      >
                        {selectedDomain.locked ? (
                          <>
                            <Unlock className="w-4 h-4 mr-2" />
                            Unlock
                          </>
                        ) : (
                          <>
                            <Lock className="w-4 h-4 mr-2" />
                            Lock
                          </>
                        )}
                      </Button>
                    </div>

                    <div className="flex items-center justify-between p-4 bg-[#1a1a1f] rounded-lg">
                      <div>
                        <p className="text-white font-medium">Auth Code</p>
                        <p className="text-gray-400 text-sm">
                          Required for transferring to another registrar
                        </p>
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleGetAuthCode(selectedDomain)}
                        disabled={selectedDomain.locked}
                        className="border-[#333]"
                      >
                        <Copy className="w-4 h-4 mr-2" />
                        Copy Code
                      </Button>
                    </div>
                  </div>
                </TabsContent>
              </Tabs>
            )}
          </DialogContent>
        </Dialog>

        {/* Add DNS Record Dialog */}
        <Dialog open={showDnsDialog} onOpenChange={setShowDnsDialog}>
          <DialogContent className="bg-[#111116] border-[#333] text-white max-w-md">
            <DialogHeader>
              <DialogTitle>Add DNS Record</DialogTitle>
            </DialogHeader>

            <div className="space-y-4">
              <div>
                <Label className="text-gray-300">Record Type</Label>
                <Select
                  value={newDnsRecord.type}
                  onValueChange={(v) =>
                    setNewDnsRecord({ ...newDnsRecord, type: v as DnsRecord["type"] })
                  }
                >
                  <SelectTrigger className="mt-1 bg-[#1a1a1f] border-[#333] text-white">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-[#111116] border-[#333]">
                    {["A", "AAAA", "CNAME", "MX", "TXT", "NS", "SRV", "CAA"].map((type) => (
                      <SelectItem key={type} value={type} className="text-white">
                        {type}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label className="text-gray-300">Host</Label>
                <Input
                  value={newDnsRecord.host}
                  onChange={(e) => setNewDnsRecord({ ...newDnsRecord, host: e.target.value })}
                  placeholder="@ or subdomain"
                  className="mt-1 bg-[#1a1a1f] border-[#333] text-white"
                />
              </div>

              <div>
                <Label className="text-gray-300">Value/Answer</Label>
                <Input
                  value={newDnsRecord.answer}
                  onChange={(e) => setNewDnsRecord({ ...newDnsRecord, answer: e.target.value })}
                  placeholder="IP address or hostname"
                  className="mt-1 bg-[#1a1a1f] border-[#333] text-white"
                />
              </div>

              <div>
                <Label className="text-gray-300">TTL (seconds)</Label>
                <Input
                  type="number"
                  value={newDnsRecord.ttl}
                  onChange={(e) =>
                    setNewDnsRecord({ ...newDnsRecord, ttl: parseInt(e.target.value) })
                  }
                  className="mt-1 bg-[#1a1a1f] border-[#333] text-white"
                />
              </div>

              {(newDnsRecord.type === "MX" || newDnsRecord.type === "SRV") && (
                <div>
                  <Label className="text-gray-300">Priority</Label>
                  <Input
                    type="number"
                    value={newDnsRecord.priority || ""}
                    onChange={(e) =>
                      setNewDnsRecord({ ...newDnsRecord, priority: parseInt(e.target.value) })
                    }
                    className="mt-1 bg-[#1a1a1f] border-[#333] text-white"
                  />
                </div>
              )}
            </div>

            <DialogFooter>
              <DialogClose asChild>
                <Button variant="outline" className="border-[#333] text-gray-300">
                  Cancel
                </Button>
              </DialogClose>
              <Button
                onClick={handleCreateDnsRecord}
                className="bg-brand hover:bg-[color:color-mix(in_srgb,var(--brand)_91%,black)] text-brand-foreground"
              >
                Add Record
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
