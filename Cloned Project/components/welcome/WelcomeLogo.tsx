"use client";

import { motion } from "framer-motion";
import Image from "next/image";
import { Building2 } from "lucide-react";

interface WelcomeLogoProps {
  isWhitelabel: boolean;
  orgName?: string | null;
  orgIcon?: string | null;
  isLoading?: boolean;
}

export function WelcomeLogo({
  isWhitelabel,
  orgName,
  orgIcon,
  isLoading,
}: WelcomeLogoProps) {
  if (isLoading) {
    return (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="flex flex-col items-center gap-4"
      >
        <div className="w-16 h-16 rounded-2xl bg-[#1a1a22] animate-pulse" />
        <div className="h-8 w-48 rounded-lg bg-[#1a1a22] animate-pulse" />
      </motion.div>
    );
  }

  // Whitelabel: show org icon and name
  if (isWhitelabel && (orgIcon || orgName)) {
    return (
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: "easeOut" }}
        className="flex flex-col items-center gap-2 sm:gap-3 lg:gap-4"
      >
        {orgIcon ? (
          <motion.div
            initial={{ scale: 0.8 }}
            animate={{ scale: 1 }}
            transition={{ delay: 0.1, duration: 0.4, ease: "backOut" }}
            className="relative w-12 h-12 sm:w-16 sm:h-16 lg:w-20 lg:h-20 rounded-xl sm:rounded-2xl overflow-hidden border border-white/10 shadow-xl"
          >
            <Image
              src={orgIcon}
              alt={orgName || "Organization"}
              fill
              className="object-cover"
            />
          </motion.div>
        ) : (
          <motion.div
            initial={{ scale: 0.8 }}
            animate={{ scale: 1 }}
            transition={{ delay: 0.1, duration: 0.4, ease: "backOut" }}
            className="w-12 h-12 sm:w-16 sm:h-16 lg:w-20 lg:h-20 rounded-xl sm:rounded-2xl bg-gradient-to-br from-primary/20 to-secondary/20 border border-white/10 flex items-center justify-center shadow-xl"
          >
            <Building2 className="w-6 h-6 sm:w-8 sm:h-8 lg:w-10 lg:h-10 text-primary" />
          </motion.div>
        )}
        <motion.h1
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.2, duration: 0.4 }}
          className="text-xl sm:text-2xl lg:text-3xl font-bold text-white text-center"
        >
          {orgName}
        </motion.h1>
      </motion.div>
    );
  }

  // Default: Garage logo
  return (
    <motion.div
      initial={{ opacity: 0, y: -20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: "easeOut" }}
      className="flex flex-col items-center gap-2 sm:gap-4 w-full max-w-full px-4"
    >
      <motion.div
        initial={{ scale: 0.8 }}
        animate={{ scale: 1 }}
        transition={{ delay: 0.1, duration: 0.4, ease: "backOut" }}
        className="relative w-auto h-10 sm:h-12 lg:h-14 max-w-full"
      >
        <Image
          src="/logo.svg"
          alt="Garage"
          width={180}
          height={56}
          className="h-full w-auto max-w-full object-contain"
          priority
        />
      </motion.div>
    </motion.div>
  );
}
