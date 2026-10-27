import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import {
  getAuth,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  sendPasswordResetEmail,
  updatePassword as firebaseUpdatePassword,
  reauthenticateWithCredential,
  EmailAuthProvider,
  updateProfile as firebaseUpdateProfile,
  browserLocalPersistence,
  browserSessionPersistence,
  setPersistence,
  GoogleAuthProvider,
  signInWithPopup,
  signInWithRedirect,
  getRedirectResult,
} from 'firebase/auth';
import type { User as FirebaseUser } from 'firebase/auth';
import {
  doc,
  getDoc,
  setDoc,
  updateDoc,
  serverTimestamp,
} from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { app, db, storage } from '../firebase';
import { isStandalonePwa, sanitizeInternalRedirect } from '../utils/authRedirect';

// ──────────────────────────────────────────────────────────────
// Types
// ──────────────────────────────────────────────────────────────
export interface UserProfile {
  uid: string;
  name: string;
  email: string;
  telefone?: string;
  cpf?: string;
  foto?: string;
  role: 'client' | 'admin' | 'banned';
  unlockedBadges?: string[];
  referredBy?: string | null;
  firstOrderPlaced?: boolean;
  referralRewarded?: boolean;
  createdAt?: Date;
  updatedAt?: Date;
  lastLogin?: Date;
  onboardingComplete?: boolean;
}

interface AuthContextType {
  user: FirebaseUser | null;
  userProfile: UserProfile | null;
  loading: boolean;
  isAdmin: boolean;
  profileLoading: boolean;
  redirectLoading: boolean;
  redirectError: unknown | null;
  // Auth actions
  login: (email: string, password: string, rememberMe?: boolean) => Promise<FirebaseUser>;
  loginWithGoogle: (options?: { returnUrl?: string; preferRedirect?: boolean }) => Promise<FirebaseUser | null>;
  register: (data: RegisterData) => Promise<FirebaseUser>;
  logout: () => Promise<void>;
  sendPasswordReset: (email: string) => Promise<void>;
  changePassword: (currentPassword: string, newPassword: string) => Promise<void>;
  // Profile actions
  updateUserProfile: (data: Partial<Pick<UserProfile, 'name' | 'telefone' | 'cpf' | 'unlockedBadges' | 'onboardingComplete'>>) => Promise<void>;
  uploadProfilePhoto: (file: File) => Promise<string>;
  refreshProfile: () => Promise<void>;
  // Legacy compat
  userName: string;
}

interface RegisterData {
  name: string;
  email: string;
  password: string;
  telefone?: string;
  cpf?: string;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// ──────────────────────────────────────────────────────────────
// Provider
// ──────────────────────────────────────────────────────────────
export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [profileLoading, setProfileLoading] = useState(false);
  const [redirectLoading, setRedirectLoading] = useState(false);
  const [redirectError, setRedirectError] = useState<unknown | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [userName, setUserName] = useState('');

  const auth = getAuth(app);
  const redirectProcessedRef = useRef(false);
  const syncInFlightRef = useRef<Map<string, Promise<UserProfile>>>(new Map());

  const toDate = (ts: unknown): Date | undefined => {
    if (!ts) return undefined;
    if (ts instanceof Date) return ts;
    if (typeof ts === 'object' && ts !== null) {
      const obj = ts as Record<string, unknown>;
      if (typeof obj['toDate'] === 'function') return (obj as { toDate: () => Date }).toDate();
      if (typeof obj['seconds'] === 'number') return new Date(obj['seconds'] * 1000);
    }
    if (typeof ts === 'string' || typeof ts === 'number') {
      const d = new Date(ts);
      return isNaN(d.getTime()) ? undefined : d;
    }
    return undefined;
  };

