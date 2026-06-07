import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import { db, handleFirestoreError, OperationType } from "../lib/firebase";
import { robustFetch } from "../lib/utils";
import {
  collection,
  doc,
  setDoc,
  getDocs,
  deleteDoc,
  updateDoc,
  getDoc,
} from "firebase/firestore";
import { MovieTitle, WatchlistItem, RatingReview, UserProfile } from "../types";
import { TRENDING_RAIL_ITEMS } from "../data";
import { ACTIVE_SHELVES, SHELF_POOL } from "../lib/shelves";
import { trackInteraction } from "../lib/tracker";
import ContentRail from "./ContentRail";
import RecommendationTab from "./RecommendationTab";
import SettingsTab from "./SettingsTab";
import WatchlistView from "./WatchlistView";
import RatingsView from "./RatingsView";
import { useWatchlistStore } from "../stores/watchlistStore";
import {
  Sparkles,
  Search,
  History,
  List,
  Send,
  Loader2,
  Trash2,
  Plus,
  Play,
  CheckCircle,
  Clock,
  Star,
  RefreshCw,
  MessageSquare,
  ChevronRight,
  AlertCircle,
} from "lucide-react";

interface PersonalizedExperienceProps {
  currentUser: any;
  onOpenMovieDetails: (movie: any) => void;
  activeTab: "home" | "recommendation" | "watchlist" | "ratings" | "settings";
  onChangeTab: (
    tab: "home" | "recommendation" | "watchlist" | "ratings" | "settings",
  ) => void;
  homepageData: any;
  onRefreshHomepage: (showSpinner?: boolean) => void;
  isRefreshingHomepage: boolean;
  onSignOut?: () => void;
}

