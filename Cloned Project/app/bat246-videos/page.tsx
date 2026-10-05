import Bat246VideosClient from "./Bat246VideosClient";

export const metadata = {
  title: "Short Intro Videos — BAT 246",
  // Funnel-internal gallery, gated by a localStorage unlock — nothing
  // here is meaningful to a crawler or a cold visitor without that state.
  robots: { index: false, follow: false },
};

export default function Bat246VideosPage() {
  return <Bat246VideosClient />;
}
