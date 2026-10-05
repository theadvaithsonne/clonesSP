import React, { createContext, useContext, useState, ReactNode, useEffect, useCallback } from 'react';
import Cookies from 'js-cookie';
import axios from 'axios';
import { jwtDecode } from 'jwt-decode'
// Subscription related types based on actual API response
type SubscriptionStatus = "created" | "active" | "cancelled" | "paused" | "completed" | "paid";

type StatusCounts = Record<SubscriptionStatus, number>;

// This is the actual subscription object from the API
interface SubscriptionDetails {
    _id: string;
    organizationCode: string;
    refId: string;
    paymentType: "subscription" | "oneTime";
    planId: string;
    subscriptionId: string;
    subscriptionStatus: SubscriptionStatus;
    status: "active" | "inactive";
    createdAt: string;
    updatedAt: string;
    __v: number;
}
interface JwtPayload {
    // Adjust these fields according to YOUR actual JWT payload
    sub?: string        // user id
    name?: string
    email?: string
    role?: string
    exp?: number
    orgId?: string
    iat?: number
    userId?: string
    // ... add any custom claims like garageId, permissions, etc.
    [key: string]: any
}
// This is for the plan details from Razorpay
interface Subscription {
    id: string;
    created_at?: string | number | Date;
    entity: string;
    period: string;
    item: {
        name?: string;
        description?: string;
        amount: number;
        active?: boolean;
    };
    subscriptionDetails?: SubscriptionDetails;
}

interface SubscriptionData {
    subscriptions: Subscription[];
    statusCounts: StatusCounts;
    totalAmount: number;
    isLoading: boolean;
    hasActiveSubscriptions: boolean; // Computed property for easier access
}

type UserContextType = {
    role: string;
    name: string;
    userId: string; // Corresponds to _id in users collection
    employeeId: string; // Specific ID from employees collection if role is employee
    clientId: string; // Specific ID from clients collection if role is client
    email: string; // User's email address
    organizationId: string; // Organization ID for subscription data
    subscriptionData: SubscriptionData;
    setUser: (name: string, role: string, userId: string, email: string, employeeId?: string, clientId?: string, organizationId?: string) => void;
    clearUser: () => void;
    refreshSubscriptions: () => void;
    fetchSubscriptionsForOrganization: (orgId: string) => void;
};

const UserContext = createContext<UserContextType | undefined>(undefined);

