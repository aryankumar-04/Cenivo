import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useNavigate, useLocation } from 'react-router-dom';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { auth, db } from './lib/firebase';
import { doc, getDoc, updateDoc, arrayUnion, arrayRemove, setDoc, collection, getDocs, onSnapshot } from 'firebase/firestore';
import { trackInteraction } from './lib/tracker';
import { REVIEWS_SAMPLES } from './data';
import { robustFetch } from './lib/utils';

// Component imports
import Navigation from './components/Navigation';
import Hero from './components/Hero';
import ImportSection from './components/ImportSection';
import AuthModal from './components/AuthModal';
import PersonalizedExperience from './components/PersonalizedExperience';
import CenivoLogo from './components/CenivoLogo';
import MovieDetailsModal from './components/MovieDetailsModal';
import SearchModal from './components/SearchModal';
import ContentRail from './components/ContentRail';
import BrowseView from './components/BrowseView';
import { useWatchlistStore } from './stores/watchlistStore';
import { useRatingsStore } from './stores/ratingsStore';
import { useSettingsStore } from './stores/settingsStore';
import { Toaster, toast } from 'react-hot-toast';

import { Sparkles, Star, ArrowRight, RefreshCw } from 'lucide-react';
import { motion } from 'motion/react';

// Protected Route Shield
function ProtectedRoute({ user, children }: { user: any; children: React.ReactNode }) {
  if (!user) {
    return <Navigate to="/login" replace />;
  }
  return <>{children}</>;
}

