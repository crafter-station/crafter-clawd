import type { Metadata } from "next";
import GlassesSheet from "@/components/GlassesSheet";

export const metadata: Metadata = {
  title: "Sunglasses build sheet · Clawd costume",
};

export default function GlassesPage() {
  return <GlassesSheet />;
}
