"use client";

import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Calendar, Clock, User, Video, MapPin, X, Pencil, Trash2, Repeat, AlertTriangle, Users, Mail, UserCog, Copy } from "lucide-react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { categorizeEvent, eventColors, formatFullDate, formatTime } from "@/lib/calendarUtils";
import type { CalendarEvent } from "@/lib/calendarUtils";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";

interface EventDetailsModalProps {
  open: boolean;
  event: CalendarEvent | null;
  meId: string;
  currentTime: Date;
  onClose: () => void;
  onCancel: (bookingId: string) => void;
  onEdit?: (event: CalendarEvent) => void;
  onDelete?: (eventId: string) => void;
  onEditMembers?: (event: CalendarEvent) => void;
}

export function EventDetailsModal({
  open,
  event,
  meId,
  currentTime,
  onClose,
  onCancel,
  onEdit,
  onDelete,
  onEditMembers,
}: EventDetailsModalProps) {
  const router = useRouter();
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);

  if (!event) return null;

  // Check if current user is the creator (for events with isEvent flag)
  const isEvent = event.isEvent === true;
  const isDealActivity = event.isDealActivity === true;
  const isCreator = isEvent && event.bookerId?._id === meId;

  const handleClose = () => {
    setShowDeleteConfirm(false);
    setShowCancelConfirm(false);
    onClose();
  };

  const category = isDealActivity ? "deal" : categorizeEvent(event.title);
  const colors = eventColors[category as keyof typeof eventColors] || eventColors.default;

  const startTime = new Date(event.startTime);
  const endTime = new Date(event.endTime);

  const otherPerson = isDealActivity
    ? event.contactName || event.entityName || "Deal follow-up"
    : event.bookerId._id === meId
      ? event.bookedWithId.name || event.bookedWithId.email
      : event.bookerId.name || event.bookerId.email;

  const otherPersonEmail = isDealActivity
    ? ""
    : event.bookerId._id === meId
      ? event.bookedWithId.email
      : event.bookerId.email;

  // Check if meeting is joinable (5 minutes before start time)
  const joinWindowStart = new Date(startTime.getTime() - 5 * 60 * 1000);
  const isJoinable = !isDealActivity && currentTime >= joinWindowStart && currentTime < endTime;

  const isVideoCall =
    !isDealActivity &&
    (
      event.title.toLowerCase().includes('virtual') ||
      event.title.toLowerCase().includes('telehealth') ||
      event.title.toLowerCase().includes('online')
    );

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="bg-gradient-to-br from-[#1a1a20] to-[#111116] border-[#2a2a35] max-w-md !top-4 !bottom-4 !translate-y-0 !max-h-none overflow-y-auto">
        <DialogHeader>
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <div
                className="w-1 h-12 rounded-full absolute left-0 top-6"
                style={{ backgroundColor: colors.border }}
              />
              <DialogTitle
                className="text-xl font-semibold pl-4"
                style={{ color: colors.text }}
              >
                {event.title}
              </DialogTitle>
              <div className="text-sm text-gray-400 mt-1 pl-4 capitalize flex items-center gap-2">
                {isDealActivity ? "Deal follow-up" : `${category} Meeting`}
                {event.isRepeating && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-green-500/20 text-green-400 text-xs rounded-full">
                    <Repeat className="h-3 w-3" />
                    Daily
                  </span>
                )}
              </div>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-4 mt-4">
          {/* Date and Time */}
          <div className="space-y-3">
            <div className="flex items-center gap-3 text-gray-300">
              <div className="w-10 h-10 rounded-lg bg-yellow-500/10 flex items-center justify-center">
                <Calendar className="h-5 w-5 text-yellow-400" />
              </div>
              <div>
                <div className="text-sm font-medium text-white">
                  {formatFullDate(startTime)}
                </div>
                <div className="text-xs text-gray-400">
                  {startTime.toLocaleDateString('en-US', { weekday: 'long' })}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-3 text-gray-300">
              <div className="w-10 h-10 rounded-lg bg-blue-500/10 flex items-center justify-center">
                <Clock className="h-5 w-5 text-blue-400" />
              </div>
              <div>
                <div className="text-sm font-medium text-white">
                  {formatTime(startTime)} - {formatTime(endTime)}
                </div>
                <div className="text-xs text-gray-400">
                  {Math.round((endTime.getTime() - startTime.getTime()) / 60000)} minutes
                </div>
              </div>
            </div>

            {/* For deal activities, show deal-related details */}
            {isDealActivity ? (
              <div className="space-y-3">
                <div className="flex items-center gap-3 text-gray-300">
                  <div className="w-10 h-10 rounded-lg bg-purple-500/10 flex items-center justify-center">
                    <User className="h-5 w-5 text-purple-400" />
                  </div>
                  <div>
                    <div className="text-sm font-medium text-white">{otherPerson}</div>
                    {event.entityName && (
                      <div className="text-xs text-gray-400">{event.entityName}</div>
                    )}
                  </div>
                </div>
                {event.description && (
                  <div className="text-xs text-gray-400 bg-white/5 border border-white/10 rounded-md p-3">
                    {event.description}
                  </div>
                )}
              </div>
            ) : isEvent ? (
              <div className="space-y-3">
                {/* Host/Creator */}
                <div className="flex items-center gap-3 text-gray-300">
                  <div className="w-10 h-10 rounded-lg bg-yellow-500/10 flex items-center justify-center">
                    <User className="h-5 w-5 text-yellow-400" />
                  </div>
                  <div className="flex-1">
                    <div className="text-sm font-medium text-white flex items-center gap-2">
                      {event.bookerId?.name || event.bookerId?.email || 'Host'}
                      <span className="text-[10px] px-1.5 py-0.5 bg-yellow-500/20 text-yellow-400 rounded">Host</span>
                    </div>
                    <div className="text-xs text-gray-400">{event.bookerId?.email}</div>
                  </div>
                </div>

                {/* Invited Users */}
                {event.invitedUserIds && event.invitedUserIds.length > 0 && (
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 text-xs text-gray-400 uppercase tracking-wide">
                      <Users className="h-3 w-3" />
                      Team Members ({event.invitedUserIds.length})
                    </div>
                    <div className="space-y-2 pl-2 max-h-[150px] overflow-y-auto">
                      {(event.invitedUserIds as any[]).map((user: any) => (
                        <div key={user._id} className="flex items-center gap-3 text-gray-300">
                          <div className="w-8 h-8 rounded-full bg-purple-500/20 flex items-center justify-center flex-shrink-0">
                            <span className="text-xs text-purple-400 font-medium">
                              {(user.name || user.email || '?').slice(0, 2).toUpperCase()}
                            </span>
                          </div>
                          <div className="min-w-0">
                            <div className="text-sm font-medium text-white truncate">{user.name || 'Unknown'}</div>
                            <div className="text-xs text-gray-400 truncate">{user.email}</div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Guest Invitations */}
                {event.guestInvitations && event.guestInvitations.length > 0 && (
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 text-xs text-gray-400 uppercase tracking-wide">
                      <Mail className="h-3 w-3" />
                      External Guests ({event.guestInvitations.length})
                    </div>
                    <div className="space-y-2 pl-2 max-h-[150px] overflow-y-auto">
                      {event.guestInvitations.map((guest, index) => (
                        <div key={guest.email || index} className="flex items-center gap-3 text-gray-300">
                          <div className="w-8 h-8 rounded-full bg-blue-500/20 flex items-center justify-center flex-shrink-0">
                            <Mail className="h-3.5 w-3.5 text-blue-400" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="text-sm font-medium text-white truncate">{guest.email}</div>
                            <div className="text-xs text-gray-400 flex items-center gap-1.5">
                              <span className={cn(
                                "px-1.5 py-0.5 rounded text-[10px]",
                                guest.status === 'joined'
                                  ? "bg-green-500/20 text-green-400"
                                  : "bg-gray-500/20 text-gray-400"
                              )}>
                                {guest.status === 'joined' ? 'Joined' : 'Pending'}
                              </span>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Copy Meeting Link Button - for events with publicJoinCode */}
                {event.publicJoinCode && (
                  <div className="pt-2">
                    <Button
                      variant="outline"
                      onClick={() => {
                        const link = `${window.location.origin}/guest/event-join?code=${event.publicJoinCode}`;
                        navigator.clipboard.writeText(link);
                        toast.success("Meeting link copied! Share with anyone to join.");
                      }}
                      className="w-full border-blue-500/30 text-blue-400 hover:bg-blue-500/20 hover:border-blue-500/50"
                    >
                      <Copy className="h-4 w-4 mr-2" />
                      Copy Meeting Link
                    </Button>
                    <p className="text-xs text-gray-500 text-center mt-1.5">
                      Share this link with anyone you want to invite
                    </p>
                  </div>
                )}
              </div>
            ) : (
              <div className="flex items-center gap-3 text-gray-300">
                <div className="w-10 h-10 rounded-lg bg-purple-500/10 flex items-center justify-center">
                  <User className="h-5 w-5 text-purple-400" />
                </div>
                <div>
                  <div className="text-sm font-medium text-white">{otherPerson}</div>
                  <div className="text-xs text-gray-400">{otherPersonEmail}</div>
                </div>
              </div>
            )}

            {!isDealActivity && (
            <div className="flex items-center gap-3 text-gray-300">
              <div
                className={cn(
                  "w-10 h-10 rounded-lg flex items-center justify-center",
                  isVideoCall ? "bg-green-500/10" : "bg-orange-500/10"
                )}
              >
                {isVideoCall ? (
                  <Video className="h-5 w-5 text-green-400" />
                ) : (
                  <MapPin className="h-5 w-5 text-orange-400" />
                )}
              </div>
              <div>
                <div className="text-sm font-medium text-white">
                  {isVideoCall ? 'Virtual Meeting' : 'In-Person Meeting'}
                </div>
                <div className="text-xs text-gray-400">
                  {isVideoCall ? 'Join via video call' : 'Location-based meeting'}
                </div>
              </div>
            </div>
            )}
          </div>

          {/* Actions */}
          <div className="flex flex-col gap-2 pt-4 border-t border-white/10">
            <AnimatePresence mode="wait">
              {/* Delete Confirmation Card */}
              {showDeleteConfirm ? (
                <motion.div
                  key="delete-confirm"
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="p-4 bg-red-500/10 border border-red-500/30 rounded-lg space-y-3"
                >
                  <div className="flex items-center gap-2 text-red-400">
                    <AlertTriangle className="h-5 w-5" />
                    <span className="font-medium">Delete this event?</span>
                  </div>
                  <p className="text-sm text-gray-400">
                    This action cannot be undone. The event will be permanently removed.
                  </p>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      onClick={() => setShowDeleteConfirm(false)}
                      className="flex-1 border-gray-500/30 text-gray-400 hover:bg-gray-500/20"
                    >
                      Cancel
                    </Button>
                    <Button
                      onClick={() => {
                        onDelete?.(event._id);
                        handleClose();
                      }}
                      className="flex-1 bg-red-500 hover:bg-red-600 text-white"
                    >
                      <Trash2 className="h-4 w-4 mr-2" />
                      Delete
                    </Button>
                  </div>
                </motion.div>
              ) : showCancelConfirm ? (
                <motion.div
                  key="cancel-confirm"
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="p-4 bg-red-500/10 border border-red-500/30 rounded-lg space-y-3"
                >
                  <div className="flex items-center gap-2 text-red-400">
                    <AlertTriangle className="h-5 w-5" />
                    <span className="font-medium">Cancel this meeting?</span>
                  </div>
                  <p className="text-sm text-gray-400">
                    Are you sure you want to cancel this meeting?
                  </p>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      onClick={() => setShowCancelConfirm(false)}
                      className="flex-1 border-gray-500/30 text-gray-400 hover:bg-gray-500/20"
                    >
                      Go Back
                    </Button>
                    <Button
                      onClick={() => {
                        onCancel(event._id);
                        handleClose();
                      }}
                      className="flex-1 bg-red-500 hover:bg-red-600 text-white"
                    >
                      <X className="h-4 w-4 mr-2" />
                      Cancel Meeting
                    </Button>
                  </div>
                </motion.div>
              ) : (
                <motion.div
                  key="actions"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="space-y-2"
                >
                  {/* Join note for events */}
                  {isJoinable && (
                    <div className="text-sm text-center text-gray-400 bg-blue-500/10 border border-blue-500/20 rounded-lg py-3 px-4">
                      <Video className="h-4 w-4 inline-block mr-2 text-blue-400" />
                      Go to <span className="text-blue-400 font-medium">OfficeStream</span> to join this call
                    </div>
                  )}

                  {/* Creator actions: Edit, Edit Members & Delete */}
                  {isCreator && onEdit && onDelete && (
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <Button
                          variant="outline"
                          onClick={() => {
                            onEdit(event);
                            handleClose();
                          }}
                          className="flex-1 border-yellow-500/30 text-yellow-400 hover:bg-yellow-500/20 hover:border-yellow-500/50"
                        >
                          <Pencil className="h-4 w-4 mr-2" />
                          Edit Event
                        </Button>
                        {onEditMembers && (
                          <Button
                            variant="outline"
                            onClick={() => {
                              onEditMembers(event);
                              handleClose();
                            }}
                            className="flex-1 border-purple-500/30 text-purple-400 hover:bg-purple-500/20 hover:border-purple-500/50"
                          >
                            <UserCog className="h-4 w-4 mr-2" />
                            Edit Members
                          </Button>
                        )}
                      </div>
                      <Button
                        variant="outline"
                        onClick={() => setShowDeleteConfirm(true)}
                        className="w-full border-red-500/30 text-red-400 hover:bg-red-500/20 hover:border-red-500/50"
                      >
                        <Trash2 className="h-4 w-4 mr-2" />
                        Delete Event
                      </Button>
                    </div>
                  )}

                  {/* Cancel button for non-event bookings or non-creators */}
                  {!isCreator && !isDealActivity && (
                    <Button
                      variant="outline"
                      onClick={() => setShowCancelConfirm(true)}
                      className="w-full border-red-500/30 text-red-400 hover:bg-red-500/20 hover:border-red-500/50"
                    >
                      <X className="h-4 w-4 mr-2" />
                      Cancel Meeting
                    </Button>
                  )}

                  {isDealActivity && (
                    <div className="space-y-2">
                      <div className="text-sm text-center text-gray-400 bg-purple-500/10 border border-purple-500/20 rounded-lg py-3 px-4">
                        This reminder is synced from Deals.
                      </div>
                      {event.leadId && (
                        <Button
                          onClick={() => {
                            if (typeof window !== "undefined") {
                              sessionStorage.setItem(
                                "deals:inline-pending-lead-id",
                                String(event.leadId)
                              );
                              window.dispatchEvent(
                                new CustomEvent("deals:open-lead-inline", {
                                  detail: { leadId: String(event.leadId) },
                                })
                              );
                            } else {
                              router.push(`/deals/leads/${event.leadId}`);
                            }
                            handleClose();
                          }}
                          className="w-full bg-purple-500/20 hover:bg-purple-500/30 text-purple-300 border border-purple-500/30"
                        >
                          Open Deal
                        </Button>
                      )}
                    </div>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {!isDealActivity && !isJoinable && startTime > currentTime && (
            <div className="text-xs text-center text-gray-500 bg-yellow-500/10 border border-yellow-500/20 rounded-lg py-2 px-3">
              You can join this meeting 5 minutes before it starts
            </div>
          )}

          {!isDealActivity && endTime < currentTime && (
            <div className="text-xs text-center text-gray-500 bg-gray-500/10 border border-gray-500/20 rounded-lg py-2 px-3">
              This meeting has ended
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
