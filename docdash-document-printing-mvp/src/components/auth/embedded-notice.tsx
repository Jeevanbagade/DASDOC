"use client";

import { useEffect, useState } from "react";
import { ExternalLink, MonitorSmartphone } from "lucide-react";

/**
 * Shown when the app is running inside an embedded preview iframe. Some
 * browser/iframe combos still starve third-party storage; the session works
 * everywhere, and this offers the guaranteed escape hatch: a dedicated tab.
 */
export function EmbeddedNotice() {
  const [embedded, setEmbedded] = useState(false);

  useEffect(() => {
    try {
      setEmbedded(window.self !== window.top);
    } catch {
      setEmbedded(true); // cross-origin frame access throws => embedded
    }
  }, []);

  if (!embedded) return null;

  return (
    <div className="animate-pop-in mb-5 flex items-start gap-3 rounded-xl border-[1.5px] border-cobalt bg-[#eef1ff] px-4 py-3 text-sm text-cobalt">
      <MonitorSmartphone size={18} className="mt-0.5 shrink-0" aria-hidden="true" />
      <div className="flex-1">
        <p className="font-bold">You're in an embedded preview</p>
        <p className="mt-0.5 text-xs leading-relaxed opacity-90">
          Sign-in works, but if pages keep bouncing you back here, your browser is blocking the preview's cookies.
          Open DocDash in its own tab for the smoothest ride.
        </p>
      </div>
      <button
        type="button"
        onClick={() => window.open(window.location.origin + window.location.pathname, "_blank", "noopener")}
        className="btn btn-dark shrink-0 px-3 py-1.5 text-xs"
      >
        <ExternalLink size={13} /> Open in tab
      </button>
    </div>
  );
}