export default function PersonalizedExperience({
  currentUser,
  onOpenMovieDetails,
  activeTab,
  onChangeTab,
  homepageData,
  onRefreshHomepage,
  isRefreshingHomepage,
  onSignOut,
}: PersonalizedExperienceProps) {
  // JioHotstar Active and Inactive Shelves lists
  const [activeShelves, setActiveShelves] = useState<any[]>(
    ACTIVE_SHELVES.map((s) => ({ ...s, items: [], loading: false, page: 1 })),
  );

  const [shelfPool, setShelfPool] = useState<any[]>(
    SHELF_POOL.map((s) => ({ ...s, items: [], loading: false, page: 1 })),
  );

  const pullLockRef = React.useRef(false);
  const activatedShelfIdsRef = React.useRef<Set<string>>(
    new Set(ACTIVE_SHELVES.map((s) => s.id)),
  );

  // Fetch individual shelf content from TMDB proxy
  const fetchShelfData = async (shelfId: string, pageNum: number = 1) => {
    const shelf = [...activeShelves, ...shelfPool].find(
      (s) => s.id === shelfId,
    );
    if (!shelf) return;

    const scoresQuery = profile?.personalizationScores
      ? `&personalizationScores=${encodeURIComponent(JSON.stringify(profile.personalizationScores))}`
      : "";
    const guestLogs = localStorage.getItem("cenivo_guest_interactions") || "[]";
    let url = `/api/tmdb?path=${shelf.route}&page=${pageNum}&userId=${currentUser?.uid || ""}${scoresQuery}&guestInteractions=${encodeURIComponent(guestLogs)}`;
    if (shelf.params) {
      url += `&${shelf.params}`;
    }

    try {
      const response = await robustFetch(url);
      if (response.ok) {
        const data = await response.json();
        const results = data.results || [];
        if (results.length > 0) {
          const mapped = results.map((x: any) => ({
            ...x,
            title: x.title || x.name,
            name: x.title || x.name,
            poster_path: x.poster_path || x.posterUrl,
            backdrop_path: x.backdrop_path,
            vote_average: x.vote_average || 8.0,
            release_date: x.release_date || x.first_air_date || "2024",
          }));

          // Merge items into visible active list
          setActiveShelves((prev) =>
            prev.map((s) => {
              if (s.id === shelfId) {
                const cleanedItems =
                  pageNum === 1
                    ? mapped
                    : [
                        ...s.items,
                        ...mapped.filter(
                          (m: any) =>
                            !s.items.some(
                              (existing: any) => existing.id === m.id,
                            ),
                        ),
                      ];
                return { ...s, items: cleanedItems, page: pageNum };
              }
              return s;
            }),
          );

          // Keep copy aligned in the shelf pool
          setShelfPool((prev) =>
            prev.map((s) => {
              if (s.id === shelfId) {
                const cleanedItems =
                  pageNum === 1
                    ? mapped
                    : [
                        ...s.items,
                        ...mapped.filter(
                          (m: any) =>
                            !s.items.some(
                              (existing: any) => existing.id === m.id,
                            ),
                        ),
                      ];
                return { ...s, items: cleanedItems, page: pageNum };
              }
              return s;
            }),
          );
        }
      }
    } catch (e) {
      console.error(`Error loading shelf data of ${shelfId}:`, e);
    }
  };

  // Synchronize cached categories from App on mount
  useEffect(() => {
    if (homepageData) {
      setActiveShelves((prev) =>
        prev.map((s) => {
          let items = s.items;
          if (s.id === "trending" && homepageData.trending) {
            items = homepageData.trending;
          } else if (s.id === "anime_zone" && homepageData.anime) {
            items = homepageData.anime;
          }
          return { ...s, items };
        }),
      );
    }
  }, [homepageData]);

  // Staggered sequential lazy fetch of empty categories
  useEffect(() => {
    const fetchEmptyCategories = async () => {
      for (let i = 0; i < activeShelves.length; i++) {
        const s = activeShelves[i];
        if (s.items.length === 0) {
          await fetchShelfData(s.id, 1);
          await new Promise((r) => setTimeout(r, 45));
        }
      }
    };
    fetchEmptyCategories();
  }, [homepageData]);

  // Pull lazy categories as vertical viewport scrolls
  useEffect(() => {
    const handleScrollVerticalPool = () => {
      if (pullLockRef.current) return;

      const threshold = 1100;
      const isNearBottom =
        window.innerHeight + window.scrollY >=
        document.documentElement.scrollHeight - threshold;

      if (isNearBottom) {
        pullLockRef.current = true;

        setShelfPool((prevPool) => {
          if (prevPool.length === 0) {
            pullLockRef.current = false;
            return prevPool;
          }

          const candidate = prevPool.find(
            (s) => !activatedShelfIdsRef.current.has(s.id),
          );
          if (!candidate) {
            pullLockRef.current = false;
            return prevPool;
          }

          activatedShelfIdsRef.current.add(candidate.id);

          setActiveShelves((prevActive) => {
            if (prevActive.some((s) => s.id === candidate.id)) {
              return prevActive;
            }
            return [...prevActive, { ...candidate, items: [] }];
          });

          fetchShelfData(candidate.id, 1);

          setTimeout(() => {
            pullLockRef.current = false;
          }, 350);

          return prevPool.filter((s) => s.id !== candidate.id);
        });
      }
    };

    window.addEventListener("scroll", handleScrollVerticalPool);
    return () => window.removeEventListener("scroll", handleScrollVerticalPool);
  }, []);

  const handleLoadMoreShelf = async (shelfId: string) => {
    const shelf = [...activeShelves, ...shelfPool].find(
      (s) => s.id === shelfId,
    );
    if (!shelf || shelf.loading) return;

    setActiveShelves((prev) =>
      prev.map((s) => (s.id === shelfId ? { ...s, loading: true } : s)),
    );
    setShelfPool((prev) =>
      prev.map((s) => (s.id === shelfId ? { ...s, loading: true } : s)),
    );

    const nextPage = (shelf.page || 1) + 1;
    await fetchShelfData(shelfId, nextPage);

    setActiveShelves((prev) =>
      prev.map((s) => (s.id === shelfId ? { ...s, loading: false } : s)),
    );
    setShelfPool((prev) =>
      prev.map((s) => (s.id === shelfId ? { ...s, loading: false } : s)),
    );
  };

  // Firestore local collections
  const [profile, setProfile] = useState<UserProfile | null>(null);

  // Profile preferences inputs
  const [editedDisplayName, setEditedDisplayName] = useState("");
  const [editedGenres, setEditedGenres] = useState("");
  const [profileSaving, setProfileSaving] = useState(false);

  // Fetch Firestore database assets
  useEffect(() => {
    if (currentUser) {
      fetchUserProfile();
    }
  }, [currentUser]);

  const fetchUserProfile = async () => {
    try {
      const uid = currentUser.uid;
      const rootDocRef = doc(db, "users", uid);
      const personalDocRef = doc(db, "users", uid, "personalization", "profile");

      const [rootSnap, personalSnap] = await Promise.all([
        getDoc(rootDocRef),
        getDoc(personalDocRef)
      ]);

      const deviceType = /Mobi|Android/i.test(navigator.userAgent)
        ? "Mobile"
        : "Desktop";
      const userLang = navigator.language || "en-US";
      const userRegion =
        Intl.DateTimeFormat().resolvedOptions().timeZone || "Asia/Kolkata";
      const userCountry = userLang.split("-")[1] || "IN";

      let rootData: any = {};
      if (rootSnap.exists()) {
        rootData = rootSnap.data();
      } else {
        const baseUsername = (currentUser.displayName || currentUser.email || 'cinephile').replace(/[^a-zA-Z0-9_]/g, '');
        const randomNum = Math.floor(100 + Math.random() * 900);
        const autoUsername = `${baseUsername}_${randomNum}`.toLowerCase().substring(0, 30);
        rootData = {
          uid: currentUser.uid,
          displayName: currentUser.displayName || "cinephile",
          username: autoUsername,
          usernameLower: autoUsername,
          email: currentUser.email || "",
          avatarUrl: currentUser.photoURL || `https://api.dicebear.com/7.x/adventurer/svg?seed=${currentUser.uid}`,
          createdAt: new Date().toISOString(),
          device: deviceType,
          language: userLang,
          region: userRegion,
          country: userCountry,
        };
        await setDoc(rootDocRef, rootData);
      }

      let personalData: any = {};
      if (personalSnap.exists()) {
        personalData = personalSnap.data();
      } else {
        personalData = {
          favoriteGenres: "Sci-Fi, Anime, Mystery",
          personalizationScores: {
            genres: {},
            actors: {},
            directors: {},
            moods: {},
            providers: {},
            animePreference: 0,
            contentTypes: { movie: 0, tv: 0, anime: 0 },
            pacing: { slowBurn: 0, fastPaced: 0 },
            tone: { dark: 0, light: 0 },
            timeOfDay: {},
          },
          recentInteractions: []
        };
        await setDoc(personalDocRef, personalData);
      }

      const enriched = {
        ...rootData,
        ...personalData,
        device: rootData.device || deviceType,
        language: rootData.language || userLang,
        region: rootData.region || userRegion,
        country: rootData.country || userCountry,
      };

      setProfile(enriched);
      setEditedDisplayName(enriched.displayName || "");
      setEditedGenres(enriched.favoriteGenres || "");
    } catch (e) {
      console.warn("Failed fetching profile; using default template.", e);
    }
  };

  const { watchlist, addToWatchlist, removeFromWatchlist } = useWatchlistStore();

  const quickSearches = [
    "Recommend a dark thriller with mind-bending plots",
    "Anime with sudden dark emotional plot twists",
    "Psychological thriller like Monster",
    "Sci-Fi with futuristic timelines",
  ];

  return (
    <div
      className={`w-full text-zinc-100 flex flex-col justify-start min-h-screen relative ${activeTab === "home" ? "" : "pt-20"}`}
    >
      {/* Dynamic Slide In Tabs Content Wrapper */}
      <main className="flex-1 w-full flex flex-col relative">
        <AnimatePresence mode="wait">
          {/* TAB 1: Home / Personalized Discover */}
          {activeTab === "home" && (
            <motion.div
              key="home"
              className="w-full text-left relative z-10 py-24"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.3 }}
            >
              <div className="w-full space-y-8">
                {activeShelves.map((shelf) => (
                  <ContentRail
                    key={shelf.id}
                    title={shelf.title}
                    subtitle={shelf.subtitle}
                    items={shelf.items}
                    onOpenDetails={onOpenMovieDetails}
                    onAddToWatchlist={(item) =>
                      currentUser && addToWatchlist(item, currentUser.uid, "watchlist")
                    }
                    watchlistIds={watchlist.map((w) => String(w.titleId))}
                    shelfId={shelf.id}
                    onLoadMore={handleLoadMoreShelf}
                    isLoadingMore={shelf.loading}
                  />
                ))}
              </div>
            </motion.div>
          )}

          {/* TAB 1.5: RECOMMENDATION ENGINE TAB */}
          {activeTab === "recommendation" && (
            <motion.div
              key="recommendation"
              className="w-full text-left"
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -15 }}
              transition={{ duration: 0.3 }}
            >
              <RecommendationTab
                currentUser={currentUser}
                onOpenMovieDetails={onOpenMovieDetails}
                watchlistIds={watchlist.map((w) => String(w.titleId))}
                onAddToWatchlist={(item) =>
                  currentUser && addToWatchlist(item, currentUser.uid, "watchlist")
                }
              />
            </motion.div>
          )}

          {/* TAB 2: WATCH JOURNAL (Watchlist Grid) */}
          {activeTab === "watchlist" && (
            <WatchlistView
              onBackToHome={() => onChangeTab("home")}
              onOpenMovieDetails={onOpenMovieDetails}
              watchlistIds={watchlist.map(i => String(i.titleId))}
            />
          )}

          {/* TAB 3: RATINGS & REVIEWS LIST */}
          {activeTab === "ratings" && (
            <RatingsView 
              onOpenDetails={onOpenMovieDetails}
              onAddToWatchlist={(movie) => useWatchlistStore.getState().addToWatchlist(movie, currentUser.uid)}
              watchlistIds={watchlist.map(i => String(i.titleId))}
            />
          )}

          {/* TAB 5: SETTINGS DASHBOARD */}
          {activeTab === "settings" && (
            <motion.div
              key="settings"
              className="w-full text-left"
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -15 }}
              transition={{ duration: 0.3 }}
            >
              <SettingsTab
                currentUser={currentUser}
                profile={profile}
                onProfileUpdate={(updated) => {
                  setProfile(updated);
                  setEditedDisplayName(updated.displayName || "");
                  setEditedGenres(updated.favoriteGenres || "");
                  onRefreshHomepage(false);
                }}
                onSignOut={onSignOut || (() => {})}
              />
            </motion.div>
          )}
        </AnimatePresence>
      </main>
    </div>
  );
}
