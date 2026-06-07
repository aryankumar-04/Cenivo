import React, { useState, useEffect } from 'react';
import { Search, User, Menu, X, LogOut, Compass, Star, History, List, Settings } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import CenivoLogo from './CenivoLogo';

interface NavigationProps {
  onOpenAuth: (mode: 'signin' | 'signup') => void;
  user: any;
  profile?: any;
  onSignOut: () => void;
  activeTab: 'home' | 'recommendation' | 'watchlist' | 'ratings' | 'settings';
  onChangeTab: (tab: 'home' | 'recommendation' | 'watchlist' | 'ratings' | 'settings') => void;
  onTriggerSearch: () => void;
}

export default function Navigation({
  onOpenAuth,
  user,
  profile,
  onSignOut,
  activeTab,
  onChangeTab,
  onTriggerSearch
}: NavigationProps) {
  const [scrolled, setScrolled] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [showComingSoon, setShowComingSoon] = useState(false);

  // Scroll visibility transitions
  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 40);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const scrollToSection = (id: string) => {
    setMobileMenuOpen(false);
    const el = document.getElementById(id);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  const handleTabClick = (tab: 'home' | 'recommendation' | 'watchlist' | 'ratings' | 'settings') => {
    if (tab === 'recommendation' && user?.email !== 'aryannot04@gmail.com') {
      setMobileMenuOpen(false);
      setShowComingSoon(true);
      setTimeout(() => {
        setShowComingSoon(false);
      }, 4000);
      return;
    }
    onChangeTab(tab);
    setMobileMenuOpen(false);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <nav
      className={`fixed top-0 left-0 right-0 z-40 transition-all duration-300 w-full ${
        scrolled
          ? "bg-[#050508]/55 backdrop-blur-2xl border-b border-white/5 py-3.5 shadow-[0_10px_40px_rgba(0,0,0,0.6)]"
          : "bg-transparent py-6"
      }`}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-12">
          {/* Unified Branding and Primary Navigation Group */}
          <div className="flex items-center gap-10 md:gap-11 lg:gap-12">
            {/* Brand Wordmark & Emblem */}
            <div
              onClick={() => handleTabClick('home')}
              className="cursor-pointer shrink-0 transition-opacity duration-200 hover:opacity-90 flex items-center"
            >
              <CenivoLogo size="md" glow={false} />
            </div>

            {/* Large Screen Core Links */}
            <div className="hidden md:flex items-center gap-6 lg:gap-8 text-xs font-bold uppercase tracking-wider">
              {user ? (
                <>
                  <button
                    onClick={() => handleTabClick('home')}
                    className={`relative font-bold transition-all duration-300 cursor-pointer text-[12px] tracking-widest pb-1.5 ${
                      activeTab === 'home' ? 'text-white' : 'text-zinc-400 hover:text-white'
                    }`}
                  >
                    Discover
                    {activeTab === 'home' && (
                      <motion.div
                        layoutId="activeNavTabLine"
                        className="absolute bottom-0 left-0 right-0 h-[2.5px] bg-gradient-to-r from-[#ff9d00] via-[#ff4d6d] to-[#6c63ff] shadow-[0_0_12px_rgba(255,140,0,0.8)] rounded-full"
                        transition={{ type: "spring", stiffness: 350, damping: 28 }}
                      />
                    )}
                  </button>
                  <button
                    onClick={() => handleTabClick('recommendation')}
                    className={`relative font-bold transition-all duration-300 cursor-pointer text-[12px] tracking-widest pb-1.5 ${
                      activeTab === 'recommendation' ? 'text-white' : 'text-zinc-400 hover:text-white'
                    }`}
                  >
                    Recommendation
                    {activeTab === 'recommendation' && (
                      <motion.div
                        layoutId="activeNavTabLine"
                        className="absolute bottom-0 left-0 right-0 h-[2.5px] bg-gradient-to-r from-[#ff9d00] via-[#ff4d6d] to-[#6c63ff] shadow-[0_0_12px_rgba(255,140,0,0.8)] rounded-full"
                        transition={{ type: "spring", stiffness: 350, damping: 28 }}
                      />
                    )}
                  </button>
                  <button
                    onClick={() => handleTabClick('watchlist')}
                    className={`relative font-bold transition-all duration-300 cursor-pointer text-[12px] tracking-widest pb-1.5 ${
                      activeTab === 'watchlist' ? 'text-white' : 'text-zinc-400 hover:text-white'
                    }`}
                  >
                    Watchlist
                    {activeTab === 'watchlist' && (
                      <motion.div
                        layoutId="activeNavTabLine"
                        className="absolute bottom-0 left-0 right-0 h-[2.5px] bg-gradient-to-r from-[#ff9d00] via-[#ff4d6d] to-[#6c63ff] shadow-[0_0_12px_rgba(255,140,0,0.8)] rounded-full"
                        transition={{ type: "spring", stiffness: 350, damping: 28 }}
                      />
                    )}
                  </button>
                  <button
                    onClick={() => handleTabClick('ratings')}
                    className={`relative font-bold transition-all duration-300 cursor-pointer text-[12px] tracking-widest pb-1.5 ${
                      activeTab === 'ratings' ? 'text-white' : 'text-zinc-400 hover:text-white'
                    }`}
                  >
                    My Ratings
                    {activeTab === 'ratings' && (
                      <motion.div
                        layoutId="activeNavTabLine"
                        className="absolute bottom-0 left-0 right-0 h-[2.5px] bg-gradient-to-r from-[#ff9d00] via-[#ff4d6d] to-[#6c63ff] shadow-[0_0_12px_rgba(255,140,0,0.8)] rounded-full"
                        transition={{ type: "spring", stiffness: 350, damping: 28 }}
                      />
                    )}
                  </button>
                  <button
                    onClick={() => handleTabClick('settings')}
                    className={`relative font-bold transition-all duration-300 cursor-pointer text-[12px] tracking-widest pb-1.5 ${
                      activeTab === 'settings' ? 'text-white' : 'text-zinc-400 hover:text-white'
                    }`}
                  >
                    Settings
                    {activeTab === 'settings' && (
                      <motion.div
                        layoutId="activeNavTabLine"
                        className="absolute bottom-0 left-0 right-0 h-[2.5px] bg-gradient-to-r from-[#ff9d00] via-[#ff4d6d] to-[#6c63ff] shadow-[0_0_12px_rgba(255,140,0,0.8)] rounded-full"
                        transition={{ type: "spring", stiffness: 350, damping: 28 }}
                      />
                    )}
                  </button>
                </>
              ) : (
                <>
                  <button
                    onClick={() => scrollToSection('trending')}
                    className="text-zinc-400 hover:text-white font-bold transition-all duration-200 cursor-pointer text-[11px] tracking-widest uppercase hover:scale-105"
                  >
                    Trending Library
                  </button>
                  <button
                    onClick={() => scrollToSection('importer')}
                    className="text-zinc-400 hover:text-white font-bold transition-all duration-200 cursor-pointer text-[11px] tracking-widest uppercase hover:scale-105"
                  >
                    File Importer
                  </button>
                </>
              )}
            </div>
          </div>

          {/* Action Tools Header Controls */}
          <div className="flex items-center gap-3">
            {/* Realtime Search bar Trigger Toggle */}
            <button
              onClick={onTriggerSearch}
              className="p-2 text-zinc-400 hover:text-white bg-white/5 hover:bg-white/10 active:scale-95 border border-white/5 rounded-full transition-all cursor-pointer"
              title="Activate Universal Search"
            >
              <Search className="w-4 h-4" />
            </button>

            {/* If Auth state logged-in */}
            {user ? (
              <div className="flex items-center gap-2.5 relative">
                {/* Profile Display Name & Avatar trigger settings */}
                <button
                  onClick={() => handleTabClick('settings')}
                  className="flex items-center gap-2 px-2.5 py-1.5 bg-white/5 border border-white/10 hover:border-white/15 rounded-xl transition-all cursor-pointer"
                  title="Profile settings"
                >
                  <img
                    src={profile?.avatarUrl || `https://api.dicebear.com/7.x/adventurer/svg?seed=${user.uid}`}
                    alt="Avatar"
                    className="w-5.5 h-5.5 rounded-full bg-zinc-800"
                    referrerPolicy="no-referrer"
                  />
                  <span className="hidden lg:inline text-xs font-bold text-white truncate max-w-[100px]">
                    {profile?.username ? `@${profile.username.replace(/^@+/, '')}` : (profile?.displayName || user.displayName || 'John Doe')}
                  </span>
                </button>

                {/* Logout Button */}
                <button
                  onClick={onSignOut}
                  className="p-2 text-zinc-400 hover:text-white hover:bg-white/5 border border-transparent hover:border-white/5 rounded-full transition-all cursor-pointer"
                  title="Sign Out"
                >
                  <LogOut className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <div className="hidden md:flex items-center gap-2">
                <button
                  onClick={() => onOpenAuth('signin')}
                  className="px-3 py-2 text-zinc-400 hover:text-white font-semibold text-xs uppercase tracking-wider transition-colors cursor-pointer"
                >
                  Sign In
                </button>
                <button
                  onClick={() => onOpenAuth('signup')}
                  className="px-4 py-2 bg-white hover:bg-zinc-200 text-black font-semibold text-xs rounded-xl shadow transition-all cursor-pointer"
                >
                  Join Free
                </button>
              </div>
            )}

            {/* Mobile drawer button toggle */}
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="p-2 md:hidden text-zinc-400 hover:text-white hover:bg-white/5 rounded-full border border-white/5 cursor-pointer"
            >
              {mobileMenuOpen ? <X className="w-4 h-4" /> : <Menu className="w-4 h-4" />}
            </button>
          </div>
        </div>
      </div>

      {/* Floating mobile slide-in navigation drawer */}
      {mobileMenuOpen && (
        <div className="md:hidden bg-[#050505] border-b border-white/5 px-4 pt-4 pb-6 space-y-4 text-left">
          <div className="flex flex-col gap-3">
            {user ? (
              <>
                <button
                  onClick={() => handleTabClick('home')}
                  className={`py-2 text-sm font-semibold tracking-wider text-left block w-full uppercase ${activeTab === 'home' ? 'text-white font-bold' : 'text-zinc-400'}`}
                >
                  Discover
                </button>
                <button
                  onClick={() => handleTabClick('recommendation')}
                  className={`py-2 text-sm font-semibold tracking-wider text-left block w-full uppercase ${activeTab === 'recommendation' ? 'text-white font-bold' : 'text-zinc-400'}`}
                >
                  Recommendation
                </button>
                <button
                  onClick={() => handleTabClick('watchlist')}
                  className={`py-2 text-sm font-semibold tracking-wider text-left block w-full uppercase ${activeTab === 'watchlist' ? 'text-white font-bold' : 'text-zinc-400'}`}
                >
                  Watchlist
                </button>
                <button
                  onClick={() => handleTabClick('ratings')}
                  className={`py-2 text-sm font-semibold tracking-wider text-left block w-full uppercase ${activeTab === 'ratings' ? 'text-white font-bold' : 'text-zinc-400'}`}
                >
                  My Ratings
                </button>
                <button
                  onClick={() => handleTabClick('settings')}
                  className={`py-2 text-sm font-semibold tracking-wider text-left block w-full uppercase ${activeTab === 'settings' ? 'text-white font-bold' : 'text-zinc-400'}`}
                >
                  Settings
                </button>
              </>
            ) : (
              <>
                <button
                  onClick={() => scrollToSection('trending')}
                  className="py-2 text-zinc-400 hover:text-white text-sm font-semibold tracking-wider text-left block w-full uppercase"
                >
                  Trending Library
                </button>
                <button
                  onClick={() => scrollToSection('importer')}
                  className="py-2 text-zinc-400 hover:text-white text-sm font-semibold tracking-wider text-left block w-full uppercase"
                >
                  File Importer
                </button>
              </>
            )}

            {/* Mobile login triggers */}
            <div className="pt-4 border-t border-white/5 flex flex-col gap-2">
              {user ? (
                <>
                  <button
                    onClick={() => {
                      setMobileMenuOpen(false);
                      onSignOut();
                    }}
                    className="w-full py-3 bg-red-600/10 hover:bg-red-600/20 text-red-500 font-semibold text-xs rounded-xl text-center border border-red-500/10"
                  >
                    Sign Out Account
                  </button>
                </>
              ) : (
                <>
                  <button
                    onClick={() => {
                      setMobileMenuOpen(false);
                      onOpenAuth('signin');
                    }}
                    className="w-full py-3 text-zinc-400 hover:text-white text-center text-xs font-bold uppercase tracking-wider"
                  >
                    Sign In
                  </button>
                  <button
                    onClick={() => {
                      setMobileMenuOpen(false);
                      onOpenAuth('signup');
                    }}
                    className="w-full py-3 bg-white text-black font-semibold text-xs rounded-xl text-center"
                  >
                    Join Cenivo Free
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Coming Soon Overlay - Non-blocking Toast Style */}
      <AnimatePresence>
        {showComingSoon && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            transition={{ type: "spring", stiffness: 300, damping: 25 }}
            className="fixed bottom-6 right-6 z-50 pointer-events-auto"
          >
            <div className="bg-[#111111]/90 backdrop-blur-xl border border-white/10 rounded-2xl p-5 max-w-[320px] shadow-[0_10px_40px_rgba(0,0,0,0.8),0_0_40px_rgba(245,158,11,0.15)] relative overflow-hidden">
              {/* Soft glowing bubbles/particles */}
              <div className="absolute -top-10 -left-10 w-24 h-24 bg-amber-500/20 blur-[40px] rounded-full pointer-events-none" />
              <div className="absolute -bottom-10 -right-10 w-24 h-24 bg-indigo-500/20 blur-[40px] rounded-full pointer-events-none" />
              
              {/* Particle effects (simulated with absolute divs) */}
              <div className="absolute top-1/4 right-1/4 w-1 h-1 bg-white/40 rounded-full animate-ping" />
              <div className="absolute bottom-1/3 left-1/4 w-1.5 h-1.5 bg-amber-500/40 rounded-full animate-pulse" />
              
              <div className="relative z-10 space-y-4">
                 <div className="flex items-start justify-between gap-4">
                   <div className="w-10 h-10 bg-white/5 border border-white/10 rounded-xl flex items-center justify-center shrink-0">
                     <Star className="w-5 h-5 text-amber-500" />
                   </div>
                   <button 
                     onClick={() => setShowComingSoon(false)}
                     className="p-1 -mr-2 -mt-2 text-zinc-500 hover:text-white transition-colors cursor-pointer"
                   >
                     <X className="w-4 h-4" />
                   </button>
                 </div>
                 
                 <div>
                   <h3 className="text-base font-bold text-white mb-1">Recommendation Engine</h3>
                   <div className="inline-block px-2 py-0.5 bg-amber-500/10 border border-amber-500/20 rounded-md text-amber-500 text-[9px] font-bold tracking-widest uppercase mb-3">
                     Coming Soon
                   </div>
                   <p className="text-xs text-zinc-400 leading-relaxed font-medium">
                     AI-powered personalized recommendations are currently under development. Stay tuned.
                   </p>
                 </div>
                 
                 <div className="flex gap-2 pt-2">
                   <button 
                     onClick={() => setShowComingSoon(false)}
                     className="flex-1 py-2 bg-white text-black font-bold text-xs rounded-xl hover:bg-zinc-200 transition-colors cursor-pointer"
                   >
                     Close
                   </button>
                   <button 
                     onClick={() => setShowComingSoon(false)}
                     className="flex-1 py-2 bg-transparent border border-white/10 text-white font-bold text-xs rounded-xl hover:bg-white/5 transition-colors cursor-pointer"
                   >
                     Notify Me
                   </button>
                 </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </nav>
  );
}
