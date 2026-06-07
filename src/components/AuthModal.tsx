import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { auth, db } from '../lib/firebase';
import {
  signInWithPopup,
  GoogleAuthProvider,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  updateProfile,
  setPersistence,
  browserLocalPersistence,
  browserSessionPersistence,
  sendPasswordResetEmail
} from 'firebase/auth';
import { doc, setDoc, getDoc, updateDoc } from 'firebase/firestore';
import { 
  X, Mail, Lock, Loader2, Eye, EyeOff, 
  Check, AlertCircle, ArrowRight, ShieldCheck, 
  User, CheckCircle2, ChevronRight
} from 'lucide-react';
import CenivoLogo from './CenivoLogo';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  defaultMode?: 'signin' | 'signup';
}

const ONBOARDING_GENRES = [
  "Action", "Sci-Fi", "Drama", "Thriller", "Anime", "Comedy", 
  "Horror", "Documentary", "Mystery", "Adventure", "Fantasy"
];

const usernameCache: Record<string, 'available' | 'taken' | 'reserved'> = {};

export default function AuthModal({ isOpen, onClose, defaultMode = 'signin' }: AuthModalProps) {
  const [mode, setMode] = useState<'signin' | 'signup' | 'forgot' | 'verify'>((defaultMode as any) || 'signin');
  
  // Form Properties
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [username, setUsername] = useState('');
  const [usernameStatus, setUsernameStatus] = useState<{
    status: 'idle' | 'checking' | 'available' | 'taken' | 'invalid_chars' | 'too_short' | 'too_long' | 'reserved';
    message: string;
  }>({ status: 'idle', message: '' });

  // Interactive configurations
  const [rememberMe, setRememberMe] = useState(true);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [selectedGenres, setSelectedGenres] = useState<string[]>([]);
  const [registeredUserRef, setRegisteredUserRef] = useState<any>(null);

  // Loading, Errors, Toast statuses
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Password Strength tracking
  const strengthRequirements = [
    { label: "At least 8 characters", valid: password.length >= 8 },
    { label: "At least 1 uppercase letter", valid: /[A-Z]/.test(password) },
    { label: "At least 1 number", valid: /[0-9]/.test(password) },
    { label: "At least 1 special character", valid: /[!@#$%^&*(),.?":{}|<>]/.test(password) }
  ];
  const passwordStrengthScore = strengthRequirements.filter(r => r.valid).length;

  // Sync mode with defaultMode on open
  useEffect(() => {
    if (isOpen) {
      setMode((defaultMode as any) || 'signin');
      setError(null);
      setSuccessMsg(null);
      setUsername('');
      setUsernameStatus({ status: 'idle', message: '' });
    }
  }, [isOpen, defaultMode]);

  // Lock background scrolling
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
      document.documentElement.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
      document.documentElement.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
      document.documentElement.style.overflow = '';
    };
  }, [isOpen]);

  // Debounced Username Availability check
  useEffect(() => {
    if (mode !== 'signup') {
      setUsernameStatus({ status: 'idle', message: '' });
      return;
    }

    const cleanUsername = username.trim().replace(/^@+/, '');
    
    if (!cleanUsername) {
      setUsernameStatus({ status: 'idle', message: '' });
      return;
    }

    // Client-side validations
    const isValidFormat = /^[a-zA-Z0-9_]+$/.test(cleanUsername);
    if (!isValidFormat) {
      setUsernameStatus({
        status: 'invalid_chars',
        message: 'Only letters, numbers and underscores allowed.'
      });
      return;
    }

    if (cleanUsername.length < 3) {
      setUsernameStatus({
        status: 'too_short',
        message: 'Username must be at least 3 characters.'
      });
      return;
    }

    if (cleanUsername.length > 30) {
      setUsernameStatus({
        status: 'too_long',
        message: 'Username cannot exceed 30 characters.'
      });
      return;
    }

    const LOWER_RESERVED = new Set([
      'admin', 'support', 'help', 'owner', 'staff', 'official', 
      'cenivo', 'root', 'system', 'api', 'watchlist', 'ratings', 
      'discover', 'recommendation', 'settings'
    ]);
    if (LOWER_RESERVED.has(cleanUsername.toLowerCase())) {
      setUsernameStatus({
        status: 'reserved',
        message: 'This username is reserved.'
      });
      return;
    }

    // Check Cache
    const lowerClean = cleanUsername.toLowerCase();
    if (usernameCache[lowerClean]) {
      const cached = usernameCache[lowerClean];
      if (cached === 'available') {
        setUsernameStatus({ status: 'available', message: '✓ Username available' });
      } else if (cached === 'reserved') {
        setUsernameStatus({ status: 'reserved', message: 'This username is reserved.' });
      } else {
        setUsernameStatus({ status: 'taken', message: '✕ Username already taken' });
      }
      return;
    }

    setUsernameStatus({ status: 'checking', message: 'Verifying availability...' });

    const timeoutId = setTimeout(async () => {
      try {
        const { collection, query, where, getDocs } = await import('firebase/firestore');
        const usersRef = collection(db, 'users');
        const q = query(usersRef, where('usernameLower', '==', lowerClean));
        const querySnap = await getDocs(q);
        
        let taken = false;
        querySnap.forEach((docSnap) => {
          taken = true;
        });

        if (taken) {
          usernameCache[lowerClean] = 'taken';
          setUsernameStatus({
            status: 'taken',
            message: '✕ Username already taken'
          });
        } else {
          usernameCache[lowerClean] = 'available';
          setUsernameStatus({
            status: 'available',
            message: '✓ Username available'
          });
        }
      } catch (err) {
        console.error("Error verifying username:", err);
        setUsernameStatus({ status: 'idle', message: '' });
      }
    }, 500);

    return () => clearTimeout(timeoutId);
  }, [username, mode]);

  // Trigger password reset email via Firebase auth link
  const handleForgotPasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) {
      setError("Please provide a valid email address.");
      return;
    }
    setLoading(true);
    setError(null);
    setSuccessMsg(null);

    try {
      await sendPasswordResetEmail(auth, email);
      setSuccessMsg(`We have sent a reset link to ${email}. Check your spam if it is missing.`);
      setTimeout(() => {
        setMode('signin');
        setSuccessMsg(null);
      }, 5000);
    } catch (err: any) {
      console.error(err);
      setError(err.message || "Failed to trigger recovery link.");
    } finally {
      setLoading(false);
    }
  };

  // Trigger Google interactive sign in popup
  const handleGoogleSignIn = async () => {
    setLoading(true);
    setError(null);
    setSuccessMsg(null);
    try {
      await setPersistence(auth, rememberMe ? browserLocalPersistence : browserSessionPersistence);
      const provider = new GoogleAuthProvider();
      const userCredential = await signInWithPopup(auth, provider);
      const user = userCredential.user;

      // Sync User details with Firestore
      const userDocRef = doc(db, 'users', user.uid);
      const userSnapshot = await getDoc(userDocRef);
      if (!userSnapshot.exists()) {
        const baseUsername = (user.displayName || user.email || 'cinephile').replace(/[^a-zA-Z0-9_]/g, '');
        const randomNum = Math.floor(100 + Math.random() * 900);
        const autoUsername = `${baseUsername}_${randomNum}`.toLowerCase().substring(0, 30);
        const initialProfile = {
          uid: user.uid,
          displayName: user.displayName || 'Cinephile Watcher',
          username: autoUsername,
          usernameLower: autoUsername,
          email: user.email || '',
          avatarUrl: user.photoURL || `https://api.dicebear.com/7.x/adventurer/svg?seed=${user.uid}`,
          createdAt: new Date().toISOString(),
          provider: "google"
        };
        await setDoc(userDocRef, initialProfile);

        await setDoc(doc(db, 'users', user.uid, 'personalization', 'profile'), {
          favoriteGenres: 'All',
          personalizationScores: {},
          recentInteractions: []
        }, { merge: true });
        
        setRegisteredUserRef(user);
        setMode('verify');
      } else {
        onClose();
      }
    } catch (err: any) {
      console.error(err);
      if (err.code === 'auth/popup-blocked') {
        setError("Sign-in popup is blocked by your browser. Please allow popups for this site, or open the app in a new tab.");
      } else if (err.code === 'auth/popup-closed-by-user' || err.code === 'auth/cancelled-popup-request') {
        setError("The sign-in popup was closed before authentication completed.");
      } else {
        setError(err.message || "Failed Google Authentication Sign In");
      }
    } finally {
      setLoading(false);
    }
  };

  // Email login/signup forms controller with Zod equivalent criteria checks
  const handleEmailAuthSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSuccessMsg(null);

    // Validation asserts
    if (mode === 'signup') {
      if (!displayName.trim() || displayName.length < 2) {
        setError("Display name must consist of at least 2 characters.");
        setLoading(false);
        return;
      }
      const cleanUsername = username.trim().replace(/^@+/, '');
      if (!cleanUsername) {
        setError("Username is required.");
        setLoading(false);
        return;
      }
      if (usernameStatus.status !== 'available') {
        setError(usernameStatus.message || "Please choose an available username.");
        setLoading(false);
        return;
      }
      if (passwordStrengthScore < 3) {
        setError("Password is too weak. Please verify it complies with at least 3 indicators below.");
        setLoading(false);
        return;
      }
      if (password !== confirmPassword) {
        setError("Passwords mismatch. Double check your entries.");
        setLoading(false);
        return;
      }
    }

    try {
      // Apply session persist checking
      await setPersistence(auth, rememberMe ? browserLocalPersistence : browserSessionPersistence);

      if (mode === 'signup') {
        let user;
        try {
          const userCredential = await createUserWithEmailAndPassword(auth, email, password);
          user = userCredential.user;
          
          await updateProfile(user, { displayName: displayName.trim() });

          const cleanUsername = username.trim().replace(/^@+/, '');
          const newUserProfile = {
            uid: user.uid,
            displayName: displayName.trim(),
            username: cleanUsername,
            usernameLower: cleanUsername.toLowerCase(),
            email: user.email || '',
            avatarUrl: `https://api.dicebear.com/7.x/adventurer/svg?seed=${user.uid}`,
            createdAt: new Date().toISOString()
          };
          await setDoc(doc(db, 'users', user.uid), newUserProfile);

          await setDoc(doc(db, 'users', user.uid, 'personalization', 'profile'), {
            favoriteGenres: 'All',
            personalizationScores: {},
            recentInteractions: []
          }, { merge: true });
          
          setRegisteredUserRef(user);
          setSuccessMsg("Account successfully provisioned! Customize your cine-feed.");
          setMode('verify');
        } catch (signUpErr: any) {
          const code = (signUpErr.code || "").toLowerCase();
          const message = (signUpErr.message || "").toLowerCase();
          if (code === 'auth/email-already-in-use' || message.includes('email-already-in-use') || message.includes('auth/email-already-in-use')) {
            try {
              const signInCredential = await signInWithEmailAndPassword(auth, email, password);
              user = signInCredential.user;
              onClose();
            } catch (signInErr) {
              setMode('signin');
              setError("This email address is already in use. We have switched you to Sign In mode — please enter your password.");
            }
          } else {
            throw signUpErr;
          }
        }
      } else {
        await signInWithEmailAndPassword(auth, email, password);
        onClose();
      }
    } catch (err: any) {
      console.error(err);
      const code = (err.code || "").toLowerCase();
      const message = (err.message || "").toLowerCase();

      if (code === 'auth/operation-not-allowed' || message.includes('auth/operation-not-allowed') || message.includes('operation-not-allowed')) {
        setError("Email/Password credentials are not enabled in your Firebase setup.");
      } else if (
        code === 'auth/wrong-password' || 
        code === 'auth/user-not-found' || 
        code === 'auth/invalid-credential' || 
        message.includes('wrong-password') || 
        message.includes('user-not-found') || 
        message.includes('invalid-credential')
      ) {
        setError("Invalid email or password.");
      } else if (code === 'auth/email-already-in-use' || message.includes('email-already-in-use')) {
        setError("This email address is already in use by another account.");
      } else if (code === 'auth/weak-password' || message.includes('weak-password')) {
        setError("Password is too weak. Please use a stronger password.");
      } else if (code === 'auth/invalid-email' || message.includes('invalid-email')) {
        setError("Please enter a valid email address.");
      } else {
        setError(err.message || "Authentication failed.");
      }
    } finally {
      setLoading(false);
    }
  };

  const toggleGenreSelection = (genre: string) => {
    if (selectedGenres.includes(genre)) {
      setSelectedGenres(prev => prev.filter(g => g !== genre));
    } else {
      setSelectedGenres(prev => [...prev, genre]);
    }
  };

  const saveOnboardingChoice = async () => {
    if (selectedGenres.length < 2) {
      setError("Please select at least 2 categories.");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const targetUid = registeredUserRef?.uid || auth.currentUser?.uid;
      if (targetUid) {
        await setDoc(doc(db, 'users', targetUid, 'personalization', 'profile'), {
          favoriteGenres: selectedGenres.join(', ')
        }, { merge: true });
      }
      onClose();
    } catch (err: any) {
      console.error(err);
      setError("Unable to save preferences. Advancing...");
      setTimeout(() => {
        onClose();
      }, 1500);
    } finally {
      setLoading(false);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          id="auth_modal_overlay"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.25 }}
          className="fixed inset-0 z-[100] flex justify-end items-start select-text pointer-events-none p-4 sm:p-6 md:p-8"
        >
          {/* Subtle Ambient Blur Close Area */}
          <div 
            id="auth_modal_backdrop"
            onClick={onClose}
            className="fixed inset-0 pointer-events-auto bg-[#02040a]/40 backdrop-blur-[2px] cursor-pointer"
          />

          {/* Floating Premium Compact Modal Card */}
          <motion.div
            id="auth_modal_container"
            initial={{ opacity: 0, scale: 0.94, y: -20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.94, y: -20 }}
            transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
            style={{ scrollBehavior: 'smooth', WebkitOverflowScrolling: 'touch' }}
            className="relative z-10 w-full sm:w-[370px] bg-gradient-to-b from-[#050811]/98 via-[#04060d]/99 to-[#020307]/100 border border-white/10 hover:border-orange-500/25 backdrop-blur-3xl shadow-[0_25px_80px_rgba(0,0,0,0.92)] rounded-2xl p-6 flex flex-col justify-between pointer-events-auto mt-16 sm:mt-20 select-text transition-all duration-300 max-h-[calc(100vh-100px)] overflow-y-auto"
          >
            {/* Top Logo and Exit Trigger */}
            <div id="auth_header" className="flex items-center justify-between pb-3 border-b border-white/5 mb-5">
              <CenivoLogo size="sm" glow={true} />
              <button
                id="auth_close_btn"
                onClick={onClose}
                className="p-1.5 text-zinc-400 hover:text-white hover:bg-white/10 rounded-full border border-white/5 hover:border-orange-500/20 transition-all duration-200 active:scale-95 cursor-pointer"
                title="Close"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Content Body */}
            <div id="auth_content_body" className="flex-1 flex flex-col justify-center space-y-5">
              
              {/* Context Centered Title */}
              <div id="auth_title_section" className="text-center space-y-1 pb-1">
                <h2 id="auth_title_logo" className="text-2xl font-sans font-extrabold tracking-widest text-transparent bg-clip-text bg-gradient-to-r from-orange-500 to-red-600 uppercase">
                  CENIVO
                </h2>
                <p id="auth_subtitle" className="text-[10px] tracking-wider uppercase text-zinc-400 font-extrabold">
                  {mode === 'signin' && "Explore Limitless Content"}
                  {mode === 'signup' && "Create Cinema Account"}
                  {mode === 'forgot' && "Recover Watch Account"}
                  {mode === 'verify' && "Customize Your Feed"}
                </p>
                {mode === 'verify' && (
                  <p id="auth_sub_genres" className="text-[10px] text-zinc-400 mt-1">
                    Select 2 or more genres for smart Gemini-curated discoveries.
                  </p>
                )}
              </div>

              {/* Toast / Status Notifications */}
              <AnimatePresence mode="wait">
                {error && (
                  <motion.div
                    key="error-notif"
                    initial={{ opacity: 0, y: -5 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -5 }}
                    className="p-3 bg-red-950/40 border border-red-500/20 rounded-xl flex items-start gap-2.5 text-red-400 text-xs text-left"
                  >
                    <AlertCircle className="w-4.5 h-4.5 shrink-0 text-red-400 mt-0.5" />
                    <div>
                      <span className="font-sans font-extrabold block">Security Alert</span>
                      <span className="leading-relaxed block">{error}</span>
                    </div>
                  </motion.div>
                )}

                {successMsg && (
                  <motion.div
                    key="success-notif"
                    initial={{ opacity: 0, y: -5 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -5 }}
                    className="p-3 bg-emerald-950/40 border border-emerald-500/20 rounded-xl flex items-start gap-2.5 text-emerald-400 text-xs text-left"
                  >
                    <CheckCircle2 className="w-4.5 h-4.5 shrink-0 text-emerald-400 mt-0.5" />
                    <div>
                      <span className="font-sans font-extrabold block">Success</span>
                      <span className="leading-relaxed block">{successMsg}</span>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Tab selector switcher (for non onboarding/reset states) */}
              {mode !== 'forgot' && mode !== 'verify' && (
                <div id="auth_tabs" className="relative p-1 bg-black/60 border border-white/5 rounded-xl flex items-center select-none font-sans text-xs">
                  <button
                    id="tab_signin"
                    onClick={() => { setMode('signin'); setError(null); setSuccessMsg(null); }}
                    className={`flex-1 py-1.5 text-center rounded-lg font-bold transition-all relative z-10 block cursor-pointer ${
                      mode === 'signin' 
                        ? 'bg-gradient-to-r from-orange-500 to-red-600 text-white shadow-lg shadow-orange-500/10' 
                        : 'text-zinc-500 hover:text-zinc-350'
                    }`}
                  >
                    Sign In
                  </button>
                  <button
                    id="tab_signup"
                    onClick={() => { setMode('signup'); setError(null); setSuccessMsg(null); }}
                    className={`flex-1 py-1.5 text-center rounded-lg font-bold transition-all relative z-10 block cursor-pointer ${
                      mode === 'signup' 
                        ? 'bg-gradient-to-r from-orange-500 to-red-600 text-white shadow-lg shadow-orange-500/10' 
                        : 'text-zinc-500 hover:text-zinc-350'
                    }`}
                  >
                    Join Free
                  </button>
                </div>
              )}

              {/* Standard Credentials/Email Forms */}
              {(mode === 'signin' || mode === 'signup') && (
                <form id="email_auth_form" onSubmit={handleEmailAuthSubmit} className="space-y-4 text-left font-sans">
                  {mode === 'signup' && (
                    <>
                      <div className="space-y-1">
                        <label className="text-[10px] font-mono font-bold text-zinc-500 tracking-wider uppercase">Name</label>
                        <div className="relative">
                          <User className="absolute left-3.5 top-3 w-4 h-4 text-zinc-500" />
                          <input
                            id="signup_name_input"
                            type="text"
                            required
                            value={displayName}
                            onChange={(e) => setDisplayName(e.target.value)}
                            placeholder="e.g. watchercine"
                            className="w-full bg-black/40 hover:bg-black/60 focus:bg-black border border-white/10 focus:border-orange-500/50 rounded-xl pl-11 pr-4 py-2.5 text-sm text-white placeholder-zinc-600 transition-all duration-200 outline-none focus:ring-1 focus:ring-orange-500/20"
                          />
                        </div>
                      </div>

                      <div className="space-y-1">
                        <label className="text-[10px] font-mono font-bold text-zinc-500 tracking-wider uppercase">Username</label>
                        <div className="relative">
                          <span className="absolute left-3.5 top-[11px] text-zinc-550 text-sm font-bold">@</span>
                          <input
                            id="signup_username_input"
                            type="text"
                            required
                            value={username}
                            onChange={(e) => {
                              const cleaned = e.target.value.replace(/^@+/, '');
                              setUsername(cleaned);
                            }}
                            placeholder="username"
                            className="w-full bg-black/40 hover:bg-black/60 focus:bg-black border border-white/10 focus:border-orange-500/50 rounded-xl pl-8 pr-4 py-2.5 text-sm text-white placeholder-zinc-600 transition-all duration-200 outline-none focus:ring-1 focus:ring-orange-500/20"
                          />
                        </div>
                        {usernameStatus.status !== 'idle' && usernameStatus.message && (
                          <p 
                            className={`text-xs mt-1 font-medium flex items-center gap-1.5 ${
                              usernameStatus.status === 'available' 
                                ? 'text-emerald-500' 
                                : usernameStatus.status === 'checking'
                                ? 'text-zinc-500 font-mono text-[11px]'
                                : usernameStatus.status === 'taken'
                                ? 'text-rose-500'
                                : 'text-amber-500'
                            }`}
                          >
                            {usernameStatus.message}
                          </p>
                        )}
                      </div>
                    </>
                  )}

                  <div className="space-y-1">
                    <label className="text-[10px] font-mono font-bold text-zinc-500 tracking-wider uppercase">Email address</label>
                    <div className="relative">
                      <Mail className="absolute left-3.5 top-3 w-4 h-4 text-zinc-500" />
                      <input
                        id="email_input"
                        type="email"
                        required
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="e.g. name@host.com"
                        className="w-full bg-black/40 hover:bg-black/60 focus:bg-black border border-white/10 focus:border-orange-500/50 rounded-xl pl-11 pr-4 py-2.5 text-sm text-white placeholder-zinc-600 transition-all duration-200 outline-none focus:ring-1 focus:ring-orange-500/20"
                      />
                    </div>
                  </div>

                  <div className="space-y-1">
                    <div className="flex items-center justify-between">
                      <label className="text-[10px] font-mono font-bold text-zinc-500 tracking-wider uppercase">Password</label>
                      {mode === 'signin' && (
                        <button
                          id="forgot_pwd_btn"
                          type="button"
                          onClick={() => { setMode('forgot'); setError(null); setSuccessMsg(null); }}
                          className="text-[10px] tracking-wider uppercase font-semibold text-zinc-400 hover:text-orange-500 transition-colors cursor-pointer"
                        >
                          Forgot Password?
                        </button>
                      )}
                    </div>
                    <div className="relative">
                      <Lock className="absolute left-3.5 top-3 w-4 h-4 text-zinc-500" />
                      <input
                        id="pwd_input"
                        type={showPassword ? "text" : "password"}
                        required
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="••••••••"
                        className="w-full bg-black/40 hover:bg-black/60 focus:bg-black border border-white/10 focus:border-orange-500/50 rounded-xl pl-11 pr-11 py-2.5 text-sm text-white placeholder-zinc-600 transition-all duration-200 outline-none focus:ring-1 focus:ring-orange-500/20"
                      />
                      <button
                        id="toggle_show_pwd"
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3.5 top-3 text-zinc-500 hover:text-zinc-300 cursor-pointer text-center flex items-center justify-center h-4 w-4"
                      >
                        {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>

                  {/* Signup Requirements Gauge */}
                  {mode === 'signup' && (
                    <div className="space-y-2 pt-1">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-mono text-zinc-500 uppercase tracking-widest">Strength</span>
                        <span className={`text-[10px] font-bold uppercase tracking-wider ${
                          passwordStrengthScore <= 1 ? "text-red-500" :
                          passwordStrengthScore === 2 ? "text-orange-500" : "text-emerald-400"
                        }`}>
                          {passwordStrengthScore <= 1 && "Weak"}
                          {passwordStrengthScore === 2 && "Fair"}
                          {passwordStrengthScore >= 3 && "Strong"}
                        </span>
                      </div>
                      <div className="h-1 w-full bg-white/5 rounded-full overflow-hidden flex gap-1">
                        {[1, 2, 3, 4].map((i) => (
                          <div
                            key={i}
                            className={`h-full flex-1 rounded-full transition-all duration-300 ${
                              i <= passwordStrengthScore 
                                ? passwordStrengthScore <= 1 ? "bg-red-500" :
                                  passwordStrengthScore === 2 ? "bg-orange-500" : "bg-emerald-400"
                                : "bg-[#1A1A1A]"
                            }`}
                          />
                        ))}
                      </div>

                      {/* Confirm Password */}
                      <div className="space-y-1 pt-2">
                        <label className="text-[10px] font-mono font-bold text-zinc-500 tracking-wider uppercase">Confirm password</label>
                        <div className="relative">
                          <Lock className="absolute left-3.5 top-3 w-4 h-4 text-zinc-500" />
                          <input
                            id="confirm_pwd_input"
                            type={showConfirmPassword ? "text" : "password"}
                            required
                            value={confirmPassword}
                            onChange={(e) => setConfirmPassword(e.target.value)}
                            placeholder="••••••••"
                            className="w-full bg-black/40 hover:bg-black/60 focus:bg-black border border-white/10 focus:border-orange-500/50 rounded-xl pl-11 pr-11 py-2.5 text-sm text-white placeholder-zinc-600 transition-all duration-200 outline-none focus:ring-1 focus:ring-orange-500/20"
                          />
                          <button
                            id="toggle_show_confirm_pwd"
                            type="button"
                            onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                            className="absolute right-3.5 top-3 text-zinc-500 hover:text-zinc-300 cursor-pointer"
                          >
                            {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                          </button>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Session Persistence */}
                  <div className="flex items-center justify-between py-1 text-xs select-none">
                    <label className="flex items-center gap-2 cursor-pointer text-zinc-400 hover:text-white">
                      <input
                        id="remember_me_checkbox"
                        type="checkbox"
                        checked={rememberMe}
                        onChange={(e) => setRememberMe(e.target.checked)}
                        className="rounded border-white/10 bg-black text-orange-500 cursor-pointer focus:ring-0 outline-none w-4 h-4 transition-colors"
                      />
                      <span>Keep me signed in</span>
                    </label>
                  </div>

                  {/* Form Action */}
                  <button
                    id="submit_email_btn"
                    type="submit"
                    disabled={loading || (mode === 'signup' && usernameStatus.status !== 'available')}
                    className="w-full py-2.5 bg-gradient-to-r from-orange-500 to-red-600 hover:opacity-90 active:opacity-100 text-white font-bold text-sm rounded-xl transition-all duration-200 shadow-md shadow-orange-500/10 flex items-center justify-center gap-2 disabled:opacity-50 hover:shadow-lg hover:shadow-orange-500/20 hover:-translate-y-0.5 active:translate-y-0 active:scale-98 cursor-pointer mt-2 border border-orange-400/20"
                  >
                    {loading ? (
                      <Loader2 className="w-4 h-4 animate-spin text-white" />
                    ) : (
                      <>
                        <span>Continue</span>
                        <ArrowRight className="w-4 h-4 text-white" />
                      </>
                    )}
                  </button>
                </form>
              )}

              {/* Password Recovery Section */}
              {mode === 'forgot' && (
                <form id="forgot_pwd_form" onSubmit={handleForgotPasswordSubmit} className="space-y-4 text-left font-sans">
                  <div className="space-y-1">
                    <label className="text-[10px] font-mono font-bold text-zinc-500 tracking-wider uppercase">Registrant Email</label>
                    <div className="relative">
                      <Mail className="absolute left-3.5 top-3 w-4 h-4 text-zinc-500" />
                      <input
                        id="forgot_email_input"
                        type="email"
                        required
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="e.g. name@host.com"
                        className="w-full bg-black/40 hover:bg-black/60 focus:bg-black border border-white/10 focus:border-orange-500/50 rounded-xl pl-11 pr-4 py-2.5 text-sm text-white placeholder-zinc-600 transition-all duration-200 outline-none focus:ring-1 focus:ring-orange-500/20"
                      />
                    </div>
                  </div>

                  <button
                    id="submit_forgot_btn"
                    type="submit"
                    disabled={loading}
                    className="w-full py-2.5 bg-gradient-to-r from-orange-500 to-red-600 hover:opacity-90 text-white font-bold text-sm rounded-xl transition-all duration-200 shadow-md shadow-orange-500/10 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 mt-2 border border-orange-400/20"
                  >
                    {loading ? <Loader2 className="w-4 h-4 animate-spin text-white" /> : "Send Reset Link"}
                  </button>

                  <div className="text-center pt-2">
                    <button
                      id="forgot_back_to_signin_btn"
                      type="button"
                      onClick={() => { setMode('signin'); setError(null); setSuccessMsg(null); }}
                      className="text-xs text-zinc-500 hover:text-white transition-colors cursor-pointer"
                    >
                      ← Return to Sign In
                    </button>
                  </div>
                </form>
              )}



              {/* Onboarding Genre Preferences Form */}
              {mode === 'verify' && (
                <div id="onboarding_preferences" className="text-left space-y-4 font-sans select-none">
                  <div className="text-[10px] font-mono font-black text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-3 py-1.5 rounded-xl flex items-center gap-1.5 mb-1">
                    <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
                    <span>SECURE PROFILE REGISTERED</span>
                  </div>
                  
                  {/* Onboarding selection nodes Grid */}
                  <div id="genre_grid" className="grid grid-cols-3 gap-1.5 py-1">
                    {ONBOARDING_GENRES.map((genre) => {
                      const isSelected = selectedGenres.includes(genre);
                      return (
                        <button
                          key={genre}
                          id={`genre_btn_${genre.toLowerCase()}`}
                          type="button"
                          onClick={() => toggleGenreSelection(genre)}
                          className={`py-1.5 px-1 px-1.5 text-center text-[10px] font-bold rounded-lg border tracking-wide truncate transition-all cursor-pointer ${
                            isSelected 
                              ? "bg-gradient-to-r from-orange-500 to-red-600 text-white border-orange-500 font-extrabold shadow-lg shadow-orange-500/25" 
                              : "bg-white/5 text-zinc-400 border-white/5 hover:bg-white/10 hover:text-zinc-200 hover:border-white/10"
                          }`}
                        >
                          {genre}
                        </button>
                      );
                    })}
                  </div>

                  <div className="pt-2">
                    <button
                      id="save_onboarding_btn"
                      type="button"
                      onClick={saveOnboardingChoice}
                      disabled={selectedGenres.length < 2 || loading}
                      className="w-full py-2.5 bg-gradient-to-r from-orange-500 to-red-600 text-white hover:opacity-90 disabled:opacity-30 disabled:pointer-events-none font-bold text-sm rounded-xl shadow-lg border border-orange-400/10 flex items-center justify-center gap-1.5 cursor-pointer transition-transform duration-200 hover:-translate-y-0.5 active:translate-y-0"
                    >
                      {loading ? (
                        <Loader2 className="w-4 h-4 animate-spin text-white" />
                      ) : (
                        <>
                          <span>Establish Preferences</span>
                          <ChevronRight className="w-4 h-4 text-white" />
                        </>
                      )}
                    </button>
                  </div>
                </div>
              )}

              {/* Social Single Sign-On */}
              {mode !== 'forgot' && mode !== 'verify' && (
                <div id="social_auth_divider" className="space-y-3 pb-1">
                  <div className="relative flex items-center justify-center">
                    <div className="absolute inset-x-0 h-px bg-white/5" />
                    <span className="relative z-10 px-3 bg-[#050811] text-[9px] font-mono text-zinc-500 uppercase tracking-widest font-bold">
                      Or continue secure with
                    </span>
                  </div>

                  {/* Google Authenticate Button */}
                  <button
                    id="google_sso_btn"
                    onClick={handleGoogleSignIn}
                    disabled={loading}
                    className="w-full py-2 px-3 bg-black/40 hover:bg-black/60 text-white font-bold text-[10px] uppercase tracking-wider rounded-xl transition-all duration-200 border border-white/10 hover:border-orange-500/20 select-none flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 hover:shadow-lg hover:shadow-black/20"
                  >
                    <svg className="w-3.5 h-3.5 shrink-0" viewBox="0 0 24 24">
                      <path
                        fill="#4285F4"
                        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                      />
                      <path
                        fill="#34A853"
                        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                      />
                      <path
                        fill="#FBBC05"
                        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22c-.87-2.6-2.31-4.53-4.18-4.53h-.01z"
                      />
                      <path
                        fill="#EA4335"
                        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                      />
                    </svg>
                    <span>Google Account</span>
                  </button>
                </div>
              )}
            </div>

            {/* Terms and Clean Footer Section */}
            <div id="auth_footer" className="text-center text-[9px] font-sans text-zinc-500 pt-4 border-t border-white/5 space-y-1.5 mt-4 select-none">
              <span className="block leading-normal">
                By continuing, you agree to Cenivo's <a href="#" className="text-zinc-450 hover:text-white underline">Terms</a> and <a href="#" className="text-zinc-450 hover:text-white underline">Privacy Policy</a>
              </span>
              <span className="block font-mono text-[8px] text-zinc-500 uppercase tracking-wider text-center">
                © {new Date().getFullYear()} Cenivo Cloud Engine
              </span>
            </div>

          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
