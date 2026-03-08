import { Hero } from "@/components/landing/hero";
import { Features } from "@/components/landing/features";
import { WaveformDemo } from "@/components/landing/waveform-demo";
import { Stats } from "@/components/landing/stats";
import { Footer } from "@/components/landing/footer";

export default function Home() {
  return (
    <main className="dark">
      <Hero />
      <Features />
      <WaveformDemo />
      <Stats />
      <Footer />
    </main>
  );
}
