import { Nav } from "@/components/landing/Nav";
import { HomeHero } from "@/components/landing/HomeHero";
import { HomeScroller } from "@/components/landing/HomeScroller";

export default function HomePage() {
  return (
    <div className="min-h-screen bg-black text-white antialiased">
      <Nav />
      <main>
        <HomeHero />
        <HomeScroller />
      </main>
    </div>
  );
}