  // ── Centralized Firestore profile sync ────────────────────
  const syncProfile = useCallback(async (firebaseUser: FirebaseUser): Promise<UserProfile> => {
    const inFlight = syncInFlightRef.current.get(firebaseUser.uid);
    if (inFlight) return inFlight;

    const task = (async (): Promise<UserProfile> => {
      const userDocRef = doc(db, 'users', firebaseUser.uid);
      const snap = await getDoc(userDocRef);

      if (snap.exists()) {
        const data = snap.data();
        try {
          const updates: Record<string, unknown> = {
            lastLogin: serverTimestamp(),
          };
          if (!data.foto && firebaseUser.photoURL) {
            updates.foto = firebaseUser.photoURL;
          }
          await updateDoc(userDocRef, updates);
        } catch (e) {
          console.warn('Failed to update lastLogin on existing profile:', e);
        }

        const profile: UserProfile = {
          uid: firebaseUser.uid,
          name: data.name || firebaseUser.displayName || 'Usuário',
          email: data.email || firebaseUser.email || '',
          telefone: data.telefone || '',
          cpf: data.cpf || '',
          foto: data.foto || firebaseUser.photoURL || '',
          role: data.role || 'client',
          unlockedBadges: data.unlockedBadges || [],
          referredBy: data.referredBy || null,
          firstOrderPlaced: !!data.firstOrderPlaced,
          referralRewarded: !!data.referralRewarded,
          createdAt: toDate(data.createdAt),
          updatedAt: toDate(data.updatedAt),
          lastLogin: new Date(),
          onboardingComplete: !!data.onboardingComplete,
        };
        return profile;
      } else {
        // New user creation — unified schema preserving referral and onboarding state
        const referredBy = localStorage.getItem('referred_by') || null;
        const newProfile: UserProfile = {
          uid: firebaseUser.uid,
          name: firebaseUser.displayName || 'Usuário',
          email: firebaseUser.email || '',
          telefone: '',
          cpf: '',
          foto: firebaseUser.photoURL || '',
          role: 'client',
          unlockedBadges: [],
          referredBy: referredBy,
          firstOrderPlaced: false,
          referralRewarded: false,
          onboardingComplete: false,
        };

        await setDoc(userDocRef, {
          name: newProfile.name,
          email: newProfile.email,
          telefone: '',
          cpf: '',
          foto: newProfile.foto,
          role: 'client',
          unlockedBadges: [],
          referredBy: newProfile.referredBy,
          firstOrderPlaced: false,
          referralRewarded: false,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
          lastLogin: serverTimestamp(),
          onboardingComplete: false,
        });

        return newProfile;
      }
    })();

    syncInFlightRef.current.set(firebaseUser.uid, task);
    try {
      return await task;
    } finally {
      syncInFlightRef.current.delete(firebaseUser.uid);
    }
  }, []);

  // ── Process getRedirectResult once in a central place ─────
  useEffect(() => {
    if (redirectProcessedRef.current) return;
    redirectProcessedRef.current = true;

    let isMounted = true;
    const processRedirect = async () => {
      try {
        setRedirectLoading(true);
        const result = await getRedirectResult(auth);
        if (result?.user && isMounted) {
          const profile = await syncProfile(result.user);
          setUser(result.user);
          setUserProfile(profile);
          setIsAdmin(profile.role === 'admin');
          setUserName(profile.name);
        }
      } catch (err: unknown) {
        console.error('getRedirectResult error:', err);
        if (isMounted) {
          setRedirectError(err);
        }
      } finally {
        if (isMounted) {
          setRedirectLoading(false);
        }
      }
    };

    processRedirect();
    return () => {
      isMounted = false;
    };
  }, [auth, syncProfile]);

  // ── onAuthStateChanged listener ──────────────────────────
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      setUser(firebaseUser);

