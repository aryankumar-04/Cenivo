import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI, Type } from "@google/genai";
import dotenv from "dotenv";
import * as admin from 'firebase-admin';

dotenv.config();

const app = express();
const PORT = 3000;

app.use(express.json());

// Lazy GoogleGenAI Initialization Helper (prevents crash on startup if GEMINI_API_KEY is not defined yet)
let aiClient: GoogleGenAI | null = null;
let lastQuotaExceededTime = 0;
const QUOTA_COOLDOWN_MS = 300 * 1000; // 5 minutes silent fallback window on first encounter of quota limit or resource exhaust errors

function getGemini(): GoogleGenAI | null {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey === "MY_GEMINI_API_KEY" || apiKey.trim() === "") {
    return null;
  }
  if (Date.now() - lastQuotaExceededTime < QUOTA_COOLDOWN_MS) {
    return null;
  }
  if (!aiClient) {
    aiClient = new GoogleGenAI({
      apiKey: apiKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        }
      }
    });
  }
  return aiClient;
}

function handleGeminiError(err: any, context: string) {
  const errMsg = err instanceof Error ? err.message : String(err);
  const isQuota = 
    errMsg.toLowerCase().includes("quota") ||
    errMsg.toLowerCase().includes("exhausted") ||
    errMsg.toLowerCase().includes("429") ||
    errMsg.toLowerCase().includes("rate limit") ||
    errMsg.toLowerCase().includes("limit") ||
    errMsg.toLowerCase().includes("resource_exhausted");

  if (isQuota) {
    lastQuotaExceededTime = Date.now();
    console.warn(`[Gemini Safe Sandbox Backoff - ${context}] Quota/rate-limit detected. Cooling down for ${QUOTA_COOLDOWN_MS / 1000} seconds.`);
  } else {
    console.warn(`[Gemini Handled Non-Critical - ${context}]`, errMsg);
  }
}

async function generateContentWithRetry(
  ai: GoogleGenAI,
  params: any,
  maxAttempts = 3,
  delayMs = 800
): Promise<any> {
  let attempt = 0;
  while (attempt < maxAttempts) {
    try {
      return await ai.models.generateContent(params);
    } catch (err: any) {
      attempt++;
      const errMsg = err instanceof Error ? err.message : String(err);
      
      const isQuota = 
        errMsg.includes("429") ||
        errMsg.toLowerCase().includes("quota") ||
        errMsg.toLowerCase().includes("rate limit") ||
        errMsg.toLowerCase().includes("resource_exhausted") ||
        errMsg.toLowerCase().includes("exhausted");

      if (isQuota) {
        lastQuotaExceededTime = Date.now();
        console.warn(`[Gemini Resilience Bypass] Quota limit hit during generation in model ${params.model}. Aborting retries and backing off immediately.`);
        throw err;
      }

      const isRetryable = 
        errMsg.includes("503") || 
        errMsg.toLowerCase().includes("unavailable") || 
        errMsg.toLowerCase().includes("high demand") || 
        errMsg.toLowerCase().includes("temporary") ||
        errMsg.toLowerCase().includes("overloaded") ||
        errMsg.includes("500");

      if (isRetryable && attempt < maxAttempts) {
        const sleepTime = delayMs * Math.pow(2, attempt - 1) + Math.random() * 200;
        console.warn(`[Gemini Resilience Retry] Attempt ${attempt}/${maxAttempts} failed in ${params.model || "unknown"} with: "${errMsg}". Retrying in ${Math.round(sleepTime)}ms...`);
        await new Promise(resolve => setTimeout(resolve, sleepTime));
      } else {
        throw err;
      }
    }
  }
}

