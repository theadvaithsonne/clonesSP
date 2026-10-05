// Garage 2.0-frontend/components/dashboard/IncomingCallDialog.tsx

"use client";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Phone, PhoneOff, Video, Mic } from "lucide-react";
import { Avatar, AvatarFallback } from "../ui/avatar";

type Props = {
  open: boolean;
  callerName?: string;
  callType?: 'audio' | 'video';
  onAccept: () => void;
  onDecline: () => void;
};

export default function IncomingCallDialog({
  open,
  callerName,
  callType = 'video',
  onAccept,
  onDecline,
}: Props) {
  if (!open) return null;

  const initials = (callerName || "?").slice(0, 2).toUpperCase();

  return (
    <Dialog open={open}>
      <DialogContent
        showCloseButton={false}
        className="max-w-sm border border-[#2a2a35] bg-[#0e0e12]/95 backdrop-blur-xl"
      >
        <DialogHeader className="items-center text-center">
          <Avatar className="h-16 w-16 mb-4 border-2 border-[#4c2e8f]">
            <AvatarFallback className="text-2xl bg-[#2a1752] text-[#e6d7ff]">
              {initials}
            </AvatarFallback>
          </Avatar>
          <DialogTitle className="text-2xl text-white flex items-center gap-2">
            {callType === 'audio' ? (
              <>
                <Mic className="h-6 w-6" />
                Incoming Audio Call
              </>
            ) : (
              <>
                <Video className="h-6 w-6" />
                Incoming Video Call
              </>
            )}
          </DialogTitle>
          <DialogDescription className="text-lg text-[#a5a6bf]">
            {callerName || "Someone"} is calling you.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="flex !flex-row items-center justify-center gap-4 pt-4">
          <Button
            onClick={onDecline}
            size="lg"
            className="w-28 bg-red-600 hover:bg-red-700 text-white rounded-full h-14"
          >
            <PhoneOff className="h-6 w-6" />
          </Button>
          <Button
            onClick={onAccept}
            size="lg"
            className="w-28 bg-green-600 hover:bg-green-700 text-white rounded-full h-14"
          >
            <Phone className="h-6 w-6" />
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
