import { MovieTitle } from './types';

// Hero Floating Posters matching the provided Criticker screenshots
export interface HeroPoster {
  title: string;
  year: string;
  rating: number;
  image: string;
  rotate: number;
  top: string;
  left: string;
}

export const HERO_POSTERS: HeroPoster[] = [
  {
    title: "Rush Hour",
    year: "1998",
    rating: 65,
    image: "https://images.unsplash.com/photo-1594909122845-11baa439b7bf?auto=format&fit=crop&w=300&q=80",
    rotate: -4,
    top: "5%",
    left: "55%"
  },
  {
    title: "Theory of Everything",
    year: "2014",
    rating: 70,
    image: "https://images.unsplash.com/photo-1509198397868-475647b2a1e5?auto=format&fit=crop&w=300&q=80",
    rotate: 3,
    top: "3%",
    left: "70%"
  },
  {
    title: "Yojimbo",
    year: "1961",
    rating: 97,
    image: "https://images.unsplash.com/photo-1543536448-d209d2d13a1c?auto=format&fit=crop&w=300&q=80",
    rotate: -2,
    top: "4%",
    left: "84%"
  },
  {
    title: "Mad Max 2",
    year: "1981",
    rating: 88,
    image: "https://images.unsplash.com/photo-1509281373149-e957c6296406?auto=format&fit=crop&w=300&q=80",
    rotate: 2,
    top: "2%",
    left: "94%"
  },
  {
    title: "Apex",
    year: "2021",
    rating: 47,
    image: "https://images.unsplash.com/photo-1536440136628-849c177e76a1?auto=format&fit=crop&w=300&q=80",
    rotate: 5,
    top: "45%",
    left: "56%"
  },
  {
    title: "Wuthering Heights",
    year: "2011",
    rating: 53,
    image: "https://images.unsplash.com/photo-1485846234645-a62644f84728?auto=format&fit=crop&w=300&q=80",
    rotate: -3,
    top: "40%",
    left: "92%"
  },
  {
    title: "Jurassic World",
    year: "2015",
    rating: 36,
    image: "https://images.unsplash.com/photo-1518709268805-4e9042af9f23?auto=format&fit=crop&w=300&q=80",
    rotate: -1,
    top: "42%",
    left: "78%"
  },
  {
    title: "If I Had Legs I'd Kick You",
    year: "2023",
    rating: 80,
    image: "https://images.unsplash.com/photo-1478720568477-152d9b164e26?auto=format&fit=crop&w=300&q=80",
    rotate: 4,
    top: "60%",
    left: "91%"
  }
];

// Highlight recommendations for the showcase (matches screenshot: Yellowstone, Anora, Bridgerton, The Settlers, A Real Pain, I May Destroy You, Mickey 17)
export const SHOWCASE_RECOMMENDATIONS = [
  { title: "Yellowstone", platform: "Paramount+", rating: 72, color: "bg-emerald-500/20 text-emerald-400 border-emerald-500/35" },
  { title: "Anora", platform: "Apple TV", rating: 68, color: "bg-amber-500/20 text-amber-400 border-amber-500/35" },
  { title: "Bridgerton", platform: "Netflix", rating: 45, color: "bg-rose-500/20 text-rose-400 border-rose-500/35" },
  { title: "The Settlers", platform: "Filmin", rating: 78, color: "bg-emerald-500/20 text-emerald-400 border-emerald-500/35" },
  { title: "A Real Pain", platform: "Hulu", rating: 84, color: "bg-emerald-500/20 text-emerald-400 border-emerald-500/35" },
  { title: "I May Destroy You", platform: "Max", rating: 91, color: "bg-emerald-500/20 text-emerald-400 border-emerald-500/35" },
  { title: "Mickey 17", platform: "In theaters now", rating: 56, color: "bg-amber-500/20 text-amber-400 border-amber-500/35" },
  { title: "Didi", platform: "Mubi", rating: 73, color: "bg-emerald-500/20 text-emerald-400 border-emerald-500/35" }
];

// Collections matching the collections section of screenshots
export const PREMIUM_COLLECTIONS = [
  {
    title: "Female Directors",
    titles: "11,795 titles",
    rated: "302 rated",
    rating: 93,
    user: "djross",
    image: "https://images.unsplash.com/photo-1542204172-e7052809a936?auto=format&fit=crop&w=400&q=80"
  },
  {
    title: "Existential films",
    titles: "111 titles",
    rated: "14 rated",
    rating: 64,
    user: "frederic_g54",
    image: "https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?auto=format&fit=crop&w=400&q=80"
  },
  {
    title: "Time Travel",
    titles: "340 titles",
    rated: "7 rated",
    rating: 47,
    user: "mpowell",
    image: "https://images.unsplash.com/photo-1506703719100-a0f3a48c0f86?auto=format&fit=crop&w=400&q=80"
  }
];

