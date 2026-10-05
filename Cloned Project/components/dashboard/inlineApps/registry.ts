import dynamic from "next/dynamic";
import { Loader2 } from "lucide-react";
import React from "react";

export type InlineAppProps = {
  onClose: () => void;
  /** Section the host app wants the inline app to display.
   *  Lifted from the BackOffice sidebar so the inline app has no internal nav. */
  section?: string;
};

const TeamforceApp = dynamic(() => import("./teamforce/TeamforceApp"), {
  ssr: false,
  loading: () =>
    React.createElement(
      "div",
      {
        className:
          "w-full h-screen flex items-center justify-center bg-[#0c0c0e]",
      },
      React.createElement(Loader2, {
        className: "h-8 w-8 animate-spin text-[#9fa0b8]",
      })
    ),
});
const DealsApp = dynamic(() => import("./deals/DealsApp"), {
  ssr: false,
  loading: () =>
    React.createElement(
      "div",
      {
        className:
          "w-full h-screen flex items-center justify-center bg-[#0c0c0e]",
      },
      React.createElement(Loader2, {
        className: "h-8 w-8 animate-spin text-[#9fa0b8]",
      })
    ),
});
const NetworkMailApp = dynamic(() => import("./network-mail/NetworkMailApp"), {
  ssr: false,
  loading: () =>
    React.createElement(
      "div",
      {
        className:
          "w-full h-screen flex items-center justify-center bg-[#0c0c0e]",
      },
      React.createElement(Loader2, {
        className: "h-8 w-8 animate-spin text-[#9fa0b8]",
      })
    ),
});
const EventsApp = dynamic(() => import("./events/EventsApp"), {
  ssr: false,
  loading: () =>
    React.createElement(
      "div",
      {
        className:
          "w-full h-screen flex items-center justify-center bg-[#0c0c0e]",
      },
      React.createElement(Loader2, {
        className: "h-8 w-8 animate-spin text-[#9fa0b8]",
      })
    ),
});
const ThoughtsApp = dynamic(() => import("./thoughts/ThoughtsApp"), {
  ssr: false,
  loading: () =>
    React.createElement(
      "div",
      {
        className:
          "w-full h-screen flex items-center justify-center bg-[#0c0c0e]",
      },
      React.createElement(Loader2, {
        className: "h-8 w-8 animate-spin text-[#9fa0b8]",
      })
    ),
});

export const INLINE_APP_REGISTRY: Record<
  string,
  React.ComponentType<InlineAppProps>
> = {
  teamforce: TeamforceApp,
  deals: DealsApp,
  "network-mail": NetworkMailApp,
  thoughts: ThoughtsApp,
  events: EventsApp,
};
