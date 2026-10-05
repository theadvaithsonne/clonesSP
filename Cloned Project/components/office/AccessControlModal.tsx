'use client';

import { useState } from 'react';
import { Loader2, Mic, ScreenShare, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { AccessPolicy } from '@/hooks/office/useAccessControl';

interface Props {
  open: boolean;
  initial: AccessPolicy;
  onConfirm(policy: AccessPolicy): Promise<void> | void;
  onSkip(): void;
}

/**
 * Pre-meeting access-control modal shown to the host before entering
 * the room. Two toggles map 1:1 to the backend policy shape. "Start
 * Meeting" writes the policy via useAccessControl.setRoomPolicy — the
 * backend then bakes the resulting canPublishSources allowlist into
 * every subsequent participant token.
 */
export default function AccessControlModal({
  open,
  initial,
  onConfirm,
  onSkip,
}: Props) {
  const [allowUnmute, setAllowUnmute] = useState<boolean>(initial.allowUnmute);
  const [allowPresent, setAllowPresent] = useState<boolean>(initial.allowPresent);
  const [submitting, setSubmitting] = useState(false);

  if (!open) return null;

  const handleStart = async () => {
    setSubmitting(true);
    try {
      await onConfirm({ allowUnmute, allowPresent });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
      <div className="w-full max-w-md rounded-2xl border border-white/10 bg-[#141419] p-6 text-white shadow-2xl">
        <div className="flex items-start justify-between">
          <div>
            <h2 className="text-lg font-semibold">Meeting access controls</h2>
            <p className="mt-1 text-sm text-white/60">
              Choose what participants can do without your approval.
            </p>
          </div>
          <button
            onClick={onSkip}
            className="rounded-full p-1 text-white/50 hover:bg-white/10 hover:text-white"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="mt-6 space-y-3">
          <ToggleRow
            icon={<Mic className="h-5 w-5" />}
            title="All participants can unmute"
            subtitle="Turn off to force everyone to request permission before speaking."
            checked={allowUnmute}
            onChange={setAllowUnmute}
          />
          <ToggleRow
            icon={<ScreenShare className="h-5 w-5" />}
            title="All participants can present"
            subtitle="Turn off to keep screen sharing host-only until approved."
            checked={allowPresent}
            onChange={setAllowPresent}
          />
        </div>

        <div className="mt-6 flex items-center justify-end gap-2">
          <button
            onClick={onSkip}
            className="rounded-full px-4 py-2 text-sm text-white/70 hover:bg-white/10"
            disabled={submitting}
          >
            Skip
          </button>
          <button
            onClick={handleStart}
            disabled={submitting}
            className={cn(
              'flex items-center gap-2 rounded-full bg-amber-500 px-5 py-2 text-sm font-semibold text-black transition',
              'hover:bg-amber-400',
              submitting && 'opacity-70',
            )}
          >
            {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
            Start meeting
          </button>
        </div>
      </div>
    </div>
  );
}

function ToggleRow({
  icon,
  title,
  subtitle,
  checked,
  onChange,
}: {
  icon: React.ReactNode;
  title: string;
  subtitle: string;
  checked: boolean;
  onChange(value: boolean): void;
}) {
  return (
    <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-white/10 bg-white/[0.03] p-4 transition hover:bg-white/[0.06]">
      <div className="mt-0.5 text-white/70">{icon}</div>
      <div className="flex-1">
        <p className="text-sm font-medium text-white">{title}</p>
        <p className="mt-0.5 text-xs text-white/50">{subtitle}</p>
      </div>
      <button
        type="button"
        onClick={() => onChange(!checked)}
        className={cn(
          'relative mt-1 h-6 w-11 shrink-0 rounded-full transition',
          checked ? 'bg-amber-500' : 'bg-white/20',
        )}
        aria-pressed={checked}
      >
        <span
          className={cn(
            'absolute top-0.5 h-5 w-5 rounded-full bg-white transition',
            checked ? 'left-[22px]' : 'left-0.5',
          )}
        />
      </button>
    </label>
  );
}
