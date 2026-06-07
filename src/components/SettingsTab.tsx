import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { db, handleFirestoreError, OperationType, auth } from '../lib/firebase';
import { doc, getDoc, setDoc, collection, query, where, getDocs, deleteDoc } from 'firebase/firestore';
import { EmailAuthProvider, GoogleAuthProvider, reauthenticateWithCredential, reauthenticateWithPopup, deleteUser } from 'firebase/auth';
import { UserProfile } from '../types';
import { useSettingsStore, PlaybackSettings, NotificationSettings, PrivacySettings } from '../stores/settingsStore';
import { useWatchlistStore } from '../stores/watchlistStore';
import { useRatingsStore } from '../stores/ratingsStore';
import { 
  User, 
  Mail, 
  Sparkles, 
  Bell, 
  Globe, 
  Play, 
  Shield, 
  LogOut, 
  Loader2, 
  Check, 
  Sliders, 
  AlertCircle,
  Heart,
  Fingerprint,
  Eye,
  Star,
  History,
  Database,
  ChevronDown,
  ChevronRight,
  Download,
  Trash2,
  Camera,
  Settings,
  X
} from 'lucide-react';
import toast from 'react-hot-toast';
import * as XLSX from 'xlsx';

interface SettingsTabProps {
  currentUser: any;
  profile: UserProfile | null;
  onProfileUpdate: (updated: UserProfile) => void;
  onSignOut: () => void;
}

