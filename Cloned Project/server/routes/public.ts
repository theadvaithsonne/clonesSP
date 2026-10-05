import { Router } from "express";
import { z } from "zod";
import { Organization } from "../models/organization.model";
import { User } from "../models/user.model";
import { requireClientKey } from "../middleware/clientKey";
import { TimeTracking } from "../models/timeTracking.model";
import { getCoordinatesFromAddress } from "../utils/geocoding";
import { Course } from "../models/course.model";
import { Channel } from "../models/channel.model";
import { CombPlan } from "../models/combPlan.model";
import { CourseEnrollment } from "../models/courseEnrollment.model";
import { Workshop } from "../models/workshop.model";
import { WorkshopRegistration } from "../models/workshopRegistration.model";
import { Product } from "../models/product.model";
import { ChannelMembership } from "../models/channelMembership.model";
import { Testimonial } from "../models/testimonial.model";
import { CallOffering } from "../models/callOffering.model";
import { CallPurchase } from "../models/callPurchase.model";
import { CallBooking } from "../models/callBooking.model";
import { Service } from "../models/service.model";
import { recordingStartedAt } from "../utils/recordingTime";
import {
  claimIntent,
  clientIp,
  hashIp,
  recordIntent,
  MATCH_WINDOW_MS,
  type Fingerprint,
} from "../services/installIntent";
import { InstallIntent } from "../models/installIntent.model";
import { classifyIdentifier } from "../services/identifier";
import { callerKey } from "../services/otpRateLimit";
import {
  allowInviteRequest,
  lookupPendingInvite,
  savePendingInvite,
} from "../services/pendingInvite";

const router = Router();