// Curated reviews block
export const REVIEWS_SAMPLES = [
  {
    username: "lpm52300",
    rating: 82,
    rank: "71st",
    work: "Omori",
    text: "OMOCAT's style and presentation create a wonderful atmosphere. The writing is solid but is not weighty enough for its 'punch' to hit hard. It still hits, though, and the game is absolutely worth playing through.",
    starCount: 1
  },
  {
    username: "cinereader",
    rating: 95,
    rank: "14th",
    work: "Interstellar",
    text: "Christopher Nolan's visual storytelling matched with Hans Zimmer's pipe organ score makes a beautiful depiction of space exploration, love, and time dilated relativity.",
    starCount: 3
  }
];

// Trending Rail items matching Criticker screenshot exactly
export const TRENDING_RAIL_ITEMS: MovieTitle[] = [
  {
    id: "hopper-2026",
    title: "Hoppers",
    year: "2026",
    description: "A girl takes on animal minds in this original Pixar futuristic adventure.",
    rating: 79,
    type: "movie",
    genres: ["Animation", "Sci-Fi", "Comedy"],
    posterUrl: "https://images.unsplash.com/photo-1534447677768-be436bb09401?auto=format&fit=crop&w=300&q=80"
  },
  {
    id: "dont-die-2026",
    title: "Good Luck, Have Fun, Don't Die",
    year: "2026",
    description: "A dark mystery that follows esports stars trapped inside a live-action game loop.",
    rating: 67,
    type: "movie",
    genres: ["Thriller", "Action"],
    posterUrl: "https://images.unsplash.com/photo-1612287230202-1bf1d85d1bdf?auto=format&fit=crop&w=300&q=80"
  },
  {
    id: "bugonia-2026",
    title: "Bugonia",
    year: "2026",
    description: "Two conspiracy theorists kidnap a high-powered CEO convinced she is an alien.",
    rating: 81,
    type: "movie",
    genres: ["Sci-Fi", "Comedy"],
    posterUrl: "https://images.unsplash.com/photo-1506703719100-a0f3a48c0f86?auto=format&fit=crop&w=300&q=80"
  },
  {
    id: "michael-2026",
    title: "Michael",
    year: "2026",
    description: "The definitive cinematic work tracking the life and times of the King of Pop.",
    rating: 94,
    type: "movie",
    genres: ["Biography", "Music", "Drama"],
    posterUrl: "https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?auto=format&fit=crop&w=300&q=80"
  },
  {
    id: "drama-2026",
    title: "The Drama",
    year: "2026",
    description: "A young couple prepares for their wedding day when dark secrets crash down.",
    rating: 73,
    type: "movie",
    genres: ["Drama", "Romance"],
    posterUrl: "https://images.unsplash.com/photo-1492691527719-9d1e07e534b4?auto=format&fit=crop&w=300&q=80"
  },
  {
    id: "backrooms-2026",
    title: "Backrooms",
    year: "2026",
    description: "A cinematic horror based on Kane Pixels' phenomenal internet-creepy visual logs.",
    rating: 58,
    type: "movie",
    genres: ["Horror", "Mystery"],
    posterUrl: "https://images.unsplash.com/photo-1509198397868-475647b2a1e5?auto=format&fit=crop&w=300&q=80"
  },
  {
    id: "readyornot-2026",
    title: "Ready or Not 2",
    year: "2026",
    description: "Grace is back to dismantle another rich bloodline's horrific wedding tradition.",
    rating: 85,
    type: "movie",
    genres: ["Horror", "Action"],
    posterUrl: "https://images.unsplash.com/photo-1594909122845-11baa439b7bf?auto=format&fit=crop&w=300&q=80"
  },
  {
    id: "hokum-2026",
    title: "Hokum",
    year: "2026",
    description: "A suspenseful psychological journey tracking a broken writer in the woods.",
    rating: 60,
    type: "movie",
    genres: ["Thriller", "Drama"],
    posterUrl: "https://images.unsplash.com/photo-1518709268805-4e9042af9f23?auto=format&fit=crop&w=300&q=80"
  }
];
