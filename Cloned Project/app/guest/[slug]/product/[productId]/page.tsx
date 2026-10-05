"use client";

import { useState, useEffect } from "react";
import { useParams, useSearchParams } from "next/navigation";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import Link from "next/link";
import { stripHtml } from "@/lib/utils";
import { sanitizeDescription } from "@/lib/sanitizeDescription";
import {
  ArrowLeft,
  Star,
  Users,
  Download,
  Check,
  ChevronDown,
  ChevronUp,
  Package,
  Shield,
  RefreshCw,
  Award,
  Lock,
  Zap,
  ShoppingBag,
} from "lucide-react";
import GuestNavbar from "../../components/GuestNavbar";
import { OpenInAppBanner } from "@/components/ui/open-in-app-banner";

interface Organization {
  _id: string;
  name: string;
  slug?: string;
  icon?: string;
  branding?: {
    primaryColor?: string;
  };
  description?: string;
  headingText?: string;
  subHeadingText?: string;
  coverPhoto?: string;
  founders?: Creator[];
}

interface Creator {
  _id: string;
  name: string;
  email: string;
  profilePicture?: string;
  country?: string;
  state?: string;
  city?: string;
}

interface DigitalAsset {
  _id: string;
  name: string;
  fileUrl: string;
  fileType: string;
  fileSize: number;
}

interface DigitalLink {
  _id: string;
  label: string;
  url: string;
  description?: string;
  linkType?: "static" | "dynamic";
}

interface ProductKeyFeature {
  icon: string;
  title: string;
  description: string;
}

interface ProductWhatsInsideGroup {
  icon: string;
  title: string;
  items: string[];
}

interface ProductReview {
  _id?: string;
  reviewerName: string;
  reviewerRole?: string;
  reviewerAvatar?: string;
  rating: number;
  text: string;
  helpfulCount?: number;
  createdAt?: string;
}

interface ProductFaq {
  question: string;
  answer: string;
}

interface ProductDetailEntry {
  label: string;
  value: string;
}

interface Product {
  _id: string;
  name: string;
  slug: string;
  description?: string;
  price: number;
  currency: string;
  images: string[];
  isDigital: boolean;
  deliveryMethod: "physical" | "digital" | "both";
  isSubscription?: boolean;
  subscriptionPeriod?: string;
  sku?: string;
  status?: string;
  categoryName?: string;
  tags?: string[];
  trackQuantity?: boolean;
  quantity?: number;
  digitalAssets?: DigitalAsset[];
  digitalLinks?: DigitalLink[];
  creator?: Creator;
  organization?: Organization;
  rating?: number;
  ratingCount?: number;
  downloadCount?: number;
  whatsIncluded?: string[];
  keyFeatures?: ProductKeyFeature[];
  whatsInside?: ProductWhatsInsideGroup[];
  reviews?: ProductReview[];
  faqs?: ProductFaq[];
  productDetails?: ProductDetailEntry[];
}

function formatCurrency(amount: number, currency: string): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: currency || "USD",
    minimumFractionDigits: 0,
  }).format(amount);
}

function StarRating({ rating, size = "sm", brandColor }: { rating: number; size?: "sm" | "md" | "lg"; brandColor?: string }) {
  const sizeClasses = { sm: "h-4 w-4", md: "h-5 w-5", lg: "h-6 w-6" };
  const starColor = brandColor || "#f59e0b";

  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((star) => (
        <Star
          key={star}
          className={sizeClasses[size]}
          style={{ color: star <= rating ? starColor : "#d1d5db", fill: star <= rating ? starColor : "#d1d5db" }}
        />
      ))}
    </div>
  );
}

