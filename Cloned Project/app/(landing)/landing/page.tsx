import AIPoweredMeetingSummariesSection from "@/components/landing/AiPowered";
import CallToActionSection from "@/components/landing/CallToAction";
import DropInMeetingsSection from "@/components/landing/Drop";
import GroupChatSection from "@/components/landing/Group";
import HeroSection from "@/components/landing/Hero";
import MapSection from "@/components/landing/Map";
import SchedulingSection from "@/components/landing/Scheduling";
import ClientTestimonialsSection from "@/components/landing/Testimonial";
import TheaterSection from "@/components/landing/Theatre";
import VideoConferencingSection from "@/components/landing/Video";
import { Button } from "@/components/ui/button";
import React from "react";

const page = () => {
  return (
    <div className="pb-40">
      <HeroSection />
      <MapSection />
      <DropInMeetingsSection />
      <VideoConferencingSection />
      <TheaterSection />
      <GroupChatSection />
      <AIPoweredMeetingSummariesSection />
      <SchedulingSection />
      {/* <ClientTestimonialsSection /> */}
      <CallToActionSection />
    </div>
  );
};

export default page;