// Curated robust catalog representing real blockbusters in high-fidelity TMDB compliance format
const CINEMATIC_CATALOG = [
  {
    id: 101,
    title: "Dune: Part Two",
    overview: "Paul Atreides unites with Chani and the Fremen while seeking revenge against the conspirators who destroyed his family. Facing a choice between the love of his life and the fate of the universe, he endeavors to prevent a terrible future only he can foresee.",
    poster_path: "https://images.unsplash.com/photo-1547483238-f400e65ccd56?auto=format&fit=crop&w=500&q=80",
    backdrop_path: "https://images.unsplash.com/photo-1534447677768-be436bb09401?auto=format&fit=crop&w=1200&q=80",
    release_date: "2024-03-01",
    vote_average: 8.8,
    vote_count: 5312,
    media_type: "movie",
    genre_ids: [878, 12, 28],
    genres: [{ id: 878, name: "Sci-Fi" }, { id: 12, name: "Adventure" }, { id: 28, name: "Action" }],
    runtime: 166,
    youtube_id: "WayA9oGlK6A",
    cast: "Timothée Chalamet, Zendaya, Rebecca Ferguson, Austin Butler",
    director: "Denis Villeneuve",
    providers: ["Netflix", "Apple TV", "Max"]
  },
  {
    id: 102,
    title: "Interstellar",
    overview: "The adventures of a group of explorers who make use of a newly discovered wormhole to surpass the limitations on human space travel and conquer the vast distances involved in an interstellar voyage.",
    poster_path: "https://images.unsplash.com/photo-1506703719100-a0f3a48c0f86?auto=format&fit=crop&w=500&q=80",
    backdrop_path: "https://images.unsplash.com/photo-1506703719100-a0f3a48c0f86?auto=format&fit=crop&w=1200&q=80",
    release_date: "2014-11-07",
    vote_average: 8.4,
    vote_count: 34107,
    media_type: "movie",
    genre_ids: [878, 18, 12],
    genres: [{ id: 878, name: "Sci-Fi" }, { id: 18, name: "Drama" }, { id: 12, name: "Adventure" }],
    runtime: 169,
    youtube_id: "zSWdZVtXT7E",
    cast: "Matthew McConaughey, Anne Hathaway, Jessica Chastain, Michael Caine",
    director: "Christopher Nolan",
    providers: ["Apple TV", "Prime Video", "Paramount+"]
  },
  {
    id: 103,
    title: "Oppenheimer",
    overview: "The story of J. Robert Oppenheimer's role in the development of the atomic bomb during World War II, showing his genius, journey, and the political aftermath of creating the world's most destructive weapon.",
    poster_path: "https://images.unsplash.com/photo-1447069387593-a5de0862481e?auto=format&fit=crop&w=500&q=80",
    backdrop_path: "https://images.unsplash.com/photo-1447069387593-a5de0862481e?auto=format&fit=crop&w=1200&q=80",
    release_date: "2023-07-21",
    vote_average: 8.7,
    vote_count: 8430,
    media_type: "movie",
    genre_ids: [18, 36],
    genres: [{ id: 18, name: "Drama" }, { id: 36, name: "History" }],
    runtime: 180,
    youtube_id: "uYPbbksJxIg",
    cast: "Cillian Murphy, Emily Blunt, Matt Damon, Robert Downey Jr.",
    director: "Christopher Nolan",
    providers: ["Apple TV", "Peacock", "Prime Video"]
  },
  {
    id: 104,
    title: "Spider-Man: Across the Spider-Verse",
    overview: "After reuniting with Gwen Stacy, Brooklyn’s full-time, friendly neighborhood Spider-Man is catapulted across the Multiverse, where he encounters a team of Spider-People charged with protecting its very existence.",
    poster_path: "https://images.unsplash.com/photo-1612287230202-1bf1d85d1bdf?auto=format&fit=crop&w=500&q=80",
    backdrop_path: "https://images.unsplash.com/photo-1545239351-ef35f43d514b?auto=format&fit=crop&w=1200&q=80",
    release_date: "2023-06-02",
    vote_average: 8.4,
    vote_count: 6221,
    media_type: "movie",
    genre_ids: [16, 28, 12, 878],
    genres: [{ id: 16, name: "Animation" }, { id: 28, name: "Action" }, { id: 12, name: "Adventure" }, { id: 878, name: "Sci-Fi" }],
    runtime: 140,
    youtube_id: "cqGjhVJWtEg",
    cast: "Shameik Moore, Hailee Steinfeld, Oscar Isaac, Jake Johnson",
    director: "Joaquim Dos Santos",
    providers: ["Netflix", "Apple TV", "Prime Video"]
  },
  {
    id: 105,
    name: "Breaking Bad",
    overview: "Walter White, a chemistry teacher, discovers that he has cancer and decides to get into the meth-making business with his former student, Jesse Pinkman, to secure his family's financial future.",
    poster_path: "https://images.unsplash.com/photo-1594909122845-11baa439b7bf?auto=format&fit=crop&w=500&q=80",
    backdrop_path: "https://images.unsplash.com/photo-1594909122845-11baa439b7bf?auto=format&fit=crop&w=1200&q=80",
    first_air_date: "2008-01-20",
    vote_average: 9.5,
    vote_count: 14320,
    media_type: "tv",
    genre_ids: [18, 80],
    genres: [{ id: 18, name: "Drama" }, { id: 80, name: "Crime" }],
    runtime: 47,
    youtube_id: "HhesaQXLuRY",
    cast: "Bryan Cranston, Aaron Paul, Anna Gunn, Bob Odenkirk",
    director: "Vince Gilligan",
    providers: ["Netflix", "Apple TV"]
  },
  {
    id: 106,
    name: "Dark",
    overview: "A family saga with a supernatural twist, set in a German town, where the disappearance of two young children exposes the relationships among four families, traveling across three generations.",
    poster_path: "https://images.unsplash.com/photo-1509198397868-475647b2a1e5?auto=format&fit=crop&w=500&q=80",
    backdrop_path: "https://images.unsplash.com/photo-1509198397868-475647b2a1e5?auto=format&fit=crop&w=1200&q=80",
    first_air_date: "2017-12-01",
    vote_average: 9.3,
    vote_count: 8325,
    media_type: "tv",
    genre_ids: [18, 9648, 878],
    genres: [{ id: 18, name: "Drama" }, { id: 9648, name: "Mystery" }, { id: 878, name: "Sci-Fi" }],
    runtime: 60,
    youtube_id: "ESEUoa-utUM",
    cast: "Louis Hofmann, Lisa Vicari, Oliver Masucci, Maja Schöne",
    director: "Baran bo Odar",
    providers: ["Netflix"]
  },
  {
    id: 107,
    name: "Attack on Titan",
    overview: "After his hometown is destroyed and his mother is killed, young Eren Jaeger vows to cleanse the earth of the giant humanoid Titans that have brought humanity to the brink of extinction.",
    poster_path: "https://images.unsplash.com/photo-1542204172-e7052809a936?auto=format&fit=crop&w=500&q=80",
    backdrop_path: "https://images.unsplash.com/photo-1542204172-e7052809a936?auto=format&fit=crop&w=1200&q=80",
    first_air_date: "2013-04-07",
    vote_average: 9.1,
    vote_count: 14930,
    media_type: "tv",
    genre_ids: [16, 12, 10759, 10765],
    genres: [{ id: 16, name: "Animation" }, { id: 10759, name: "Action & Adventure" }, { id: 10765, name: "Sci-Fi & Fantasy" }],
    runtime: 24,
    youtube_id: "MGRm4IzK1SQ",
    cast: "Yuki Kaji, Yui Ishikawa, Marina Inoue, Hiroshi Kamiya",
    director: "Tetsuro Araki",
    providers: ["Netflix", "Crunchyroll"]
  },
  {
    id: 108,
    title: "Spirited Away",
    overview: "During her family's move to the suburbs, a sullen 10-year-old girl wanders into a world ruled by gods, witches, and spirits, and where humans are changed into beasts.",
    poster_path: "https://images.unsplash.com/photo-1478720568477-152d9b164e26?auto=format&fit=crop&w=500&q=80",
    backdrop_path: "https://images.unsplash.com/photo-1478720568477-152d9b164e26?auto=format&fit=crop&w=1200&q=80",
    release_date: "2001-07-20",
    vote_average: 8.9,
    vote_count: 14812,
    media_type: "movie",
    genre_ids: [16, 10751, 14],
    genres: [{ id: 16, name: "Animation" }, { id: 10751, name: "Family" }, { id: 14, name: "Fantasy" }],
    runtime: 125,
    youtube_id: "ByXuk9QqQkk",
    cast: "Rumi Hiiragi, Miyu Irino, Mari Natsuki, Takashi Naito",
    director: "Hayao Miyazaki",
    providers: ["Netflix", "Max"]
  },
  {
    id: 109,
    name: "Frieren: Beyond Journey's End",
    overview: "An elf mage and her former party members have defeated the Demon King, bringing peace to the land. As an elf, Frieren will outlive her companions. How will she come to terms with the mortality of her human friends?",
    poster_path: "https://images.unsplash.com/photo-1419242902214-272b3f66ee7a?auto=format&fit=crop&w=500&q=80",
    backdrop_path: "https://images.unsplash.com/photo-1419242902214-272b3f66ee7a?auto=format&fit=crop&w=1200&q=80",
    first_air_date: "2023-09-29",
    vote_average: 9.4,
    vote_count: 850,
    media_type: "tv",
    genre_ids: [16, 10765, 18],
    genres: [{ id: 16, name: "Animation" }, { id: 10765, name: "Sci-Fi & Fantasy" }, { id: 18, name: "Drama" }],
    runtime: 24,
    youtube_id: "K6G8TAsb9P8",
    cast: "Atsumi Tanezaki, Kana Ichinose, Chiaki Kobayashi, Nobuhiko Okamoto",
    director: "Keiichiro Saito",
    providers: ["Crunchyroll"]
  },
  {
    id: 110,
    name: "Cyberpunk: Edgerunners",
    overview: "A street kid trying to survive in a technology and body modification-obsessed city of the future. Having everything to lose, he chooses to stay alive by becoming an edgerunner.",
    poster_path: "https://images.unsplash.com/photo-1545239351-ef35f43d514b?auto=format&fit=crop&w=500&q=80",
    backdrop_path: "https://images.unsplash.com/photo-1518709268805-4e9042af9f23?auto=format&fit=crop&w=1200&q=80",
    first_air_date: "2022-09-13",
    vote_average: 8.6,
    vote_count: 2470,
    media_type: "tv",
    genre_ids: [16, 10759, 10765, 878],
    genres: [{ id: 16, name: "Animation" }, { id: 10759, name: "Action & Adventure" }, { id: 10765, name: "Sci-Fi & Fantasy" }, { id: 878, name: "Sci-Fi" }],
    runtime: 24,
    youtube_id: "JtqIas3bYhg",
    cast: "KENN, Aoi Yuki, Hiroki Touchi, Michiko Kaiden",
    director: "Hiroyuki Imaishi",
    providers: ["Netflix"]
  },
  {
    id: 111,
    title: "Inception",
    overview: "Cobb, a skilled thief who steals corporate secrets through use of dream-sharing technology, is given the inverse task of planting an idea into the mind of a C.E.O. in exchange for his clean slate record.",
    poster_path: "https://images.unsplash.com/photo-1518709268805-4e9042af9f23?auto=format&fit=crop&w=500&q=80",
    backdrop_path: "https://images.unsplash.com/photo-1489599849927-2ee91cede3ba?auto=format&fit=crop&w=1200&q=80",
    release_date: "2010-07-16",
    vote_average: 8.3,
    vote_count: 35140,
    media_type: "movie",
    genre_ids: [28, 878, 12, 53],
    genres: [{ id: 28, name: "Action" }, { id: 878, name: "Sci-Fi" }, { id: 12, name: "Adventure" }, { id: 53, name: "Thriller" }],
    runtime: 148,
    youtube_id: "YoHD9XEInc0",
    cast: "Leonardo DiCaprio, Joseph Gordon-Levitt, Elliot Page, Tom Hardy",
    director: "Christopher Nolan",
    providers: ["Apple TV", "Prime Video", "Max"]
  },
  {
    id: 112,
    title: "The Shawshank Redemption",
    overview: "Framed in the 1940s for the double murder of his wife and her lover, upstanding banker Andy Dufresne begins a new life at the Shawshank prison, where he puts his accounting skills to work for an amoral warden.",
    poster_path: "https://images.unsplash.com/photo-1489599849927-2ee91cede3ba?auto=format&fit=crop&w=500&q=80",
    backdrop_path: "https://images.unsplash.com/photo-1485846234645-a62644f84728?auto=format&fit=crop&w=1200&q=80",
    release_date: "1994-09-23",
    vote_average: 9.3,
    vote_count: 26420,
    media_type: "movie",
    genre_ids: [18, 80],
    genres: [{ id: 18, name: "Drama" }, { id: 80, name: "Crime" }],
    runtime: 142,
    youtube_id: "PLl99DcL6b4",
    cast: "Tim Robbins, Morgan Freeman, Bob Gunton, William Sadler",
    director: "Frank Darabont",
    providers: ["Apple TV", "Max", "Prime Video"]
  },
  {
    id: 113,
    title: "The Godfather",
    overview: "Spanning the years 1945 to 1955, a chronicle of the fictional Italian-American Corleone family, focusing on the transformation of Michael Corleone from reluctant family outsider to ruthless mafia boss.",
    poster_path: "https://images.unsplash.com/photo-1485846234645-a62644f84728?auto=format&fit=crop&w=500&q=80",
    backdrop_path: "https://images.unsplash.com/photo-1545239351-ef35f43d514b?auto=format&fit=crop&w=1200&q=80",
    release_date: "1972-03-14",
    vote_average: 9.2,
    vote_count: 19830,
    media_type: "movie",
    genre_ids: [18, 80],
    genres: [{ id: 18, name: "Drama" }, { id: 80, name: "Crime" }],
    runtime: 175,
    youtube_id: "sY1S34973zA",
    cast: "Marlon Brando, Al Pacino, James Caan, Diane Keaton",
    director: "Francis Ford Coppola",
    providers: ["Apple TV", "Paramount+"]
  },
  {
    id: 114,
    name: "Arcane: League of Legends",
    overview: "Amid the stark discord of the twin cities Piltover and Zaun, two sisters fight on rival sides of a war between magic technologies and clashing convictions.",
    poster_path: "https://images.unsplash.com/photo-1563089145-599997674d42?auto=format&fit=crop&w=500&q=80",
    backdrop_path: "https://images.unsplash.com/photo-1563089145-599997674d42?auto=format&fit=crop&w=1200&q=80",
    first_air_date: "2021-11-06",
    vote_average: 9.1,
    vote_count: 3820,
    media_type: "tv",
    genre_ids: [16, 12, 14, 10765],
    genres: [{ id: 16, name: "Animation" }, { id: 12, name: "Adventure" }, { id: 14, name: "Fantasy" }, { id: 10765, name: "Sci-Fi & Fantasy" }],
    runtime: 40,
    youtube_id: "4Ps6nInuOD0",
    cast: "Hailee Steinfeld, Ella Purnell, Kevin Alejandro, Harry Lloyd",
    director: "Christian Linke",
    providers: ["Netflix"]
  },
  {
    id: 115,
    name: "Demon Slayer: Kimetsu no Yaiba",
    overview: "It is the Taisho Period in Japan. Tanjiro, a kindhearted boy who sells charcoal for a living, finds his family slaughtered by a demon. To make matters worse, his younger sister Nezuko, the sole survivor, has been transformed into a demon herself.",
    poster_path: "https://images.unsplash.com/photo-1578632767115-351597cf2477?auto=format&fit=crop&w=500&q=80",
    backdrop_path: "https://images.unsplash.com/photo-1578632767115-351597cf2477?auto=format&fit=crop&w=1200&q=80",
    first_air_date: "2019-04-06",
    vote_average: 8.7,
    vote_count: 5880,
    media_type: "tv",
    genre_ids: [16, 10759, 10765],
    genres: [{ id: 16, name: "Animation" }, { id: 10759, name: "Action & Adventure" }, { id: 10765, name: "Sci-Fi & Fantasy" }],
    runtime: 24,
    youtube_id: "VQGCKyvzIM4",
    cast: "Natsuki Hanae, Akari Kito, Yoshitsugu Matsuoka, Hiro Shimono",
    director: "Haruo Sotozaki",
    providers: ["Netflix", "Crunchyroll"]
  },
  {
    id: 116,
    title: "Blade Runner 2049",
    overview: "Thirty years after the events of the first film, a new blade runner, LAPD Officer K, unearths a long-buried secret that has the potential to plunge what's left of society into chaos.",
    poster_path: "https://images.unsplash.com/photo-1542204172-e7052809a936?auto=format&fit=crop&w=500&q=80",
    backdrop_path: "https://images.unsplash.com/photo-1509198397868-475647b2a1e5?auto=format&fit=crop&w=1200&q=80",
    release_date: "2017-10-06",
    vote_average: 8.5,
    vote_count: 12500,
    media_type: "movie",
    genre_ids: [878, 18, 9648],
    genres: [{ id: 878, name: "Sci-Fi" }, { id: 18, name: "Drama" }, { id: 9648, name: "Mystery" }],
    runtime: 164,
    youtube_id: "gCcx85zbxz4",
    cast: "Ryan Gosling, Harrison Ford, Ana de Armas, Sylvia Hoeks",
    director: "Denis Villeneuve",
    providers: ["Apple TV", "Prime Video", "Max"]
  },
  {
    id: 117,
    title: "The Matrix",
    overview: "Set in the 22nd century, The Matrix tells the story of a computer hacker who joins a group of underground insurgents fighting the vast and powerful computers who now rule the earth.",
    poster_path: "https://images.unsplash.com/photo-1545239351-ef35f43d514b?auto=format&fit=crop&w=500&q=80",
    backdrop_path: "https://images.unsplash.com/photo-1563089145-599997674d42?auto=format&fit=crop&w=1200&q=80",
    release_date: "1999-03-30",
    vote_average: 8.2,
    vote_count: 24310,
    media_type: "movie",
    genre_ids: [28, 878],
    genres: [{ id: 28, name: "Action" }, { id: 878, name: "Sci-Fi" }],
    runtime: 136,
    youtube_id: "m8e-FF8MsqU",
    cast: "Keanu Reeves, Laurence Fishburne, Carrie-Anne Moss, Hugo Weaving",
    director: "Lana Wachowski",
    providers: ["Apple TV", "Max"]
  },
  {
    id: 118,
    name: "Stranger Things",
    overview: "When a young boy vanishes, a small town uncovers a mystery involving secret experiments, terrifying supernatural forces and one strange little girl.",
    poster_path: "https://images.unsplash.com/photo-1509198397868-475647b2a1e5?auto=format&fit=crop&w=500&q=80",
    backdrop_path: "https://images.unsplash.com/photo-1518709268805-4e9042af9f23?auto=format&fit=crop&w=1200&q=80",
    first_air_date: "2016-07-15",
    vote_average: 8.6,
    vote_count: 16210,
    media_type: "tv",
    genre_ids: [18, 9648, 10765],
    genres: [{ id: 18, name: "Drama" }, { id: 9648, name: "Mystery" }, { id: 10765, name: "Sci-Fi & Fantasy" }],
    runtime: 50,
    youtube_id: "b9EkMc79ZSU",
    cast: "Millie Bobby Brown, Finn Wolfhard, Winona Ryder, David Harbour",
    director: "The Duffer Brothers",
    providers: ["Netflix"]
  },
  {
    id: 119,
    title: "Chainsaw Man",
    overview: "Denji has a simple dream—to live a happy and peaceful life, spending time with a girl he likes. This is a far cry from reality, however, as Denji is forced by the yakuza into killing devils in order to pay off his crushing debts.",
    poster_path: "https://images.unsplash.com/photo-1578632767115-351597cf2477?auto=format&fit=crop&w=500&q=80",
    backdrop_path: "https://images.unsplash.com/photo-1542204172-e7052809a936?auto=format&fit=crop&w=1200&q=80",
    release_date: "2022-10-12",
    vote_average: 8.7,
    vote_count: 1200,
    media_type: "movie",
    genre_ids: [16, 28, 14, 10765],
    genres: [{ id: 16, name: "Animation" }, { id: 28, name: "Action" }, { id: 14, name: "Fantasy" }, { id: 10765, name: "Sci-Fi & Fantasy" }],
    runtime: 24,
    youtube_id: "v4yvTrgW_g8",
    cast: "Kikonosuke Toya, Tomori Kusunoki, Shogo Sakata, Fairouz Ai",
    director: "Ryu Nakayama",
    providers: ["Crunchyroll"]
  },
  {
    id: 120,
    title: "Your Name.",
    overview: "High schoolers Mitsuha and Taki are complete strangers living separate lives. But one night, they suddenly switch places. Mitsuha wakes up in Taki’s body, and he in hers. This bizarre occurrence continues to happen randomly, and the two must adjust their lives around each other.",
    poster_path: "https://images.unsplash.com/photo-1419242902214-272b3f66ee7a?auto=format&fit=crop&w=500&q=80",
    backdrop_path: "https://images.unsplash.com/photo-1478720568477-152d9b164e26?auto=format&fit=crop&w=1200&q=80",
    release_date: "2016-08-26",
    vote_average: 8.5,
    vote_count: 10600,
    media_type: "movie",
    genre_ids: [16, 18, 14, 10749],
    genres: [{ id: 16, name: "Animation" }, { id: 18, name: "Drama" }, { id: 14, name: "Fantasy" }, { id: 10749, name: "Romance" }],
    runtime: 106,
    youtube_id: "hRfHcp2t654",
    cast: "Ryunosuke Kamiki, Mone Kamishiraishi, Ryo Narita, Aoi Yuki",
    director: "Makoto Shinkai",
    providers: ["Apple TV", "Crunchyroll"]
  }
];

