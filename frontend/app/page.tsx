import { Nav } from "@/components/landing/Nav";
import { HomeHero } from "@/components/landing/HomeHero";

export default function HomePage() {
  return (
    <div className="min-h-screen bg-black text-white antialiased">
      <Nav />
      <main>
        <HomeHero />
        <div id="beneath" />
      </main>
    </div>
  );
}