export function UserProvider({ children }: { children: ReactNode }) {
    const [name, setName] = useState('');
    const [role, setRole] = useState('');
    const [userId, setUserId] = useState('');
    const [employeeId, setEmployeeId] = useState('');
    const [clientId, setClientId] = useState('');
    const [email, setEmail] = useState('');
    const [organizationId, setOrganizationId] = useState('');
    const [subscriptionData, setSubscriptionData] = useState<SubscriptionData>({
        subscriptions: [],
        statusCounts: {
            created: 0,
            active: 0,
            cancelled: 0,
            paused: 0,
            completed: 0,
            paid: 0,
        },
        totalAmount: 0,
        isLoading: false,
        hasActiveSubscriptions: false,
    });

    // Subscription fetching functions
    const fetchSubscriptionDetails = async (orgId: string): Promise<{
        data: any[];
        counts: StatusCounts;
        paymentStatus: string | null;
        paymentType: string | null;
    }> => {
        try {
            const response = await axios.get(
                `https://garage.marketsverse.com/v1/payments/razorpay/${orgId}/status`
            );
            if (response.data.status && response?.data?.data) {
                const paymentData = response.data.data;
                const counts: StatusCounts = {
                    created: 0,
                    active: 0,
                    cancelled: 0,
                    paused: 0,
                    completed: 0,
                    paid: 0,
                };

                // Check if paymentStatus is active
                if (paymentData.paymentStatus === 'active') {
                    counts.active = 1;
                }

                return {
                    data: paymentData.paymentStatus === 'active' ? [paymentData] : [],
                    counts,
                    paymentStatus: paymentData.paymentStatus,
                    paymentType: paymentData.paymentType
                };
            }
            return {
                data: [],
                counts: { created: 0, active: 0, cancelled: 0, paused: 0, completed: 0, paid: 0 },
                paymentStatus: null,
                paymentType: null
            };
        } catch (error) {
            console.error("Error fetching subscription details:", error);
            return {
                data: [],
                counts: { created: 0, active: 0, cancelled: 0, paused: 0, completed: 0, paid: 0 },
                paymentStatus: null,
                paymentType: null
            };
        }
    };

    const fetchAllSubscriptions = async (orgId: string) => {
        setSubscriptionData(prev => ({ ...prev, isLoading: true }));
        try {
            // Get subscription status first
            const subscriptionDetails = await fetchSubscriptionDetails(orgId);

            // Check if payment is active
            const hasActivePayment = subscriptionDetails.paymentStatus === 'active';

            if (hasActivePayment) {
                // If payment is active, we can create a mock subscription for display
                const mockSubscription: Subscription = {
                    id: `${orgId}-payment`,
                    entity: 'subscription',
                    period: subscriptionDetails.paymentType === 'oneTime' ? 'lifetime' : 'monthly',
                    item: {
                        name: subscriptionDetails.paymentType === 'oneTime' ? 'One-Time Payment' : 'Subscription Plan',
                        description: `${subscriptionDetails.paymentType} payment - Active`,
                        amount: 0, // We don't have amount info from the new API
                        active: true
                    },
                    subscriptionDetails: {
                        _id: `${orgId}-sub`,
                        organizationCode: orgId,
                        refId: orgId,
                        paymentType: subscriptionDetails.paymentType as "subscription" | "oneTime",
                        planId: `${orgId}-plan`,
                        subscriptionId: `${orgId}-subscription`,
                        subscriptionStatus: 'active' as SubscriptionStatus,
                        status: 'active' as "active" | "inactive",
                        createdAt: new Date().toISOString(),
                        updatedAt: new Date().toISOString(),
                        __v: 0
                    }
                };

                setSubscriptionData({
                    subscriptions: [mockSubscription],
                    statusCounts: subscriptionDetails.counts,
                    totalAmount: 0, // We don't have amount info from the new API
                    isLoading: false,
                    hasActiveSubscriptions: hasActivePayment,
                });
            } else {
                setSubscriptionData({
                    subscriptions: [],
                    statusCounts: subscriptionDetails.counts,
                    totalAmount: 0,
                    isLoading: false,
                    hasActiveSubscriptions: false,
                });
            }
        } catch (error) {
            console.error("Error fetching subscriptions:", error);
            setSubscriptionData(prev => ({
                ...prev,
                isLoading: false,
                hasActiveSubscriptions: false
            }));
        }
    };

    const refreshSubscriptions = useCallback(() => {
        if (organizationId) {
            fetchAllSubscriptions(organizationId);
        }
    }, [organizationId]);

    // Add a method to fetch subscriptions for a specific organization
    const fetchSubscriptionsForOrganization = useCallback((orgId: string) => {
        if (orgId) {
            fetchAllSubscriptions(orgId);
        }
    }, []);

    useEffect(() => {
        const userData = localStorage.getItem("garage_tok");
        if (userData) {
            try {
                const parsedData = jwtDecode<JwtPayload>(userData)
                setName(parsedData.name || '');
                setRole(parsedData.role || 'user'); // Default to 'user' if not specified
                setUserId(parsedData.userId || parsedData.id || ''); // Accommodate 'id' or 'userId'
                setEmail(parsedData.email || '');
                setEmployeeId(parsedData.employeeId || '');
                setClientId(parsedData.clientId || parsedData.id);
                setOrganizationId(parsedData?.orgId || '');

                // Don't fetch subscriptions here anymore - let the launchpad page handle it explicitly
            } catch (error) {
                console.error("Error parsing user data from cookies:", error);
            }
        }
    }, []); // Remove dependency to avoid multiple calls

    const setUser = (newName: string, newRole: string, newUserId: string, newEmail: string, newEmployeeId?: string, newClientId?: string, newOrganizationId?: string) => {
        setName(newName);
        setRole(newRole);
        setUserId(newUserId);
        setEmail(newEmail);
        setEmployeeId(newEmployeeId || '');
        setClientId(newClientId || '');
        setOrganizationId(newOrganizationId || '');
        const existingUserData = typeof window !== "undefined" ? localStorage.getItem("garage_tok") : null;

        // Preserve existing impersonation data if it exists
        // const existingUserData = Cookies.get("user-data");

        let impersonationData = {};
        if (existingUserData) {
            try {
                const parsed = jwtDecode<JwtPayload>(existingUserData)

                if (parsed.isImpersonated) {
                    impersonationData = {
                        isImpersonated: parsed.isImpersonated,
                        impersonationId: parsed.impersonationId,
                        originalSupportUserId: parsed.originalSupportUserId,
                        impersonatorId: parsed.impersonatorId,
                        impersonatorName: parsed.impersonatorName,
                        impersonatorRole: parsed.impersonatorRole,
                    };
                }
            } catch (e) {
                console.error("Error parsing existing user-data:", e);
            }
        }

        Cookies.set("user-data", JSON.stringify({
            name: newName,
            role: newRole,
            userId: newUserId, // Consistent key for user's main ID
            email: newEmail,
            employeeId: newEmployeeId || '',
            clientId: newClientId || '',
            organizationId: newOrganizationId || '',
            ...impersonationData, // Preserve impersonation metadata
        }), {
            path: "/",
            secure: true, // Required for SameSite=None
            sameSite: "none", // Allow cross-origin iframe access
            expires: 7, // 7 days
        });

        // Fetch subscriptions if organizationId is provided
        if (newOrganizationId) {
            fetchAllSubscriptions(newOrganizationId);
        }
    };

    const clearUser = () => {
        setName('');
        setRole('');
        setUserId('');
        setEmail('');
        setEmployeeId('');
        setClientId('');
        setOrganizationId('');
        setSubscriptionData({
            subscriptions: [],
            statusCounts: {
                created: 0,
                active: 0,
                cancelled: 0,
                paused: 0,
                completed: 0,
                paid: 0,
            },
            totalAmount: 0,
            isLoading: false,
            hasActiveSubscriptions: false,
        });
        Cookies.remove("user-data", { path: "/" });
    };

    return (
        <UserContext.Provider value={{
            name,
            role,
            userId,
            employeeId,
            clientId,
            email,
            organizationId,
            subscriptionData,
            setUser,
            clearUser,
            refreshSubscriptions,
            fetchSubscriptionsForOrganization
        }}>
            {children}
        </UserContext.Provider>
    );
}

export function useUser() {
    const context = useContext(UserContext);
    if (context === undefined) {
        throw new Error('useUser must be used within a UserProvider');
    }
    return context;
} 