      if (firebaseUser) {
        setProfileLoading(true);
        const profile = await syncProfile(firebaseUser);
        const tokenResult = await firebaseUser.getIdTokenResult();
        const isBanned = tokenResult.claims['banned'] === true || profile?.role === 'banned';

        if (isBanned) {
          await signOut(auth);
          setUser(null);
          setUserProfile(null);
          setIsAdmin(false);
          setUserName('');
          setProfileLoading(false);
          setLoading(false);
          alert('Esta conta foi suspensa por um administrador.');
          return;
        }

        const hasAdminClaim = tokenResult.claims['admin'] === true;
        if (profile) {
          setUserProfile(profile);
          setIsAdmin(hasAdminClaim || profile.role === 'admin');
          setUserName(profile.name);
        }
        setProfileLoading(false);
      } else {
        setUserProfile(null);
        setIsAdmin(false);
        setUserName('');
      }

      setLoading(false);
    });

    return () => unsubscribe();
  }, [auth, syncProfile]);

  // ── Login ────────────────────────────────────────────────
  const login = async (email: string, password: string, rememberMe = true): Promise<FirebaseUser> => {
    setLoading(true);
    try {
      await setPersistence(auth, rememberMe ? browserLocalPersistence : browserSessionPersistence);
      const credential = await signInWithEmailAndPassword(auth, email, password);

      try {
        await updateDoc(doc(db, 'users', credential.user.uid), {
          lastLogin: serverTimestamp(),
        });
      } catch {
        // Non-critical
      }

      return credential.user;
    } finally {
      setLoading(false);
    }
  };

  // ── Login With Google (PWA standalone redirect + browser popup with fallback) ──
  const loginWithGoogle = async (options?: { returnUrl?: string; preferRedirect?: boolean }): Promise<FirebaseUser | null> => {
    const provider = new GoogleAuthProvider();
    provider.setCustomParameters({ prompt: 'select_account' });

    const safeReturn = sanitizeInternalRedirect(options?.returnUrl, '/');
    const inStandalone = isStandalonePwa();
    const shouldRedirect = !!(options?.preferRedirect || inStandalone);

    if (shouldRedirect) {
      sessionStorage.setItem('auth_return_url', safeReturn);
      setLoading(true);
      await signInWithRedirect(auth, provider);
      return null;
    }

    setLoading(true);
    try {
      const credential = await signInWithPopup(auth, provider);
      const firebaseUser = credential.user;
      const profile = await syncProfile(firebaseUser);
      setUser(firebaseUser);
      setUserProfile(profile);
      setIsAdmin(profile.role === 'admin');
      setUserName(profile.name);
      return firebaseUser;
    } catch (popupErr: unknown) {
      const e = popupErr as { code?: string };
      // Fallback to redirect if popup is blocked or unsupported in this browser environment
      if (e?.code === 'auth/popup-blocked' || e?.code === 'auth/operation-not-supported-in-this-environment') {
        console.warn('Popup blocked or not supported. Falling back to signInWithRedirect...');
        sessionStorage.setItem('auth_return_url', safeReturn);
        await signInWithRedirect(auth, provider);
        return null;
      }
      throw popupErr;
    } finally {
      setLoading(false);
    }
  };

  // ── Register ─────────────────────────────────────────────
  const register = async (data: RegisterData): Promise<FirebaseUser> => {
    setLoading(true);
    try {
      const credential = await createUserWithEmailAndPassword(auth, data.email, data.password);
      const firebaseUser = credential.user;

      // Update Firebase Auth display name
      await firebaseUpdateProfile(firebaseUser, { displayName: data.name });

      // Create Firestore document.
      // Role is always 'client' on self-registration.
      // To assign admin, use the Firestore console or an admin SDK script.
      const referredBy = localStorage.getItem('referred_by') || null;
      await setDoc(doc(db, 'users', firebaseUser.uid), {
        name: data.name,
        email: data.email,
        telefone: data.telefone || '',
        cpf: data.cpf || '',
        foto: '',
        role: 'client',
        unlockedBadges: [],
        referredBy: referredBy,
        firstOrderPlaced: false,
        referralRewarded: false,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        lastLogin: serverTimestamp(),
        onboardingComplete: false,
      });

      setUserName(data.name);
      return firebaseUser;
    } finally {
      setLoading(false);
    }
  };

  // ── Logout ───────────────────────────────────────────────
  const logout = async (): Promise<void> => {
    await signOut(auth);
    setUserProfile(null);
    setIsAdmin(false);
    setUserName('');
  };

  // ── Send Password Reset Email ────────────────────────────
  const sendPasswordReset = async (email: string): Promise<void> => {
    await sendPasswordResetEmail(auth, email);
  };

  // ── Change Password (requires re-auth) ───────────────────
  const changePassword = async (currentPassword: string, newPassword: string): Promise<void> => {
    if (!user || !user.email) throw new Error('Usuário não autenticado');
    const credential = EmailAuthProvider.credential(user.email, currentPassword);
    await reauthenticateWithCredential(user, credential);
    await firebaseUpdatePassword(user, newPassword);
  };

  // ── Update Profile in Firestore ──────────────────────────
  const updateUserProfile = async (data: Partial<Pick<UserProfile, 'name' | 'telefone' | 'cpf' | 'unlockedBadges' | 'onboardingComplete'>>): Promise<void> => {
    if (!user) throw new Error('Usuário não autenticado');

    const updates: Record<string, unknown> = { updatedAt: serverTimestamp() };
    if (data.name !== undefined) updates.name = data.name;
    if (data.telefone !== undefined) updates.telefone = data.telefone;
    if (data.cpf !== undefined) updates.cpf = data.cpf;
    if (data.unlockedBadges !== undefined) updates.unlockedBadges = data.unlockedBadges;
    if (data.onboardingComplete !== undefined) updates.onboardingComplete = data.onboardingComplete;

    await updateDoc(doc(db, 'users', user.uid), updates);

    // Update Firebase Auth display name if name changed
    if (data.name) {
      await firebaseUpdateProfile(user, { displayName: data.name });
    }

    // Refresh local profile state
    setUserProfile(prev => prev ? { ...prev, ...data } : prev);
    if (data.name) setUserName(data.name);
  };

  // ── Upload Profile Photo ─────────────────────────────────
  const uploadProfilePhoto = async (file: File): Promise<string> => {
    if (!user) throw new Error('Usuário não autenticado');

    // Validate file
    if (!file.type.startsWith('image/')) throw new Error('Arquivo deve ser uma imagem');
    if (file.size > 5 * 1024 * 1024) throw new Error('Imagem deve ter menos de 5MB');

    const storageRef = ref(storage, `profile-photos/${user.uid}/${Date.now()}_${file.name}`);
    await uploadBytes(storageRef, file);
    const downloadURL = await getDownloadURL(storageRef);

    // Update Firestore and Firebase Auth
    await updateDoc(doc(db, 'users', user.uid), {
      foto: downloadURL,
      updatedAt: serverTimestamp(),
    });
    await firebaseUpdateProfile(user, { photoURL: downloadURL });

    // Update local state
    setUserProfile(prev => prev ? { ...prev, foto: downloadURL } : prev);

    return downloadURL;
  };

  // ── Refresh Profile ──────────────────────────────────────
  const refreshProfile = async (): Promise<void> => {
    if (!user) return;
    setProfileLoading(true);
    // Force-refresh token to pick up any new Custom Claims (e.g., after setAdminClaim)
    const tokenResult = await user.getIdTokenResult(true);
    const hasAdminClaim = tokenResult.claims['admin'] === true;
    const profile = await syncProfile(user);
    if (profile) {
      setUserProfile(profile);
      setIsAdmin(hasAdminClaim || profile.role === 'admin');
      setUserName(profile.name);
    }
    setProfileLoading(false);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        userProfile,
        loading,
        isAdmin,
        profileLoading,
        redirectLoading,
        redirectError,
        login,
        loginWithGoogle,
        register,
        logout,
        sendPasswordReset,
        changePassword,
        updateUserProfile,
        uploadProfilePhoto,
        refreshProfile,
        userName,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

// ──────────────────────────────────────────────────────────────
// Hook
// ──────────────────────────────────────────────────────────────
// eslint-disable-next-line react-refresh/only-export-components
export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within an AuthProvider');
  return context;
};