export default function SettingsTab({
  currentUser,
  profile,
  onProfileUpdate,
  onSignOut
}: SettingsTabProps) {
  // Use settings from Zustand store
  const {
    profile: sProfile,
    privacy: sPrivacy,
    playback: sPlayback,
    notifications: sNotifications,
    stats,
    historyItems,
    draftBio,
    setDraftBio,
    subscribeToSettings,
    updateProfileField,
    updatePrivacyField,
    updatePlaybackField,
    updateNotificationField,
    clearWatchHistory,
    loadWatchHistory
  } = useSettingsStore();

  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [activeSection, setActiveSection] = useState<string>('profile');

  // Input bindings
  const [editedDisplayName, setEditedDisplayName] = useState('');
  const [editedUsername, setEditedUsername] = useState('');
  const [usernameStatus, setUsernameStatus] = useState<{
    status: 'idle' | 'checking' | 'available' | 'taken' | 'invalid_chars' | 'too_short' | 'too_long' | 'reserved';
    message: string;
  }>({ status: 'idle', message: '' });

  const handleUsernameChange = (val: string) => {
    const cleaned = val.replace(/^@+/, '');
    setEditedUsername(cleaned);
  };
  
  // File upload ref
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploadingImage, setUploadingImage] = useState(false);

  // Modal controls
  const [showClearHistoryModal, setShowClearHistoryModal] = useState(false);
  const [showDeleteAccountModal, setShowDeleteAccountModal] = useState(false);
  const [deleteAccountInput, setDeleteAccountInput] = useState('');
  const [deletePasswordInput, setDeletePasswordInput] = useState('');
  const [deletingAccount, setDeletingAccount] = useState(false);

  // Debounced Username Availability check
  useEffect(() => {
    const cleanUsername = editedUsername.trim().replace(/^@+/, '');
    
    if (!cleanUsername) {
      setUsernameStatus({ status: 'idle', message: '' });
      return;
    }

    if (!currentUser?.uid) {
      setUsernameStatus({ status: 'idle', message: '' });
      return;
    }

    const currentUsernameClean = (sProfile.username || '').trim().replace(/^@+/, '');

    if (cleanUsername.toLowerCase() === currentUsernameClean.toLowerCase()) {
      const isValidFormat = /^[a-zA-Z0-9_]+$/.test(cleanUsername);
      if (isValidFormat && cleanUsername.length >= 3 && cleanUsername.length <= 30) {
        setUsernameStatus({ status: 'available', message: '✓ Username available' });
      } else {
        if (!isValidFormat) {
          setUsernameStatus({ status: 'invalid_chars', message: 'Only letters, numbers and underscores are allowed.' });
        } else if (cleanUsername.length < 3) {
          setUsernameStatus({ status: 'too_short', message: 'Username must be at least 3 characters.' });
        } else if (cleanUsername.length > 30) {
          setUsernameStatus({ status: 'too_long', message: 'Username cannot exceed 30 characters.' });
        }
      }
      return;
    }

    // Client-side validations
    const isValidFormat = /^[a-zA-Z0-9_]+$/.test(cleanUsername);
    if (!isValidFormat) {
      setUsernameStatus({
        status: 'invalid_chars',
        message: 'Only letters, numbers and underscores are allowed.'
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

    const RESERVED_USERNAMES = new Set([
      'admin', 'support', 'help', 'contact', 'official', 'cenivo', 'system',
      'root', 'owner', 'staff', 'api', 'settings', 'watchlist', 'ratings',
      'discover', 'recommendation'
    ]);
    if (RESERVED_USERNAMES.has(cleanUsername.toLowerCase())) {
      setUsernameStatus({
        status: 'reserved',
        message: 'This username is reserved.'
      });
      return;
    }

    setUsernameStatus({ status: 'checking', message: 'Verifying availability...' });

    const timeoutId = setTimeout(async () => {
      try {
        const usersRef = collection(db, 'users');
        const q = query(usersRef, where('usernameLower', '==', cleanUsername.toLowerCase()));
        const querySnap = await getDocs(q);
        
        let taken = false;
        querySnap.forEach((docSnap) => {
          if (docSnap.id !== currentUser?.uid) {
            taken = true;
          }
        });

        if (taken) {
          setUsernameStatus({
            status: 'taken',
            message: 'Username already taken.'
          });
        } else {
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
  }, [editedUsername, sProfile.username, currentUser?.uid]);

  // Initialize and subscribe
  useEffect(() => {
    if (currentUser?.uid) {
      const unsubscribe = subscribeToSettings(currentUser.uid);
      
      // Seed initial input bindings
      setEditedDisplayName(sProfile.displayName || currentUser.displayName || '');
      setEditedUsername((sProfile.username || '').replace(/^@+/, ''));
      
      // Auto-restore draft bio
      const savedDraftBio = localStorage.getItem(`cenivo_draft_bio_${currentUser.uid}`);
      if (savedDraftBio) {
        setDraftBio(savedDraftBio);
      } else if (sProfile.bio) {
        setDraftBio(sProfile.bio);
      }

      return () => unsubscribe();
    }
  }, [currentUser?.uid]);

  // Keep local fields in sync when profile state loads
  useEffect(() => {
    if (sProfile) {
      if (!editedDisplayName) setEditedDisplayName(sProfile.displayName || currentUser.displayName || '');
      if (!editedUsername) setEditedUsername((sProfile.username || '').replace(/^@+/, ''));
    }
  }, [sProfile]);

  // Auto-save bio draft locally while typing
  const handleBioChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value;
    setDraftBio(val);
    if (currentUser?.uid) {
      localStorage.setItem(`cenivo_draft_bio_${currentUser.uid}`, val);
    }
  };

  // Helper to dynamically compress profile image to a reasonable size on canvas
  const compressProfileImage = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (event) => {
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement('canvas');
          let width = img.width;
          let height = img.height;
          const maxDim = 250; // max 250px on any dimension ensures rich detail and extremely lightweight footprint

          if (width > maxDim || height > maxDim) {
            if (width > height) {
              height = Math.round((height * maxDim) / width);
              width = maxDim;
            } else {
              width = Math.round((width * maxDim) / height);
              height = maxDim;
            }
          }

          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          if (!ctx) {
            resolve(event.target?.result as string);
            return;
          }

          // Clear backdrop with white before drawing to support transparent PNG conversions correctly
          ctx.fillStyle = '#FFFFFF';
          ctx.fillRect(0, 0, width, height);

          ctx.drawImage(img, 0, 0, width, height);
          
          // Export as compressed jpeg with 0.7 quality to keep state document highly under limit
          const compressedBase64 = canvas.toDataURL('image/jpeg', 0.7);
          resolve(compressedBase64);
        };
        img.onerror = () => {
          reject(new Error("Failed to load image for compression"));
        };
        img.src = event.target?.result as string;
      };
      reader.onerror = () => {
        reject(new Error("Failed to read image file"));
      };
      reader.readAsDataURL(file);
    });
  };

  // Upload/replace or remove avatar image
  const handleImageButtonClick = (e: React.MouseEvent) => {
    e.preventDefault();
    if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !currentUser?.uid) return;

    setUploadingImage(true);
    const toastId = toast.loading("Processing and compressing profile image...");
    try {
      // Dynamic compression to prevent Firestore size-exceeded limits
      const compressedBase64 = await compressProfileImage(file);
      
      // Save base64 image path
      await updateProfileField(currentUser.uid, {
        avatarUrl: compressedBase64
      });
      
      // Notify original profile state
      onProfileUpdate({
        ...(profile || {}),
        avatarUrl: compressedBase64
      } as UserProfile);

      toast.success("Profile photo updated successfully!", { id: toastId });
      setUploadingImage(false);
    } catch (err) {
      console.error("Profile file compression or upload failed:", err);
      toast.error("Failed uploading profile photo", { id: toastId });
      setUploadingImage(false);
    }
  };

  const handleRemovePhoto = async (e: React.MouseEvent) => {
    e.preventDefault();
    if (!currentUser?.uid) return;

    const defaultSeedUrl = `https://api.dicebear.com/7.x/adventurer/svg?seed=${currentUser.uid}`;
    const toastId = toast.loading("Removing profile photo...");
    try {
      await updateProfileField(currentUser.uid, {
        avatarUrl: defaultSeedUrl
      });

      onProfileUpdate({
        ...(profile || {}),
        avatarUrl: defaultSeedUrl
      } as UserProfile);

      toast.success("Profile photo removed!", { id: toastId });
    } catch (err) {
      toast.error("Failed removing photo", { id: toastId });
    }
  };

  // Profile Form Change Checking
  const isUsernameValidAndAvailable = usernameStatus.status === 'available';

  const hasProfileChanges = 
    (editedDisplayName !== sProfile.displayName ||
     editedUsername !== sProfile.username ||
     draftBio !== sProfile.bio) &&
    isUsernameValidAndAvailable;

  // Save profile and unique username verification
  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser?.uid) return;
    if (!hasProfileChanges) return;

    setSaving(true);
    setSaveSuccess(false);

    try {
      const nextUsernameClean = editedUsername.trim().replace(/^@+/, '');
      await updateProfileField(currentUser.uid, {
        displayName: editedDisplayName.trim(),
        username: nextUsernameClean,
        bio: draftBio
      });

      onProfileUpdate({
        ...(profile || {}),
        displayName: editedDisplayName.trim(),
        username: nextUsernameClean,
        bio: draftBio
      } as UserProfile);

      // Clean local storage draft upon successful database commit
      localStorage.removeItem(`cenivo_draft_bio_${currentUser.uid}`);

      setSaveSuccess(true);
      toast.success("Settings saved successfully!");
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (err) {
      console.error(err);
      toast.error("Error saving profile changes. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  // Dynamic Excel spreadsheet SheetJS generation
  const handleExportProfile = () => {
    try {
      const data = [{
        "UID": currentUser.uid,
        "Email": currentUser.email || '',
        "Display Name": sProfile.displayName || currentUser.displayName || '',
        "Username": sProfile.username || '',
        "Bio": sProfile.bio || '',
        "Favorite Genres": profile?.favoriteGenres || 'All',
        "Registered On": profile?.createdAt || new Date().toISOString()
      }];

      const ws = XLSX.utils.json_to_sheet(data);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Profile Data");
      XLSX.writeFile(wb, `Cenivo_Profile_Data_${currentUser.uid.substring(0, 5)}.xlsx`);
      toast.success("Excel sheet exported!");
    } catch (e) {
      toast.error("Export failed!");
    }
  };

  const handleExportWatchlist = () => {
    try {
      const watchlistItems = useWatchlistStore.getState().watchlist;
      if (watchlistItems.length === 0) {
        toast.error("Watchlist log is currently empty.");
        return;
      }

      const formatted = watchlistItems.map((item, index) => ({
        "Serial No": index + 1,
        "Item Key ID": item.id,
        "TMDB reference ID": item.titleId,
        "Title": item.title,
        "Media Type": item.type,
        "Year of Release": item.year,
        "Platform Rating": item.rating,
        "Added At": item.addedAt
      }));

      const ws = XLSX.utils.json_to_sheet(formatted);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Watchlist_Log");
      XLSX.writeFile(wb, `Cenivo_Watchlist_Log_${currentUser.uid.substring(0, 5)}.xlsx`);
      toast.success("Watchlist sheet exported!");
    } catch (e) {
      toast.error("Export failed!");
    }
  };

  const handleExportRatings = () => {
    try {
      const ratingsItems = useRatingsStore.getState().ratings;
      if (ratingsItems.length === 0) {
        toast.error("Ratings log is currently empty.");
        return;
      }

      const formatted = ratingsItems.map((item, index) => ({
        "Serial No": index + 1,
        "Rating Key ID": item.id,
        "TMDB reference ID": item.titleId,
        "Title": item.title,
        "Your Rating (out of 10)": item.rating,
        "Review text": item.reviewText || '',
        "Created At": item.createdAt
      }));

      const ws = XLSX.utils.json_to_sheet(formatted);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Ratings_Log");
      XLSX.writeFile(wb, `Cenivo_Ratings_Log_${currentUser.uid.substring(0, 5)}.xlsx`);
      toast.success("Ratings sheet exported!");
    } catch (e) {
      toast.error("Export failed!");
    }
  };

  // Google Login Check
  const isGoogleAccount = currentUser?.providerData?.some((p: any) => p.providerId === 'google.com');

  const handleChangePasswordClick = (e: React.MouseEvent) => {
    e.preventDefault();
    if (isGoogleAccount) {
      toast("Google Account Active. Authenticated securely via Sign-In with Google. Passwords cannot be set here.", {
        icon: 'ℹ️',
        className: 'bg-zinc-900 border border-zinc-800 text-zinc-100 font-sans'
      });
    } else {
      alert("Redirecting to Firebase Authentication re-auth reset flow.");
    }
  };

  // Sign out everywhere (Session version control system)
  const handleSignOutEverywhere = async () => {
    if (!currentUser?.uid) return;

    const toastId = toast.loading("Signing out of all active devices...");
    try {
      const userRef = doc(db, 'users', currentUser.uid);
      const userSnap = await getDoc(userRef);
      const currentVersion = userSnap.exists() ? (userSnap.data().sessionVersion || 0) : 0;
      
      // Increment sessionVersion in database to force disconnect elsewhere
      await setDoc(userRef, {
        sessionVersion: currentVersion + 1
      }, { merge: true });

      toast.success("Successfully invalidated all other sessions!", { id: toastId });
      
      // Logout current device
      setTimeout(() => {
        onSignOut();
      }, 1000);
    } catch (e) {
      toast.error("Couldn't process session reset", { id: toastId });
    }
  };

  // Clear All Watch History records
  const handleConfirmClearHistory = async () => {
    if (!currentUser?.uid) return;
    const toastId = toast.loading("Clearing watch history...");
    try {
      await clearWatchHistory(currentUser.uid);
      setShowClearHistoryModal(false);
      toast.success("Watch History cleared completely!", { id: toastId });
    } catch (e) {
      toast.error("Failed clearing history data", { id: toastId });
    }
  };

  // Delete Account Purge Flow
  const handleConfirmDeleteAccount = async () => {
    if (!currentUser?.uid) return;

    const isPasswordUser = currentUser.providerData.some(p => p.providerId === 'password');
    if (isPasswordUser && !deletePasswordInput) {
       toast.error("Please enter your current password to confirm deletion.");
       return;
    }

    setDeletingAccount(true);
    const toastId = toast.loading("Processing account deletion...");
    try {
      const uid = currentUser.uid;

      // 1. Re-authenticate
      if (isPasswordUser) {
        const credential = EmailAuthProvider.credential(currentUser.email!, deletePasswordInput);
        await reauthenticateWithCredential(currentUser, credential);
      } else {
        const provider = new GoogleAuthProvider();
        await reauthenticateWithPopup(currentUser, provider);
      }

      // 2. Delete user data based on actual schema in firestore.rules
      const watchlistSnap = await getDocs(collection(db, 'users', uid, 'watchlist'));
      const deleteWatchlistPromises = watchlistSnap.docs.map(docSnap => deleteDoc(docSnap.ref));
      
      const ratingsSnap = await getDocs(collection(db, 'users', uid, 'ratings'));
      const deleteRatingsPromises = ratingsSnap.docs.map(docSnap => deleteDoc(docSnap.ref));

      const sections = ['profile', 'privacy', 'playback', 'notifications', 'activity'];
      const deleteSettingsPromises = sections.map(sec => deleteDoc(doc(db, 'users', uid, 'settings', sec)));

      await Promise.all([
         ...deleteWatchlistPromises,
         ...deleteRatingsPromises,
         ...deleteSettingsPromises,
         deleteDoc(doc(db, 'users', uid, 'personalization', 'profile'))
      ]);

      await deleteDoc(doc(db, 'users', uid));

      // 3. Revoke sessions via server
      try {
        const idToken = await currentUser.getIdToken();
        await fetch('/api/revoke-sessions', {
           method: 'POST',
           headers: { 
             'Content-Type': 'application/json',
             'Authorization': `Bearer ${idToken}`
           },
           body: JSON.stringify({ uid })
        });
      } catch (err) {
        console.warn('Revoke sessions error', err);
      }

      // 4. Force local logout and clear caches
      await useWatchlistStore.getState().clear();
      await useRatingsStore.getState().clear();
      sessionStorage.clear();
      localStorage.clear();

      // 5. Delete Firebase Auth user
      await deleteUser(currentUser);

      toast.success("Account deleted successfully. We're sorry to see you go.", { id: toastId });
      
      window.location.href = '/'; 

    } catch (e: any) {
      console.error(e);
      if (e.code === 'auth/wrong-password' || e.code === 'auth/invalid-credential') {
         toast.error("Incorrect password.", { id: toastId });
      } else if (e.code === 'auth/popup-closed-by-user') {
         toast.error("Google sign-in popup closed. Deletion cancelled.", { id: toastId });
      } else if (e.code === 'auth/requires-recent-login') {
         toast.error("Please log in again to delete your account.", { id: toastId });
      } else {
         toast.error("Error during account deletion.", { id: toastId });
      }
      setDeletingAccount(false);
    }
  };

  const menuSections = [
    { id: 'profile', icon: User, label: 'Account & Profile' },
    { id: 'history', icon: History, label: 'Watch History & Activity' },
    { id: 'playback', icon: Play, label: 'Playback & Streaming' },
    { id: 'privacy', icon: Shield, label: 'Privacy & Security' },
    { id: 'data', icon: Database, label: 'Account Data Management' }
  ];

  return (
    <div className="max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-12 text-left flex flex-col lg:flex-row gap-8 lg:gap-12 relative items-start">
      
      {/* HIDDEN INPUT FOR FILE UPLOAD */}
      <input 
        type="file" 
        ref={fileInputRef} 
        onChange={handleFileChange} 
        className="hidden" 
        accept="image/*" 
      />

      {/* LEFT NAVIGATION SIDEBAR */}
      <div className="lg:w-80 flex-shrink-0 lg:sticky lg:top-24 space-y-6 z-20 w-full">
        {/* Profile Card */}
        <div className="bg-black/40 border border-white/5 rounded-3xl p-6 relative overflow-hidden group backdrop-blur-xl">
          <div className="absolute inset-0 bg-gradient-to-br from-white/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
          <div className="flex items-center gap-4 relative z-10">
            <div className="relative">
              <img
                src={sProfile.avatarUrl || `https://api.dicebear.com/7.x/adventurer/svg?seed=${currentUser.uid}`}
                alt="Profile Avatar"
                className="w-16 h-16 rounded-full object-cover border border-white/10 bg-zinc-900 shadow-[0_0_20px_rgba(255,255,255,0.05)]"
                referrerPolicy="no-referrer"
              />
              <button 
                onClick={handleImageButtonClick}
                disabled={uploadingImage}
                type="button"
                className="absolute bottom-0 right-[-4px] w-6 h-6 bg-zinc-800 border border-white/10 rounded-full flex items-center justify-center text-white hover:bg-zinc-700 transition"
              >
                {uploadingImage ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Camera className="w-3 h-3" />}
              </button>
            </div>
            <div className="min-w-0">
              <h4 className="font-sans font-extrabold text-lg text-white truncate tracking-tight">
                {sProfile.displayName || currentUser.displayName || 'Guest'}
              </h4>
              <p className="font-mono text-[10px] sm:text-xs text-zinc-500 truncate">
                {sProfile.username ? `@${sProfile.username.replace(/^@+/, '')}` : currentUser.email}
              </p>
              {sProfile.avatarUrl && !sProfile.avatarUrl.includes('dicebear.com') && (
                <button onClick={handleRemovePhoto} className="text-[10px] text-rose-400 hover:text-rose-300 font-semibold underline mt-1 block">Remove Image</button>
              )}
            </div>
          </div>
          
          <div className="pt-5 mt-5 border-t border-white/5 space-y-2 relative z-10">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-mono text-zinc-500 uppercase tracking-widest font-bold">Plan</span>
              <span className="text-xs text-amber-500 font-bold flex items-center gap-1.5"><Sparkles className="w-3.5 h-3.5" /> Cenivo Elite</span>
            </div>
          </div>
        </div>

        {/* Menu Scroller */}
        <nav className="bg-[#0B0B0B]/80 border border-white/5 rounded-3xl p-3 flex flex-col gap-1 lg:max-h-[55vh] overflow-y-auto no-scrollbar shadow-2xl">
          {menuSections.map((sec) => (
            <button
              type="button"
              key={sec.id}
              onClick={() => {
                setActiveSection(sec.id);
                window.scrollTo({ top: 0, behavior: 'smooth' });
              }}
              className={`w-full flex items-center justify-between px-4 py-3.5 rounded-2xl transition-all group ${
                activeSection === sec.id 
                  ? 'bg-white/10 text-white shadow-lg border border-white/10 scale-[1.02]' 
                  : 'text-zinc-500 hover:bg-white/5 hover:text-zinc-300 border border-transparent'
              }`}
            >
              <div className="flex items-center gap-3">
                <sec.icon className={`w-4 h-4 transition-colors ${activeSection === sec.id ? 'text-amber-500' : 'group-hover:text-white'}`} />
                <span className="text-sm font-semibold tracking-wide">{sec.label}</span>
              </div>
              {activeSection === sec.id && <ChevronRight className="w-4 h-4 text-amber-500" />}
            </button>
          ))}
        </nav>

        <button
          onClick={onSignOut}
          className="w-full py-3.5 bg-rose-500/10 hover:bg-rose-500/20 text-rose-500 font-bold text-xs rounded-2xl border border-rose-500/10 transition-all flex items-center justify-center gap-2"
        >
          <LogOut className="w-4 h-4" />
          Sign Out Extensively
        </button>
      </div>

      {/* RIGHT CONTENT AREA */}
      <div className="flex-1 w-full min-w-0 pb-32">
        <form onSubmit={handleSaveProfile} className="space-y-6">
          
          {/* HEADER ROW WITH SAVE BUTTON */}
          <div className="flex items-center justify-between sticky top-[72px] lg:top-4 z-40 bg-black/60 backdrop-blur-xl border border-white/10 p-4 rounded-3xl shadow-2xl mb-8">
            <div className="flex items-center gap-3">
              {React.createElement(menuSections.find(m => m.id === activeSection)?.icon || Settings, { className: "w-5 h-5 text-zinc-300" })}
              <h2 className="font-sans font-extrabold text-lg sm:text-xl text-white tracking-tight">
                {menuSections.find(m => m.id === activeSection)?.label}
              </h2>
            </div>
            {activeSection === 'profile' && (
              <button
                type="submit"
                disabled={saving || !hasProfileChanges}
                className="px-6 py-2.5 bg-white text-black font-bold rounded-2xl hover:bg-zinc-200 transition-all text-xs sm:text-sm flex items-center gap-2 cursor-pointer shadow-[0_0_20px_rgba(255,255,255,0.15)] hover:shadow-[0_0_25px_rgba(255,255,255,0.3)] disabled:opacity-30 disabled:cursor-not-allowed"
              >
                {saving ? <><Loader2 className="w-4 h-4 animate-spin" /> Saving...</> : saveSuccess ? <><Check className="w-4 h-4 text-green-600" /> Saved</> : 'Save Changes'}
              </button>
            )}
          </div>

          <div className="bg-[#0B0B0B]/90 border border-white/5 rounded-3xl p-6 sm:p-10 shadow-2xl min-h-[60vh] relative overflow-hidden backdrop-blur-md">
            {/* Ambient Background Glows */}
            <div className="absolute top-0 right-0 w-96 h-96 bg-amber-500/5 blur-[120px] rounded-full pointer-events-none" />
            <div className="absolute bottom-0 left-0 w-96 h-96 bg-blue-500/5 blur-[120px] rounded-full pointer-events-none" />
            
            <AnimatePresence mode="wait">
              <motion.div
                key={activeSection}
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -15 }}
                transition={{ duration: 0.2 }}
                className="w-full relative z-10"
              >
                {/* 1. PROFILE */}
                {activeSection === 'profile' && (
                  <div className="space-y-8">
                    <p className="text-zinc-400 text-sm font-light">Set your community presence identities.</p>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                      <div className="space-y-2 font-sans">
                        <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest block font-mono">Username</label>
                        <input 
                          type="text" 
                          value={editedUsername} 
                          onChange={(e) => handleUsernameChange(e.target.value)} 
                          className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3.5 text-white text-sm focus:outline-none focus:border-white/30 transition-colors font-medium" 
                          placeholder="username" 
                        />
                        {usernameStatus.status !== 'idle' && usernameStatus.message && (
                          <p 
                            className={`text-xs mt-1.5 font-medium flex items-center gap-1.5 ${
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
                      <div className="space-y-2">
                        <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest block">Display Name</label>
                        <input 
                          type="text" 
                          value={editedDisplayName} 
                          onChange={(e) => setEditedDisplayName(e.target.value)} 
                          className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3.5 text-white text-sm focus:outline-none focus:border-white/30 transition-colors font-medium" 
                        />
                      </div>
                      <div className="space-y-2 md:col-span-2">
                        <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest block">Profile Bio</label>
                        <textarea 
                          rows={3} 
                          value={draftBio} 
                          onChange={handleBioChange} 
                          maxLength={250} 
                          className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3.5 text-white text-sm focus:outline-none focus:border-white/30 transition-colors font-medium resize-none space-normal" 
                          placeholder="Love mind-bending sci-fi and dark thrillers..." 
                        />
                        <p className="text-[10px] font-mono text-zinc-500 text-right">{draftBio?.length || 0}/250</p>
                      </div>
                    </div>
                  </div>
                )}

                {/* 2. PLAYBACK & STREAMING */}
                {activeSection === 'playback' && (
                  <div className="space-y-4">
                    {[
                      { id: 'autoPlayTrailers', title: 'Auto Play Trailers', desc: 'Play trailers automatically on hover in the background.' },
                      { id: 'trailerAudio', title: 'Trailer Audio', desc: 'Play ambient trailers with sound activated by default.' },
                      { id: 'hoverPreviewVideos', title: 'Hover Preview Videos', desc: 'Show quick video snippets directly on movie cards.' },
                      { id: 'autoPlayNextTrailer', title: 'Auto Play Next Trailer', desc: 'Continuously play subsequent trailers in modals.' },
                      { id: 'dataSaver', title: 'Data Saver Mode', desc: 'Limit background video quality and use compressed images for lower bandwidth usage.' }
                    ].map(opt => {
                      const isChecked = sPlayback[opt.id as keyof PlaybackSettings];
                      return (
                        <div 
                          key={opt.id} 
                          className="flex items-center justify-between p-5 sm:p-6 bg-[#050505] border border-white/5 hover:border-white/10 transition-colors rounded-2xl group cursor-pointer" 
                          onClick={() => updatePlaybackField(currentUser.uid, opt.id as keyof PlaybackSettings, !isChecked)}
                        >
                          <div>
                            <h5 className={`font-bold text-sm sm:text-base transition-colors ${isChecked ? 'text-white' : 'text-zinc-300 group-hover:text-white'}`}>{opt.title}</h5>
                            <p className="text-zinc-500 font-light text-xs sm:text-sm mt-1">{opt.desc}</p>
                          </div>
                          <button 
                            type="button" 
                            className={`relative flex items-center shrink-0 w-12 h-6 sm:w-14 sm:h-7 rounded-full p-1 transition-all ${isChecked ? 'bg-amber-500' : 'bg-white/10'}`}
                          >
                            <div className={`w-4 h-4 sm:w-5 sm:h-5 rounded-full bg-white transition-transform ${isChecked ? 'translate-x-6 sm:translate-x-7 shadow-sm' : 'opacity-60'}`} />
                          </button>
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* 4. PRIVACY */}
                {activeSection === 'privacy' && (
                  <div className="space-y-8">
                    <div className="space-y-4">
                      {[
                        { id: 'publicProfile', title: 'Public Profile Visibility', desc: 'Allow others to see your user profile node.' },
                        { id: 'showWatchlist', title: 'Show Watchlist', desc: 'Allow others to view your active watchlist arrays.' },
                        { id: 'showRatings', title: 'Show Ratings', desc: 'Display your numerical ratings on your public profile.' }
                      ].map(opt => {
                        const isChecked = sPrivacy[opt.id as keyof PrivacySettings];
                        return (
                          <div 
                            key={opt.id} 
                            className="flex items-center justify-between p-5 bg-[#050505] border border-white/5 rounded-2xl cursor-pointer hover:border-white/10 transition-colors" 
                            onClick={() => updatePrivacyField(currentUser.uid, opt.id as keyof PrivacySettings, !isChecked)}
                          >
                            <div>
                              <h5 className="text-white font-bold text-sm">{opt.title}</h5>
                              <p className="text-zinc-500 text-xs mt-1 font-light">{opt.desc}</p>
                            </div>
                            <button 
                              type="button" 
                              className={`relative flex items-center shrink-0 w-12 h-6 sm:w-14 sm:h-7 rounded-full p-1 transition-all ${isChecked ? 'bg-amber-500' : 'bg-white/10'}`}
                            >
                              <div className={`w-4 h-4 sm:w-5 sm:h-5 rounded-full bg-white transition-transform ${isChecked ? 'translate-x-6 sm:translate-x-7 box-shadow-sm' : 'opacity-60'}`} />
                            </button>
                          </div>
                        );
                      })}
                    </div>
                    
                    <div className="pt-10 border-t border-white/5 space-y-4">
                      <div className="space-y-1 mb-6">
                        <h4 className="text-white font-extrabold text-base tracking-tight">Security Actions</h4>
                        <p className="text-xs text-zinc-500 font-light">Manage local authorizations.</p>
                      </div>
                      
                      <button 
                        type="button" 
                        onClick={handleChangePasswordClick} 
                        className={`px-6 py-4 w-full sm:w-auto bg-white/5 hover:bg-white/10 rounded-xl text-sm font-bold transition flex items-center justify-center gap-2 border border-white/10 ${isGoogleAccount ? "opacity-60 cursor-not-allowed" : "text-white"}`}
                      >
                        Change Associated Password
                      </button>

                      <button 
                        type="button" 
                        onClick={handleSignOutEverywhere} 
                        className="px-6 py-4 w-full sm:w-auto bg-rose-500/10 hover:bg-rose-500/20 rounded-xl text-sm font-bold text-rose-500 transition flex items-center justify-center gap-2 border border-rose-500/20 mt-2"
                      >
                        Sign Out Everywhere
                      </button>
                    </div>
                  </div>
                )}

                {/* 5. WATCH HISTORY */}
                {activeSection === 'history' && (
                  <div className="space-y-8 text-center py-12 px-4 rounded-[3rem] border border-white/5 bg-[#050505]">
                    <div className="w-20 h-20 bg-white/5 rounded-3xl mx-auto flex items-center justify-center border border-white/10 mb-6 shadow-xl">
                      <History className="w-8 h-8 text-zinc-400" />
                    </div>
                    <h3 className="text-white font-extrabold text-2xl tracking-tight">Watch History Analytics</h3>
                    <p className="text-zinc-400 font-light text-sm max-w-sm mx-auto leading-relaxed mt-2">
                      Computed live from your synced playback activity logs.
                    </p>
                    
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-10 max-w-2xl mx-auto">
                      <div className="p-6 bg-white/5 rounded-3xl border border-white/10 hover:bg-white/10 transition-colors">
                        <div className="text-3xl sm:text-4xl font-black text-white">{stats.moviesViewed}</div>
                        <div className="text-[10px] text-zinc-500 mt-2 uppercase font-extrabold tracking-widest">Movies</div>
                      </div>
                      <div className="p-6 bg-white/5 rounded-3xl border border-white/10 hover:bg-white/10 transition-colors">
                        <div className="text-3xl sm:text-4xl font-black text-white">{stats.seriesViewed}</div>
                        <div className="text-[10px] text-zinc-500 mt-2 uppercase font-extrabold tracking-widest">Series</div>
                      </div>
                      <div className="p-6 bg-white/5 rounded-3xl border border-white/10 hover:bg-white/10 transition-colors">
                        <div className="text-3xl sm:text-4xl font-black text-amber-500 drop-shadow-md">{stats.minutesWatched}</div>
                        <div className="text-[10px] text-zinc-500 mt-2 uppercase font-extrabold tracking-widest">Minutes Played</div>
                      </div>
                      <div className="p-6 bg-white/5 rounded-3xl border border-white/10 hover:bg-white/10 transition-colors">
                        <div className="text-3xl sm:text-4xl font-black text-white">{stats.trailersPlayed}</div>
                        <div className="text-[10px] text-zinc-500 mt-2 uppercase font-extrabold tracking-widest">Trailers</div>
                      </div>
                    </div>

                    {historyItems.length > 0 && (
                      <div className="mt-8 text-left max-w-2xl mx-auto space-y-3">
                        <h4 className="text-xs font-bold text-zinc-400 uppercase tracking-widest">Recent Activity Stack</h4>
                        <div className="max-h-52 overflow-y-auto border border-white/5 rounded-2xl bg-black/60 p-4 space-y-2 no-scrollbar">
                          {historyItems.slice(0, 5).map((item) => (
                            <div key={item.id} className="flex justify-between items-center text-xs text-zinc-300 border-b border-white/5 pb-2 last:border-0 last:pb-0">
                              <div className="truncate pr-4">
                                <p className="font-bold text-white truncate">{item.title}</p>
                                <p className="text-[10px] text-zinc-500 uppercase">{item.mediaType}</p>
                              </div>
                              <span className="shrink-0 text-zinc-500 font-mono text-[10px]">
                                {new Date(item.watchedAt).toLocaleDateString()}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                    
                    <button 
                      type="button" 
                      onClick={() => setShowClearHistoryModal(true)}
                      className="mt-10 px-8 py-3 bg-white/5 border border-white/10 text-white text-xs uppercase tracking-widest font-extrabold rounded-full hover:bg-white/10 transition-colors"
                    >
                      Clear Cloud History Matrix
                    </button>
                  </div>
                )}

                {/* 6. DATA */}
                {activeSection === 'data' && (
                  <div className="space-y-12">
                    <div className="space-y-6">
                      <div className="space-y-1">
                        <h4 className="text-white font-extrabold text-base tracking-tight">Export Application Data</h4>
                        <p className="text-xs text-zinc-500 font-light">Download Excel spreadsheet exports of your account interactions.</p>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                        <button 
                          onClick={handleExportProfile}
                          type="button" 
                          className="p-8 flex flex-col items-center justify-center gap-4 bg-[#050505] hover:bg-white/5 rounded-[2rem] border border-white/10 transition group cursor-pointer shadow-lg hover:border-white/20"
                        >
                          <Download className="w-8 h-8 text-zinc-500 group-hover:text-white transition-colors" />
                          <span className="text-sm font-bold text-white tracking-wide">Profile Data</span>
                        </button>
                        <button 
                          onClick={handleExportWatchlist}
                          type="button" 
                          className="p-8 flex flex-col items-center justify-center gap-4 bg-[#050505] hover:bg-white/5 rounded-[2rem] border border-white/10 transition group cursor-pointer shadow-lg hover:border-white/20"
                        >
                          <Download className="w-8 h-8 text-zinc-500 group-hover:text-white transition-colors" />
                          <span className="text-sm font-bold text-white tracking-wide">Watchlist Log</span>
                        </button>
                        <button 
                          onClick={handleExportRatings}
                          type="button" 
                          className="p-8 flex flex-col items-center justify-center gap-4 bg-[#050505] hover:bg-white/5 rounded-[2rem] border border-white/10 transition group cursor-pointer shadow-lg hover:border-white/20"
                        >
                          <Download className="w-8 h-8 text-zinc-500 group-hover:text-white transition-colors" />
                          <span className="text-sm font-bold text-white tracking-wide">Ratings Log</span>
                        </button>
                      </div>
                    </div>
                    
                    <div className="pt-10 border-t border-rose-500/10 space-y-6">
                      <div className="space-y-1">
                        <h4 className="text-rose-500 font-extrabold text-base tracking-tight">Danger Zone</h4>
                        <p className="text-xs text-rose-500/50 font-light">Irreversible system operations.</p>
                      </div>
                      <div className="p-6 bg-rose-950/10 border border-rose-500/20 rounded-3xl flex max-sm:flex-col sm:items-center justify-between gap-6">
                        <div>
                           <h5 className="font-bold text-rose-400 text-sm">Delete Account Permanently</h5>
                           <p className="text-xs text-rose-500/60 mt-1">This will permanently purge your profile, watchlist, and ratings from the database.</p>
                        </div>
                        <button 
                          type="button" 
                          onClick={() => setShowDeleteAccountModal(true)} 
                          className="px-6 py-3 w-full sm:w-auto bg-rose-500/10 hover:bg-rose-500/20 rounded-xl text-sm font-bold text-rose-500 transition-colors flex items-center justify-center gap-2 border border-rose-500/20 shrink-0"
                        >
                          <Trash2 className="w-4 h-4" />
                          Erase Account
                        </button>
                      </div>
                    </div>
                  </div>
                )}

              </motion.div>
            </AnimatePresence>
          </div>
        </form>
      </div>

      {/* CONFIRMATION MODAL - HISTORY PURGE */}
      <AnimatePresence>
        {showClearHistoryModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4">
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-[#0C0E14] border border-white/10 rounded-3xl p-6 sm:p-8 max-w-md w-full relative space-y-4"
            >
              <h3 className="text-white font-extrabold text-lg tracking-tight">Clear Cloud History Matrix?</h3>
              <p className="text-xs text-zinc-400 leading-relaxed font-light">
                This is a terminal database request. All recorded trailer logs and minutes watched statistics will be deleted permanently.
              </p>
              <div className="flex gap-4 pt-2 justify-end">
                <button 
                  type="button"
                  onClick={() => setShowClearHistoryModal(false)}
                  className="px-5 py-2.5 bg-white/5 hover:bg-white/10 text-white rounded-xl text-xs font-semibold border border-white/5"
                >
                  Cancel
                </button>
                <button 
                  type="button"
                  onClick={handleConfirmClearHistory}
                  className="px-5 py-2.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-semibold"
                >
                  DELETE History logs
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* CONFIRMATION MODAL - FULL ACCOUNT PURGE */}
      <AnimatePresence>
        {showDeleteAccountModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-md p-4">
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-[#0F0C0F] border border-rose-500/20 rounded-3xl p-6 sm:p-8 max-w-md w-full relative space-y-5"
            >
              <div>
                <h3 className="text-white font-extrabold text-xl tracking-tight">Delete Account?</h3>
                <p className="text-sm text-zinc-400 mt-2">
                  This action is permanent.
                </p>
                <p className="text-sm text-zinc-400 mt-1">
                  Your ratings, watchlist, profile data, and saved information will be permanently removed.
                </p>
              </div>

              {currentUser?.providerData?.some(p => p.providerId === 'password') && (
                <div className="space-y-2 pt-2">
                  <label className="text-[12px] font-semibold text-zinc-300 block">
                    Confirm your Password:
                  </label>
                  <input 
                    type="password" 
                    value={deletePasswordInput}
                    onChange={(e) => setDeletePasswordInput(e.target.value)}
                    className="w-full bg-[#111111] border border-white/10 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-rose-500/50"
                    placeholder="Password"
                    disabled={deletingAccount}
                  />
                </div>
              )}

              <div className="flex gap-4 justify-end pt-4">
                <button 
                  type="button"
                  onClick={() => {
                    setShowDeleteAccountModal(false);
                    setDeletePasswordInput('');
                  }}
                  disabled={deletingAccount}
                  className="px-5 py-2.5 bg-white/5 hover:bg-white/10 text-white rounded-xl text-sm font-semibold border border-white/5 disabled:opacity-50"
                >
                  Cancel
                </button>
                <button 
                  type="button"
                  onClick={handleConfirmDeleteAccount}
                  disabled={deletingAccount}
                  className="px-5 py-2.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-sm font-bold flex items-center gap-2"
                >
                  {deletingAccount ? <><Loader2 className="w-4 h-4 animate-spin" /> </> : null}
                  Delete Permanently
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

    </div>
  );
}
