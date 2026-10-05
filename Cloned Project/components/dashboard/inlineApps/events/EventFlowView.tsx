"use client";

// One event inside the attendee Events pages: its page, and from "Get
// tickets" the in-app checkout, then back. Discover and Purchases both open
// events through this, so the flow is the same wherever it starts.

import { useState } from "react";
import type { PublicEventPayload } from "./api";
import EventCheckoutView from "./EventCheckoutView";
import EventDetailView from "./EventDetailView";

export default function EventFlowView({
  slug,
  rootLabel,
  onBack,
  initial,
  startInCheckout,
  onOpenPurchases,
  onScrollTop,
}: {
  slug: string;
  /** Breadcrumb root on the event page. */
  rootLabel: string;
  /** Leave the event entirely. */
  onBack: () => void;
  initial?: PublicEventPayload | null;
  /** Opened from a card's "Get tickets" — skip the event page. */
  startInCheckout?: boolean;
  onOpenPurchases?: () => void;
  onScrollTop?: () => void;
}) {
  const [checkout, setCheckout] = useState<{ tierId?: string } | null>(
    startInCheckout ? {} : null
  );
  const [payload, setPayload] = useState<PublicEventPayload | null>(initial ?? null);

  // Checkout opened straight from a card goes back where it came from; one
  // opened from the event page goes back to the page.
  const leaveCheckout = (refresh: boolean) => {
    // Seats just changed hands, so the page's availability is stale.
    if (refresh) setPayload(null);
    if (startInCheckout) {
      onBack();
      return;
    }
    setCheckout(null);
    onScrollTop?.();
  };

  if (checkout) {
    return (
      <EventCheckoutView
        slug={slug}
        initial={payload}
        initialTierId={checkout.tierId}
        onBack={() => leaveCheckout(false)}
        onDone={() => leaveCheckout(true)}
        onOpenPurchases={onOpenPurchases}
      />
    );
  }

  return (
    <EventDetailView
      slug={slug}
      rootLabel={rootLabel}
      onBack={onBack}
      initial={payload}
      onLoaded={setPayload}
      onGetTickets={(_, tierId) => {
        setCheckout({ tierId });
        onScrollTop?.();
      }}
    />
  );
}
