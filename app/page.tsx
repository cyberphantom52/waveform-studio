import { StudioProvider } from "@/lib/studio-context";
import { StudioPage } from "@/components/studio/studio-page";

export default function Home() {
  return (
    <div className="dark h-screen w-screen overflow-hidden bg-background text-foreground">
      <StudioProvider>
        <StudioPage />
      </StudioProvider>
    </div>
  );
}
