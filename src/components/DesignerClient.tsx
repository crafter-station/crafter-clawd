"use client";

import dynamic from "next/dynamic";

// WebGL and <canvas> artwork only exist in the browser.
const Designer = dynamic(() => import("./Designer"), {
  ssr: false,
  loading: () => (
    <div className="grid h-dvh place-items-center bg-stone-100 text-sm text-stone-400">Loading studio…</div>
  ),
});

export default function DesignerClient() {
  return <Designer />;
}
