import { Nav } from "@/components/landing/Nav";
import { HomeHero } from "@/components/landing/HomeHero";
import { HomeLayers } from "@/components/landing/HomeLayers";

export default function HomePage() {
  return (
    <div className="min-h-screen bg-black text-white antialiased">
      <Nav />
      <main>
        <HomeHero />
        <HomeLayers />
      </main>
    </div>
  );
}
