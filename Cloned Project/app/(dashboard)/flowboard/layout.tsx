"use client";

import { useEffect, useState } from "react";
import { useUserStore } from '@/store/flowboard/userStore';
import { notificationSocketService } from './lib/notification-socket-service';
import { jwtDecode } from 'jwt-decode' 
import { useThemeStore } from "@/store/flowboard/themeStore";
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
export default function FlowboardLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    const [mounted, setMounted] = useState(false);

    const fetchUserProfile = useUserStore((state) => state.fetchUserProfile);
    const userProfile = useUserStore((state) => state.userProfile);
    const { theme } = useThemeStore();

    useEffect(() => {
        setMounted(true);
    }, []);

    useEffect(() => {
        const userData = localStorage.getItem("garage_tok")

        if (userData) {
            const payload = jwtDecode<JwtPayload>(userData)
            console.log("payload", payload)
            // setDecoded(payload)

            if (payload?.orgId && payload?.userId) {
                notificationSocketService.connect(payload.userId);
            }
        }
        return () => {
            console.log("Disconnecting global notification socket");
            notificationSocketService.disconnect();
        };


    }, [])


    // useEffect(() => {
    //     // if (userProfile?._id) {
    //     //     console.log("Connecting global notification socket for user:", userProfile._id);
    //     //     notificationSocketService.connect(userProfile._id);
    //     // }
    //     notificationSocketService.connect(userProfile._id);
    //     return () => {
    //         console.log("Disconnecting global notification socket");
    //         notificationSocketService.disconnect();
    //     };
    // }, [userProfile?._id]);

    if (!mounted) {
        return <div className={theme === 'dark' ? "dark min-h-screen bg-[#0b0b0d]" : "min-h-screen bg-white"}>{children}</div>;
    }

    return (
        <div className={theme === 'dark' ? "dark min-h-screen bg-[#0b0b0d] text-foreground" : "min-h-screen bg-white text-gray-900"}>
            {children}
        </div>
    );
}
