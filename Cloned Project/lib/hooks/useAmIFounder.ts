import { useState, useEffect } from "react";
import { getUserDataFromToken, getToken } from "@/lib/auth";
import { api } from "@/lib/api";

export type UserData = {
  userId: string | null;
  role: string | null;
  orgId: string | null;
  membershipRole?: string | null; // Role within current organization
  orgName?: string | null;
  profilePicture?: string | null;
  guest?: boolean;
  name?: string | null;
  email?: string | null;
};

export function useAmIFounder() {
  const [userData, setUserData] = useState<UserData>({
    userId: null,
    role: null,
    orgId: null,
    membershipRole: null,
    orgName: null,
    profilePicture: null,
    name: null,
    email: null,
  });
  const [amIFounder, setAmIFounder] = useState<boolean>(false);
  const [isGarageHQ, setIsGarageHQ] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(true);
  const [refetchTrigger, setRefetchTrigger] = useState(0);

  const hqNameWanted = (
    process.env.NEXT_PUBLIC_HQ_NAME || "GARAGE HQ"
  ).toLowerCase();

  // Re-fetch whenever the JWT token is replaced (org switch)
  useEffect(() => {
    const handler = () => setRefetchTrigger((n) => n + 1);
    window.addEventListener("garage:token-change", handler);
    return () => window.removeEventListener("garage:token-change", handler);
  }, []);

  useEffect(() => {
    const fetchUserData = async () => {
      try {
        setLoading(true);
        const tokenData = getUserDataFromToken();
        const token = getToken();

        if (!tokenData.userId || !tokenData.orgId || !token) {
          setUserData({
            ...tokenData,
            membershipRole: null,
            orgName: null,
            profilePicture: null,
          });
          setAmIFounder(false);
          setIsGarageHQ(false);
          return;
        }

        // Fetch user's organizations to get membership role for current org
        const response = await api<{
          user: {
            id: string;
            email: string;
            name?: string;
            profilePicture?: string;
            guest?: boolean;
            organizations: Array<{
              id: string;
              name: string;
              role: "founder" | "stakeholder";
              fullAccess?: boolean;
              joinedAt: string;
              guest?: boolean;
            }>;
          };
        }>("/auth/me", {}, token);

        // Find the current organization membership
        const currentOrgMembership = response.user.organizations.find(
          (org) => org.id === tokenData.orgId
        );

        const membershipRole = currentOrgMembership?.role || null;
        const currentOrgName = currentOrgMembership?.name || null;
        const updatedUserData = {
          ...tokenData,
          membershipRole,
          orgName: currentOrgName,
          profilePicture: response.user.profilePicture,
          guest: currentOrgMembership?.guest || false,
          name: response.user.name || null,
          email: response.user.email || null,
        };

        setUserData(updatedUserData);

        // Check if user is a founder (or has fullAccess) within the current organization
        const isFounder = membershipRole === "founder" || currentOrgMembership?.fullAccess === true;
        setAmIFounder(isFounder);

        const isHqOrg =
          typeof currentOrgName === "string" &&
          currentOrgName.toLowerCase() === hqNameWanted;
        setIsGarageHQ(isHqOrg);

        // console.log("🔍 useAmIFounder - Organization Context:", {
        //   currentOrgId: tokenData.orgId,
        //   globalRole: tokenData.role,
        //   membershipRole,
        //   isFounder,
        //   isGarageHQ: isHqOrg,
        //   allOrganizations: response.user.organizations,
        // });
      } catch (error) {
        console.error("Error fetching user data:", error);
        setAmIFounder(false);
        setIsGarageHQ(false);
      } finally {
        setLoading(false);
      }
    };

    fetchUserData();
  }, [refetchTrigger]);

  // console.log("🔍 useAmIFounder - userData:", userData);

  return {
    amIFounder,
    userData,
    loading,
    isGarageHQ,
  };
}