function customShuffle<T>(array: T[]): T[] {
  const arr = [...array];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

// Helper function to dynamically personalize and re-rank catalog items based on user tastes and guest actions
function personalizeAndRerankList(
  items: any[],
  personalizationScores: any = {},
  guestInteractions: any[] = []
): any[] {
  if (!items || !Array.isArray(items)) return [];

  const scores = personalizationScores || {};
  const genres = scores.genres || {};
  const contentTypes = scores.contentTypes || {};

  return items
    .filter(item => item !== null && item !== undefined)
    .map(item => {
      let scoreBoost = 0;

      // RULE: CENIVO MUST PRIORITIZE INDIAN CONTENT FIRST
      const isIndianLang = ["hi", "te", "ta", "kn", "ml"].includes(item.original_language?.toLowerCase() || "");
      const titleStr = String(item.title || item.name || "").toLowerCase();
      const overviewStr = String(item.overview || "").toLowerCase();
      const isIndianKeyword = titleStr.includes("rrr") || titleStr.includes("jawan") || titleStr.includes("idiots") || titleStr.includes("kantara") || titleStr.includes("dangal") || titleStr.includes("baahubali") || overviewStr.includes("shah rukh") || overviewStr.includes("india") || overviewStr.includes("bollywood") || overviewStr.includes("hindi") || overviewStr.includes("south action");

      const isIndian = isIndianLang || isIndianKeyword;

      if (isIndian) {
        // Strong baseline multiplier for Indian Cinema
        scoreBoost += 40; 
      }

      // Match TMDB genre IDs or names
      const genreArray: number[] = item.genre_ids || [];
      const genreNames: string[] = [];
      if (Array.isArray(item.genres)) {
        item.genres.forEach((g: any) => {
          if (typeof g === 'string') genreNames.push(g.toLowerCase());
          else if (g && g.name) genreNames.push(g.name.toLowerCase());
        });
      }

      genreArray.forEach(genreId => {
        const genreMap: Record<number, string> = {
          28: 'action', 12: 'adventure', 16: 'anime', 35: 'comedy', 80: 'crime',
          99: 'documentary', 18: 'drama', 10751: 'family', 14: 'fantasy',
          36: 'history', 27: 'horror', 10402: 'music', 9648: 'mystery',
          10749: 'romance', 878: 'sci-fi', 53: 'thriller', 10752: 'war', 37: 'western'
        };
        const name = genreMap[genreId];
        if (name && genres[name] !== undefined) {
          scoreBoost += (Number(genres[name]) * 6);
        }
      });

      genreNames.forEach(name => {
        if (genres[name] !== undefined) {
          scoreBoost += (Number(genres[name]) * 6);
        }
      });

      // Content types preference
      const hasTvDate = !!(item.first_air_date || item.air_date);
      const hasTvType = item.type === 'series' || item.type === 'tv' || item.media_type === 'tv';
      const type = item.media_type || (hasTvDate || hasTvType ? 'tv' : 'movie');
      const isAnimeGenre = genreArray.includes(16) || genreNames.includes('anime') || titleStr.includes('anime') || genreNames.includes('animation');
      
      if (isAnimeGenre && contentTypes['anime'] !== undefined) {
        scoreBoost += (Number(contentTypes['anime']) * 8);
      } else if (type === 'tv' && contentTypes['tv'] !== undefined) {
        scoreBoost += (Number(contentTypes['tv']) * 6);
      } else if (type === 'movie' && contentTypes['movie'] !== undefined) {
        scoreBoost += (Number(contentTypes['movie']) * 6);
      }

      // Capture recent guest actions from localStorage stream
      if (guestInteractions && Array.isArray(guestInteractions)) {
        guestInteractions.forEach(g => {
          if (g && g.itemId && String(g.itemId) === String(item.id)) {
            scoreBoost += 45; // Huge boost for items user active clicked or saved
          }
        });
      }

      // Average rating weight
      const rating = Number(item.vote_average || item.rating || 8.0);
      scoreBoost += rating * 1.5;

      // Explore vs Exploit jitter factor to ensure slightly different results on every feed refresh
      const jitter = Math.random() * 6;

      return {
        ...item,
        rankingScore: scoreBoost + jitter
      };
    })
    .sort((a, b) => b.rankingScore - a.rankingScore)
    .map(item => {
      const { rankingScore, ...rest } = item;
      return rest;
    });
}

// GET /api/search-suggestions
app.get("/api/search-suggestions", async (req, res) => {
  const fallbackPool = [
    { title: "Dune: Part Two", type: "movie" },
    { title: "Interstellar", type: "movie" },
    { title: "Dark", type: "tv" },
    { title: "Attack on Titan", type: "tv" },
    { title: "Spirited Away", type: "movie" },
    { title: "Shogun", type: "tv" },
    { title: "Inception", type: "movie" },
    { title: "Severance", type: "tv" },
    { title: "Breaking Bad", type: "tv" },
    { title: "Arcane", type: "tv" },
    { title: "Parasite", type: "movie" },
    { title: "Oppenheimer", type: "movie" },
    { title: "The Last of Us", type: "tv" },
    { title: "The Bear", type: "tv" },
    { title: "Princess Mononoke", type: "movie" },
    { title: "Whiplash", type: "movie" },
    { title: "Black Mirror", type: "tv" },
    { title: "Blade Runner 2049", type: "movie" },
    { title: "Chernobyl", type: "tv" },
    { title: "Your Name", type: "movie" }
  ];

  const ai = getGemini();
  if (!ai) {
    const shuffled = [...fallbackPool].sort(() => 0.5 - Math.random()).slice(0, 5);
    return res.json({ suggestions: shuffled });
  }

  try {
    const response = await generateContentWithRetry(ai, {
      model: "gemini-3.5-flash",
      contents: "Generate exactly 5 highly discoverable movie, TV series, or anime titles. Provide a mix of genres and types representing trending favorites or masterpieces. Return only an array of JSON objects matching this exact typescript signature: Array<{ title: string, type: 'movie' | 'tv' }>. Do not wrap in markdown except 'json' codeblock, do not write explanations.",
      config: {
        responseMimeType: "application/json"
      }
    });

    if (response.text) {
      const cleanJson = response.text.replace(/```json/g, "").replace(/```/g, "").trim();
      const parsed = JSON.parse(cleanJson);
      const items = Array.isArray(parsed) ? parsed : (parsed.suggestions || []);
      if (Array.isArray(items) && items.length > 0) {
        const validated = items.slice(0, 5).map((x: any) => ({
          title: String(x.title || x.name || ""),
          type: x.type === "tv" || x.type === "series" ? "tv" : "movie"
        })).filter(x => x.title);
        if (validated.length >= 3) {
          return res.json({ suggestions: validated });
        }
      }
    }
  } catch (err) {
    handleGeminiError(err, "search-suggestions");
  }

  const shuffled = [...fallbackPool].sort(() => 0.5 - Math.random()).slice(0, 5);
  return res.json({ suggestions: shuffled });
});

// Cinematic Biography and details API combining TMDB live resolution or Gemini-powered factual encyclopedia lookup with high-speed response
app.get("/api/person", async (req, res) => {
  try {
    const { name, id } = req.query;
    const personName = String(name || "");
    const personId = String(id || "");
    const tmdbKey = process.env.TMDB_API_KEY;

    let bio = "";
    let birthday = "";
    let birthplace = "";
    let knownFor = "";
    let popularity = "72.5";
    let topCredits = "";
    let department = "";
    let profilePath = "";

    // 1. If live TMDB key exists, let's try to query TMDB!
    if (tmdbKey && tmdbKey !== "MY_TMDB_API_KEY" && tmdbKey.trim() !== "" && personId && personId !== "null" && personId !== "undefined") {
      try {
        const livePersonUrl = `https://api.themoviedb.org/3/person/${personId}?api_key=${tmdbKey}&append_to_response=combined_credits`;
        const tmdbRes = await fetch(livePersonUrl);
        if (tmdbRes.ok) {
          const tmdbData = await tmdbRes.json();
          bio = tmdbData.biography || "";
          birthday = tmdbData.birthday || "Information unavailable.";
          birthplace = tmdbData.place_of_birth || "Information unavailable.";
          knownFor = tmdbData.known_for_department || "Acting";
          popularity = tmdbData.popularity ? tmdbData.popularity.toFixed(1) : "75.0";
          profilePath = tmdbData.profile_path ? `https://image.tmdb.org/t/p/h632${tmdbData.profile_path}` : "";
          
          if (tmdbData.combined_credits?.cast) {
            const sorted = tmdbData.combined_credits.cast
              .sort((a: any, b: any) => (b.popularity || 0) - (a.popularity || 0))
              .slice(0, 3)
              .map((c: any) => c.title || c.name);
            topCredits = sorted.join(", ");
          }
        }
      } catch (e) {
        console.warn("Live TMDB Person service failed, resolving via Gemini/fallback.");
      }
    }

    // 2. If details are still empty/missing, or we want the pure Gemini power to get an incredibly rich bio and details for any actor/director:
    const gemini = getGemini();
    if (gemini && (!bio || bio.length < 10)) {
      try {
        const prompt = `You are a cinematic biography encyclopedia for Cenivo.
Generate accurate, encyclopedic details for the entertainment industry professional:
Name: "${personName}"

Evaluate their biography, birthdate, place of birth, main department, top 3 famous works/credits, and popularity on a scale of 1-100.
Return a JSON object with:
- "biography": (string) 3-4 sentences of descriptive, accurate bio.
- "birthday": (string, e.g. "July 24, 1979" or "N/A")
- "birthplace": (string, e.g. "Paris, France" or "N/A")
- "known_for": (string, e.g. the movie/shows title)
- "popularity": (string, e.g. "85.4")
- "top_credits": (string, comma separated top 3 works)
- "department": (string, e.g. "Acting", "Directing")

Return strictly JSON. No markdown blocks.`;

        const response = await gemini.models.generateContent({
          model: "gemini-3.5-flash",
          contents: prompt,
          config: {
            responseMimeType: "application/json",
            responseSchema: {
              type: Type.OBJECT,
              properties: {
                biography: { type: Type.STRING },
                birthday: { type: Type.STRING },
                birthplace: { type: Type.STRING },
                known_for: { type: Type.STRING },
                popularity: { type: Type.STRING },
                top_credits: { type: Type.STRING },
                department: { type: Type.STRING }
              },
              required: ["biography", "birthday", "birthplace", "known_for", "popularity", "top_credits", "department"]
            }
          }
        });
        const data = JSON.parse(response.candidates?.[0]?.content?.parts?.[0]?.text || "{}");
        bio = data.biography || bio;
        birthday = data.birthday || birthday;
        birthplace = data.birthplace || birthplace;
        knownFor = data.known_for || knownFor;
        popularity = data.popularity || popularity;
        topCredits = data.top_credits || topCredits;
        department = data.department || department;
      } catch (err) {
        handleGeminiError(err, "person-biography");
      }
    }

    // Fallbacks if both fail or aren't available
    if (!bio) {
      bio = `${personName} is a highly accomplished creative professional in the entertainment industry, celebrated for their remarkable contributions across critically acclaimed feature films and TV series.`;
      birthday = "Information unavailable.";
      birthplace = "Information unavailable.";
      knownFor = "Cinema";
      popularity = "78.2";
      topCredits = "Various Blockbusters";
      department = "Production";
    }

    return res.json({
      name: personName,
      biography: bio,
      birthday,
      birthplace,
      known_for: knownFor,
      popularity,
      top_credits: topCredits,
      department: department,
      profile_path: profilePath
    });
  } catch (err: any) {
    console.error("Critical error inside /api/person:", err);
    return res.status(500).json({ error: "Intermittent biography error." });
  }
});

const similarCache = new Map<string, any[]>();

// Gemini + TMDB Hybrid similarity recommendation system with full caching, strict matching and infinite pagination support
app.get("/api/similar", async (req, res) => {
  try {
    const { id, type, title, genres, overview, page } = req.query;
    const itemID = String(id || "");
    const mediaType = String(type || "movie");
    const itemTitle = String(title || "");
    const itemGenres = String(genres || "");
    const itemOverview = String(overview || "");
    const pageNum = Number(page || 1);

    const cacheKey = `${mediaType}_${itemID}`;
    let validatedList = similarCache.get(cacheKey) || [];

    if (validatedList.length === 0) {
      console.log(`[Similar Tab] Generating Similar recommendations for "${itemTitle}" (${mediaType})`);
      const gemini = getGemini();
      let rawRecs: any[] = [];

      if (gemini) {
        try {
          const prompt = `You are the core recommender engine for Cenivo.
Analyze this title metadata:
Title: "${itemTitle}"
Media Type: "${mediaType}"
Genres: "${itemGenres}"
Overview: "${itemOverview}"

Suggest exactly 35 real, existing and highly similar movies or TV shows/anime.
Strict matching rules:
1. Similarity score must be 90%+. High match on themes, mood, tone, paced story, audience type, narrative style.
2. If the current title is an animation or fantasy anime, return only highly authentic anime recommendations (e.g. fantasy, adventure, mythological, magical girl, mecha, etc. anime). No live-action.
3. If it is a horror, return ONLY supernatural, psychological, action horror or thrillers. No comedy or fluffy romance.
4. No duplicates.

Return a JSON object containing the recommendations array under the key "recommendations".
Format:
{
  "recommendations": [
    { "title": "Inception", "media_type": "movie" },
    ...
  ]
}
JSON only.`;

          const response = await gemini.models.generateContent({
            model: "gemini-3.5-flash",
            contents: prompt,
            config: {
              responseMimeType: "application/json",
              responseSchema: {
                type: Type.OBJECT,
                properties: {
                  recommendations: {
                    type: Type.ARRAY,
                    items: {
                      type: Type.OBJECT,
                      properties: {
                        title: { type: Type.STRING },
                        media_type: { type: Type.STRING }
                      },
                      required: ["title", "media_type"]
                    }
                  }
                },
                required: ["recommendations"]
              }
            }
          });

          const data = JSON.parse(response.candidates?.[0]?.content?.parts?.[0]?.text || "{}");
          rawRecs = data.recommendations || [];
        } catch (err) {
          handleGeminiError(err, "similar-recommender");
        }
      }

      // If Gemini did not suggest enough or failed, create high-fidelity fallbacks matching the genre
      if (rawRecs.length === 0) {
        const itemGenreIds = itemGenres.split(",").map(g => g.trim().toLowerCase());
        const matched = CINEMATIC_CATALOG.filter(x => {
          if (x.id === Number(itemID)) return false;
          // match by genre
          const xGenres = (x.genres || []).map((g: any) => (typeof g === "string" ? g : g.name || "").toLowerCase());
          return xGenres.some(g => itemGenreIds.includes(g));
        });
        const pool = matched.length > 0 ? matched : CINEMATIC_CATALOG.filter(x => x.id !== Number(itemID));
        rawRecs = pool.map(x => ({ title: x.title || x.name, media_type: x.media_type }));
      }

      // TMDB Validation & Enrichment
      const tmdbKey = process.env.TMDB_API_KEY;
      const verifiedItems: any[] = [];
      const seenIds = new Set<number>();

      if (tmdbKey && tmdbKey !== "MY_TMDB_API_KEY" && tmdbKey.trim() !== "") {
        // Parallel multi-search resolution with limit
        const batch = rawRecs.slice(0, 30);
        const searchPromises = batch.map(async (rec) => {
          try {
            const queryName = encodeURIComponent(rec.title);
            const searchUrl = `https://api.themoviedb.org/3/search/multi?api_key=${tmdbKey}&query=${queryName}`;
            const res = await fetch(searchUrl);
            if (res.ok) {
              const sData = await res.json();
              if (sData.results && sData.results.length > 0) {
                // Find first result of matching media type or closest
                let bestMatch = sData.results.find((r: any) => r.media_type === rec.media_type);
                if (!bestMatch) bestMatch = sData.results[0];

                if (bestMatch && !seenIds.has(bestMatch.id) && bestMatch.id !== Number(itemID)) {
                  seenIds.add(bestMatch.id);
                  return {
                    id: bestMatch.id,
                    title: bestMatch.title || bestMatch.name,
                    name: bestMatch.title || bestMatch.name,
                    poster_path: bestMatch.poster_path,
                    backdrop_path: bestMatch.backdrop_path,
                    vote_average: bestMatch.vote_average || 8.0,
                    release_date: bestMatch.release_date || bestMatch.first_air_date || "2024",
                    media_type: bestMatch.media_type || rec.media_type || "movie",
                    overview: bestMatch.overview || ""
                  };
                }
              }
            }
          } catch (_) {}
          return null;
        });

        const resolved = await Promise.all(searchPromises);
        resolved.forEach(item => {
          if (item) verifiedItems.push(item);
        });
      }

      // Fill remaining items or create fallback items matching the requested titles
      if (verifiedItems.length < 12) {
        rawRecs.forEach((rec, idx) => {
          const mockId = 9900000 + (Number(itemID) % 1000) * 100 + idx;
          if (mockId !== Number(itemID) && !seenIds.has(mockId)) {
            // Find a cinematic catalog item with the same genre or random
            const catItem = CINEMATIC_CATALOG[idx % CINEMATIC_CATALOG.length];
            verifiedItems.push({
              id: mockId,
              title: rec.title,
              name: rec.title,
              poster_path: catItem.poster_path,
              backdrop_path: catItem.backdrop_path,
              vote_average: Number((7.2 + (idx % 5) * 0.4).toFixed(1)),
              release_date: "2024",
              media_type: rec.media_type || "movie",
              overview: `An elegant and compelling visual journey recommended specifically based on your flavor profile.`
            });
            seenIds.add(mockId);
          }
        });
      }

      validatedList = verifiedItems;
      similarCache.set(cacheKey, validatedList);
    }

    // Paginate: slice of 12 items per page
    const pageSize = 12;
    const startIdx = (pageNum - 1) * pageSize;
    const endIdx = pageNum * pageSize;
    const results = validatedList.slice(startIdx, endIdx);

    return res.json({
      results,
      page: pageNum,
      total_pages: Math.ceil(validatedList.length / pageSize),
      total_results: validatedList.length
    });
  } catch (err: any) {
    console.error("Error in /api/similar endpoint:", err);
    return res.json({ results: [], page: 1 });
  }
});

// Reusable TMDB API endpoint supporting actual API keys and fallback database with rich trailer, runtimes, cast lists
app.get("/api/tmdb", async (req, res) => {
  try {
    const { path: route, query, id, type, page, with_genres, with_original_language, sort_by, vote_average_gte, vote_count_lte, vote_count_gte, personalizationScores, guestInteractions, season_number } = req.query;
  const tmdbKey = process.env.TMDB_API_KEY;
  const pageParam = page ? `&page=${page}` : '';

  // Parse incoming user personalization context
  let parsedScores = {};
  let parsedGuest = [];
  try {
    if (typeof personalizationScores === 'string') {
      parsedScores = JSON.parse(personalizationScores);
    }
  } catch (_) {}
  try {
    if (typeof guestInteractions === 'string') {
      parsedGuest = JSON.parse(guestInteractions);
    }
  } catch (_) {}

  if (tmdbKey && tmdbKey !== "MY_TMDB_API_KEY" && tmdbKey.trim() !== "") {
    try {
      let url = "";
      if (route === "trending") {
        url = `https://api.themoviedb.org/3/trending/all/week?api_key=${tmdbKey}${pageParam}`;
      } else if (route === "movie_popular") {
        url = `https://api.themoviedb.org/3/movie/popular?api_key=${tmdbKey}${pageParam}`;
      } else if (route === "movie_top_rated") {
        url = `https://api.themoviedb.org/3/movie/top_rated?api_key=${tmdbKey}${pageParam}`;
      } else if (route === "tv_popular") {
        url = `https://api.themoviedb.org/3/tv/popular?api_key=${tmdbKey}${pageParam}`;
      } else if (route === "tv_top_rated") {
        url = `https://api.themoviedb.org/3/tv/top_rated?api_key=${tmdbKey}${pageParam}`;
      } else if (route === "upcoming") {
        url = `https://api.themoviedb.org/3/movie/upcoming?api_key=${tmdbKey}${pageParam}`;
      } else if (route === "anime") {
        url = `https://api.themoviedb.org/3/discover/movie?api_key=${tmdbKey}&with_genres=16&sort_by=popularity.desc${pageParam}`;
      } else if (route === "discover") {
        const genres = with_genres ? `&with_genres=${with_genres}` : "";
        const lang = with_original_language ? `&with_original_language=${with_original_language}` : "";
        const sort = sort_by ? `&sort_by=${sort_by}` : "&sort_by=popularity.desc";
        const minVote = vote_average_gte ? `&vote_average.gte=${vote_average_gte}` : "";
        const maxCount = vote_count_lte ? `&vote_count.lte=${vote_count_lte}` : "";
        const minCount = vote_count_gte ? `&vote_count.gte=${vote_count_gte}` : "";
        url = `https://api.themoviedb.org/3/discover/movie?api_key=${tmdbKey}${pageParam}${genres}${lang}${sort}${minVote}${maxCount}${minCount}`;
      } else if (route === "search") {
        url = `https://api.themoviedb.org/3/search/multi?api_key=${tmdbKey}&query=${encodeURIComponent(String(query || ""))}${pageParam}`;
      } else if (route === "details") {
        url = `https://api.themoviedb.org/3/${type}/${id}?api_key=${tmdbKey}&append_to_response=videos,credits,similar,recommendations,watch/providers`;
      } else if (route === "season") {
        const sNum = season_number || "1";
        url = `https://api.themoviedb.org/3/tv/${id}/season/${sNum}?api_key=${tmdbKey}`;
      }

      if (url) {
        console.log("TMDB Proxy: Requesting live route ->", route);
        const response = await fetch(url);
        if (response.ok) {
          const data = await response.json();
          if (data && Array.isArray(data.results)) {
            data.results = personalizeAndRerankList(data.results, parsedScores, parsedGuest);
          }
          return res.json(data);
        }
      }
    } catch (err) {
      console.log("Live TMDB Request Failed, operating in fully functional fallback mode.");
    }
  }

  // Pure Minimal High-Fidelity Fallback Logic matching TMDB API signatures perfectly with on-the-fly user personalization
  console.log("TMDB Proxy: Serving high-fidelity fallback data for route ->", route);

  if (route === "trending") {
    const personalized = personalizeAndRerankList(CINEMATIC_CATALOG, parsedScores, parsedGuest);
    return res.json({ results: personalized.slice(0, 10), page: 1 });
  }

  if (route === "movie_popular") {
    const movies = CINEMATIC_CATALOG.filter(item => item.media_type === "movie");
    const personalized = personalizeAndRerankList(movies, parsedScores, parsedGuest);
    return res.json({ results: personalized.slice(0, 8), page: 1 });
  }

  if (route === "movie_top_rated") {
    const moviesSorted = [...CINEMATIC_CATALOG]
      .filter(item => item.media_type === "movie")
      .sort((a, b) => b.vote_average - a.vote_average);
    const personalized = personalizeAndRerankList(moviesSorted, parsedScores, parsedGuest);
    return res.json({ results: personalized.slice(0, 8), page: 1 });
  }

  if (route === "tv_popular") {
    const tvs = CINEMATIC_CATALOG.filter(item => item.media_type === "tv");
    const personalized = personalizeAndRerankList(tvs, parsedScores, parsedGuest);
    return res.json({ results: personalized.slice(0, 8), page: 1 });
  }

  if (route === "tv_top_rated") {
    const tvsSorted = [...CINEMATIC_CATALOG]
      .filter(item => item.media_type === "tv")
      .sort((a, b) => b.vote_average - a.vote_average);
    const personalized = personalizeAndRerankList(tvsSorted, parsedScores, parsedGuest);
    return res.json({ results: personalized.slice(0, 8), page: 1 });
  }

  if (route === "upcoming") {
    const upcoming = CINEMATIC_CATALOG.filter(item => {
      const yr = item.release_date || item.first_air_date || "";
      return yr.startsWith("2024") || yr.startsWith("2023");
    });
    const personalized = personalizeAndRerankList(upcoming, parsedScores, parsedGuest);
    return res.json({ results: personalized.slice(0, 8), page: 1 });
  }

  if (route === "anime") {
    const animeList = CINEMATIC_CATALOG.filter(item => item.genre_ids.includes(16));
    const personalized = personalizeAndRerankList(animeList, parsedScores, parsedGuest);
    return res.json({ results: personalized.slice(0, 8), page: 1 });
  }

  // Additional dynamic fallbacks for custom JIOHOTSTAR categories
  if (route === "discover") {
    let list: any[] = [];
    if (with_original_language === "hi") {
      // Indian Hits fallback
      list = [
        {
          id: 110001,
          title: "Jawan",
          overview: "A high-octane action thriller which outlines the emotional journey of a man who is set to rectify the wrongs in the society, starring Shah Rukh Khan in a massive double role.",
          poster_path: "https://images.unsplash.com/photo-1594909122845-11baa439b7bf?auto=format&fit=crop&w=500&q=80",
          backdrop_path: "https://images.unsplash.com/photo-1594909122845-11baa439b7bf?auto=format&fit=crop&w=1200&q=80",
          release_date: "2023-09-07",
          vote_average: 8.4,
          media_type: "movie",
          genre_ids: [28, 53],
          original_language: "hi"
        },
        {
          id: 110002,
          title: "3 Idiots",
          overview: "Two friends are searching for their long lost companion. They revisit their college days and recall the memories of their friend who inspired them to think differently.",
          poster_path: "https://images.unsplash.com/photo-1492691527719-9d1e07e534b4?auto=format&fit=crop&w=500&q=80",
          backdrop_path: "https://images.unsplash.com/photo-1492691527719-9d1e07e534b4?auto=format&fit=crop&w=1200&q=80",
          release_date: "2009-12-25",
          vote_average: 8.8,
          media_type: "movie",
          genre_ids: [35, 18],
          original_language: "hi"
        },
        {
          id: 110003,
          title: "Dangal",
          overview: "The story of Mahavir Singh Phogat, who taught wrestling to his daughters Geeta Phogat and Babita Kumari, who went on to win gold medals. A premium cinematic experience.",
          poster_path: "https://images.unsplash.com/photo-1542204172-e7052809a936?auto=format&fit=crop&w=500&q=80",
          backdrop_path: "https://images.unsplash.com/photo-1509198397868-475647b2a1e5?auto=format&fit=crop&w=1200&q=80",
          release_date: "2016-12-23",
          vote_average: 8.6,
          media_type: "movie",
          genre_ids: [18, 10751],
          original_language: "hi"
        }
      ];
    } else if (with_original_language === "te" || with_original_language === "ta") {
      // South Indian fallback
      list = [
        {
          id: 110004,
          title: "RRR (Rise Roar Revolt)",
          overview: "A fictional history tale of two legendary revolutionaries and their journey away from home before they started fighting for their country in the 1920s.",
          poster_path: "https://images.unsplash.com/photo-148546234645-a62644f84728?auto=format&fit=crop&w=500&q=80",
          backdrop_path: "https://images.unsplash.com/photo-1594909122845-11baa439b7bf?auto=format&fit=crop&w=1200&q=80",
          release_date: "2022-03-24",
          vote_average: 8.5,
          media_type: "movie",
          genre_ids: [28, 18],
          original_language: "te"
        },
        {
          id: 110005,
          title: "Baahubali: The Conclusion",
          overview: "When Shiva, the son of Bahubali, learns about his heritage, he begins to look for answers. His story is juxtaposed with past events that unfolded in the Mahishmati Kingdom.",
          poster_path: "https://images.unsplash.com/photo-1534447677768-be436bb09401?auto=format&fit=crop&w=500&q=80",
          backdrop_path: "https://images.unsplash.com/photo-1534447677768-be436bb09401?auto=format&fit=crop&w=1200&q=80",
          release_date: "2017-04-28",
          vote_average: 8.7,
          media_type: "movie",
          genre_ids: [28, 14, 18],
          original_language: "te"
        },
        {
          id: 110006,
          title: "Kantara",
          overview: "In a village bordering a dense forest, a mystical traditional dance triggers a fierce conflict between a landlord, a rebel hero, and a forest officer.",
          poster_path: "https://images.unsplash.com/photo-1506703719100-a0f3a48c0f86?auto=format&fit=crop&w=500&q=80",
          backdrop_path: "https://images.unsplash.com/photo-1506703719100-a0f3a48c0f86?auto=format&fit=crop&w=1200&q=80",
          release_date: "2022-09-30",
          vote_average: 8.4,
          media_type: "movie",
          genre_ids: [18, 53, 14],
          original_language: "kn"
        }
      ];
    } else if (with_genres === "878") {
      // Sci-Fi fallback
      list = CINEMATIC_CATALOG.filter(x => x.genre_ids?.includes(878));
      if (list.length === 0) {
        list = [
          {
            id: 110007,
            title: "Interstellar",
            overview: "A team of explorers travel through a wormhole in space in an attempt to ensure humanity's survival under severe global atmospheric crises.",
            poster_path: "https://images.unsplash.com/photo-1506703719100-a0f3a48c0f86?auto=format&fit=crop&w=500&q=80",
            backdrop_path: "https://images.unsplash.com/photo-1506703719100-a0f3a48c0f86?auto=format&fit=crop&w=1200&q=80",
            release_date: "2014-11-07",
            vote_average: 8.9,
            media_type: "movie",
            genre_ids: [878, 18, 12]
          },
          ...CINEMATIC_CATALOG.slice(0, 3)
        ];
      }
    } else if (with_genres === "53" || with_genres === "80") {
      // Thrillers
      list = [
        {
          id: 110010,
          title: "The Dark Knight",
          overview: "When the menace known as the Joker wreaks havoc and chaos on the people of Gotham, Batman must accept one of the greatest psychological and physical tests of his ability.",
          poster_path: "https://images.unsplash.com/photo-1534447677768-be436bb09401?auto=format&fit=crop&w=500&q=80",
          backdrop_path: "https://images.unsplash.com/photo-1534447677768-be436bb09401?auto=format&fit=crop&w=1200&q=80",
          release_date: "2008-07-18",
          vote_average: 9.0,
          media_type: "movie",
          genre_ids: [28, 80, 53]
        },
        {
          id: 110011,
          title: "Prisoners",
          overview: "When Keller Dover's daughter and her friend go missing, he takes matters into his own hands as the police pursue multiple leads and the pressure mounts.",
          poster_path: "https://images.unsplash.com/photo-1509198397868-475647b2a1e5?auto=format&fit=crop&w=500&q=80",
          backdrop_path: "https://images.unsplash.com/photo-1509198397868-475647b2a1e5?auto=format&fit=crop&w=1200&q=80",
          release_date: "2013-09-20",
          vote_average: 8.2,
          media_type: "movie",
          genre_ids: [18, 53, 9648]
        }
      ];
    } else {
      // General fallbacks
      list = customShuffle(CINEMATIC_CATALOG).slice(0, 8);
    }
    
    const personalizedList = personalizeAndRerankList(list, parsedScores, parsedGuest);
    // Map list items correctly to client schema
    const results = personalizedList.map(x => ({
      ...x,
      title: x.title || x.name,
      name: x.title || x.name,
      poster_path: x.poster_path,
      backdrop_path: x.backdrop_path,
      vote_average: x.vote_average || 8.0,
      release_date: x.release_date || x.first_air_date || '2024'
    }));
    return res.json({ results, page: Number(page || 1) });
  }

  if (route === "search") {
    const q = String(query || "").toLowerCase();
    const filtered = CINEMATIC_CATALOG.filter(item => {
      const matchTitle = (item.title || "").toLowerCase().includes(q);
      const matchName = (item.name || "").toLowerCase().includes(q);
      const matchOverview = (item.overview || "").toLowerCase().includes(q);
      return matchTitle || matchName || matchOverview;
    });
    return res.json({ results: filtered, page: 1 });
  }

  if (route === "details") {
    const searchId = Number(id);
    const item = CINEMATIC_CATALOG.find(x => x.id === searchId);
    if (item) {
      // Map to full detail format resembling TMDB details completely
      const isTv = item.media_type === "tv" || !item.release_date;
      const mappedDetails = {
        ...item,
        genres: item.genres,
        backdrop_path: item.backdrop_path,
        poster_path: item.poster_path,
        status: isTv ? "Returning Series" : "Released",
        tagline: isTv ? "Secrets bury deeper in the dark." : "A masterclass in cinema storytelling.",
        original_language: "en",
        popularity: item.vote_count ? (item.vote_count / 10).toFixed(1) : "95.5",
        original_title: item.title || item.name,
        // specific to Movie:
        budget: isTv ? 0 : 150000000,
        revenue: isTv ? 0 : 450000000,
        belongs_to_collection: isTv ? null : { name: `${item.title || item.name} Collection` },
        production_countries: [{ iso_3166_1: "US", name: "United States" }],
        // specific to TV:
        first_air_date: item.first_air_date || item.release_date || "2015-06-01",
        last_air_date: isTv ? "2023-11-15" : null,
        type: isTv ? "Scripted" : null,
        networks: isTv ? [{ name: "HBO" }, { name: "Netflix" }] : [],
        created_by: isTv ? [{ name: item.director || "Vince Gilligan" }] : [],
        production_companies: [{ name: "Sony Pictures Television" }, { name: "Warner Bros. Television" }],
        number_of_seasons: isTv ? 5 : 0,
        number_of_episodes: isTv ? 62 : 0,
        episode_run_time: isTv ? [item.runtime || 47] : [],
        seasons: isTv ? [
          { season_number: 1, episode_count: 7, name: "Season 1" },
          { season_number: 2, episode_count: 10, name: "Season 2" },
          { season_number: 3, episode_count: 10, name: "Season 3" },
          { season_number: 4, episode_count: 10, name: "Season 4" },
          { season_number: 5, episode_count: 16, name: "Season 5" }
        ] : [],
        credits: {
          cast: (item.cast || "").split(", ").map((c, i) => ({
            id: i,
            name: c,
            character: `Star ${i + 1}`,
            profile_path: null
          })),
          crew: [
            {
              id: 99,
              name: item.director,
              job: "Director"
            }
          ]
        },
        videos: {
          results: item.youtube_id ? [
            {
              id: "v_id",
              key: item.youtube_id,
              name: "Official Trailer",
              site: "YouTube",
              type: "Trailer"
            }
          ] : []
        },
        similar: {
          results: CINEMATIC_CATALOG.filter(x => x.id !== searchId).slice(0, 4)
        }
      };
      return res.json(mappedDetails);
    }
    return res.status(404).json({ error: "Details not found in fallback collection." });
  }

  if (route === "season") {
    const searchId = Number(id);
    const sNum = Number(season_number || 1);
    const item = CINEMATIC_CATALOG.find(x => x.id === searchId);
    
    const epCount = sNum === 1 ? 10 : sNum === 2 ? 8 : 6;
    const episodes = [];
    const showName = item ? (item.title || item.name) : "Series";
    
    for (let i = 1; i <= epCount; i++) {
      episodes.push({
        id: (searchId * 1000) + (sNum * 100) + i,
        episode_number: i,
        name: `${showName} Ep. ${i}: Pilot / Climax`,
        overview: `A deep, high-stakes exploration into the lives and unfolding mysteries of our main characters. Tension escalates as secrets are unveiled and alliances are tested.`,
        vote_average: (8.0 + (i % 3) * 0.4 + (sNum % 2) * 0.2).toFixed(1),
        air_date: `2024-0${sNum}-1${i}`,
        runtime: item?.runtime || 45,
        still_path: null
      });
    }

    return res.json({
      id: (searchId * 10) + sNum,
      name: `Season ${sNum}`,
      season_number: sNum,
      episodes: episodes,
      poster_path: item?.poster_path || null
    });
  }

    return res.status(400).json({ error: "Invalid path requested." });
  } catch (err: any) {
    console.error("Critical error inside /api/tmdb API: ", err);
    return res.json({ results: CINEMATIC_CATALOG.slice(0, 10), page: 1, isFallback: true });
  }
});

// Aesthetic banner proxies based on genres to make sure visual card items always look cinematic
function getUnsplashFallback(genres: string[], type: string): string {
  const g = genres.map(x => x.toLowerCase());
  if (g.includes("scifi") || g.includes("sci-fi") || g.includes("space")) {
    return "https://images.unsplash.com/photo-1506703719100-a0f3a48c0f86?auto=format&fit=crop&w=400&q=80";
  }
  if (g.includes("horror") || g.includes("mystery") || g.includes("thriller")) {
    return "https://images.unsplash.com/photo-1534447677768-be436bb09401?auto=format&fit=crop&w=400&q=80";
  }
  if (g.includes("anime") || type === "anime") {
    return "https://images.unsplash.com/photo-1542204172-e7052809a936?auto=format&fit=crop&w=400&q=80";
  }
  if (g.includes("drama") || g.includes("romance")) {
    return "https://images.unsplash.com/photo-1492691527719-9d1e07e534b4?auto=format&fit=crop&w=400&q=80";
  }
  if (g.includes("action") || g.includes("adventure") || g.includes("crime")) {
    return "https://images.unsplash.com/photo-1594909122845-11baa439b7bf?auto=format&fit=crop&w=400&q=80";
  }
  return "https://images.unsplash.com/photo-1485846234645-a62644f84728?auto=format&fit=crop&w=400&q=80";
}

// Global reference for catalog shuffles
const CURATED_SANDBOX_CATALOG = CINEMATIC_CATALOG;

// API: Advanced Dynamic Unified Homepage Generator (Netflix/YouTube styled intelligent discovery)
app.post("/api/homepage", async (req, res) => {
  try {
    let { watchlist = [], ratings = [], profile = {}, personalizationScores = {}, recentInteractions = [], seed = "" } = req.body;
  if (!profile) profile = {};
  if (!watchlist) watchlist = [];
  if (!ratings) ratings = [];
  if (!personalizationScores) personalizationScores = {};
  if (!recentInteractions) recentInteractions = [];
  const tmdbKey = process.env.TMDB_API_KEY;
  const ai = getGemini();

  let hasLiveTMDB = false;
  let allMedia: any[] = [];

  // 1. Fetch catalog options from TMDB if active, otherwise fallback to local rich mock database
  if (tmdbKey && tmdbKey !== "MY_TMDB_API_KEY" && tmdbKey.trim() !== "") {
    try {
      console.log("Homepage: Fetching live selections from TMDB...");
      const [trendingRes, seriesRes, upcomingRes, animeRes] = await Promise.all([
        fetch(`https://api.themoviedb.org/3/trending/all/week?api_key=${tmdbKey}`).then(r => r.json()),
        fetch(`https://api.themoviedb.org/3/tv/popular?api_key=${tmdbKey}`).then(r => r.json()),
        fetch(`https://api.themoviedb.org/3/movie/upcoming?api_key=${tmdbKey}`).then(r => r.json()),
        fetch(`https://api.themoviedb.org/3/discover/movie?api_key=${tmdbKey}&with_genres=16&sort_by=popularity.desc`).then(r => r.json())
      ]);

      const trendingResults = trendingRes.results || [];
      const seriesResults = seriesRes.results || [];
      const upcomingResults = upcomingRes.results || [];
      const animeResults = animeRes.results || [];

      const prepItems = (items: any[], typeSuffix: string) => items.map(x => {
        const titleName = x.title || x.name || "Cinematic Epic";
        return {
          id: x.id,
          title: titleName,
          name: titleName,
          overview: x.overview || "Join the interactive lounge to review or update watch logs.",
          poster_path: x.poster_path ? `https://image.tmdb.org/t/p/w500${x.poster_path}` : "",
          backdrop_path: x.backdrop_path ? `https://image.tmdb.org/t/p/original${x.backdrop_path}` : "",
          vote_average: x.vote_average || 8.0,
          release_date: x.release_date || x.first_air_date || "2024",
          first_air_date: x.first_air_date || x.release_date || "2024",
          media_type: typeSuffix,
          genres: x.genre_ids ? x.genre_ids.map((id: number) => String(id)) : ["Drama"],
          providers: ["Netflix", "Apple TV", "Max", "Prime Video", "Crunchyroll"].slice(0, Math.floor(Math.random() * 3) + 1)
        };
      });

      const trendingList = prepItems(trendingResults, "movie");
      const seriesList = prepItems(seriesResults, "tv");
      const upcomingList = prepItems(upcomingResults, "movie");
      const animeList = prepItems(animeResults, "movie");

      const combined = [...trendingList, ...seriesList, ...upcomingList, ...animeList];
      const seenIds = new Set();
      allMedia = [];
      for (const item of combined) {
        if (item && item.id !== undefined && item.id !== null) {
          if (!seenIds.has(item.id)) {
            seenIds.add(item.id);
            allMedia.push(item);
          }
        }
      }
      hasLiveTMDB = true;
    } catch (err) {
      console.log("Failed to load live TMDB for Homepage, falling back to local cinematic catalog.");
    }
  }

  if (!hasLiveTMDB) {
    allMedia = CINEMATIC_CATALOG.map((x: any) => ({
      ...x,
      name: x.title,
      vote_average: x.vote_average || 8.5,
      release_date: x.release_date || x.year || "2024",
      first_air_date: x.first_air_date || x.year || "2024",
      media_type: x.media_type || (x.type === "series" ? "tv" : "movie"),
      poster_path: x.poster_path,
      backdrop_path: x.backdrop_path
    }));
  }

  // Filter categories
  const movies = allMedia.filter((x: any) => x.media_type === "movie" || x.type === "movie");
  const tvShows = allMedia.filter((x: any) => x.media_type === "tv" || x.type === "series");
  const animations = allMedia.filter((x: any) => x.type === "anime" || (x.genres && x.genres.includes("Anime")) || (x.genre_ids && x.genre_ids.includes(16)));

  const shuffledTrending = customShuffle(allMedia).slice(0, 8);
  const shuffledSeries = customShuffle(tvShows.length > 0 ? tvShows : allMedia).slice(0, 8);
  const shuffledAnime = customShuffle(animations.length > 0 ? animations : allMedia).slice(0, 8);
  const shuffledHero = customShuffle(allMedia).slice(0, 5);

  return res.json({
    hero: shuffledHero,
    trending: shuffledTrending,
    web_series: shuffledSeries,
    anime: shuffledAnime,
    isFallback: !ai
  });
} catch (err: any) {
  console.error("Critical error in /api/homepage handler: ", err);
  const tvShows = CINEMATIC_CATALOG.filter(x => x && x.media_type === "tv");
  return res.json({
    hero: CINEMATIC_CATALOG.slice(0, 5),
    trending: CINEMATIC_CATALOG.slice(0, 8),
    web_series: tvShows.slice(0, 8),
    anime: CINEMATIC_CATALOG.filter(x => x && x.genre_ids && x.genre_ids.includes(16)).slice(0, 8),
    isFallback: true
  });
}
});

app.post("/api/discover", async (req, res) => {
  try {
    const {
      prompt,
      filters,
      page = 1,
      tmdbParams, // Re-supplied by client for pagination
      seenTmdbIds = []
    } = req.body;

    const tmdbKey = process.env.TMDB_API_KEY;
    const ai = getGemini();

    let searchParams = tmdbParams || {};
    
    let validationCriteria: any = null;

    // Step 1: Gemini parses intent IF page 1 and no tmdbParams provided
    if (page === 1 && !tmdbParams && ai && (prompt || (filters && Object.keys(filters).length > 0))) {
      const systemPrompt = `You are an advanced cinematic search intent analyzer configuring a strict search pipeline.
Extract the user's intent from their text prompt AND selected UI filters. 
You must output a JSON object with TWO parts:
1) "tmdb": The exact query parameters to send to the TMDB API.
2) "validation": Strict rules that EVERY returned result MUST pass to be shown to the user.

CRITICAL TMDB RULES:
- NEVER output a "query" parameter unless the user is specifically trying to find a named movie/show (e.g. "The Dark Knight"). If they ask for "indian web series", "korean thrillers", "space movies", use "with_genres", "with_origin_country", "with_original_language". Using "query" breaks TMDB discovery!
- "content_type": MUST be exactly one of: "movie" | "tv" | "multi"
- "with_genres": comma-separated genre IDs (infer them based on text)
- "with_original_language": ISO-639-1 code (e.g., "hi" for Hindi/Indian, "ko" for Korean, "en" for English)
- "with_origin_country": ISO-3166-1 code (e.g., "IN" for India, "KR" for South Korea, "US" for USA)
- "primary_release_year": "YYYY"
- "first_air_date_year": "YYYY" (for tv)
- "sort_by": string

Validation parameters (STRICT limits to filter TMDB results):
- "allowedCountries": array of country codes (e.g. ["IN"]) - empty if any country is allowed.
- "allowedLanguages": array of language codes (e.g. ["hi", "ta", "te", "ml"]) - empty if any language.
- "allowedTypes": array of types (e.g. ["tv"]) - empty if any.
- "minYear": integer or null
- "maxYear": integer or null

Example for "Indian top web series":
{
  "tmdb": {
    "content_type": "tv",
    "with_origin_country": "IN",
    "with_original_language": "hi",
    "sort_by": "vote_average.desc",
    "vote_count.gte": 100
  },
  "validation": {
    "allowedCountries": ["IN"],
    "allowedLanguages": ["hi", "ta", "te", "ml", "bn", "kn"],
    "allowedTypes": ["tv"],
    "minYear": null,
    "maxYear": null
  }
}

Output ONLY valid JSON matching this schema.`;

      try {
        const aiResponse = await generateContentWithRetry(ai, {
          model: "gemini-3.5-flash",
          contents: `User Prompt: "${prompt}"\nExplicit Filters: ${JSON.stringify(filters)}\n\nOnly output valid JSON.`,
          config: {
            systemInstruction: systemPrompt,
            responseMimeType: "application/json"
          }
        });
        
        if (aiResponse.text) {
           const parsed = JSON.parse(aiResponse.text);
           searchParams = parsed.tmdb || parsed;
           validationCriteria = parsed.validation || null;
           console.log("[Search Engine] Gemini Structured Query:", JSON.stringify(parsed));
        }
      } catch (e: any) {
        handleGeminiError(e, "discover-intent-parse");
        searchParams = {
          content_type: filters?.contentTypes?.[0] === "Series" ? "tv" : "movie",
          sort_by: "popularity.desc"
        };
      }
    } else if (tmdbParams) {
       searchParams = tmdbParams.tmdb || tmdbParams;
       validationCriteria = tmdbParams.validation || null;
    } else if (!tmdbParams && !prompt) {
      searchParams = {
        content_type: filters?.contentTypes?.[0] === "Series" ? "tv" : "movie",
        sort_by: "popularity.desc"
      };
    }

    // Step 2 & 3: TMDB Fetches Results
    let results: any[] = [];
    let queryParams = new URLSearchParams();
    queryParams.append("page", String(page));
    queryParams.append("include_adult", filters?.adult ? "true" : "false");
    
    if (searchParams.sort_by) queryParams.append("sort_by", searchParams.sort_by);
    if (searchParams.with_genres) queryParams.append("with_genres", searchParams.with_genres);
    if (searchParams.primary_release_year) queryParams.append("primary_release_year", searchParams.primary_release_year);
    if (searchParams.first_air_date_year) queryParams.append("first_air_date_year", searchParams.first_air_date_year);
    if (searchParams.with_original_language) queryParams.append("with_original_language", searchParams.with_original_language);
    if (searchParams.with_origin_country) queryParams.append("with_origin_country", searchParams.with_origin_country);

    if (tmdbKey && tmdbKey !== "MY_TMDB_API_KEY") {
      let endpoint = "discover/movie";
      if (searchParams.content_type === "tv") endpoint = "discover/tv";
      
      if (searchParams.query || filters?.title) {
         endpoint = searchParams.content_type === "tv" ? "search/tv" : searchParams.content_type === "movie" ? "search/movie" : "search/multi";
         queryParams.append("query", searchParams.query || filters?.title);
      }
      
      const tmdbUrl = `https://api.themoviedb.org/3/${endpoint}?api_key=${tmdbKey}&${queryParams.toString()}`;
      console.log("[Search Logic] TMDB Request:", tmdbUrl);

      const tmdbRes = await fetch(tmdbUrl);
      if (tmdbRes.ok) {
        const tmdbData = await tmdbRes.json();
        console.log(`[Search Logic] TMDB Response Count: ${tmdbData.results?.length || 0}`);
        results = tmdbData.results || [];
        
        results = results.map((item: any) => ({
          id: String(item.id),
          title: item.title || item.name,
          release_date: item.release_date || item.first_air_date,
          overview: item.overview,
          poster_path: item.poster_path,
          backdrop_path: item.backdrop_path,
          vote_average: item.vote_average,
          media_type: item.media_type || (endpoint.includes("tv") ? "tv" : "movie"),
          genre_ids: item.genre_ids,
          original_language: item.original_language,
          origin_country: item.origin_country || []
        }));
      }
    } else {
       // Sandbox fallback
       results = CURATED_SANDBOX_CATALOG.slice((page-1)*20, page*20);
    }
    
    // Step 4: Strict Post Validation & Deduplication
    let rejectedCount = 0;
    
    if (results.length > 0) {
      results = results.filter((item) => {
        let isValid = true;

        if (seenTmdbIds && seenTmdbIds.includes(String(item.id))) {
           rejectedCount++;
           return false;
        }
        
        if (validationCriteria) {
          // Allowed Types
          if (validationCriteria.allowedTypes?.length > 0) {
            if (!validationCriteria.allowedTypes.includes(item.media_type)) isValid = false;
          }
          
          // Allowed Languages
          if (isValid && validationCriteria.allowedLanguages?.length > 0) {
            if (!validationCriteria.allowedLanguages.includes(item.original_language)) isValid = false;
          }
          
          // Allowed Countries
          if (isValid && validationCriteria.allowedCountries?.length > 0) {
            let foundCountry = false;
            const targetCountries = validationCriteria.allowedCountries;
            if (item.origin_country && Array.isArray(item.origin_country)) {
               foundCountry = item.origin_country.some((oc: string) => targetCountries.includes(oc));
            }
            if (!foundCountry) {
              const langMap: Record<string, string> = { "ko": "KR", "hi": "IN", "ja": "JP", "ta": "IN", "te": "IN", "ml": "IN" };
              if (item.original_language && targetCountries.includes(langMap[item.original_language])) {
                foundCountry = true;
              }
            }
            
            if (!foundCountry) isValid = false;
          }
          
          // Release Year
          if (isValid && item.release_date) {
             const y = parseInt(item.release_date.substring(0, 4), 10);
             if (validationCriteria.minYear && y < validationCriteria.minYear) isValid = false;
             if (validationCriteria.maxYear && y > validationCriteria.maxYear) isValid = false;
          }
        }

        if (!isValid) rejectedCount++;
        return isValid;
      });
    }

    console.log(`[Search Logic] Validated Results Count: ${results.length} | Rejected: ${rejectedCount}`);

    // Step 5: Result Quality Scoring (Intelligent Reranking) IF there's a natural language prompt
    if (page === 1 && prompt && ai && results.length > 0 && tmdbKey && tmdbKey !== "MY_TMDB_API_KEY") {
       try {
         const rerankSystemPrompt = `You are a cinematic content curator. Score and rerank the provided JSON array of TMDB results based strictly on how well they match the exact user prompt: "${prompt}". 
         
Output a JSON array of objects containing the "id" of the movie/series and a "score" from 0 to 100.
Do not output anything else.
Example:
[
  { "id": "123", "score": 98 },
  { "id": "456", "score": 10 }
]`;
         const resultsSlice = results.slice(0, 20).map(x => ({id: x.id, title: x.title, overview: x.overview}));
         
         const rerankResponse = await generateContentWithRetry(ai, {
            model: "gemini-3.5-flash",
            contents: `User Prompt: ${prompt}\nResults to score: ${JSON.stringify(resultsSlice)}`,
            config: {
              systemInstruction: rerankSystemPrompt,
              responseMimeType: "application/json"
            }
         });
         
         if (rerankResponse.text) {
            const rankings = JSON.parse(rerankResponse.text) as {id: string | number, score: number}[];
            const scoreMap = new Map(rankings.map(r => [String(r.id), r.score]));
            
            // Apply scores and sort
            results.forEach(r => {
               r.match_score = scoreMap.get(String(r.id)) || 50; 
            });
            // Filter out clearly irrelevant
            results = results.filter(r => (r.match_score as number) >= 10);
            // Sort descending
            results.sort((a, b) => (b.match_score as number) - (a.match_score as number));
            
            console.log(`[Search Logic] AI Scoring Applied. Results remaining: ${results.length}`);
         }
       } catch (e: any) {
         handleGeminiError(e, "discover-rerank");
       }
    }

    return res.json({
      results,
      tmdbParams: { tmdb: searchParams, validation: validationCriteria },
      page,
      isFallback: !tmdbKey || tmdbKey === "MY_TMDB_API_KEY"
    });
  } catch (error) {
    console.error("Discover API Error:", error);
    res.status(500).json({ error: "Discovery failed", results: [], isFallback: true });
  }
});

app.post("/api/revoke-sessions", async (req, res) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const { uid } = req.body;
  if (!uid) return res.status(400).json({ error: "Missing UID" });

  try {
    if (!admin.apps.length) {
      admin.initializeApp();
    }
    
    // Verify token belongs to the UID being revoked to prevent arbitrary revocation attacks
    const idToken = authHeader.split("Bearer ")[1];
    const decodedToken = await admin.auth().verifyIdToken(idToken);
    
    if (decodedToken.uid !== uid) {
      return res.status(403).json({ error: "Forbidden: Cannot revoke other users' sessions." });
    }

    await admin.auth().revokeRefreshTokens(uid);
    return res.json({ success: true });
  } catch(e) {
    console.error("Firebase admin init/revoke error:", e);
    return res.status(401).json({ error: "Session revocation failed." });
  }
});

// Configure Vite middleware or static serving
async function bootstrap() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Cenivo Application started on http://localhost:${PORT}`);
  });
}

bootstrap();
