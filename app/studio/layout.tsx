import type { Metadata } from "next";
import { StudioProvider } from "@/lib/studio-context";

export const metadata: Metadata = {
  title: "Waveform Studio",
  description: "Haptic waveform remastering workbench",
};

export default function StudioLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="dark h-screen w-screen overflow-hidden bg-background text-foreground">
      <StudioProvider>{children}</StudioProvider>
    </div>
  );
}