// Public GET endpoint to fetch all organizations with founders data
router.get("/hq-organizations", async (req, res) => {
  try {
    console.log("=== PUBLIC ORGANIZATIONS API ===");
    console.log("Fetching all organizations with founders data...");

    // Fetch all organizations
    const organizations = await Organization.find({}).lean();

    console.log(`Found ${organizations.length} organizations`);

    // For each organization, get the founders data
    const organizationsWithFounders = await Promise.all(
      organizations.map(async (org) => {
        try {
          // Find users who are founders of this organization
          const founders = await User.find({
            organizations: {
              $elemMatch: {
                organization: org._id,
                role: "founder",
              },
            },
          })
            .select({
              _id: 1,
              name: 1,
              email: 1,
              profilePicture: 1,
              country: 1,
              state: 1,
              city: 1,
              latitude: 1,
              longitude: 1,
              organizations: {
                $elemMatch: {
                  organization: org._id,
                  role: "founder",
                },
              },
            })
            .lean();

          // Count stakeholders (role: stakeholder, guest: false or undefined)
          const stakeholdersCount = await User.countDocuments({
            organizations: {
              $elemMatch: {
                organization: org._id,
                role: "stakeholder",
                $or: [{ guest: false }, { guest: { $exists: false } }],
              },
            },
          });

          // Count community members (guest: true for this org)
          const communityMembersCount = await User.countDocuments({
            organizations: {
              $elemMatch: {
                organization: org._id,
                guest: true,
              },
            },
          });

          console.log(`Found ${founders.length} founders for org: ${org.name}`);

          // Transform founders data to include only necessary fields
          const foundersData = founders.map((founder) => ({
            _id: founder._id,
            name: founder.name,
            email: founder.email,
            profilePicture: founder.profilePicture,
            country: founder.country?.trim(),
            state: founder.state?.trim(),
            city: founder.city?.trim(),
            latitude: founder.latitude,
            longitude: founder.longitude,
            joinedAt: founder.organizations?.[0]?.joinedAt,
          }));

          return {
            _id: org._id,
            name: org.name,
            slug: org.slug,
            size: org.size,
            location: org.location,
            city: org.city?.trim(),
            state: org.state?.trim(),
            country: org.country?.trim(),
            latitude: org.latitude,
            longitude: org.longitude,
            description: org.description,
            headingText: org.headingText,
            subHeadingText: org.subHeadingText,
            icon: org.icon,
            coverPhoto: org.coverPhoto,
            promoVideoLink: org.promoVideoLink,
            colored_logo: org.colored_logo,
            white_logo: org.white_logo,
            colored_icon: org.colored_icon,
            white_icon: org.white_icon,
            website_meta_title: org.website_meta_title,
            website_meta_description: org.website_meta_description,
            office_public: org.office_public,
            category: org.category,
            branding: org.branding,
            founders: foundersData,
            stakeholders: stakeholdersCount,
            communityMembers: communityMembersCount,
            products: 0,
            connections: 0,
            createdAt: org.createdAt,
            updatedAt: org.updatedAt,
          };
        } catch (error) {
          console.error(`Error fetching founders for org ${org._id}:`, error);
          return {
            _id: org._id,
            name: org.name,
            slug: org.slug,
            size: org.size,
            location: org.location,
            city: org.city?.trim(),
            state: org.state?.trim(),
            country: org.country?.trim(),
            latitude: org.latitude,
            longitude: org.longitude,
            description: org.description,
            headingText: org.headingText,
            subHeadingText: org.subHeadingText,
            icon: org.icon,
            coverPhoto: org.coverPhoto,
            promoVideoLink: org.promoVideoLink,
            colored_logo: org.colored_logo,
            white_logo: org.white_logo,
            colored_icon: org.colored_icon,
            white_icon: org.white_icon,
            website_meta_title: org.website_meta_title,
            website_meta_description: org.website_meta_description,
            office_public: org.office_public,
            category: org.category,
            branding: org.branding,
            founders: [],
            stakeholders: 0,
            communityMembers: 0,
            products: 0,
            connections: 0,
            createdAt: org.createdAt,
            updatedAt: org.updatedAt,
          };
        }
      })
    );

    console.log("=== END PUBLIC ORGANIZATIONS API ===");

    res.json({
      success: true,
      count: organizationsWithFounders.length,
      organizations: organizationsWithFounders,
    });
  } catch (error) {
    console.error("Error in public organizations API:", error);
    res.status(500).json({
      success: false,
      error: "Failed to fetch organizations",
      message: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

// Public GET endpoint to fetch a single organization by ID with founders data
router.get("/hq-organizations/:orgId", async (req, res) => {
  try {
    const { orgId } = req.params;

    console.log("=== PUBLIC SINGLE ORGANIZATION API ===");
    console.log(`Fetching organization: ${orgId}`);

    // Fetch the organization
    const organization = await Organization.findById(orgId).lean();

    if (!organization) {
      return res.status(404).json({
        success: false,
        error: "Organization not found",
      });
    }

    // Find founders of this organization
    const founders = await User.find({
      organizations: {
        $elemMatch: {
          organization: orgId,
          role: "founder",
        },
      },
    })
      .select({
        _id: 1,
        name: 1,
        email: 1,
        profilePicture: 1,
        country: 1,
        state: 1,
        city: 1,
        latitude: 1,
        longitude: 1,
        organizations: {
          $elemMatch: {
            organization: orgId,
            role: "founder",
          },
        },
      })
      .lean();

    console.log(
      `Found ${founders.length} founders for org: ${organization.name}`
    );

    // Transform founders data
    const foundersData = founders.map((founder) => ({
      _id: founder._id,
      name: founder.name,
      email: founder.email,
      profilePicture: founder.profilePicture,
      country: founder.country?.trim(),
      state: founder.state?.trim(),
      city: founder.city?.trim(),
      latitude: founder.latitude,
      longitude: founder.longitude,
      joinedAt: founder.organizations?.[0]?.joinedAt,
    }));

    const organizationWithFounders = {
      _id: organization._id,
      name: organization.name,
      slug: organization.slug,
      size: organization.size,
      location: organization.location,
      city: organization.city?.trim(),
      state: organization.state?.trim(),
      country: organization.country?.trim(),
      latitude: organization.latitude,
      longitude: organization.longitude,
      description: organization.description,
      headingText: organization.headingText,
      subHeadingText: organization.subHeadingText,
      icon: organization.icon,
      coverPhoto: organization.coverPhoto,
      promoVideoLink: organization.promoVideoLink,
      colored_logo: organization.colored_logo,
      white_logo: organization.white_logo,
      colored_icon: organization.colored_icon,
      white_icon: organization.white_icon,
      website_meta_title: organization.website_meta_title,
      website_meta_description: organization.website_meta_description,
      office_public: organization.office_public,
      category: organization.category,
      branding: organization.branding,
      founders: foundersData,
      createdAt: organization.createdAt,
      updatedAt: organization.updatedAt,
    };

    console.log("=== END PUBLIC SINGLE ORGANIZATION API ===");

    res.json({
      success: true,
      organization: organizationWithFounders,
    });
  } catch (error) {
    console.error("Error in public single organization API:", error);
    res.status(500).json({
      success: false,
      error: "Failed to fetch organization",
      message: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

// Public GET endpoint to fetch all founders across all organizations
router.get("/all-founders", async (req, res) => {
  try {
    console.log("=== PUBLIC ALL FOUNDERS API ===");
    console.log("Fetching all founders across all organizations...");

    // Find all users who are founders in any organization
    // Need full organizations array to get both founded and joined orgs
    const founders = await User.find({
      "organizations.role": "founder",
    })
      .select({
        _id: 1,
        name: 1,
        email: 1,
        profilePicture: 1,
        country: 1,
        state: 1,
        city: 1,
        latitude: 1,
        longitude: 1,
        organizations: 1,
      })
      .lean();

    console.log(`Found ${founders.length} founders across all organizations`);

    // Transform founders data to include organization details
    const foundersWithOrgs = await Promise.all(
      founders.map(async (founder) => {
        const officesFounded = [];
        const officesJoined = [];

        for (const orgRef of founder.organizations || []) {
          try {
            const org = await Organization.findById(orgRef.organization)
              .select({
                _id: 1,
                name: 1,
                size: 1,
                location: 1,
                city: 1,
                state: 1,
                country: 1,
                description: 1,
                icon: 1,
              })
              .lean();

            if (org) {
              const orgData = {
                organization: org,
                joinedAt: orgRef.joinedAt,
              };

              if (orgRef.role === "founder") {
                officesFounded.push(orgData);
              } else if (orgRef.role === "stakeholder") {
                officesJoined.push(orgData);
              }
            }
          } catch (error) {
            console.error(
              `Error fetching org ${orgRef.organization} for founder ${founder._id}:`,
              error
            );
          }
        }

        return {
          _id: founder._id,
          name: founder.name,
          email: founder.email,
          profilePicture: founder.profilePicture,
          country: founder.country?.trim(),
          state: founder.state?.trim(),
          city: founder.city?.trim(),
          latitude: founder.latitude,
          longitude: founder.longitude,
          offices_founded: officesFounded,
          offices_joined: officesJoined,
        };
      })
    );

    console.log("=== END PUBLIC ALL FOUNDERS API ===");

    res.json({
      success: true,
      count: foundersWithOrgs.length,
      founders: foundersWithOrgs,
    });
  } catch (error) {
    console.error("Error in public all founders API:", error);
    res.status(500).json({
      success: false,
      error: "Failed to fetch founders",
      message: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

// Public GET endpoint to fetch all stakeholders across all organizations
router.get("/all-stakeholders", async (req, res) => {
  try {
    console.log("=== PUBLIC ALL STAKEHOLDERS API ===");
    console.log("Fetching all stakeholders across all organizations...");

    // Find all users who are stakeholders in any organization
    const stakeholders = await User.find({
      "organizations.role": "stakeholder",
    })
      .select({
        _id: 1,
        name: 1,
        email: 1,
        profilePicture: 1,
        country: 1,
        state: 1,
        city: 1,
        latitude: 1,
        longitude: 1,
        organizations: 1,
      })
      .lean();

    console.log(
      `Found ${stakeholders.length} stakeholders across all organizations`
    );

    // Transform stakeholders data to include organization details
    const stakeholdersWithOrgs = await Promise.all(
      stakeholders.map(async (stakeholder) => {
        const officesJoined = [];

        for (const orgRef of stakeholder.organizations || []) {
          if (orgRef.role === "stakeholder") {
            try {
              const org = await Organization.findById(orgRef.organization)
                .select({
                  _id: 1,
                  name: 1,
                  size: 1,
                  location: 1,
                  city: 1,
                  state: 1,
                  country: 1,
                  description: 1,
                  icon: 1,
                })
                .lean();

              if (org) {
                officesJoined.push({
                  organization: org,
                  joinedAt: orgRef.joinedAt,
                });
              }
            } catch (error) {
              console.error(
                `Error fetching org ${orgRef.organization} for stakeholder ${stakeholder._id}:`,
                error
              );
            }
          }
        }

        return {
          _id: stakeholder._id,
          name: stakeholder.name,
          email: stakeholder.email,
          profilePicture: stakeholder.profilePicture,
          country: stakeholder.country?.trim(),
          state: stakeholder.state?.trim(),
          city: stakeholder.city?.trim(),
          latitude: stakeholder.latitude,
          longitude: stakeholder.longitude,
          offices_joined: officesJoined,
        };
      })
    );

    console.log("=== END PUBLIC ALL STAKEHOLDERS API ===");

    res.json({
      success: true,
      count: stakeholdersWithOrgs.length,
      stakeholders: stakeholdersWithOrgs,
    });
  } catch (error) {
    console.error("Error in public all stakeholders API:", error);
    res.status(500).json({
      success: false,
      error: "Failed to fetch stakeholders",
      message: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

// Public GET endpoint to fetch all affiliates & customers (users with guest: true)
router.get("/all-affiliates-customers", async (req, res) => {
  try {
    console.log("=== PUBLIC ALL AFFILIATES & CUSTOMERS API ===");
    console.log("Fetching all users with guest: true...");

    // Find all users who have guest: true in any organization membership
    const affiliatesCustomers = await User.find({
      "organizations.guest": true,
    })
      .select({
        _id: 1,
        name: 1,
        email: 1,
        profilePicture: 1,
        country: 1,
        state: 1,
        city: 1,
        latitude: 1,
        longitude: 1,
        organizations: 1,
      })
      .lean();

    console.log(
      `Found ${affiliatesCustomers.length} affiliates & customers across all organizations`
    );

    // Transform data to include organization details for guest memberships
    const affiliatesWithOrgs = await Promise.all(
      affiliatesCustomers.map(async (user) => {
        const guestOrgs = [];

        for (const orgRef of user.organizations || []) {
          if (orgRef.guest === true) {
            try {
              const org = await Organization.findById(orgRef.organization)
                .select({
                  _id: 1,
                  name: 1,
                  city: 1,
                  state: 1,
                  country: 1,
                  icon: 1,
                })
                .lean();

              if (org) {
                guestOrgs.push({
                  organization: org,
                  role: orgRef.role,
                  joinedAt: orgRef.joinedAt,
                });
              }
            } catch (error) {
              console.error(
                `Error fetching org ${orgRef.organization} for user ${user._id}:`,
                error
              );
            }
          }
        }

        return {
          _id: user._id,
          name: user.name,
          email: user.email,
          profilePicture: user.profilePicture,
          country: user.country?.trim(),
          state: user.state?.trim(),
          city: user.city?.trim(),
          latitude: user.latitude,
          longitude: user.longitude,
          organizations: guestOrgs,
        };
      })
    );

    console.log("=== END PUBLIC ALL AFFILIATES & CUSTOMERS API ===");

    res.json({
      success: true,
      count: affiliatesWithOrgs.length,
      affiliatesCustomers: affiliatesWithOrgs,
    });
  } catch (error) {
    console.error("Error in public all affiliates & customers API:", error);
    res.status(500).json({
      success: false,
      error: "Failed to fetch affiliates & customers",
      message: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

// Public GET endpoint to fetch total hours monitored
router.get("/total-hours-monitored", async (req, res) => {
  try {
    console.log("=== PUBLIC TOTAL HOURS MONITORED API ===");

    // Aggregate total duration from all time tracking records
    const result = await TimeTracking.aggregate([
      {
        $group: {
          _id: null,
          totalSeconds: { $sum: "$durationInSeconds" },
          totalRecords: { $sum: 1 },
        },
      },
    ]);

    const totalSeconds = result[0]?.totalSeconds || 0;
    const totalHours = totalSeconds / 3600;

    console.log(`Total hours monitored: ${totalHours.toFixed(2)} hrs`);
    console.log("=== END PUBLIC TOTAL HOURS MONITORED API ===");

    res.json({
      success: true,
      totalSeconds,
      totalHours: parseFloat(totalHours.toFixed(2)),
      totalRecords: result[0]?.totalRecords || 0,
    });
  } catch (error) {
    console.error("Error in public total hours monitored API:", error);
    res.status(500).json({
      success: false,
      error: "Failed to fetch total hours monitored",
      message: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

// Public GET endpoint to fetch unique cities count
router.get("/cities-count", async (req, res) => {
  try {
    console.log("=== PUBLIC CITIES COUNT API ===");

    // Get unique cities from organizations
    const orgCities = await Organization.distinct("city", {
      city: { $nin: [null, ""] },
    });

    // Get unique cities from users (founders and stakeholders)
    const userCities = await User.distinct("city", {
      city: { $nin: [null, ""] },
    });

    // Combine and deduplicate cities (case-insensitive)
    const allCitiesLower = new Set<string>();
    const uniqueCities: string[] = [];

    [...orgCities, ...userCities].forEach((city) => {
      if (city && typeof city === "string") {
        const cityLower = city.trim().toLowerCase();
        if (!allCitiesLower.has(cityLower)) {
          allCitiesLower.add(cityLower);
          uniqueCities.push(city.trim());
        }
      }
    });

    console.log(`Found ${uniqueCities.length} unique cities`);
    console.log("=== END PUBLIC CITIES COUNT API ===");

    res.json({
      success: true,
      count: uniqueCities.length,
      cities: uniqueCities.sort(),
    });
  } catch (error) {
    console.error("Error in public cities count API:", error);
    res.status(500).json({
      success: false,
      error: "Failed to fetch cities count",
      message: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

// Public GET endpoint to fetch all tracker stats in one call
router.get("/tracker-stats", async (req, res) => {
  try {
    console.log("=== PUBLIC TRACKER STATS API ===");

    // Run all queries in parallel for better performance
    const [
      orgCount,
      foundersCount,
      stakeholdersCount,
      affiliatesCustomersCount,
      totalUsersCount,
      hoursResult,
      orgCities,
      userCities,
      orgCountries,
      affiliateCountries,
    ] = await Promise.all([
      // Organizations count
      Organization.countDocuments({}),

      // Founders count
      User.countDocuments({ "organizations.role": "founder" }),

      // Stakeholders count
      User.countDocuments({ "organizations.role": "stakeholder" }),

      // Affiliates & Customers count (guest: true)
      User.countDocuments({ "organizations.guest": true }),

      // Total users count (all users)
      User.countDocuments({}),

      // Total hours monitored
      TimeTracking.aggregate([
        {
          $group: {
            _id: null,
            totalSeconds: { $sum: "$durationInSeconds" },
          },
        },
      ]),

      // Unique cities from organizations
      Organization.distinct("city", { city: { $nin: [null, ""] } }),

      // Unique cities from users
      User.distinct("city", { city: { $nin: [null, ""] } }),

      // Unique countries from organizations only
      Organization.distinct("country", { country: { $nin: [null, ""] } }),

      // Unique countries from affiliate users (guest: true)
      User.distinct("country", {
        "organizations.guest": true,
        country: { $nin: [null, ""] },
      }),
    ]);

    // Calculate unique cities
    const allCitiesLower = new Set<string>();
    [...orgCities, ...userCities].forEach((city) => {
      if (city && typeof city === "string") {
        const trimmed = city.trim().toLowerCase();
        if (trimmed) {
          allCitiesLower.add(trimmed);
        }
      }
    });

    // Calculate unique countries (from organizations only, deduplicate by trimming and lowercasing)
    const allCountriesLower = new Set<string>();
    orgCountries.forEach((country) => {
      if (country && typeof country === "string") {
        const trimmed = country.trim().toLowerCase();
        if (trimmed) {
          allCountriesLower.add(trimmed);
        }
      }
    });

    // Calculate unique countries from affiliates (deduplicate by trimming and lowercasing)
    const affiliateCountriesLower = new Set<string>();
    affiliateCountries.forEach((country) => {
      if (country && typeof country === "string") {
        const trimmed = country.trim().toLowerCase();
        if (trimmed) {
          affiliateCountriesLower.add(trimmed);
        }
      }
    });

    const totalSeconds = hoursResult[0]?.totalSeconds || 0;
    const totalHours = totalSeconds / 3600;

    console.log("=== END PUBLIC TRACKER STATS API ===");

    res.json({
      success: true,
      stats: {
        offices: orgCount,
        founders: foundersCount,
        stakeholders: stakeholdersCount,
        affiliatesCustomers: affiliatesCustomersCount,
        totalUsers: totalUsersCount,
        cities: allCitiesLower.size,
        countries: allCountriesLower.size,
        affiliateCountries: affiliateCountriesLower.size,
        totalHoursMonitored: parseFloat(totalHours.toFixed(2)),
      },
    });
  } catch (error) {
    console.error("Error in public tracker stats API:", error);
    res.status(500).json({
      success: false,
      error: "Failed to fetch tracker stats",
      message: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

// Public GET endpoint to fetch a single course by ID with all related info
router.get("/courses/:courseId", async (req, res) => {
  try {
    const { courseId } = req.params;

    console.log("=== PUBLIC COURSE DETAILS API ===");
    console.log(`Fetching course: ${courseId}`);

    // Fetch the course
    const course = await Course.findById(courseId).lean();

    if (!course) {
      return res.status(404).json({
        success: false,
        error: "Course not found",
      });
    }

    // Fetch all related data in parallel
    const [organization, creator, channels, combPlan, enrollmentCount] =
      await Promise.all([
        // Get organization details
        Organization.findById(course.organizationId)
          .select({
            _id: 1,
            name: 1,
            size: 1,
            location: 1,
            city: 1,
            state: 1,
            country: 1,
            latitude: 1,
            longitude: 1,
            description: 1,
            headingText: 1,
            subHeadingText: 1,
            icon: 1,
            coverPhoto: 1,
          })
          .lean(),

        // Get creator (founder) details
        User.findById(course.createdBy)
          .select({
            _id: 1,
            name: 1,
            email: 1,
            profilePicture: 1,
            country: 1,
            state: 1,
            city: 1,
          })
          .lean(),

        // Get associated channels
        course.channelIds && course.channelIds.length > 0
          ? Channel.find({ _id: { $in: course.channelIds } })
              .select({
                _id: 1,
                title: 1,
                description: 1,
                price: 1,
                currency: 1,
                coverImage: 1,
                isFree: 1,
                isSubscription: 1,
                subscriptionPeriod: 1,
                isActive: 1,
              })
              .lean()
          : [],

        // Get comb plan for this course
        CombPlan.findOne({
          itemType: "course",
          itemId: courseId,
          isActive: true,
        })
          .select({
            _id: 1,
            name: 1,
            description: 1,
            levels: 1,
            totalPercentage: 1,
            platformPercentage: 1,
          })
          .lean(),

        // Get enrollment count
        CourseEnrollment.countDocuments({ courseId }),
      ]);

    // Get founders of the organization
    let founders: any[] = [];
    if (organization) {
      founders = await User.find({
        organizations: {
          $elemMatch: {
            organization: organization._id,
            role: "founder",
          },
        },
      })
        .select({
          _id: 1,
          name: 1,
          email: 1,
          profilePicture: 1,
          country: 1,
          state: 1,
          city: 1,
        })
        .lean();
    }

    // Build the comprehensive response
    const courseDetails = {
      // Course basic info
      _id: course._id,
      title: course.title,
      description: course.description,
      coverImage: course.coverImage,
      status: course.status,

      // Pricing
      isPaid: course.isPaid,
      isFree: course.isFree,
      price: course.price,
      currency: course.currency,

      // Subscription settings
      isSubscription: course.isSubscription,
      subscriptionPeriod: course.subscriptionPeriod,

      // Content structure
      sections: course.sections,
      digitalAssets: course.digitalAssets,

      // Stats
      totalDuration: course.totalDuration,
      totalChapters: course.totalChapters,
      enrolledStudents: enrollmentCount,

      // Detail page fields
      rating: course.rating,
      ratingCount: course.ratingCount,
      whatYouWillLearn: course.whatYouWillLearn,
      requirements: course.requirements,
      courseIncludes: course.courseIncludes,
      reviews: course.reviews,

      // Creator info
      creator: creator
        ? {
            _id: creator._id,
            name: creator.name,
            email: creator.email,
            profilePicture: creator.profilePicture,
            country: creator.country?.trim(),
            state: creator.state,
            city: creator.city?.trim(),
          }
        : null,

      // Organization (Office) info
      organization: organization
        ? {
            _id: organization._id,
            name: organization.name,
            size: organization.size,
            location: organization.location,
            city: organization.city?.trim(),
            state: organization.state,
            country: organization.country?.trim(),
            latitude: organization.latitude,
            longitude: organization.longitude,
            description: organization.description,
            headingText: organization.headingText,
            subHeadingText: organization.subHeadingText,
            icon: organization.icon,
            coverPhoto: organization.coverPhoto,
            founders: founders.map((f) => ({
              _id: f._id,
              name: f.name,
              email: f.email,
              profilePicture: f.profilePicture,
              country: f.country?.trim(),
              state: f.state,
              city: f.city?.trim(),
            })),
          }
        : null,

      // Associated channels
      channels: channels,

      // Commission plan
      combPlan: combPlan
        ? {
            _id: combPlan._id,
            name: combPlan.name,
            description: combPlan.description,
            levels: combPlan.levels,
            totalPercentage: combPlan.totalPercentage,
            platformPercentage: combPlan.platformPercentage,
          }
        : null,

      // Timestamps
      createdAt: course.createdAt,
      updatedAt: course.updatedAt,
    };

    console.log(`Course found: ${course.title}`);
    console.log(`Organization: ${organization?.name || "N/A"}`);
    console.log(`Channels: ${channels.length}`);
    console.log(`CombPlan: ${combPlan ? combPlan.name : "None"}`);
    console.log("=== END PUBLIC COURSE DETAILS API ===");

    res.json({
      success: true,
      course: courseDetails,
    });
  } catch (error) {
    console.error("Error in public course details API:", error);
    res.status(500).json({
      success: false,
      error: "Failed to fetch course details",
      message: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

// Public GET endpoint to fetch a single workshop by ID with all related info
router.get("/workshops/:workshopId", async (req, res) => {
  try {
    const { workshopId } = req.params;

    console.log("=== PUBLIC WORKSHOP DETAILS API ===");
    console.log(`Fetching workshop: ${workshopId}`);

    // Fetch the workshop
    const workshop = await Workshop.findById(workshopId).lean();

    if (!workshop) {
      return res.status(404).json({
        success: false,
        error: "Workshop not found",
      });
    }

    // Fetch all related data in parallel
    const [organization, creator, channels, combPlan, registrationCount] =
      await Promise.all([
        // Get organization details
        Organization.findById(workshop.orgId)
          .select({
            _id: 1,
            name: 1,
            size: 1,
            location: 1,
            city: 1,
            state: 1,
            country: 1,
            latitude: 1,
            longitude: 1,
            description: 1,
            headingText: 1,
            subHeadingText: 1,
            icon: 1,
            coverPhoto: 1,
          })
          .lean(),

        // Get creator (founder) details
        User.findById(workshop.createdBy)
          .select({
            _id: 1,
            name: 1,
            email: 1,
            profilePicture: 1,
            country: 1,
            state: 1,
            city: 1,
          })
          .lean(),

        // Get associated channels
        workshop.channelIds && workshop.channelIds.length > 0
          ? Channel.find({ _id: { $in: workshop.channelIds } })
              .select({
                _id: 1,
                title: 1,
                description: 1,
                price: 1,
                currency: 1,
                coverImage: 1,
                isFree: 1,
                isSubscription: 1,
                subscriptionPeriod: 1,
                isActive: 1,
              })
              .lean()
          : [],

        // Get comb plan for this workshop
        CombPlan.findOne({
          itemType: "workshop",
          itemId: workshopId,
          isActive: true,
        })
          .select({
            _id: 1,
            name: 1,
            description: 1,
            levels: 1,
            totalPercentage: 1,
            platformPercentage: 1,
          })
          .lean(),

        // Get registration count
        WorkshopRegistration.countDocuments({
          workshopId,
          status: { $ne: "cancelled" },
        }),
      ]);

    // Get founders of the organization
    let founders: any[] = [];
    if (organization) {
      founders = await User.find({
        organizations: {
          $elemMatch: {
            organization: organization._id,
            role: "founder",
          },
        },
      })
        .select({
          _id: 1,
          name: 1,
          email: 1,
          profilePicture: 1,
          country: 1,
          state: 1,
          city: 1,
        })
        .lean();
    }

    // Build the comprehensive response
    const workshopDetails = {
      // Workshop basic info
      _id: workshop._id,
      title: workshop.title,
      description: workshop.description,
      thumbnail: workshop.thumbnail,
      isActive: workshop.isActive,

      // Schedule
      date: workshop.date,
      startTime: workshop.startTime,
      endTime: workshop.endTime,
      timezone: workshop.timezone,

      // Meeting info (public - no password)
      meetingUrl: workshop.meetingUrl,
      meetingId: workshop.meetingId,
      maxParticipants: workshop.maxParticipants,

      // Pricing
      isFree: workshop.isFree,
      price: workshop.price,
      currency: workshop.currency,

      // Subscription settings
      isSubscription: workshop.isSubscription,
      subscriptionPeriod: workshop.subscriptionPeriod,

      // Recurrence
      isRecurring: workshop.isRecurring,
      recurrencePattern: workshop.recurrencePattern,
      recurrenceStartDate: workshop.recurrenceStartDate,
      isRecurrenceActive: workshop.isRecurrenceActive,
      enrollmentType: workshop.enrollmentType,

      // Workshop detail page fields
      rating: workshop.rating,
      ratingCount: workshop.ratingCount,
      aboutText: workshop.aboutText,
      learningPoints: workshop.learningPoints,
      agenda: workshop.agenda,
      bonuses: workshop.bonuses,
      reviews: workshop.reviews,
      faqs: workshop.faqs,
      requirements: workshop.requirements,
      whatsIncluded: workshop.whatsIncluded,
      hostRating: workshop.hostRating,
      hostStudents: workshop.hostStudents,
      hostWebinars: workshop.hostWebinars,
      hostExperience: workshop.hostExperience,

      // Stats
      registeredParticipants: registrationCount,

      // Creator info
      creator: creator
        ? {
            _id: creator._id,
            name: creator.name,
            email: creator.email,
            profilePicture: creator.profilePicture,
            country: creator.country?.trim(),
            state: creator.state,
            city: creator.city?.trim(),
          }
        : null,

      // Organization (Office) info
      organization: organization
        ? {
            _id: organization._id,
            name: organization.name,
            size: organization.size,
            location: organization.location,
            city: organization.city?.trim(),
            state: organization.state,
            country: organization.country?.trim(),
            latitude: organization.latitude,
            longitude: organization.longitude,
            description: organization.description,
            headingText: organization.headingText,
            subHeadingText: organization.subHeadingText,
            icon: organization.icon,
            coverPhoto: organization.coverPhoto,
            founders: founders.map((f) => ({
              _id: f._id,
              name: f.name,
              email: f.email,
              profilePicture: f.profilePicture,
              country: f.country?.trim(),
              state: f.state,
              city: f.city?.trim(),
            })),
          }
        : null,

      // Associated channels
      channels: channels,

      // Commission plan
      combPlan: combPlan
        ? {
            _id: combPlan._id,
            name: combPlan.name,
            description: combPlan.description,
            levels: combPlan.levels,
            totalPercentage: combPlan.totalPercentage,
            platformPercentage: combPlan.platformPercentage,
          }
        : null,

      // Timestamps
      createdAt: workshop.createdAt,
      updatedAt: workshop.updatedAt,
    };

    console.log(`Workshop found: ${workshop.title}`);
    console.log(`Organization: ${organization?.name || "N/A"}`);
    console.log(`Channels: ${channels.length}`);
    console.log(`CombPlan: ${combPlan ? combPlan.name : "None"}`);
    console.log("=== END PUBLIC WORKSHOP DETAILS API ===");

    res.json({
      success: true,
      workshop: workshopDetails,
    });
  } catch (error) {
    console.error("Error in public workshop details API:", error);
    res.status(500).json({
      success: false,
      error: "Failed to fetch workshop details",
      message: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

// Public GET endpoint to fetch a single product by ID with all related info
router.get("/products/:productId", async (req, res) => {
  try {
    const { productId } = req.params;

    console.log("=== PUBLIC PRODUCT DETAILS API ===");
    console.log(`Fetching product: ${productId}`);

    // Fetch the product
    const product = await Product.findById(productId).lean();

    if (!product) {
      return res.status(404).json({
        success: false,
        error: "Product not found",
      });
    }

    // Fetch all related data in parallel
    const [organization, creator, channels, combPlan] = await Promise.all([
      // Get organization details
      Organization.findById(product.organizationId)
        .select({
          _id: 1,
          name: 1,
          size: 1,
          location: 1,
          city: 1,
          state: 1,
          country: 1,
          latitude: 1,
          longitude: 1,
          description: 1,
          headingText: 1,
          subHeadingText: 1,
          icon: 1,
          coverPhoto: 1,
        })
        .lean(),

      // Get creator (founder) details
      User.findById(product.createdBy)
        .select({
          _id: 1,
          name: 1,
          email: 1,
          profilePicture: 1,
          country: 1,
          state: 1,
          city: 1,
        })
        .lean(),

      // Get associated channels
      product.channelIds && product.channelIds.length > 0
        ? Channel.find({ _id: { $in: product.channelIds } })
            .select({
              _id: 1,
              title: 1,
              description: 1,
              price: 1,
              currency: 1,
              coverImage: 1,
              isFree: 1,
              isSubscription: 1,
              subscriptionPeriod: 1,
              isActive: 1,
            })
            .lean()
        : [],

      // Get comb plan for this product
      CombPlan.findOne({
        itemType: "product",
        itemId: productId,
        isActive: true,
      })
        .select({
          _id: 1,
          name: 1,
          description: 1,
          levels: 1,
          totalPercentage: 1,
          platformPercentage: 1,
        })
        .lean(),
    ]);

    // Get founders of the organization
    let founders: any[] = [];
    if (organization) {
      founders = await User.find({
        organizations: {
          $elemMatch: {
            organization: organization._id,
            role: "founder",
          },
        },
      })
        .select({
          _id: 1,
          name: 1,
          email: 1,
          profilePicture: 1,
          country: 1,
          state: 1,
          city: 1,
        })
        .lean();
    }

    // Build the comprehensive response
    const productDetails = {
      // Product basic info
      _id: product._id,
      name: product.name,
      slug: product.slug,
      description: product.description,
      sku: product.sku,
      status: product.status,

      // Pricing
      price: product.price,
      currency: product.currency,

      // Subscription settings
      isSubscription: product.isSubscription,
      subscriptionPeriod: product.subscriptionPeriod,

      // Inventory
      trackQuantity: product.trackQuantity,
      quantity: product.quantity,
      lowStockThreshold: product.lowStockThreshold,

      // Media & categorization
      images: product.images,
      categoryName: product.categoryName,
      tags: product.tags,

      // Delivery
      isDigital: product.isDigital,
      requiresShipping: product.requiresShipping,
      deliveryMethod: product.deliveryMethod,
      digitalAssets: product.digitalAssets,
      // Return link metadata (labels & type) without exposing actual URLs
      digitalLinks: product.digitalLinks?.map((link) => ({
        _id: link._id,
        label: link.label,
        description: link.description,
        linkType: link.linkType || "static",
      })),

      // Product detail page enrichment
      rating: product.rating,
      ratingCount: product.ratingCount,
      downloadCount: product.downloadCount,
      whatsIncluded: product.whatsIncluded,
      keyFeatures: product.keyFeatures,
      whatsInside: product.whatsInside,
      reviews: product.reviews,
      faqs: product.faqs,
      productDetailTable: product.productDetails,

      // Creator info
      creator: creator
        ? {
            _id: creator._id,
            name: creator.name,
            email: creator.email,
            profilePicture: creator.profilePicture,
            country: creator.country?.trim(),
            state: creator.state,
            city: creator.city?.trim(),
          }
        : null,

      // Organization (Office) info
      organization: organization
        ? {
            _id: organization._id,
            name: organization.name,
            size: organization.size,
            location: organization.location,
            city: organization.city?.trim(),
            state: organization.state,
            country: organization.country?.trim(),
            latitude: organization.latitude,
            longitude: organization.longitude,
            description: organization.description,
            headingText: organization.headingText,
            subHeadingText: organization.subHeadingText,
            icon: organization.icon,
            coverPhoto: organization.coverPhoto,
            founders: founders.map((f) => ({
              _id: f._id,
              name: f.name,
              email: f.email,
              profilePicture: f.profilePicture,
              country: f.country?.trim(),
              state: f.state,
              city: f.city?.trim(),
            })),
          }
        : null,

      // Associated channels
      channels: channels,

      // Commission plan
      combPlan: combPlan
        ? {
            _id: combPlan._id,
            name: combPlan.name,
            description: combPlan.description,
            levels: combPlan.levels,
            totalPercentage: combPlan.totalPercentage,
            platformPercentage: combPlan.platformPercentage,
          }
        : null,

      // Timestamps
      createdAt: product.createdAt,
      updatedAt: product.updatedAt,
    };

    console.log(`Product found: ${product.name}`);
    console.log(`Organization: ${organization?.name || "N/A"}`);
    console.log(`Channels: ${channels.length}`);
    console.log(`CombPlan: ${combPlan ? combPlan.name : "None"}`);
    console.log("=== END PUBLIC PRODUCT DETAILS API ===");

    res.json({
      success: true,
      product: productDetails,
    });
  } catch (error) {
    console.error("Error in public product details API:", error);
    res.status(500).json({
      success: false,
      error: "Failed to fetch product details",
      message: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

// Public GET endpoint to fetch a single channel by ID with all related info
router.get("/channels/:channelId", async (req, res) => {
  try {
    const { channelId } = req.params;

    console.log("=== PUBLIC CHANNEL DETAILS API ===");
    console.log(`Fetching channel: ${channelId}`);

    // Fetch the channel
    const channel = await Channel.findById(channelId).lean();

    if (!channel) {
      return res.status(404).json({
        success: false,
        error: "Channel not found",
      });
    }

    // Fetch all related data in parallel
    const [organization, creator, combPlan, memberCount] = await Promise.all([
      // Get organization details
      Organization.findById(channel.storeId)
        .select({
          _id: 1,
          name: 1,
          size: 1,
          location: 1,
          city: 1,
          state: 1,
          country: 1,
          latitude: 1,
          longitude: 1,
          description: 1,
          headingText: 1,
          subHeadingText: 1,
          icon: 1,
          coverPhoto: 1,
        })
        .lean(),

      // Get creator (founder) details
      User.findById(channel.createdBy)
        .select({
          _id: 1,
          name: 1,
          email: 1,
          profilePicture: 1,
          country: 1,
          state: 1,
          city: 1,
        })
        .lean(),

      // Get comb plan for this channel
      CombPlan.findOne({
        itemType: "channel",
        itemId: channelId,
        isActive: true,
      })
        .select({
          _id: 1,
          name: 1,
          description: 1,
          levels: 1,
          totalPercentage: 1,
          platformPercentage: 1,
        })
        .lean(),

      // Get member count
      ChannelMembership.countDocuments({
        channelId,
        status: "active",
      }),
    ]);

    // Get founders of the organization
    let founders: any[] = [];
    if (organization) {
      founders = await User.find({
        organizations: {
          $elemMatch: {
            organization: organization._id,
            role: "founder",
          },
        },
      })
        .select({
          _id: 1,
          name: 1,
          email: 1,
          profilePicture: 1,
          country: 1,
          state: 1,
          city: 1,
        })
        .lean();
    }

    // Build the comprehensive response
    const channelDetails = {
      // Channel basic info
      _id: channel._id,
      title: channel.title,
      description: channel.description,
      coverImage: channel.coverImage,
      shareLink: channel.shareLink,
      isActive: channel.isActive,

      // Pricing
      isFree: channel.isFree,
      price: channel.price,
      currency: channel.currency,
      allowPayWhatYouWant: channel.allowPayWhatYouWant,

      // Subscription settings
      isSubscription: channel.isSubscription,
      subscriptionPeriod: channel.subscriptionPeriod,
      subscriptionInterval: channel.subscriptionInterval,

      // Stats
      memberCount: memberCount,

      // Creator info
      creator: creator
        ? {
            _id: creator._id,
            name: creator.name,
            email: creator.email,
            profilePicture: creator.profilePicture,
            country: creator.country?.trim(),
            state: creator.state,
            city: creator.city?.trim(),
          }
        : null,

      // Organization (Office) info
      organization: organization
        ? {
            _id: organization._id,
            name: organization.name,
            size: organization.size,
            location: organization.location,
            city: organization.city?.trim(),
            state: organization.state,
            country: organization.country?.trim(),
            latitude: organization.latitude,
            longitude: organization.longitude,
            description: organization.description,
            headingText: organization.headingText,
            subHeadingText: organization.subHeadingText,
            icon: organization.icon,
            coverPhoto: organization.coverPhoto,
            founders: founders.map((f) => ({
              _id: f._id,
              name: f.name,
              email: f.email,
              profilePicture: f.profilePicture,
              country: f.country?.trim(),
              state: f.state,
              city: f.city?.trim(),
            })),
          }
        : null,

      // Commission plan
      combPlan: combPlan
        ? {
            _id: combPlan._id,
            name: combPlan.name,
            description: combPlan.description,
            levels: combPlan.levels,
            totalPercentage: combPlan.totalPercentage,
            platformPercentage: combPlan.platformPercentage,
          }
        : null,

      // Channel detail page fields
      rating: channel.rating,
      ratingCount: channel.ratingCount,
      aboutText: channel.aboutText,
      whatsIncluded: channel.whatsIncluded,
      benefits: channel.benefits,
      reviews: channel.reviews,
      faqs: channel.faqs,

      // Timestamps
      createdAt: channel.createdAt,
      updatedAt: channel.updatedAt,
    };

    console.log(`Channel found: ${channel.title}`);
    console.log(`Organization: ${organization?.name || "N/A"}`);
    console.log(`Members: ${memberCount}`);
    console.log(`CombPlan: ${combPlan ? combPlan.name : "None"}`);
    console.log("=== END PUBLIC CHANNEL DETAILS API ===");

    res.json({
      success: true,
      channel: channelDetails,
    });
  } catch (error) {
    console.error("Error in public channel details API:", error);
    res.status(500).json({
      success: false,
      error: "Failed to fetch channel details",
      message: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

// ============ PUBLIC TESTIMONIALS ROUTES ============

// Public GET endpoint to fetch testimonials for an organization by slug
router.get("/testimonials/:orgSlug", async (req, res) => {
  try {
    const { orgSlug } = req.params;
    const { category, tag, featured, page = "1", limit = "20" } = req.query;

    console.log("=== PUBLIC TESTIMONIALS API ===");
    console.log(`Fetching testimonials for org: ${orgSlug}`);

    // Find organization by slug
    const organization = await Organization.findOne({ slug: orgSlug }).lean();

    if (!organization) {
      return res.status(404).json({
        success: false,
        error: "Organization not found",
      });
    }

    // Build query for published and public testimonials only
    const query: any = {
      organizationId: organization._id,
      status: "published",
      isPublic: true,
    };

    // Category filter
    if (category) {
      query.categories = category;
    }

    // Tag filter
    if (tag) {
      query.tags = tag;
    }

    // Featured filter
    if (featured === "true") {
      query.isFeatured = true;
    }

    const pageNum = parseInt(page as string);
    const limitNum = parseInt(limit as string);
    const skip = (pageNum - 1) * limitNum;

    const [testimonials, total] = await Promise.all([
      Testimonial.find(query)
        .sort({ isFeatured: -1, displayOrder: 1, publishedAt: -1 })
        .skip(skip)
        .limit(limitNum)
        .select({
          _id: 1,
          clientName: 1,
          clientLogo: 1,
          clientIndustry: 1,
          title: 1,
          slug: 1,
          shortDescription: 1,
          coverImage: 1,
          categories: 1,
          tags: 1,
          primaryQuote: 1,
          primaryQuoteAuthor: 1,
          primaryQuoteAuthorRole: 1,
          isFeatured: 1,
          displayOrder: 1,
          publishedAt: 1,
        })
        .lean(),
      Testimonial.countDocuments(query),
    ]);

    // Get unique categories for this organization (from published testimonials only)
    const allCategories = await Testimonial.distinct("categories", {
      organizationId: organization._id,
      status: "published",
      isPublic: true,
    });

    // Get founders of the organization
    const founders = await User.find({
      organizations: {
        $elemMatch: {
          organization: organization._id,
          role: "founder",
        },
      },
    })
      .select({
        _id: 1,
        name: 1,
        email: 1,
        profilePicture: 1,
      })
      .lean();

    console.log(`Found ${testimonials.length} testimonials`);
    console.log("=== END PUBLIC TESTIMONIALS API ===");

    res.json({
      success: true,
      testimonials,
      categories: allCategories,
      total,
      page: pageNum,
      totalPages: Math.ceil(total / limitNum),
      organization: {
        _id: organization._id,
        name: organization.name,
        slug: organization.slug,
        icon: organization.icon,
        coverPhoto: organization.coverPhoto,
        description: organization.description,
        headingText: organization.headingText,
        subHeadingText: organization.subHeadingText,
      },
      founders: founders.map((f) => ({
        _id: f._id,
        name: f.name,
        profilePicture: f.profilePicture,
      })),
    });
  } catch (error) {
    console.error("Error in public testimonials API:", error);
    res.status(500).json({
      success: false,
      error: "Failed to fetch testimonials",
      message: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

// Public GET endpoint to fetch categories for an organization's testimonials
router.get("/testimonials/:orgSlug/categories", async (req, res) => {
  try {
    const { orgSlug } = req.params;

    // Find organization by slug
    const organization = await Organization.findOne({ slug: orgSlug }).lean();

    if (!organization) {
      return res.status(404).json({
        success: false,
        error: "Organization not found",
      });
    }

    // Get unique categories from published testimonials
    const categories = await Testimonial.distinct("categories", {
      organizationId: organization._id,
      status: "published",
      isPublic: true,
    });

    res.json({
      success: true,
      categories,
    });
  } catch (error) {
    console.error("Error fetching testimonial categories:", error);
    res.status(500).json({
      success: false,
      error: "Failed to fetch categories",
      message: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

// Public GET endpoint to fetch a single testimonial by slug
router.get("/testimonials/:orgSlug/:testimonialSlug", async (req, res) => {
  try {
    const { orgSlug, testimonialSlug } = req.params;

    console.log("=== PUBLIC TESTIMONIAL DETAIL API ===");
    console.log(`Fetching testimonial: ${testimonialSlug} for org: ${orgSlug}`);

    // Find organization by slug
    const organization = await Organization.findOne({ slug: orgSlug }).lean();

    if (!organization) {
      return res.status(404).json({
        success: false,
        error: "Organization not found",
      });
    }

    // Find the testimonial
    const testimonial = await Testimonial.findOne({
      organizationId: organization._id,
      slug: testimonialSlug,
      status: "published",
      isPublic: true,
    }).lean();

    if (!testimonial) {
      return res.status(404).json({
        success: false,
        error: "Testimonial not found",
      });
    }

    // Get founders of the organization
    const founders = await User.find({
      organizations: {
        $elemMatch: {
          organization: organization._id,
          role: "founder",
        },
      },
    })
      .select({
        _id: 1,
        name: 1,
        email: 1,
        profilePicture: 1,
        country: 1,
        state: 1,
        city: 1,
      })
      .lean();

    // Get related testimonials (same category, exclude current)
    const relatedTestimonials = await Testimonial.find({
      organizationId: organization._id,
      status: "published",
      isPublic: true,
      _id: { $ne: testimonial._id },
      ...(testimonial.categories.length > 0
        ? { categories: { $in: testimonial.categories } }
        : {}),
    })
      .sort({ isFeatured: -1, displayOrder: 1 })
      .limit(3)
      .select({
        _id: 1,
        clientName: 1,
        clientLogo: 1,
        title: 1,
        slug: 1,
        shortDescription: 1,
        coverImage: 1,
        categories: 1,
      })
      .lean();

    console.log(`Testimonial found: ${testimonial.title}`);
    console.log("=== END PUBLIC TESTIMONIAL DETAIL API ===");

    res.json({
      success: true,
      testimonial,
      organization: {
        _id: organization._id,
        name: organization.name,
        slug: organization.slug,
        icon: organization.icon,
        coverPhoto: organization.coverPhoto,
        description: organization.description,
        headingText: organization.headingText,
        subHeadingText: organization.subHeadingText,
      },
      founders: founders.map((f) => ({
        _id: f._id,
        name: f.name,
        profilePicture: f.profilePicture,
        country: f.country?.trim(),
        state: f.state,
        city: f.city?.trim(),
      })),
      relatedTestimonials,
    });
  } catch (error) {
    console.error("Error in public testimonial detail API:", error);
    res.status(500).json({
      success: false,
      error: "Failed to fetch testimonial",
      message: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

// ============ PUBLIC CALLS ROUTES ============

// Public GET endpoint to fetch all published call offerings for an organization
router.get("/calls/:orgId", async (req, res) => {
  try {
    const { orgId } = req.params;
    const { page = "1", limit = "20" } = req.query;

    console.log("=== PUBLIC CALLS API ===");
    console.log(`Fetching calls for org: ${orgId}`);

    // Verify organization exists
    const organization = await Organization.findById(orgId)
      .select({
        _id: 1,
        name: 1,
        slug: 1,
        size: 1,
        location: 1,
        city: 1,
        state: 1,
        country: 1,
        latitude: 1,
        longitude: 1,
        description: 1,
        headingText: 1,
        subHeadingText: 1,
        icon: 1,
        coverPhoto: 1,
      })
      .lean();

    if (!organization) {
      return res.status(404).json({
        success: false,
        error: "Organization not found",
      });
    }

    const pageNum = parseInt(page as string);
    const limitNum = parseInt(limit as string);
    const skip = (pageNum - 1) * limitNum;

    // Fetch published call offerings for this organization
    const [calls, total] = await Promise.all([
      CallOffering.find({
        organizationId: orgId,
        status: "published",
      })
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limitNum)
        .lean(),
      CallOffering.countDocuments({
        organizationId: orgId,
        status: "published",
      }),
    ]);

    // Get creator details and comb plans for all calls in parallel
    const callsWithDetails = await Promise.all(
      calls.map(async (call) => {
        const [creator, combPlan] = await Promise.all([
          User.findById(call.createdBy)
            .select({
              _id: 1,
              name: 1,
              email: 1,
              profilePicture: 1,
              country: 1,
              state: 1,
              city: 1,
            })
            .lean(),
          CombPlan.findOne({
            itemType: "call",
            itemId: call._id,
            isActive: true,
          })
            .select({
              _id: 1,
              name: 1,
              description: 1,
              levels: 1,
              totalPercentage: 1,
              platformPercentage: 1,
            })
            .lean(),
        ]);

        return {
          _id: call._id,
          title: call.title,
          description: call.description,
          coverImage: call.coverImage,

          // Pricing
          pricePerCall: call.pricePerCall,
          currency: call.currency,
          isFree: call.isFree,

          // Call details
          duration: call.duration,

          // Intake questions
          intakeQuestions: call.intakeQuestions,

          // Stats
          totalPurchased: call.totalPurchased,
          totalUsed: call.totalUsed,
          totalScheduled: call.totalScheduled,
          purchaseCount: call.purchaseCount,
          averageRating: call.averageRating,
          reviewCount: call.reviewCount,

          // Creator info
          creator: creator
            ? {
                _id: creator._id,
                name: creator.name,
                email: creator.email,
                profilePicture: creator.profilePicture,
                country: creator.country?.trim(),
                state: creator.state,
                city: creator.city?.trim(),
              }
            : null,

          // Commission plan
          combPlan: combPlan
            ? {
                _id: combPlan._id,
                name: combPlan.name,
                description: combPlan.description,
                levels: combPlan.levels,
                totalPercentage: combPlan.totalPercentage,
                platformPercentage: combPlan.platformPercentage,
              }
            : null,

          // Timestamps
          createdAt: call.createdAt,
          updatedAt: call.updatedAt,
        };
      })
    );

    // Get founders of the organization
    const founders = await User.find({
      organizations: {
        $elemMatch: {
          organization: organization._id,
          role: "founder",
        },
      },
    })
      .select({
        _id: 1,
        name: 1,
        email: 1,
        profilePicture: 1,
      })
      .lean();

    console.log(`Found ${callsWithDetails.length} published calls`);
    console.log("=== END PUBLIC CALLS API ===");

    res.json({
      success: true,
      calls: callsWithDetails,
      total,
      page: pageNum,
      totalPages: Math.ceil(total / limitNum),
      organization: {
        _id: organization._id,
        name: organization.name,
        slug: organization.slug,
        size: organization.size,
        location: organization.location,
        city: organization.city?.trim(),
        state: organization.state,
        country: organization.country?.trim(),
        latitude: organization.latitude,
        longitude: organization.longitude,
        description: organization.description,
        headingText: organization.headingText,
        subHeadingText: organization.subHeadingText,
        icon: organization.icon,
        coverPhoto: organization.coverPhoto,
      },
      founders: founders.map((f) => ({
        _id: f._id,
        name: f.name,
        email: f.email,
        profilePicture: f.profilePicture,
      })),
    });
  } catch (error) {
    console.error("Error in public calls API:", error);
    res.status(500).json({
      success: false,
      error: "Failed to fetch calls",
      message: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

// Public GET endpoint to fetch a single call offering by ID with all related info
router.get("/calls/:orgId/:callId", async (req, res) => {
  try {
    const { orgId, callId } = req.params;

    console.log("=== PUBLIC CALL DETAIL API ===");
    console.log(`Fetching call: ${callId} for org: ${orgId}`);

    // Verify organization exists
    const organization = await Organization.findById(orgId)
      .select({
        _id: 1,
        name: 1,
        slug: 1,
        size: 1,
        location: 1,
        city: 1,
        state: 1,
        country: 1,
        latitude: 1,
        longitude: 1,
        description: 1,
        headingText: 1,
        subHeadingText: 1,
        icon: 1,
        coverPhoto: 1,
      })
      .lean();

    if (!organization) {
      return res.status(404).json({
        success: false,
        error: "Organization not found",
      });
    }

    // Fetch the call offering (must be published and belong to this org)
    const call = await CallOffering.findOne({
      _id: callId,
      organizationId: orgId,
      status: "published",
    }).lean();

    if (!call) {
      return res.status(404).json({
        success: false,
        error: "Call offering not found",
      });
    }

    // Fetch all related data in parallel
    const [creator, channels, combPlan, purchaseCount, bookingCount, reviews] =
      await Promise.all([
        // Get creator (founder) details
        User.findById(call.createdBy)
          .select({
            _id: 1,
            name: 1,
            email: 1,
            profilePicture: 1,
            country: 1,
            state: 1,
            city: 1,
          })
          .lean(),

        // Get associated channels
        call.channelIds && call.channelIds.length > 0
          ? Channel.find({ _id: { $in: call.channelIds } })
              .select({
                _id: 1,
                title: 1,
                description: 1,
                price: 1,
                currency: 1,
                coverImage: 1,
                isFree: 1,
                isSubscription: 1,
                subscriptionPeriod: 1,
                isActive: 1,
              })
              .lean()
          : [],

        // Get comb plan for this call
        CombPlan.findOne({
          itemType: "call",
          itemId: callId,
          isActive: true,
        })
          .select({
            _id: 1,
            name: 1,
            description: 1,
            levels: 1,
            totalPercentage: 1,
            platformPercentage: 1,
          })
          .lean(),

        // Get total purchase count
        CallPurchase.countDocuments({
          callOfferingId: callId,
          paymentStatus: "completed",
        }),

        // Get total completed bookings count
        CallBooking.countDocuments({
          callOfferingId: callId,
          status: "completed",
        }),

        // Get recent reviews
        CallBooking.find({
          callOfferingId: callId,
          rating: { $exists: true },
        })
          .sort({ ratedAt: -1 })
          .limit(10)
          .select({
            _id: 1,
            rating: 1,
            review: 1,
            ratedAt: 1,
            bookerId: 1,
          })
          .lean(),
      ]);

    // Get reviewer details for reviews
    const reviewsWithUsers = await Promise.all(
      reviews.map(async (review) => {
        const reviewer = await User.findById(review.bookerId)
          .select({
            _id: 1,
            name: 1,
            profilePicture: 1,
          })
          .lean();

        return {
          _id: review._id,
          rating: review.rating,
          review: review.review,
          ratedAt: review.ratedAt,
          reviewer: reviewer
            ? {
                _id: reviewer._id,
                name: reviewer.name,
                profilePicture: reviewer.profilePicture,
              }
            : null,
        };
      })
    );

    // Get founders of the organization
    const founders = await User.find({
      organizations: {
        $elemMatch: {
          organization: organization._id,
          role: "founder",
        },
      },
    })
      .select({
        _id: 1,
        name: 1,
        email: 1,
        profilePicture: 1,
        country: 1,
        state: 1,
        city: 1,
      })
      .lean();

    // Build the comprehensive response
    const callDetails = {
      // Call basic info
      _id: call._id,
      title: call.title,
      description: call.description,
      coverImage: call.coverImage,

      // Pricing
      pricePerCall: call.pricePerCall,
      currency: call.currency,
      isFree: call.isFree,

      // Call details
      duration: call.duration,

      // Intake questions
      intakeQuestions: call.intakeQuestions,

      // Stats
      totalPurchased: call.totalPurchased,
      totalUsed: call.totalUsed,
      totalScheduled: call.totalScheduled,
      purchaseCount: purchaseCount,
      completedBookings: bookingCount,
      averageRating: call.averageRating,
      reviewCount: call.reviewCount,

      // Detail page fields
      whatsIncluded: call.whatsIncluded,
      topicsWeCover: call.topicsWeCover,
      howItWorks: call.howItWorks,
      faqs: call.faqs,

      // Creator info
      creator: creator
        ? {
            _id: creator._id,
            name: creator.name,
            email: creator.email,
            profilePicture: creator.profilePicture,
            country: creator.country?.trim(),
            state: creator.state,
            city: creator.city?.trim(),
          }
        : null,

      // Organization (Office) info
      organization: {
        _id: organization._id,
        name: organization.name,
        slug: organization.slug,
        size: organization.size,
        location: organization.location,
        city: organization.city?.trim(),
        state: organization.state,
        country: organization.country?.trim(),
        latitude: organization.latitude,
        longitude: organization.longitude,
        description: organization.description,
        headingText: organization.headingText,
        subHeadingText: organization.subHeadingText,
        icon: organization.icon,
        coverPhoto: organization.coverPhoto,
        founders: founders.map((f) => ({
          _id: f._id,
          name: f.name,
          email: f.email,
          profilePicture: f.profilePicture,
          country: f.country?.trim(),
          state: f.state,
          city: f.city?.trim(),
        })),
      },

      // Associated channels
      channels: channels,

      // Commission plan
      combPlan: combPlan
        ? {
            _id: combPlan._id,
            name: combPlan.name,
            description: combPlan.description,
            levels: combPlan.levels,
            totalPercentage: combPlan.totalPercentage,
            platformPercentage: combPlan.platformPercentage,
          }
        : null,

      // Reviews
      reviews: reviewsWithUsers,

      // Timestamps
      createdAt: call.createdAt,
      updatedAt: call.updatedAt,
    };

    console.log(`Call found: ${call.title}`);
    console.log(`Organization: ${organization.name}`);
    console.log(`Channels: ${channels.length}`);
    console.log(`Reviews: ${reviewsWithUsers.length}`);
    console.log("=== END PUBLIC CALL DETAIL API ===");

    res.json({
      success: true,
      call: callDetails,
    });
  } catch (error) {
    console.error("Error in public call detail API:", error);
    res.status(500).json({
      success: false,
      error: "Failed to fetch call details",
      message: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

// ============ PUBLIC SELLABLE ITEMS ROUTE ============

// Public GET endpoint to fetch all sellable items with search query
router.get("/sellable-items", async (req, res) => {
  try {
    const { search, page = "1", limit = "20" } = req.query;

    const pageNum = parseInt(page as string);
    const limitNum = parseInt(limit as string);
    const skip = (pageNum - 1) * limitNum;

    // Build search filter
    const searchFilter = search
      ? { $regex: search as string, $options: "i" }
      : undefined;

    // Query all sellable item types in parallel
    const [courses, workshops, products, channels, callOfferings, services] =
      await Promise.all([
        Course.find({
          status: "published",
          ...(searchFilter ? { title: searchFilter } : {}),
        }).lean(),

        Workshop.find({
          isActive: true,
          ...(searchFilter ? { title: searchFilter } : {}),
        }).lean(),

        Product.find({
          status: "active",
          ...(searchFilter ? { name: searchFilter } : {}),
        }).lean(),

        Channel.find({
          isActive: true,
          ...(searchFilter ? { title: searchFilter } : {}),
        }).lean(),

        CallOffering.find({
          status: "published",
          ...(searchFilter ? { title: searchFilter } : {}),
        }).lean(),

        Service.find({
          status: "active",
          ...(searchFilter ? { title: searchFilter } : {}),
        }).lean(),
      ]);

    // Collect all unique org IDs and fetch their slugs in bulk
    const orgIdSet = new Set<string>();
    courses.forEach((c) => c.organizationId && orgIdSet.add(String(c.organizationId)));
    workshops.forEach((w) => w.orgId && orgIdSet.add(String(w.orgId)));
    products.forEach((p) => p.organizationId && orgIdSet.add(String(p.organizationId)));
    channels.forEach((ch) => ch.storeId && orgIdSet.add(String(ch.storeId)));
    callOfferings.forEach((co) => co.organizationId && orgIdSet.add(String(co.organizationId)));
    services.forEach((s) => s.organizationId && orgIdSet.add(String(s.organizationId)));

    // Fetch org slugs and comp plans in parallel
    const allItemIds = [
      ...courses.map((c) => ({ type: "course", id: c._id })),
      ...workshops.map((w) => ({ type: "workshop", id: w._id })),
      ...products.map((p) => ({ type: "product", id: p._id })),
      ...channels.map((ch) => ({ type: "channel", id: ch._id })),
      ...callOfferings.map((co) => ({ type: "call", id: co._id })),
      ...services.map((s) => ({ type: "service", id: s._id })),
    ];

    const [orgs, combPlans] = await Promise.all([
      Organization.find({ _id: { $in: Array.from(orgIdSet) } })
        .select({ _id: 1, slug: 1 })
        .lean(),
      CombPlan.find({
        isActive: true,
        itemId: { $in: allItemIds.map((i) => i.id) },
      })
        .select({ _id: 1, itemType: 1, itemId: 1, levels: 1, totalPercentage: 1 })
        .lean(),
    ]);

    const orgSlugMap = new Map<string, string>();
    orgs.forEach((org) => orgSlugMap.set(String(org._id), org.slug || ""));

    // Build comp plan lookup by itemId
    const compPlanMap = new Map<string, any>();
    combPlans.forEach((cp) => {
      compPlanMap.set(String(cp.itemId), {
        levels: cp.levels,
        totalPercentage: cp.totalPercentage,
      });
    });

    // Normalize into a unified list with all fields
    const allItems: any[] = [
      ...courses.map((c) => {
        const { organizationId, __v, ...rest } = c as any;
        return { ...rest, name: c.title, type: "course", orgSlug: orgSlugMap.get(String(organizationId)) || "", coverPhoto: c.coverImage || "", price: c.price || 0, compPlan: compPlanMap.get(String(c._id)) || null };
      }),
      ...workshops.map((w) => {
        const { orgId, __v, ...rest } = w as any;
        return { ...rest, name: w.title, type: "workshop", orgSlug: orgSlugMap.get(String(orgId)) || "", coverPhoto: w.thumbnail || "", price: w.price || 0, compPlan: compPlanMap.get(String(w._id)) || null };
      }),
      ...products.map((p) => {
        const { organizationId, __v, ...rest } = p as any;
        return { ...rest, name: p.name, type: "product", orgSlug: orgSlugMap.get(String(organizationId)) || "", coverPhoto: p.images?.[0] || "", price: p.price || 0, compPlan: compPlanMap.get(String(p._id)) || null };
      }),
      ...channels.map((ch) => {
        const { storeId, __v, ...rest } = ch as any;
        return { ...rest, name: ch.title, type: "channel", orgSlug: orgSlugMap.get(String(storeId)) || "", coverPhoto: ch.coverImage || "", price: ch.price || 0, compPlan: compPlanMap.get(String(ch._id)) || null };
      }),
      ...callOfferings.map((co) => {
        const { organizationId, __v, ...rest } = co as any;
        return { ...rest, name: co.title, type: "call", orgSlug: orgSlugMap.get(String(organizationId)) || "", coverPhoto: co.coverImage || "", price: co.pricePerCall || 0, compPlan: compPlanMap.get(String(co._id)) || null };
      }),
      ...services.map((s) => {
        const { organizationId, __v, ...rest } = s as any;
        return { ...rest, name: s.title, type: "service", orgSlug: orgSlugMap.get(String(organizationId)) || "", coverPhoto: s.coverImage || "", price: s.totalPrice || 0, compPlan: compPlanMap.get(String(s._id)) || null };
      }),
    ];

    // Sort alphabetically by name
    allItems.sort((a, b) => a.name.localeCompare(b.name));

    const total = allItems.length;
    const paginated = allItems.slice(skip, skip + limitNum);

    res.json({
      success: true,
      total,
      page: pageNum,
      totalPages: Math.ceil(total / limitNum),
      items: paginated,
    });
  } catch (error) {
    console.error("Error in public sellable items API:", error);
    res.status(500).json({
      success: false,
      error: "Failed to fetch sellable items",
      message: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

// ============ PUBLIC ORGANIZATION STOREFRONT ROUTE ============

// Public GET endpoint to fetch a single organization ("HQ") by slug along with
// all of its published/active sellable items. Powers the in-app HQ storefront
// page in garage-store. Mirrors the normalization used by /sellable-items so the
// item shape is identical.
router.get("/organizations/:slug", async (req, res) => {
  try {
    const { slug } = req.params;

    const org = await Organization.findOne({ slug })
      .select({
        _id: 1,
        name: 1,
        slug: 1,
        description: 1,
        headingText: 1,
        subHeadingText: 1,
        icon: 1,
        coverPhoto: 1,
        colored_logo: 1,
        white_logo: 1,
        colored_icon: 1,
        white_icon: 1,
        category: 1,
        promoVideoLink: 1,
        website_meta_title: 1,
        website_meta_description: 1,
      })
      .lean();

    if (!org) {
      return res.status(404).json({ success: false, error: "Organization not found" });
    }

    const orgId = org._id;
    const orgSlug = org.slug || slug;

    // Query each sellable-item type for this org, honoring the same status
    // filters and per-collection foreign keys used by /sellable-items.
    const [courses, workshops, products, channels, callOfferings, services] =
      await Promise.all([
        Course.find({ status: "published", organizationId: orgId }).lean(),
        // Exclude soft-deleted (Trash) workshops. Workshop has two-track
        // "not-shown" semantics — isActive:false for hard deactivation, and
        // deletedAt+restoredAt for the Trash flow. The soft-delete handler
        // (routes/workshop.ts::soft-delete) leaves isActive unchanged, so
        // filtering on isActive alone leaks trashed workshops into the
        // public storefront. Mirrors isWorkshopDeleted() at
        // utils/workshopStatus.ts:39.
        Workshop.find({
          isActive: true,
          orgId: orgId,
          $or: [
            { deletedAt: null },
            { deletedAt: { $exists: false } },
            { $expr: { $gt: ["$restoredAt", "$deletedAt"] } },
          ],
        }).lean(),
        Product.find({ status: "active", organizationId: orgId }).lean(),
        Channel.find({ isActive: true, storeId: orgId }).lean(),
        CallOffering.find({ status: "published", organizationId: orgId }).lean(),
        Service.find({ status: "active", organizationId: orgId }).lean(),
      ]);

    const items: any[] = [
      ...courses.map((c) => {
        const { organizationId, __v, ...rest } = c as any;
        return { ...rest, name: c.title, type: "course", orgSlug, coverPhoto: c.coverImage || "", price: c.price || 0 };
      }),
      ...workshops.map((w) => {
        const { orgId: _o, __v, ...rest } = w as any;
        return { ...rest, name: w.title, type: "workshop", orgSlug, coverPhoto: w.thumbnail || "", price: w.price || 0 };
      }),
      ...products.map((p) => {
        const { organizationId, __v, ...rest } = p as any;
        return { ...rest, name: p.name, type: "product", orgSlug, coverPhoto: p.images?.[0] || "", price: p.price || 0 };
      }),
      ...channels.map((ch) => {
        const { storeId, __v, ...rest } = ch as any;
        return { ...rest, name: ch.title, type: "channel", orgSlug, coverPhoto: ch.coverImage || "", price: ch.price || 0 };
      }),
      ...callOfferings.map((co) => {
        const { organizationId, __v, ...rest } = co as any;
        return { ...rest, name: co.title, type: "call", orgSlug, coverPhoto: co.coverImage || "", price: co.pricePerCall || 0 };
      }),
      ...services.map((s) => {
        const { organizationId, __v, ...rest } = s as any;
        return { ...rest, name: s.title, type: "service", orgSlug, coverPhoto: s.coverImage || "", price: s.totalPrice || 0 };
      }),
    ];

    items.sort((a, b) => String(a.name).localeCompare(String(b.name)));

    res.json({
      success: true,
      organization: org,
      total: items.length,
      items,
    });
  } catch (error) {
    console.error("Error in public organization storefront API:", error);
    res.status(500).json({
      success: false,
      error: "Failed to fetch organization",
      message: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

// ============ PUBLIC SINGLE SELLABLE ITEM ROUTE ============

// Public GET endpoint to fetch one sellable item by type + id, with its
// organization branding. Powers the in-app digital item detail page in
// garage-store (so buyers don't get redirected to the hosted guest page).
router.get("/sellable-items/:type/:id", async (req, res) => {
  try {
    const { type, id } = req.params;

    let doc: any = null;
    let orgRef: any = null;
    let coverPhoto = "";
    let price = 0;

    switch (type) {
      case "course":
        doc = await Course.findById(id).lean();
        if (doc) { orgRef = doc.organizationId; coverPhoto = doc.coverImage || ""; price = doc.price || 0; }
        break;
      case "workshop":
        doc = await Workshop.findById(id).lean();
        if (doc) { orgRef = doc.orgId; coverPhoto = doc.thumbnail || ""; price = doc.price || 0; }
        break;
      case "product":
        doc = await Product.findById(id).lean();
        if (doc) { orgRef = doc.organizationId; coverPhoto = doc.images?.[0] || ""; price = doc.price || 0; }
        break;
      case "channel":
        doc = await Channel.findById(id).lean();
        if (doc) { orgRef = doc.storeId; coverPhoto = doc.coverImage || ""; price = doc.price || 0; }
        break;
      case "call":
        doc = await CallOffering.findById(id).lean();
        if (doc) { orgRef = doc.organizationId; coverPhoto = doc.coverImage || ""; price = doc.pricePerCall || 0; }
        break;
      case "service":
        doc = await Service.findById(id).lean();
        if (doc) { orgRef = doc.organizationId; coverPhoto = doc.coverImage || ""; price = doc.totalPrice || 0; }
        break;
      default:
        return res.status(400).json({ success: false, error: "Unknown sellable item type" });
    }

    if (!doc) {
      return res.status(404).json({ success: false, error: "Item not found" });
    }

    const org = orgRef
      ? await Organization.findById(orgRef)
          .select({
            _id: 1, name: 1, slug: 1, description: 1,
            icon: 1, coverPhoto: 1, colored_logo: 1, white_logo: 1,
            colored_icon: 1, white_icon: 1, category: 1,
          })
          .lean()
      : null;

    const { __v, organizationId, orgId, storeId, ...rest } = doc as any;
    const item = {
      ...rest,
      name: doc.title || doc.name,
      type,
      orgSlug: (org as any)?.slug || "",
      coverPhoto,
      price,
      organization: org || null,
    };

    res.json({ success: true, item });
  } catch (error) {
    console.error("Error in public single sellable item API:", error);
    res.status(500).json({
      success: false,
      error: "Failed to fetch sellable item",
      message: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

// ============ PUBLIC ALL AFFILIATES (ALL USERS) ROUTE ============

// Public GET endpoint to fetch all users (affiliates) with search query
router.get("/all-affiliates", async (req, res) => {
  try {
    const { search, page = "1", limit = "20" } = req.query;

    const pageNum = parseInt(page as string);
    const limitNum = parseInt(limit as string);
    const skip = (pageNum - 1) * limitNum;

    // Build search filter across name and email
    const query: any = {};
    if (search) {
      const searchRegex = { $regex: search as string, $options: "i" };
      query.$or = [{ name: searchRegex }, { email: searchRegex }, { phone: searchRegex }];
    }

    const [users, total] = await Promise.all([
      User.find(query)
        .select({
          _id: 1,
          name: 1,
          email: 1,
          country: 1,
          profilePicture: 1,
          organizations: 1,
        })
        .sort({ name: 1 })
        .skip(skip)
        .limit(limitNum)
        .lean(),
      User.countDocuments(query),
    ]);

    res.json({
      success: true,
      total,
      page: pageNum,
      totalPages: Math.ceil(total / limitNum),
      affiliates: users.map((u) => {
        const orgs = (u as any).organizations || [];
        const isFounder = orgs.some((o: any) => o.role === "founder");
        const isGuest = orgs.some((o: any) => o.guest === true);

        let role = "stakeholder";
        if (isFounder) role = "founder";
        else if (isGuest) role = "affiliate";

        return {
          _id: u._id,
          name: u.name,
          email: u.email,
          country: u.country?.trim(),
          profilePicture: u.profilePicture,
          role,
        };
      }),
    });
  } catch (error) {
    console.error("Error in public all affiliates API:", error);
    res.status(500).json({
      success: false,
      error: "Failed to fetch affiliates",
      message: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

// ── Public Feed Post Detail ──────────────────────────────────────────

router.get("/posts/:postId", async (req, res) => {
  try {
    const { postId } = req.params;

    const { Post } = await import("../models/post.model");
    const { Poll } = await import("../models/poll.model");

    const post = await Post.findOne({ _id: postId, isActive: true })
      .populate("authorId", "name email profilePicture")
      .populate("channelIds", "title")
      .populate("orgId", "name slug icon coverPhoto description branding")
      .populate({
        path: "quotedPostId",
        select: "content authorId channelIds createdAt attachments",
        populate: [
          { path: "authorId", select: "name profilePicture" },
          { path: "channelIds", select: "title" },
        ],
      })
      .lean();

    if (!post) {
      return res.status(404).json({ success: false, error: "Post not found" });
    }

    // If post has a poll, fetch it
    let poll = null;
    if (post.hasPoll) {
      const pollDoc = await Poll.findOne({ postId: post._id }).lean();
      if (pollDoc) {
        const totalVotes = (pollDoc as any).options?.reduce(
          (sum: number, opt: any) => sum + (opt.votes || 0),
          0
        ) || 0;
        poll = {
          _id: (pollDoc as any)._id,
          question: (pollDoc as any).question,
          options: (pollDoc as any).options?.map((opt: any) => ({
            text: opt.text,
            votes: opt.votes || 0,
            percentage: totalVotes > 0 ? Math.round(((opt.votes || 0) / totalVotes) * 100) : 0,
          })),
          totalVotes,
          expiresAt: (pollDoc as any).expiresAt,
          isExpired: (pollDoc as any).expiresAt ? new Date((pollDoc as any).expiresAt) < new Date() : false,
        };
      }
    }

    res.json({
      success: true,
      post: {
        _id: post._id,
        content: post.content,
        // Article-specific fields
        title: (post as any).title,
        coverImage: (post as any).coverImage,
        postType: (post as any).postType,
        readingTimeMinutes: (post as any).readingTimeMinutes,
        slug: (post as any).slug,
        author: post.authorId,
        organization: post.orgId,
        channels: post.channelIds,
        tags: post.tags,
        attachments: post.attachments,
        linkPreviews: post.linkPreviews,
        reactionsCount: post.reactionsCount,
        commentsCount: post.commentsCount,
        repostsCount: post.repostsCount,
        quotedPost: post.quotedPostId || null,
        hasPoll: post.hasPoll,
        poll,
        createdAt: (post as any).createdAt,
        updatedAt: (post as any).updatedAt,
      },
    });
  } catch (error) {
    console.error("Error fetching public post:", error);
    res.status(500).json({
      success: false,
      error: "Failed to fetch post",
      message: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

// ── Public Video Detail ──────────────────────────────────────────────

// Public GET endpoint to fetch a single playlist by ID with populated videos
router.get("/playlists/:playlistId", async (req, res) => {
  try {
    const { playlistId } = req.params;

    const { Playlist } = await import("../models/playlist.model");
    const { StandaloneVideo } = await import("../models/standaloneVideo.model");
    const { s3Service } = await import("../services/s3");

    const playlist = await Playlist.findById(playlistId)
      .populate("createdBy", "name email profilePicture")
      .populate("organizationId", "name slug icon coverPhoto description branding")
      .lean();

    if (!playlist) {
      return res.status(404).json({ success: false, error: "Playlist not found" });
    }

    // Only allow access to published founder playlists
    if (playlist.type === "founder" && !playlist.isPublished) {
      return res.status(404).json({ success: false, error: "Playlist not found" });
    }

    // Resolve video entries
    const entries = (playlist as any).videoEntries || [];

    // Group entries by source
    const workshopIds: string[] = [];
    const standaloneIds: string[] = [];
    const courseVideoEntries: any[] = [];

    for (const entry of entries) {
      if (entry.videoSource === "workshop") {
        workshopIds.push(entry.videoId.toString());
      } else if (entry.videoSource === "standalone") {
        standaloneIds.push(entry.videoId.toString());
      } else if (entry.videoSource === "courseVideo") {
        courseVideoEntries.push(entry);
      }
    }

    // Fetch video data in parallel
    const courseIds = [
      ...new Set(
        courseVideoEntries
          .filter((e: any) => e.courseId)
          .map((e: any) => e.courseId.toString())
      ),
    ];

    const [workshops, standaloneVideos, courses] = await Promise.all([
      workshopIds.length > 0
        ? Workshop.find({ _id: { $in: workshopIds } })
            .select("title description thumbnail date startTime endTime recordingLink recordingS3Key createdAt")
            .lean()
        : [],
      standaloneIds.length > 0
        ? StandaloneVideo.find({ _id: { $in: standaloneIds } })
            .select("title description thumbnail videoUrl videoS3Key sourceType duration createdAt")
            .lean()
        : [],
      courseIds.length > 0
        ? Course.find({ _id: { $in: courseIds } })
            .select("title coverImage sections isPaid isFree price currency status")
            .lean()
        : [],
    ]);

    // Build lookup maps
    const workshopMap = new Map<string, any>();
    for (const w of workshops) workshopMap.set(w._id.toString(), w);

    const standaloneMap = new Map<string, any>();
    for (const sv of standaloneVideos) standaloneMap.set(sv._id.toString(), sv);

    const courseMap = new Map<string, any>();
    for (const c of courses) courseMap.set(c._id.toString(), c);

    // Build populated videos array maintaining order, generate stream URLs for S3 videos
    const videos: any[] = [];
    for (const entry of entries) {
      if (entry.videoSource === "workshop") {
        const doc = workshopMap.get(entry.videoId.toString());
        if (doc) {
          // For workshops, check for recording S3 key
          let streamUrl: string | null = null;
          if (doc.recordingS3Key) {
            try {
              const exists = await s3Service.fileExists(doc.recordingS3Key);
              if (exists) streamUrl = await s3Service.getPresignedDownloadUrl(doc.recordingS3Key, 4 * 3600);
            } catch {}
          }
          videos.push({
            ...doc,
            _videoSource: "workshop",
            videoUrl: doc.recordingLink || null,
            streamUrl,
          });
        }
      } else if (entry.videoSource === "standalone") {
        const doc = standaloneMap.get(entry.videoId.toString());
        if (doc) {
          let streamUrl: string | null = null;
          if (doc.videoS3Key) {
            try {
              const exists = await s3Service.fileExists(doc.videoS3Key);
              if (exists) streamUrl = await s3Service.getPresignedDownloadUrl(doc.videoS3Key, 4 * 3600);
            } catch {}
          }
          videos.push({
            ...doc,
            _videoSource: "standalone",
            streamUrl,
          });
        }
      } else if (entry.videoSource === "courseVideo") {
        const course = entry.courseId ? courseMap.get(entry.courseId.toString()) : null;
        if (course) {
          for (const section of course.sections || []) {
            const chapter = section.chapters?.find(
              (ch: any) => ch._id.toString() === (entry.chapterId || entry.videoId).toString()
            );
            if (chapter) {
              let streamUrl: string | null = null;
              if (chapter.videoS3Key) {
                try {
                  const exists = await s3Service.fileExists(chapter.videoS3Key);
                  if (exists) streamUrl = await s3Service.getPresignedDownloadUrl(chapter.videoS3Key, 4 * 3600);
                } catch {}
              }
              videos.push({
                _id: chapter._id,
                title: chapter.title,
                thumbnail: course.coverImage || null,
                duration: chapter.duration,
                videoUrl: chapter.videoUrl || null,
                videoS3Key: chapter.videoS3Key || null,
                streamUrl,
                sourceType: chapter.videoS3Key ? "upload" : "link",
                _videoSource: "courseVideo",
                courseId: course._id,
                courseTitle: course.title,
                sectionTitle: section.title,
              });
              break;
            }
          }
        }
      }
    }

    const org = (playlist as any).organizationId;

    res.json({
      success: true,
      playlist: {
        _id: playlist._id,
        title: playlist.title,
        description: playlist.description,
        coverImage: playlist.coverImage,
        type: playlist.type,
        videoCount: playlist.videoCount,
        videos,
        createdBy: playlist.createdBy,
        createdAt: playlist.createdAt,
        updatedAt: playlist.updatedAt,
      },
      organization: org
        ? {
            _id: org._id,
            name: org.name,
            slug: org.slug,
            icon: org.icon,
            coverPhoto: org.coverPhoto,
            description: org.description,
            branding: org.branding,
          }
        : null,
    });
  } catch (error) {
    console.error("Error fetching public playlist:", error);
    res.status(500).json({
      success: false,
      error: "Failed to fetch playlist",
      message: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

// ── Public Recording Detail (for workshop recording share links) ──────────
router.get("/recordings/:recordingId", async (req, res) => {
  try {
    const { recordingId } = req.params;

    const { OrganizationFile } = await import("../models/cabinet.model");
    const { s3Service } = await import("../services/s3");

    // Find the recording file
    const file = await OrganizationFile.findById(recordingId).lean();
    if (!file) {
      return res.status(404).json({ success: false, error: "Recording not found" });
    }

    const meta = (file as any).metadata || {};
    const workshopId = meta.workshopId;

    // Fetch parent workshop for fallback metadata
    let workshop: any = null;
    let org: any = null;
    if (workshopId) {
      workshop = await Workshop.findById(workshopId)
        .populate("orgId", "name slug icon coverPhoto description branding")
        .lean();
      if (workshop) {
        org = workshop.orgId;
      }
    }

    // Generate presigned stream URL
    let streamUrl: string | null = null;
    if ((file as any).s3Key) {
      try {
        const exists = await s3Service.fileExists((file as any).s3Key);
        if (exists) {
          const isManifest = (file as any).mimeType === "application/x-webinar-manifest";
          if (!isManifest) {
            streamUrl = await s3Service.getPresignedStreamUrl(
              (file as any).s3Key,
              4 * 3600,
              (file as any).mimeType || "video/mp4"
            );
          }
          if (!streamUrl) {
            streamUrl = await s3Service.getPresignedDownloadUrl(
              (file as any).s3Key,
              4 * 3600,
              (file as any).name
            );
          }
        }
      } catch (err) {
        console.error("Error generating recording stream URL:", err);
      }
    }

    // Resolve display overrides (founder can customise per-recording)
    const displayTitle = meta.displayTitle || "";
    const displayDescription = meta.displayDescription || "";
    const displayThumbnail = meta.displayThumbnail || "";

    const response = {
      _id: (file as any)._id,
      title: displayTitle || workshop?.title || "Recording",
      description: displayDescription || workshop?.description || "",
      thumbnail: displayThumbnail || workshop?.thumbnail || null,
      streamUrl,
      createdAt: (file as any).createdAt,
      /**
       * When the egress started, which is where the watch page puts zero.
       *
       * Without it a signed-out viewer resolving a recording through this
       * route gets no anchor, so the chat and pin replays have nothing to
       * line up against and silently show nothing. `createdAt` is upload
       * time and would misplace everything on a long stream.
       */
      startedAt: recordingStartedAt(
        (file as any).s3Key,
        (file as any).createdAt
      ),
      workshopId: workshopId || null,
    };

    res.json({
      success: true,
      recording: response,
      organization: org ? {
        _id: org._id,
        name: org.name,
        slug: org.slug,
        icon: org.icon,
        coverPhoto: org.coverPhoto,
        description: org.description,
        branding: org.branding,
      } : null,
    });
  } catch (error) {
    console.error("Error fetching public recording:", error);
    res.status(500).json({
      success: false,
      error: "Failed to fetch recording",
      message: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

router.get("/videos/:videoId", async (req, res) => {
  try {
    const { videoId } = req.params;
    const videoType = (req.query.videoType as string) || "standalone";

    const { StandaloneVideo } = await import("../models/standaloneVideo.model");
    const { s3Service } = await import("../services/s3");

    let videoData: any = null;

    if (videoType === "standalone") {
      videoData = await StandaloneVideo.findById(videoId)
        .populate("createdBy", "name email profilePicture")
        .populate("orgId", "name slug icon coverPhoto description branding")
        .lean();
    } else if (videoType === "workshop") {
      videoData = await Workshop.findById(videoId)
        .populate("orgId", "name slug icon coverPhoto description branding")
        .lean();
    }

    if (!videoData) {
      return res.status(404).json({ success: false, error: "Video not found" });
    }

    // Generate a signed stream URL if video is S3-hosted
    let streamUrl: string | null = null;
    const s3Key = videoData.videoS3Key || videoData.recordingS3Key;
    if (s3Key) {
      try {
        const exists = await s3Service.fileExists(s3Key);
        if (exists) {
          streamUrl = await s3Service.getPresignedDownloadUrl(s3Key, 4 * 3600);
        }
      } catch (err) {
        console.error("Error generating public video stream URL:", err);
      }
    }

    // Normalize the response shape
    const org = videoData.orgId;
    const response: any = {
      _id: videoData._id,
      title: videoData.title,
      description: videoData.description,
      thumbnail: videoData.thumbnail,
      videoUrl: videoData.videoUrl || videoData.recordingLink || null,
      streamUrl,
      sourceType: videoData.sourceType || (s3Key ? "upload" : "link"),
      duration: videoData.duration || 0,
      createdAt: videoData.createdAt,
      videoType,
    };

    if (videoType === "standalone" && videoData.createdBy) {
      response.author = videoData.createdBy;
    }

    res.json({
      success: true,
      video: response,
      organization: org ? {
        _id: org._id,
        name: org.name,
        slug: org.slug,
        icon: org.icon,
        coverPhoto: org.coverPhoto,
        description: org.description,
        branding: org.branding,
      } : null,
    });
  } catch (error) {
    console.error("Error fetching public video:", error);
    res.status(500).json({
      success: false,
      error: "Failed to fetch video",
      message: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

// Public GET endpoint to fetch all users for a specific organization
router.get("/organizations/:orgId/users", async (req, res) => {
  try {
    const { orgId } = req.params;
    const { search } = req.query;

    const org = await Organization.findById(orgId).lean();
    if (!org) {
      return res.status(404).json({ success: false, error: "Organization not found" });
    }

    const filter: any = {
      "organizations.organization": orgId,
    };

    if (search && typeof search === "string" && search.trim()) {
      const searchRegex = new RegExp(search.trim(), "i");
      filter.$or = [
        { name: searchRegex },
        { email: searchRegex },
        { phone: searchRegex },
      ];
    }

    const users = await User.find(filter)
      .select({
        _id: 1,
        name: 1,
        email: 1,
        profilePicture: 1,
        country: 1,
        state: 1,
        city: 1,
        department: 1,
        organizations: { $elemMatch: { organization: orgId } },
      })
      .lean();

    const usersData = users.map((user) => {
      const membership = user.organizations?.[0];
      return {
        _id: user._id,
        name: user.name,
        email: user.email,
        profilePicture: user.profilePicture,
        country: user.country?.trim(),
        state: user.state?.trim(),
        city: user.city?.trim(),
        department: user.department,
        role: membership?.role,
        guest: membership?.guest || false,
        joinedAt: membership?.joinedAt,
      };
    });

    res.json({
      success: true,
      data: {
        organization: {
          _id: org._id,
          name: (org as any).name,
        },
        users: usersData,
        totalCount: usersData.length,
      },
    });
  } catch (error) {
    console.error("Error fetching organization users:", error);
    res.status(500).json({
      success: false,
      error: "Failed to fetch organization users",
      message: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

// Lookup a user by email — guarded by a hardcoded client key (x-client-key header)
router.get("/owner-by-email", requireClientKey, async (req, res) => {
  try {
    const email = String(req.query.email || "").trim().toLowerCase();
    if (!email) {
      return res.status(400).json({ error: "email required" });
    }

    const user = await User.findOne({ email })
      .populate({ path: "organizations.organization", select: "name slug" })
      .lean();

    if (!user) {
      return res.status(404).json({ error: "not found" });
    }

    res.json({
      userId: user._id,
      name: user.name,
      email: user.email,
      profilePicture: (user as any).profilePicture,
      role: (user as any).role,
      organizations: ((user as any).organizations || []).map((m: any) => ({
        orgId: m.organization?._id,
        orgName: m.organization?.name,
        orgSlug: m.organization?.slug,
        role: m.role,
        fullAccess: m.fullAccess,
      })),
      createdAt: (user as any).createdAt,
    });
  } catch (error) {
    console.error("Error in /owner-by-email:", error);
    res.status(500).json({
      error: "Failed to lookup owner",
      message: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

// ─── Deferred deep linking (install intent) ─────────────────────────────────
//
// Two public, unauthenticated endpoints that carry an affiliate link across an
// App Store install. See services/installIntent.ts for why iOS needs this and
// Android does not (Play's Install Referrer already does the job).
//
// Neither endpoint is a tracking surface: an intent holds a link and a hashed
// IP, is single-use, and is deleted within three hours.

// Only in-app paths we are willing to send a freshly-installed user to. The
// link is written by a browser and read back by the app, so it is untrusted
// input on both ends — an unconstrained value here would be an open redirect
// into whatever screen an attacker names.
//
// These are the Garage Shop app's routes (app.garage.store), which are the
// same paths the public storefront serves: /hq/<slug>, /store/<slug>,
// /product/<id>, /category/<id>, /digital/<type>/<id>, /live/<id> — plus the
// Garage HQ app's (com.garageapp.hq): /hq/<slug> again (an office invite now
// opens HQ, not Shop), /webinar/<id>, /channel/<id>, /course/<id>. Which app a
// row belongs to travels in `app`; each app's own route table decides what it
// will actually navigate to.
//
// `/register/<aff_id>` is NetworkChains' (`app: "nc"`) affiliate onboarding
// link — www.networkchains.com/register/aff_x sends the visitor to the store,
// and the first launch claims it and opens signup with that sponsor already
// attached. It is an affiliate id rather than a free-form slug, so it is
// matched to the shape `isValidAffiliateId` enforces (see utils/affiliateId),
// spelt `[Aa][Ff][Ff]_` because that check is case-insensitive and an `i` flag
// here would loosen every other alternative too.
//
// `/s/<slug>` and `/a/<code>` are GarageIRL's (`app: "pay"`) counter QRs:
// a store's printed QR and a counter bill's "join this bill" QR, both served
// on my.garage.app. On `/s/` the `?ref=` is the TABLE the QR is stuck to, not
// an affiliate — see the affiliateId extraction below.
//
// The bare `/?ref=` form is the no-destination case: an affiliate who shared
// the app itself rather than a particular page. There is a referrer to credit
// but nowhere to navigate, so the app spends it at signup and stays put.
//
// `/meet/room/<roomId>` is NetworkChains' Catch Up invite. It needs its own
// alternative rather than joining the list above because it is the only
// TWO-segment destination: every other branch matches `/<section>/<id>`, so a
// meeting link failed the test and was dropped here — silently, since this
// route answers 202 whether it wrote a row or not. Android never noticed
// (Play's install referrer carries the link through the store on its own), so
// this only ever broke the iOS half, where the claim is the sole channel.
// The sharer rides along in `?ref=`, which the affiliateId extraction below
// already reads.
const INSTALL_LINK_RE =
  /^\/(hq|store|product|category|live|webinar|channel|course|s|a)\/[A-Za-z0-9_-]+(\?[\w=&%.\-]*)?$|^\/meet\/room\/[A-Za-z0-9_-]+(\?[\w=&%.\-]*)?$|^\/digital\/[A-Za-z]+\/[A-Za-z0-9_-]+(\?[\w=&%.\-]*)?$|^\/register\/[Aa][Ff][Ff]_[A-Za-z0-9]{6,10}(\?[\w=&%.\-]*)?$|^\/\?ref=[A-Za-z0-9_%-]{1,64}$/;

const fingerprintShape = {
  platform: z.enum(["ios", "android"]),
  // Which app parks / claims — Garage Shop, Garage HQ, NetworkChains ("nc")
  // or GarageIRL ("pay"). Optional so Shop builds that predate it keep
  // working; the service treats a missing value as "store".
  app: z.enum(["store", "hq", "nc", "pay"]).optional(),
  osVersion: z.string().max(40).nullish(),
  screen: z.string().max(24).nullish(),
  timezone: z.string().max(64).nullish(),
  locale: z.string().max(24).nullish(),
};

function fingerprintFrom(req: any, data: any): Fingerprint | null {
  const ipHash = hashIp(clientIp(req));
  if (!ipHash) return null;
  return {
    platform: data.platform,
    app: data.app ?? null,
    ipHash,
    userAgent: String(req.headers["user-agent"] || ""),
    osVersion: data.osVersion ?? null,
    screen: data.screen ?? null,
    timezone: data.timezone ?? null,
    locale: data.locale ?? null,
  };
}

/**
 * POST /public/install-intent
 * Called by the web interstitial immediately before it bounces the visitor to
 * the App Store. Fire-and-forget from the caller's point of view — it must
 * never delay the store navigation, so failures are swallowed and the
 * response is always 202.
 */
router.post("/install-intent", async (req, res) => {
  const parsed = z
    .object({ link: z.string().min(2).max(2000), ...fingerprintShape })
    .safeParse(req.body);
  if (!parsed.success) return res.status(202).json({ success: true });

  const { link } = parsed.data;
  if (!INSTALL_LINK_RE.test(link)) return res.status(202).json({ success: true });

  const fp = fingerprintFrom(req, parsed.data);
  if (!fp) return res.status(202).json({ success: true });

  try {
    // Cheap abuse ceiling. One phone writes one intent per store bounce; an
    // office behind a single NAT might legitimately produce a handful. Well
    // past that, stop writing — the extra rows could not be told apart at
    // claim time anyway, so they would only poison real matches.
    const recent = await InstallIntent.countDocuments({
      ipHash: fp.ipHash,
      createdAt: { $gte: new Date(Date.now() - MATCH_WINDOW_MS) },
    });
    if (recent >= 30) return res.status(202).json({ success: true });

    // The referrer rides in the query string on Garage links (`?ref=`) and in
    // the path on NetworkChains' (`/register/aff_x`); either way it is copied
    // onto the row so attribution reporting never re-parses the link. A
    // counter QR's `ref` is a table label, so it credits nobody.
    const affiliateId =
      (link.startsWith("/s/") ? undefined : /[?&]ref=([^&]+)/.exec(link)?.[1]) ??
      /^\/register\/(aff_[A-Za-z0-9]{6,10})/i.exec(link)?.[1] ??
      null;
    await recordIntent({
      link,
      affiliateId: affiliateId ? decodeURIComponent(affiliateId) : null,
      fp,
    });
  } catch (error) {
    console.error("Error recording install intent:", error);
  }
  return res.status(202).json({ success: true });
});

/**
 * POST /public/install-intent/claim
 * Called ONCE by the app on its first launch after install. Returns the link
 * the visitor was headed for, or `link: null` when nothing matches — which is
 * the normal case for an organic install and must not be treated as an error.
 */
router.post("/install-intent/claim", async (req, res) => {
  const parsed = z
    .object({
      ...fingerprintShape,
      // "I already claimed and lost the answer" — see claimIntent.
      reclaim: z.boolean().optional(),
    })
    .safeParse(req.body);
  if (!parsed.success) return res.json({ success: true, link: null });

  const fp = fingerprintFrom(req, parsed.data);
  if (!fp) return res.json({ success: true, link: null });

  try {
    const link = await claimIntent(fp, { reclaim: !!parsed.data.reclaim });
    return res.json({ success: true, link });
  } catch (error) {
    console.error("Error claiming install intent:", error);
    return res.json({ success: true, link: null });
  }
});

/**
 * POST /public/pending-invite
 * The mobile invite page, just before it sends the visitor to the store:
 * "whoever signs up with this phone number / email was invited by aff_x".
 * See models/pendingInvite.model.ts.
 *
 * `identifier` is an email or an E.164 number ("+9198…") — the same single
 * field, and the same canonicaliser, as /auth/request-otp. The page must never
 * hold up the store hop on this call, so every outcome is a 200 except bad
 * input (400) and the spam window (429).
 */
router.post("/pending-invite", async (req, res) => {
  const parsed = z
    .object({
      identifier: z.string().min(1).max(320),
      affiliateCode: z.string().min(1).max(32),
    })
    .safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ success: false, error: "Invalid request" });

  const id = classifyIdentifier(parsed.data.identifier);
  if (id.kind === "invalid") {
    return res.status(400).json({ success: false, error: "Enter a valid email or phone number" });
  }
  if (!allowInviteRequest("save", callerKey(req))) {
    return res.status(429).json({ success: false, error: "Too many requests" });
  }

  try {
    const { saved, existingAccount } = await savePendingInvite(
      id,
      parsed.data.affiliateCode.trim().toLowerCase(),
    );
    return res.json({ success: true, saved, existingAccount });
  } catch (error) {
    console.error("Error saving pending invite:", error);
    return res.json({ success: true, saved: false, existingAccount: false });
  }
});

/**
 * POST /public/pending-invite/lookup
 * The app's login screen, once a complete phone number or email is typed:
 * is this a new person, and did someone invite them? Drives the switch to the
 * invite view before the OTP is sent. POST so numbers stay out of access logs.
 *
 * Advisory only — the sign-in credits the invite on its own (finishLogin), so
 * any failure here answers "nothing to show" rather than an error.
 */
router.post("/pending-invite/lookup", async (req, res) => {
  const parsed = z.object({ identifier: z.string().min(1).max(320) }).safeParse(req.body);
  const id = parsed.success ? classifyIdentifier(parsed.data.identifier) : null;
  if (!id || id.kind === "invalid") {
    return res.status(400).json({ success: false, error: "Enter a valid email or phone number" });
  }
  if (!allowInviteRequest("lookup", callerKey(req))) {
    return res.json({ success: true, existing: null, sponsor: null });
  }

  try {
    const { existing, sponsor } = await lookupPendingInvite(id);
    return res.json({ success: true, existing, sponsor });
  } catch (error) {
    console.error("Error looking up pending invite:", error);
    return res.json({ success: true, existing: null, sponsor: null });
  }
});

export default router;