function AppContent() {
  const [user, setUser] = useState<any>(null);
  const [userProfile, setUserProfile] = useState<any>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const initialSessionVersionRef = React.useRef<number | null>(null);
  const [authOpen, setAuthOpen] = useState(false);
  const [authMode, setAuthMode] = useState<'signin' | 'signup'>('signin');

  const navigate = useNavigate();
  const location = useLocation();

  // Dynamic discovery elements on landing page
  const [homepageData, setHomepageData] = useState<any>(null);
  const [loadingTrending, setLoadingTrending] = useState(true);
  const [activeShelf, setActiveShelf] = useState<'trending' | 'series' | 'anime'>('trending');
  const [isRefreshing, setIsRefreshing] = useState(false);

  // States for unauthenticated homepage content rails pagination
  const [extraShelfItems, setExtraShelfItems] = useState<Record<string, any[]>>({
    trending: [],
    series: [],
    anime: []
  });
  const [shelfPages, setShelfPages] = useState<Record<string, number>>({
    trending: 1,
    series: 1,
    anime: 1
  });
  const [shelfLoading, setShelfLoading] = useState<Record<string, boolean>>({
    trending: false,
    series: false,
    anime: false
  });

  const handleLoadMoreShelf = async (shelfId: string) => {
    if (shelfLoading[shelfId]) return;
    setShelfLoading(prev => ({ ...prev, [shelfId]: true }));
    
    const nextPage = (shelfPages[shelfId] || 1) + 1;
    let path = 'trending';
    if (shelfId === 'series') path = 'tv_popular';
    else if (shelfId === 'anime') path = 'anime';

    try {
      const scoresQuery = userProfile?.personalizationScores ? `&personalizationScores=${encodeURIComponent(JSON.stringify(userProfile.personalizationScores))}` : '';
      const guestLogs = localStorage.getItem('cenivo_guest_interactions') || '[]';
      const response = await robustFetch(`/api/tmdb?path=${path}&page=${nextPage}&userId=${user?.uid || ''}${scoresQuery}&guestInteractions=${encodeURIComponent(guestLogs)}`);
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
            release_date: x.release_date || x.first_air_date || '2024'
          }));

          setExtraShelfItems(prev => ({
            ...prev,
            [shelfId]: [...prev[shelfId], ...mapped]
          }));
          setShelfPages(prev => ({
            ...prev,
            [shelfId]: nextPage
          }));
        }
      }
    } catch (err) {
      console.error(`Error loading more items for shelf ${shelfId}:`, err);
    } finally {
      setShelfLoading(prev => ({ ...prev, [shelfId]: false }));
    }
  };

  // Modal display controllers
  const [selectedMovie, setSelectedMovie] = useState<any>(null);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);

  const { watchlist, addToWatchlist, removeFromWatchlist, isInWatchlist } = useWatchlistStore();
  const watchlistIds = React.useMemo(() => {
    return watchlist.map((item) => String(item.titleId));
  }, [watchlist]);
  const [activeTab, setActiveTab] = useState<'home' | 'recommendation' | 'watchlist' | 'ratings' | 'settings'>('home');

  // Listen to Auth State change
  useEffect(() => {
    let unsubUserSnap: (() => void) | null = null;
    let unsubPersonalSnap: (() => void) | null = null;
    let unsubSettings: (() => void) | null = null;

    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (unsubUserSnap) {
        unsubUserSnap();
        unsubUserSnap = null;
      }
      if (unsubPersonalSnap) {
        unsubPersonalSnap();
        unsubPersonalSnap = null;
      }
      if (unsubSettings) {
        unsubSettings();
        unsubSettings = null;
      }
      initialSessionVersionRef.current = null;

      if (firebaseUser) {
        setUser(firebaseUser);
        useWatchlistStore.getState().fetchWatchlist(firebaseUser.uid);
        useRatingsStore.getState().fetchRatings(firebaseUser.uid);
        
        // Globally subscribe to settings store
        try {
          unsubSettings = useSettingsStore.getState().subscribeToSettings(firebaseUser.uid);
        } catch (settingsInitErr) {
          console.error("Error subscribing to settings store:", settingsInitErr);
        }

        // Listen dynamically with real-time onSnapshot to update profiles and log out if session version invalidates!
        try {
          const userDocRef = doc(db, 'users', firebaseUser.uid);
          const personalDocRef = doc(db, 'users', firebaseUser.uid, 'personalization', 'profile');

          let rootData: any = null;
          let personalData: any = null;

          const mergeUserProfile = () => {
            if (rootData) {
              const deviceType = /Mobi|Android/i.test(navigator.userAgent) ? 'Mobile' : 'Desktop';
              const userLang = navigator.language || 'en-US';
              const userRegion = Intl.DateTimeFormat().resolvedOptions().timeZone || 'Asia/Kolkata';
              const userCountry = userLang.split('-')[1] || 'IN';

              const merged = {
                ...rootData,
                ...(personalData || {}),
                device: rootData.device || deviceType,
                language: rootData.language || userLang,
                region: rootData.region || userRegion,
                country: rootData.country || userCountry,
              };
              setUserProfile(merged);
            }
          };

          unsubUserSnap = onSnapshot(userDocRef, async (docSnap) => {
            if (!docSnap.exists()) {
              // Seed base profile if document doesn't exist
              const deviceType = /Mobi|Android/i.test(navigator.userAgent) ? 'Mobile' : 'Desktop';
              const userLang = navigator.language || 'en-US';
              const userRegion = Intl.DateTimeFormat().resolvedOptions().timeZone || 'Asia/Kolkata';
              const userCountry = userLang.split('-')[1] || 'IN';

              const baseUsername = (firebaseUser.displayName || firebaseUser.email || 'cinephile').replace(/[^a-zA-Z0-9_]/g, '');
              const randomNum = Math.floor(100 + Math.random() * 900);
              const autoUsername = `${baseUsername}_${randomNum}`.toLowerCase().substring(0, 30);
              
              const mockProfile = {
                uid: firebaseUser.uid,
                displayName: firebaseUser.displayName || 'Cinephile',
                username: autoUsername,
                usernameLower: autoUsername,
                email: firebaseUser.email || '',
                avatarUrl: firebaseUser.photoURL || `https://api.dicebear.com/7.x/adventurer/svg?seed=${firebaseUser.uid}`,
                createdAt: new Date().toISOString(),
                device: deviceType,
                language: userLang,
                region: userRegion,
                country: userCountry,
                sessionVersion: 0,
              };
              await setDoc(userDocRef, mockProfile);

              const mockPersonal = {
                favoriteGenres: 'All',
                personalizationScores: {},
                recentInteractions: []
              };
              await setDoc(personalDocRef, mockPersonal, { merge: true });

              rootData = mockProfile;
              personalData = mockPersonal;
              mergeUserProfile();
              initialSessionVersionRef.current = 0;
              return;
            }

            const data = docSnap.data() as any;

            // Session version validation for Sign Out Everywhere
            const ver = data.sessionVersion || 0;
            if (initialSessionVersionRef.current === null) {
              initialSessionVersionRef.current = ver;
            } else if (ver > initialSessionVersionRef.current) {
              initialSessionVersionRef.current = null;
              toast.error("Logout triggered from another session.");
              await signOut(auth);
              return;
            }

            rootData = data;
            mergeUserProfile();
          }, (snapErr) => {
            const errStr = snapErr?.message?.toLowerCase() || String(snapErr).toLowerCase();
            if (!errStr.includes("offline") && !errStr.includes("could not reach") && !errStr.includes("network") && !errStr.includes("unavailable")) {
              console.error("Dynamic profile sync error:", snapErr);
            }
          });

          unsubPersonalSnap = onSnapshot(personalDocRef, (personalSnap) => {
            if (personalSnap.exists()) {
              personalData = personalSnap.data();
            } else {
              personalData = {
                favoriteGenres: 'All',
                personalizationScores: {},
                recentInteractions: []
              };
            }
            mergeUserProfile();
          }, (personalSnapErr) => {
            const errStr = personalSnapErr?.message?.toLowerCase() || String(personalSnapErr).toLowerCase();
            if (!errStr.includes("offline") && !errStr.includes("could not reach") && !errStr.includes("network") && !errStr.includes("unavailable")) {
              console.error("Personalization stream error:", personalSnapErr);
            }
          });

        } catch (err) {
          console.error("Error initiating combined onSnapshot subscriber:", err);
        }
      } else {
        setUser(null);
        setUserProfile(null);
        useWatchlistStore.getState().clear();
        useRatingsStore.getState().clear();
        setActiveTab('home');
      }
      setAuthLoading(false);
    });

    return () => {
      unsubscribe();
      if (unsubUserSnap) {
        unsubUserSnap();
      }
      if (unsubPersonalSnap) {
        unsubPersonalSnap();
      }
      if (unsubSettings) {
        unsubSettings();
      }
    };
  }, []);

  // Listen to path changes when user is not authenticated to trigger Auth Modal on /login or /signup
  useEffect(() => {
    if (!user && !authLoading) {
      if (location.pathname === '/login') {
        setAuthMode('signin');
        setAuthOpen(true);
      } else if (location.pathname === '/signup') {
        setAuthMode('signup');
        setAuthOpen(true);
      }
    }
  }, [location.pathname, user, authLoading]);

  // Fetch advanced dynamic unified homepage discoveries matching taste weights
  const fetchHomepageData = async (shouldShowSpinner = false) => {
    if (shouldShowSpinner) setIsRefreshing(true);
    setLoadingTrending(true);
    try {
      let profile = { favoriteGenres: 'All' };
      let ratings: any[] = [];
      let watchlist: any[] = [];
      let personalizationScores = {};
      let recentInteractions: any[] = [];

      if (user) {
        try {
          const [userDoc, personalDoc] = await Promise.all([
            getDoc(doc(db, 'users', user.uid)),
            getDoc(doc(db, 'users', user.uid, 'personalization', 'profile'))
          ]);

          let favGenres = 'All';
          let pScores = {};
          let rInteractions: any[] = [];

          if (personalDoc.exists()) {
            const data = personalDoc.data();
            favGenres = data.favoriteGenres || 'All';
            pScores = data.personalizationScores || {};
            rInteractions = data.recentInteractions || [];
          } else if (userDoc.exists()) {
            const data = userDoc.data();
            favGenres = data.favoriteGenres || 'All';
            pScores = data.personalizationScores || {};
            rInteractions = data.recentInteractions || [];
          }

          profile = { favoriteGenres: favGenres };
          personalizationScores = pScores;
          recentInteractions = rInteractions;

          // Fetch watch queue collection
          const wSnap = await getDocs(collection(db, 'users', user.uid, 'watchlist'));
          wSnap.forEach(d => {
            watchlist.push(d.data());
          });

          // Fetch user rating review entries
          const rSnap = await getDocs(collection(db, 'users', user.uid, 'ratings'));
          rSnap.forEach(d => {
            ratings.push(d.data());
          });
        } catch (e) {
          const errStr = String(e).toLowerCase();
          if (errStr.includes("offline") || errStr.includes("could not reach") || errStr.includes("network") || errStr.includes("unavailable")) {
            console.warn("Offline notice fetching user profile for homepage tuning (using default fallback):", e);
          } else {
            console.error("Error fetching user profile for homepage tuning:", e);
          }
        }
      }

      const response = await robustFetch('/api/homepage', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          watchlist,
          ratings,
          profile,
          personalizationScores,
          recentInteractions,
          seed: Math.random().toString() // Always shuffle on call
        })
      });

      if (response.ok) {
        const data = await response.json();
        setHomepageData(data);
      }
    } catch (err) {
      console.error('Error fetching dynamic homepage data:', err);
    } finally {
      setLoadingTrending(false);
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    fetchHomepageData();
  }, [user]);

  const openAuth = React.useCallback((mode: 'signin' | 'signup') => {
    setAuthMode(mode);
    setAuthOpen(true);
    navigate(mode === 'signin' ? '/login' : '/signup');
  }, [navigate]);

  const handleSignOut = async () => {
    try {
      await signOut(auth);
      navigate('/');
    } catch (e) {
      console.error(e);
    }
  };

  const handleTriggerDetails = React.useCallback((movie: any) => {
    setSelectedMovie(movie);
    setDetailsOpen(true);

    // Track detailed movie view action safely
    try {
      trackInteraction(user?.uid, 'movie_click', {
        id: movie.id,
        title: movie.title || movie.name,
        genres: movie.genres || [],
        type: movie.media_type || movie.type || 'movie'
      });
    } catch (e) {
      console.warn(e);
    }
  }, [user?.uid]);

  const handleSelectSimilarMovie = React.useCallback((similarMovie: any) => {
    // Graceful swap on similar carousel click with frame-in reload
    setSelectedMovie(similarMovie);

    // Track similar movie click engagement action
    try {
      trackInteraction(user?.uid, 'similar_click', {
        id: similarMovie.id,
        title: similarMovie.title || similarMovie.name,
        genres: similarMovie.genres || [],
        type: similarMovie.media_type || similarMovie.type || 'movie'
      });
    } catch (e) {
      console.warn(e);
    }
  }, [user?.uid]);

  const handleToggleWatchlist = React.useCallback(async (movie: any) => {
    const titleIdStr = String(movie.id || movie.tmdbId || movie.titleId);
    if (user) {
      if (isInWatchlist(titleIdStr)) {
        removeFromWatchlist(titleIdStr, user.uid);
        toast.success("Removed from Watchlist");
      } else {
        addToWatchlist(movie, user.uid);
        toast.success("Added to Watchlist");
        try {
          trackInteraction(user.uid, 'add_watchlist', {
            id: movie.id,
            title: movie.title || movie.name,
            genres: movie.genres || [],
            type: movie.media_type || movie.type || 'movie'
          });
        } catch (_) {}
      }
    } else {
      // Guide user to login context
      openAuth('signup');
    }
  }, [user, isInWatchlist, addToWatchlist, removeFromWatchlist, openAuth]);

  if (authLoading) {
    return (
      <div className="fixed inset-0 z-50 bg-[#050505] flex flex-col items-center justify-center select-none text-center">
        <div className="absolute inset-0 bg-gradient-to-t from-black via-transparent to-black/30 pointer-events-none" />
        <div className="relative z-10 flex flex-col items-center gap-6">
          <CenivoLogo size="lg" glow={true} className="animate-pulse" />
          <div className="space-y-2 mt-4 text-center">
            <p className="font-mono text-[10px] sm:text-xs font-bold text-zinc-400 tracking-widest uppercase animate-pulse">
              Restoring Authentic Session...
            </p>
            <div className="w-48 h-1 bg-white/5 rounded-full overflow-hidden relative mx-auto">
              <div 
                className="absolute top-0 bottom-0 w-1/3 bg-white rounded-full" 
                style={{
                  animation: 'shimmer-effect 1.5s infinite ease-in-out',
                }} 
              />
            </div>
          </div>
        </div>
        <style>{`
          @keyframes shimmer-effect {
            0% { left: -100%; }
            100% { left: 100%; }
          }
        `}</style>
      </div>
    );
  }

  return (
    <div className="bg-transparent text-[#FFFFFF] min-h-screen selection:bg-white/20 flex flex-col justify-between font-sans relative antialiased scroll-smooth">
      <Toaster position="bottom-center" toastOptions={{
        style: { background: "#333", color: "#fff", borderColor: "#444" }
      }} />

      {(() => {
        const matchBrowse = location.pathname.match(/^\/browse\/([^/]+)/);
        const isBrowsePage = !!matchBrowse;
        const currentShelfId = matchBrowse ? matchBrowse[1] : undefined;

        return (
          <>
            {/* Persistent Navigation & Home view container kept alive in background */}
            <div className={isBrowsePage ? "hidden" : "flex-1 flex flex-col"}>
              <Navigation
                onOpenAuth={openAuth}
                user={user}
                profile={userProfile}
                onSignOut={handleSignOut}
                activeTab={activeTab}
                onChangeTab={setActiveTab}
                onTriggerSearch={() => setSearchOpen(true)}
              />

              {user ? (
                // 1. LOGGED-IN DYNAMIC PERSONALIZED EXPERIENCE
                <div className="flex-1 flex flex-col animate-in fade-in duration-300">
                  {activeTab === 'home' && (
                    <Hero
                      onExploreTrending={() => {
                        const el = document.getElementById('ai-chat');
                        if (el) el.scrollIntoView({ behavior: 'smooth' });
                      }}
                      onOpenDetails={handleTriggerDetails}
                      user={user}
                      onAddToWatchlist={handleToggleWatchlist}
                      watchlistIds={watchlistIds}
                      slides={homepageData?.hero}
                    />
                  )}

                  <PersonalizedExperience
                    currentUser={user}
                    onOpenMovieDetails={handleTriggerDetails}
                    activeTab={activeTab}
                    onChangeTab={setActiveTab}
                    homepageData={homepageData}
                    onRefreshHomepage={fetchHomepageData}
                    isRefreshingHomepage={isRefreshing}
                    onSignOut={handleSignOut}
                  />

                  {/* Authenticated Feed Footer */}
                  <footer className="bg-transparent border-t border-white/5 py-12 px-4 sm:px-6 lg:px-8 mt-12">
                    <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-6">
                      <div className="flex items-center gap-2">
                        <CenivoLogo size="sm" />
                      </div>
                      <ul className="flex items-center gap-6 text-xs text-zinc-400">
                        <li><a href="#" className="hover:text-white transition-colors">Terms of Service</a></li>
                        <li><a href="#" className="hover:text-white transition-colors">Privacy Policy</a></li>
                        <li><a href="#" className="hover:text-white transition-colors">Contact Support</a></li>
                      </ul>
                      <div className="text-[10px] font-mono text-zinc-500">
                        © {new Date().getFullYear()} Cenivo. Designed under Criticker style sheets. Powered by Gemini.
                      </div>
                    </div>
                  </footer>
                </div>
              ) : (
                // 2. PUBLIC MARKETING LANDING EXPERIENCE
                <div className="flex-1 flex flex-col animate-in fade-in duration-300">
                  <Hero
                    onExploreTrending={() => {
                      const el = document.getElementById('trending');
                      if (el) el.scrollIntoView({ behavior: 'smooth' });
                    }}
                    onOpenDetails={handleTriggerDetails}
                    user={user}
                    onAddToWatchlist={handleToggleWatchlist}
                    watchlistIds={watchlistIds}
                    slides={homepageData?.hero}
                  />

                  <section id="trending" className="py-24 bg-transparent relative overflow-hidden border-t border-white/5">
                    <div className="absolute top-[30%] right-[-10%] w-[450px] h-[450px] rounded-full bg-white/2 blur-[130px] pointer-events-none" />
                    <div className="w-full relative z-10">
                      {loadingTrending ? (
                        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 grid grid-cols-2 lg:grid-cols-4 gap-6">
                          {[...Array(4)].map((_, i) => (
                            <div key={i} className="aspect-[2/3] bg-zinc-900 rounded-2xl animate-pulse border border-white/5" />
                          ))}
                        </div>
                      ) : (
                        <div className="space-y-8">
                          <ContentRail
                            title="Trending Now"
                            subtitle="Critically popular films globally this week."
                            items={[...(homepageData?.trending || []), ...(extraShelfItems.trending || [])]}
                            onOpenDetails={handleTriggerDetails}
                            onAddToWatchlist={handleToggleWatchlist}
                            watchlistIds={watchlistIds}
                            shelfId="trending"
                            onLoadMore={handleLoadMoreShelf}
                            isLoadingMore={shelfLoading.trending}
                          />
                          <ContentRail
                            title="Popular in Your Region"
                            subtitle="Top loved series and television stories."
                            items={[...(homepageData?.web_series || []), ...(extraShelfItems.series || [])]}
                            onOpenDetails={handleTriggerDetails}
                            onAddToWatchlist={handleToggleWatchlist}
                            watchlistIds={watchlistIds}
                            shelfId="series"
                            onLoadMore={handleLoadMoreShelf}
                            isLoadingMore={shelfLoading.series}
                          />
                          <ContentRail
                            title="Elite Anime"
                            subtitle="Handpicked animated masterworks."
                            items={[...(homepageData?.anime || []), ...(extraShelfItems.anime || [])]}
                            onOpenDetails={handleTriggerDetails}
                            onAddToWatchlist={handleToggleWatchlist}
                            watchlistIds={watchlistIds}
                            shelfId="anime"
                            onLoadMore={handleLoadMoreShelf}
                            isLoadingMore={shelfLoading.anime}
                          />
                        </div>
                      )}
                    </div>
                  </section>

                  <ImportSection />

                  <section className="py-24 px-4 sm:px-6 lg:px-8 bg-transparent relative overflow-hidden">
                    <div className="max-w-4xl mx-auto w-full space-y-12 relative z-10">
                      <div className="text-center space-y-2 max-w-lg mx-auto">
                        <span className="font-mono text-[10px] font-bold text-[#ff9d00] tracking-widest uppercase">CENIVO FEED</span>
                        <h3 className="font-display font-black text-3xl text-white tracking-tight">Cinephile Critic Lounge</h3>
                        <p className="font-sans text-xs sm:text-sm text-zinc-400">Taste matches in the wild using simple structural rating lists.</p>
                      </div>

                      <div className="space-y-6">
                        {REVIEWS_SAMPLES.slice(0, 3).map((rev, idx) => (
                          <div
                            key={idx}
                            className="p-6 bg-white/[0.03] backdrop-blur-3xl border border-white/10 rounded-2xl flex flex-col sm:flex-row items-stretch sm:items-start justify-between gap-6 text-left hover:border-white/20 transition-all duration-300 hover:-translate-y-0.5 shadow-xl"
                          >
                            <div className="space-y-3 flex-1 text-left">
                              <div className="flex items-center gap-3">
                                <span className="text-white font-sans font-bold text-sm">@{rev.username}</span>
                                <div className="flex items-center gap-0.5">
                                  {[...Array(rev.starCount)].map((_, i) => (
                                    <Star key={i} className="w-3.5 h-3.5 text-[#ff9d00] fill-[#ff9d00]" />
                                  ))}
                                </div>
                              </div>
                              <p className="font-sans text-sm text-zinc-300 leading-relaxed font-light">
                                "{rev.text}"
                              </p>
                              <div className="pt-2 text-[10px] font-mono text-zinc-500">
                                Reviewed work: <span className="text-white font-semibold">{rev.work}</span> • taste tier rank: {rev.rank}
                              </div>
                            </div>

                            <div className="shrink-0 flex items-center justify-center sm:justify-start">
                              <div className="w-12 h-12 bg-white/5 border border-white/10 text-white rounded-xl flex items-center justify-center font-sans font-extrabold text-base">
                                {rev.rating}%
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </section>

                  <section className="py-24 px-4 sm:px-6 lg:px-8 bg-transparent relative overflow-hidden text-center border-t border-white/5">
                    <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[300px] rounded-full bg-white/5 blur-[120px] pointer-events-none" />
                    <div className="max-w-xl mx-auto space-y-8 relative z-10">
                      <h3 className="font-sans font-extrabold text-3xl sm:text-5xl text-white tracking-tight leading-tight">
                        Ready to find your<br />next favorite watch?
                      </h3>
                      <p className="font-sans text-sm sm:text-base text-zinc-400 leading-relaxed">
                        Connect your account and join thousands of cinephiles mapping recommendations, watch statuses, and reviews through Gemini AI.
                      </p>
                      <button
                        onClick={() => openAuth('signup')}
                        className="px-8 py-4 bg-white hover:bg-zinc-200 text-black text-base font-semibold rounded-xl transition cursor-pointer flex items-center justify-center gap-2 mx-auto active:scale-[0.98] shadow-lg animate-bounce"
                      >
                        <span>Join Cenivo Free</span>
                        <ArrowRight className="w-4.5 h-4.5 text-black" />
                      </button>
                    </div>
                  </section>

                  <footer className="bg-[#050505] border-t border-white/5 py-12 px-4 sm:px-6 lg:px-8">
                    <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-6">
                      <div className="flex items-center gap-2">
                        <CenivoLogo size="sm" />
                      </div>
                      <ul className="flex items-center gap-6 text-xs text-zinc-400">
                        <li><a href="#" className="hover:text-white transition-colors">Terms of Service</a></li>
                        <li><a href="#" className="hover:text-white transition-colors">Privacy Policy</a></li>
                        <li><a href="#" className="hover:text-white transition-colors">Contact Support</a></li>
                      </ul>
                      <div className="text-[10px] font-mono text-zinc-500">
                        © {new Date().getFullYear()} Cenivo. Designed under Criticker style sheets. Powered by Gemini.
                      </div>
                    </div>
                  </footer>
                </div>
              )}
            </div>

            {/* Persistent BrowseView container styled to only paint when router matched */}
            <div className={isBrowsePage ? "flex-1 flex flex-col animate-in fade-in duration-300" : "hidden"} key={currentShelfId || "home"}>
              {currentShelfId && (
                <BrowseView
                  user={user}
                  watchlistIds={watchlistIds}
                  onToggleWatchlist={handleToggleWatchlist}
                  onOpenDetails={handleTriggerDetails}
                  shelfIdOverride={currentShelfId}
                />
              )}
            </div>

            {/* Register Router paths for navigation compatibility */}
            <Routes>
              <Route path="/login" element={<Navigate to="/" replace />} />
              <Route path="/signup" element={<Navigate to="/" replace />} />
              <Route path="/browse/:shelfId" element={null} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </>
        );
      })()}

      {/* Unified Secure Authentication Gate Modal */}
      <AuthModal
        isOpen={authOpen}
        onClose={() => {
          setAuthOpen(false);
          if (location.pathname === '/login' || location.pathname === '/signup') {
            navigate('/');
          }
        }}
        defaultMode={authMode}
      />

      {/* Global Interactive Fullscreen Detail Overlay Card */}
      <MovieDetailsModal
        movie={selectedMovie}
        isOpen={detailsOpen}
        onClose={() => setDetailsOpen(false)}
        user={user}
        onAddToWatchlist={handleToggleWatchlist}
        watchlistIds={watchlistIds}
        onSelectSimilar={handleSelectSimilarMovie}
      />

      {/* Advanced Global Search Overlay Trigger Panel */}
      <SearchModal
        isOpen={searchOpen}
        onClose={() => setSearchOpen(false)}
        onOpenDetails={handleTriggerDetails}
      />

    </div>
  );
}

export default function App() {
  return (
    <Router>
      <AppContent />
    </Router>
  );
}