export default function ProductDetailPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const slug = params.slug as string;
  const productId = params.productId as string;
  const referCode = searchParams.get("referCode");
  const referSuffix = referCode ? `?referCode=${referCode}` : "";
  const checkoutRef = referCode ? `?ref=${referCode}` : "";

  const [organization, setOrganization] = useState<Organization | null>(null);
  const [product, setProduct] = useState<Product | null>(null);
  const [loading, setLoading] = useState(true);
  const [expandedContent, setExpandedContent] = useState<Set<string>>(new Set(["1"]));
  const [selectedImage, setSelectedImage] = useState(0);
  const [theme, setTheme] = useState<"light" | "dark">("dark");
  const [isDescriptionExpanded, setIsDescriptionExpanded] = useState(false);

  const brandColor = organization?.branding?.primaryColor || "#FBA70A";

  // Dynamic data - only show sections when data exists
  const contentCategories = product?.whatsInside && product.whatsInside.length > 0
    ? product.whatsInside.map((group, idx) => ({
        id: String(idx + 1),
        title: group.title,
        itemCount: group.items.length,
        items: group.items,
      }))
    : null;

  const reviews = product?.reviews && product.reviews.length > 0
    ? product.reviews.map((r, idx) => ({
        id: r._id || String(idx + 1),
        name: r.reviewerName,
        initials: r.reviewerName.split(" ").map((w) => w[0]).join("").toUpperCase().slice(0, 2),
        role: r.reviewerRole || "",
        rating: r.rating,
        comment: r.text,
        date: r.createdAt ? new Date(r.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "",
        helpfulCount: r.helpfulCount || 0,
      }))
    : null;

  const faqs = product?.faqs && product.faqs.length > 0 ? product.faqs : null;

  const includedFeatures = product?.whatsIncluded && product.whatsIncluded.length > 0
    ? product.whatsIncluded
    : null;

  const displayRating = product?.rating;
  const displayRatingCount = product?.ratingCount;
  const displayDownloads = product?.downloadCount;
  const creator = product?.creator;
  // No discount concept in this app: a product is either free or paid; `price` is
  // the single source of truth (0 = free).
  const sellingPrice = product?.price || 0;

  const keyFeatures = product?.keyFeatures && product.keyFeatures.length > 0 ? product.keyFeatures : null;

  const productDetailTable = product?.productDetails && product.productDetails.length > 0
    ? product.productDetails
    : null;

  useEffect(() => {
    fetchData();
  }, [slug, productId]);

  async function fetchData() {
    try {
      setLoading(true);

      // Try to fetch product from public endpoint first (includes organization data)
      try {
        const productResponse = await api<{ success: boolean; product: Product }>(
          `/public/products/${productId}`,
          { method: "GET" }
        );
        if (productResponse.success && productResponse.product) {
          setProduct(productResponse.product);
          // Organization is included in the product response
          if (productResponse.product.organization) {
            setOrganization(productResponse.product.organization);
          }
          return;
        }
      } catch {
        // Public endpoint failed, try fallback
      }

      // Fallback: Fetch organization separately
      const orgResponse = await api<{ ok: boolean; organization: Organization }>(
        `/guest-auth/hq-by-slug/${slug}`,
        { method: "GET" }
      );

      if (orgResponse.ok && orgResponse.organization) {
        setOrganization(orgResponse.organization);
      }

      // Fallback: Fetch from hq-items
      const itemsResponse = await api<{ ok: boolean; products: Product[] }>(
        `/guest-auth/hq-items/${slug}`,
        { method: "GET" }
      );

      if (itemsResponse.ok && itemsResponse.products) {
        const found = itemsResponse.products.find((p) => p._id === productId);
        if (found) setProduct(found);
      }
    } catch (err) {
      console.error("Error fetching data:", err);
      toast.error("Failed to load product details");
    } finally {
      setLoading(false);
    }
  }

  function toggleContent(id: string) {
    setExpandedContent((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  if (loading) {
    return (
      <div className={`min-h-screen flex items-center justify-center ${theme === "dark" ? "bg-zinc-950" : "bg-white"}`}>
        <div className="animate-spin rounded-full h-12 w-12 border-b-2" style={{ borderColor: brandColor }} />
      </div>
    );
  }

  if (!product || !organization) {
    return (
      <div className={`min-h-screen flex flex-col items-center justify-center ${theme === "dark" ? "bg-zinc-950" : "bg-white"}`}>
        <ShoppingBag className={`h-16 w-16 mb-4 ${theme === "dark" ? "text-zinc-700" : "text-gray-300"}`} />
        <h1 className={`text-2xl font-bold mb-2 ${theme === "dark" ? "text-white" : "text-gray-900"}`}>Product Not Found</h1>
        <p className={`mb-6 ${theme === "dark" ? "text-zinc-400" : "text-gray-600"}`}>The product you're looking for doesn't exist.</p>
        <Link href={`/guest/${slug}${referSuffix}`}>
          <Button style={{ backgroundColor: brandColor }} className="text-black">Back to Office</Button>
        </Link>
      </div>
    );
  }

  const productImages = product.images?.length > 0 ? product.images : [null, null, null, null];

  return (
    <div className={`min-h-screen ${theme === "dark" ? "bg-zinc-950" : "bg-gray-50"}`}>
      <style>{`
        .brand-hover:hover { color: ${brandColor} !important; }
      `}</style>

      {/* Open-in-app banner — shown on mobile browsers only */}
      <OpenInAppBanner
        deepLinkPath={`product/${productId}`}
        contentTitle={product.name}
      />

      <GuestNavbar organization={organization} slug={slug} theme={theme} setTheme={setTheme} brandColor={brandColor} />

      {/* Hero Section */}
      <section
        className={theme === "dark" ? "bg-zinc-950" : "bg-gray-50"}
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="lg:grid lg:grid-cols-5 lg:gap-8 items-start">
            {/* Left Content - 3 columns */}
            <div className="lg:col-span-3">
              {/* Badge */}
              <div className="mb-4 flex items-center gap-2">
                <span
                  className="inline-block px-3 py-1 text-sm font-semibold rounded text-black"
                  style={{ backgroundColor: brandColor }}
                >
                  {product.isDigital ? "Digital Product" : "Product"}
                </span>
                {product.digitalLinks?.some(l => l.linkType === "dynamic") && (
                  <span className="inline-flex items-center gap-1 px-3 py-1 text-sm font-semibold rounded bg-purple-500 text-white">
                    Dynamic Links
                  </span>
                )}
              </div>

              {/* Title */}
              <h1 className={`text-3xl md:text-4xl font-bold mb-4 ${theme === "dark" ? "text-white" : "text-gray-900"}`}>
                {product.name}
              </h1>

              {/* Description with View More */}
              {product.description && (
                <div className="mb-6">
                  {isDescriptionExpanded || stripHtml(product.description).length <= 200 ? (
                    <div 
                      className={`text-lg space-y-2 [&_ol]:list-decimal [&_ul]:list-disc [&_ol]:pl-5 [&_ul]:pl-5 [&_a]:underline ${theme === "dark" ? "text-gray-300" : "text-gray-700"}`}
                      dangerouslySetInnerHTML={{ __html: sanitizeDescription(product.description) }}
                    />
                  ) : (
                    <p className={`text-lg ${theme === "dark" ? "text-gray-300" : "text-gray-700"}`}>
                      {`${stripHtml(product.description).slice(0, 200)}...`}
                    </p>
                  )}
                  {stripHtml(product.description).length > 200 && (
                    <button
                      onClick={() => setIsDescriptionExpanded(!isDescriptionExpanded)}
                      className="mt-2 text-sm font-medium hover:underline cursor-pointer"
                      style={{ color: brandColor }}
                    >
                      {isDescriptionExpanded ? "View less" : "View more"}
                    </button>
                  )}
                </div>
              )}

              {/* Rating & Downloads */}
              {(displayRating || displayDownloads) && (
                <div className="flex flex-wrap items-center gap-4 mb-4">
                  {displayRating != null && (
                    <div className="flex items-center gap-2">
                      <span style={{ color: brandColor }} className="font-bold">{displayRating}</span>
                      <StarRating rating={Math.round(displayRating)} size="sm" brandColor={brandColor} />
                      {displayRatingCount != null && (
                        <span style={{ color: brandColor }}>({displayRatingCount.toLocaleString()} ratings)</span>
                      )}
                    </div>
                  )}
                  {displayDownloads != null && (
                    <div className={`flex items-center gap-2 ${theme === "dark" ? "text-gray-300" : "text-gray-600"}`}>
                      <Download className="h-4 w-4" />
                      <span>{displayDownloads.toLocaleString()} downloads</span>
                    </div>
                  )}
                </div>
              )}

              {/* Creator */}
              <p className={`mb-4 ${theme === "dark" ? "text-gray-300" : "text-gray-600"}`}>
                Created by <span style={{ color: brandColor }} className="hover:underline cursor-pointer">{creator?.name || organization.name}</span>
              </p>

              {/* Meta Info */}
              <div className={`flex flex-wrap items-center gap-6 text-sm ${theme === "dark" ? "text-gray-400" : "text-gray-500"}`}>
                {product.categoryName && (
                  <div className="flex items-center gap-2">
                    <Package className="h-4 w-4" />
                    <span>{product.categoryName}</span>
                  </div>
                )}
                <div className="flex items-center gap-2">
                  <Shield className="h-4 w-4" />
                  <span>Secure checkout</span>
                </div>
                <div className="flex items-center gap-2">
                  <RefreshCw className="h-4 w-4" />
                  <span>Lifetime updates</span>
                </div>
              </div>
            </div>

            {/* Right - Product Image - 2 columns */}
            <div className="lg:col-span-2 mt-6 lg:mt-0">
              <div className="relative rounded-xl overflow-hidden shadow-lg">
                {product.images && product.images.length > 0 && product.images[0] ? (
                  <img
                    src={product.images[0]}
                    alt={product.name}
                    className="w-full aspect-video object-cover"
                  />
                ) : (
                  <div
                    className="w-full aspect-video flex items-center justify-center"
                    style={{ background: `linear-gradient(135deg, ${brandColor}40, ${brandColor}20)` }}
                  >
                    <Package className="h-16 w-16 text-white/50" />
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Main Content */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="lg:grid lg:grid-cols-3 lg:gap-8">
          {/* Left Content */}
          <div className="lg:col-span-2 space-y-8">
            {/* What's Included */}
            {includedFeatures && (
              <div className={`rounded-xl border p-6 ${theme === "dark" ? "bg-zinc-900 border-zinc-800" : "bg-white border-gray-200"}`}>
                <h2 className={`text-xl font-bold mb-6 ${theme === "dark" ? "text-white" : "text-gray-900"}`}>What's Included</h2>
                <div className="grid md:grid-cols-2 gap-4">
                  {includedFeatures.map((feature, index) => (
                    <div key={index} className="flex gap-3">
                      <Check className="h-5 w-5 shrink-0 mt-0.5" style={{ color: brandColor }} />
                      <span className={theme === "dark" ? "text-zinc-300" : "text-gray-700"}>{feature}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Key Features */}
            {keyFeatures && (
              <div className={`rounded-xl border p-6 ${theme === "dark" ? "bg-zinc-900 border-zinc-800" : "bg-white border-gray-200"}`}>
                <h2 className={`text-xl font-bold mb-6 ${theme === "dark" ? "text-white" : "text-gray-900"}`}>Key Features</h2>
                <div className="grid md:grid-cols-2 gap-6">
                  {keyFeatures.map((feature, index) => (
                    <div key={index} className={`p-4 rounded-xl border ${theme === "dark" ? "bg-zinc-800/50 border-zinc-700" : "bg-gray-50 border-gray-200"}`}>
                      <div className="flex items-start gap-4">
                        <div className="w-12 h-12 rounded-xl flex items-center justify-center shrink-0 overflow-hidden" style={{ backgroundColor: `${brandColor}20` }}>
                          {feature.icon ? (
                            <img src={feature.icon} alt="" className="w-full h-full object-cover" />
                          ) : (
                            <Zap className="h-6 w-6" style={{ color: brandColor }} />
                          )}
                        </div>
                        <div>
                          <h3 className={`font-semibold mb-1 ${theme === "dark" ? "text-white" : "text-gray-900"}`}>{feature.title}</h3>
                          <p className={`text-sm ${theme === "dark" ? "text-zinc-400" : "text-gray-600"}`}>{feature.description}</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* What's Inside */}
            {contentCategories && (
            <div className={`rounded-xl border p-6 ${theme === "dark" ? "bg-zinc-900 border-zinc-800" : "bg-white border-gray-200"}`}>
              <h2 className={`text-xl font-bold mb-6 ${theme === "dark" ? "text-white" : "text-gray-900"}`}>What's Inside</h2>
              <div className="space-y-3">
                {contentCategories.map((category) => (
                  <div key={category.id} className={`border rounded-xl overflow-hidden ${theme === "dark" ? "border-zinc-800" : "border-gray-200"}`}>
                    <button
                      onClick={() => toggleContent(category.id)}
                      className={`w-full flex items-center justify-between p-4 transition-colors ${theme === "dark" ? "hover:bg-zinc-800/50" : "hover:bg-gray-50"}`}
                    >
                      <div className="flex items-center gap-3">
                        <Package className="h-5 w-5" style={{ color: brandColor }} />
                        <span className={`font-semibold ${theme === "dark" ? "text-white" : "text-gray-900"}`}>{category.title}</span>
                        <span className={`px-2 py-0.5 text-xs rounded-full ${theme === "dark" ? "bg-zinc-800 text-zinc-400" : "bg-gray-100 text-gray-600"}`}>
                          {category.itemCount} items
                        </span>
                      </div>
                      {expandedContent.has(category.id) ? (
                        <ChevronUp className={`h-5 w-5 ${theme === "dark" ? "text-zinc-400" : "text-gray-400"}`} />
                      ) : (
                        <ChevronDown className={`h-5 w-5 ${theme === "dark" ? "text-zinc-400" : "text-gray-400"}`} />
                      )}
                    </button>
                    {expandedContent.has(category.id) && (
                      <div className={`px-4 pb-4 space-y-2 ${theme === "dark" ? "border-t border-zinc-800" : "border-t border-gray-100"}`}>
                        <div className="pt-4 pl-8 space-y-2">
                          {category.items.map((item, i) => (
                            <div key={i} className="flex items-center gap-2">
                              <Check className="h-4 w-4" style={{ color: brandColor }} />
                              <span className={theme === "dark" ? "text-zinc-400" : "text-gray-600"}>{item}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
            )}


            {/* About the Creator */}
            <div className={`rounded-xl border p-6 ${theme === "dark" ? "bg-zinc-900 border-zinc-800" : "bg-white border-gray-200"}`}>
              <h2 className={`text-xl font-bold mb-6 ${theme === "dark" ? "text-white" : "text-gray-900"}`}>About the Creator</h2>
              <div className="flex items-start gap-6">
                {creator?.profilePicture ? (
                  <img
                    src={creator.profilePicture}
                    alt={creator.name}
                    className="w-24 h-24 rounded-full object-cover flex-shrink-0"
                  />
                ) : (
                  <div className="w-24 h-24 rounded-full flex items-center justify-center text-3xl font-bold text-black flex-shrink-0" style={{ backgroundColor: brandColor }}>
                    {(creator?.name || organization.name)?.split(" ").map(w => w[0]).join("").slice(0, 2) || "CR"}
                  </div>
                )}
                <div className="flex-1">
                  <h3 className={`text-xl font-semibold mb-2 ${theme === "dark" ? "text-white" : "text-gray-900"}`}>
                    {creator?.name || organization.name}
                  </h3>
                  <div className={`flex flex-wrap items-center gap-6 text-sm mb-4 ${theme === "dark" ? "text-zinc-400" : "text-gray-600"}`}>
                    <div className="flex items-center gap-1">
                      <Star className="h-4 w-4" style={{ color: brandColor, fill: brandColor }} />
                      <span>4.9 Creator Rating</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <Users className="h-4 w-4" />
                      <span>25,000 Customers</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <Package className="h-4 w-4" />
                      <span>12 Products</span>
                    </div>
                  </div>
                  <p className={theme === "dark" ? "text-zinc-400" : "text-gray-600"}>
                    {creator?.name || organization.name} is a team of award-winning designers and developers creating world-class design systems and UI kits.
                    Our products are used by companies like Adobe, Shopify, and Microsoft.
                  </p>
                </div>
              </div>
            </div>

            {/* Customer Reviews */}
            {reviews && (
              <div className={`rounded-xl border p-6 ${theme === "dark" ? "bg-zinc-900 border-zinc-800" : "bg-white border-gray-200"}`}>
                <h2 className={`text-xl font-bold mb-6 ${theme === "dark" ? "text-white" : "text-gray-900"}`}>Customer Reviews</h2>
                <div className="space-y-6">
                  {reviews.map((review, idx) => (
                    <div key={review.id} className={`pb-6 ${idx !== reviews.length - 1 ? (theme === "dark" ? "border-b border-zinc-800" : "border-b border-gray-100") : ""}`}>
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-semibold" style={{ backgroundColor: `${brandColor}30`, color: theme === "dark" ? "white" : brandColor }}>
                            {review.initials}
                          </div>
                          <div>
                            <h4 className={`font-semibold ${theme === "dark" ? "text-white" : "text-gray-900"}`}>{review.name}</h4>
                            <p className={`text-sm ${theme === "dark" ? "text-zinc-500" : "text-gray-500"}`}>{review.role}</p>
                          </div>
                        </div>
                        <StarRating rating={review.rating} size="sm" brandColor={brandColor} />
                      </div>
                      <p className={`mb-2 ${theme === "dark" ? "text-zinc-400" : "text-gray-600"}`}>{review.comment}</p>
                      <div className={`flex items-center gap-4 text-sm ${theme === "dark" ? "text-zinc-500" : "text-gray-400"}`}>
                        <span>{review.date}</span>
                        <span>•</span>
                        <span>{review.helpfulCount} found this helpful</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* FAQ */}
            {faqs && (
              <div className={`rounded-xl border p-6 ${theme === "dark" ? "bg-zinc-900 border-zinc-800" : "bg-white border-gray-200"}`}>
                <h2 className={`text-xl font-bold mb-6 ${theme === "dark" ? "text-white" : "text-gray-900"}`}>Frequently Asked Questions</h2>
                <div className="space-y-6">
                  {faqs.map((faq, idx) => (
                    <div key={idx} className={`pb-6 ${idx !== faqs.length - 1 ? (theme === "dark" ? "border-b border-zinc-800" : "border-b border-gray-100") : ""}`}>
                      <h4 className={`font-semibold mb-2 ${theme === "dark" ? "text-white" : "text-gray-900"}`}>{faq.question}</h4>
                      <p className={theme === "dark" ? "text-zinc-400" : "text-gray-600"}>{faq.answer}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Sidebar */}
          <div className="lg:col-span-1 mt-8 lg:mt-0">
            <div className="lg:sticky lg:top-24">
              <div className={`rounded-xl border overflow-hidden shadow-lg ${theme === "dark" ? "bg-zinc-900 border-zinc-800" : "bg-white border-gray-200"}`}>
                <div className="p-6">
                  {/* Price */}
                  <div className="mb-4">
                    <div className="flex items-center gap-2 mb-1">
                      {sellingPrice > 0 && (
                        <span className={`line-through ${theme === "dark" ? "text-zinc-500" : "text-gray-400"}`}>
                          {formatCurrency(sellingPrice, product.currency)}
                        </span>
                      )}
                    </div>
                    <div className="text-4xl font-bold" style={{ color: "#10b981" }}>FREE</div>
                    <div className="flex items-center gap-2 mt-2">
                      <Lock className={`h-4 w-4 ${theme === "dark" ? "text-zinc-500" : "text-gray-400"}`} />
                      <span className={`text-sm ${theme === "dark" ? "text-zinc-400" : "text-gray-500"}`}>Included with membership</span>
                    </div>
                  </div>

                  {/* CTA */}
                  <Link href={`/checkout/product/${productId}${checkoutRef}`} target="_blank">
                    <Button className="w-full h-12 text-white font-semibold mb-4 cursor-pointer" style={{ backgroundColor: "#7c3aed" }}>
                      <Download className="h-5 w-5 mr-2" />
                      Get Access Now
                    </Button>
                  </Link>

                  <p className={`text-center text-sm mb-6 ${theme === "dark" ? "text-zinc-500" : "text-gray-500"}`}>
                    Instant download after purchase. 30-day money-back guarantee.
                  </p>

                  <div className={`border-t ${theme === "dark" ? "border-zinc-800" : "border-gray-200"} my-6`} />

                  {/* This product includes */}
                  {includedFeatures && (
                    <div className="mb-6">
                      <h4 className={`font-semibold mb-4 ${theme === "dark" ? "text-white" : "text-gray-900"}`}>This product includes:</h4>
                      <ul className="space-y-3">
                        {includedFeatures.map((item, i) => (
                          <li key={i} className="flex items-center gap-3">
                            <Check className="h-4 w-4" style={{ color: "#10b981" }} />
                            <span className={`text-sm ${theme === "dark" ? "text-zinc-400" : "text-gray-600"}`}>{item}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {/* Product Details */}
                  {productDetailTable && (
                    <>
                      <div className={`border-t ${theme === "dark" ? "border-zinc-800" : "border-gray-200"} my-6`} />
                      <div className="space-y-3 text-sm">
                        {productDetailTable.map((detail, i) => (
                          <div key={i} className="flex items-center justify-between">
                            <span className={theme === "dark" ? "text-zinc-500" : "text-gray-500"}>{detail.label}</span>
                            <span className={`font-medium ${theme === "dark" ? "text-white" : "text-gray-900"}`}>{detail.value}</span>
                          </div>
                        ))}
                      </div>
                    </>
                  )}

                  <div className={`border-t ${theme === "dark" ? "border-zinc-800" : "border-gray-200"} my-6`} />

                  {/* Trust Badges */}
                  <div className="flex items-center justify-around">
                    {[
                      { icon: Shield, label: "Secure Payment" },
                      { icon: Award, label: "Top Rated" },
                      { icon: RefreshCw, label: "Free Updates" },
                    ].map((badge, i) => (
                      <div key={i} className="flex flex-col items-center gap-1">
                        <badge.icon className={`h-5 w-5 ${theme === "dark" ? "text-zinc-500" : "text-gray-400"}`} />
                        <span className={`text-xs ${theme === "dark" ? "text-zinc-500" : "text-gray-500"}`}>{badge.label}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
