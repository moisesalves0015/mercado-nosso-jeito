import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
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
  role: 'client' | 'admin';
  createdAt?: Date;
  updatedAt?: Date;
  lastLogin?: Date;
}

interface AuthContextType {
  user: FirebaseUser | null;
  userProfile: UserProfile | null;
  loading: boolean;
  isAdmin: boolean;
  profileLoading: boolean;
  // Auth actions
  login: (email: string, password: string, rememberMe?: boolean) => Promise<FirebaseUser>;
  loginWithGoogle: () => Promise<FirebaseUser>;
  register: (data: RegisterData) => Promise<FirebaseUser>;
  logout: () => Promise<void>;
  sendPasswordReset: (email: string) => Promise<void>;
  changePassword: (currentPassword: string, newPassword: string) => Promise<void>;
  // Profile actions
  updateUserProfile: (data: Partial<Pick<UserProfile, 'name' | 'telefone' | 'cpf'>>) => Promise<void>;
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
  const [isAdmin, setIsAdmin] = useState(false);
  const [userName, setUserName] = useState('');

  const auth = getAuth(app);

  // ── Fetch profile from Firestore ──────────────────────────
  const fetchProfile = useCallback(async (firebaseUser: FirebaseUser): Promise<UserProfile | null> => {
    try {
      const userDocRef = doc(db, 'users', firebaseUser.uid);
      const snap = await getDoc(userDocRef);

      if (snap.exists()) {
        const data = snap.data();
        const profile: UserProfile = {
          uid: firebaseUser.uid,
          name: data.name || firebaseUser.displayName || 'Usuário',
          email: data.email || firebaseUser.email || '',
          telefone: data.telefone || '',
          cpf: data.cpf || '',
          foto: data.foto || firebaseUser.photoURL || '',
          role: data.role || 'client',
          createdAt: data.createdAt?.toDate?.() ?? undefined,
          updatedAt: data.updatedAt?.toDate?.() ?? undefined,
          lastLogin: data.lastLogin?.toDate?.() ?? undefined,
        };
        return profile;
      } else {
        // Auto-heal: create doc for existing users
        const emailLower = firebaseUser.email?.toLowerCase() || '';
        const initialRole = emailLower.startsWith('admin@') ? 'admin' : 'client';
        const profile: UserProfile = {
          uid: firebaseUser.uid,
          name: firebaseUser.displayName || 'Usuário',
          email: firebaseUser.email || '',
          role: initialRole,
        };
        await setDoc(userDocRef, {
          name: profile.name,
          email: profile.email,
          telefone: '',
          cpf: '',
          foto: '',
          role: initialRole,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
          lastLogin: serverTimestamp(),
        });
        return profile;
      }
    } catch (error) {
      console.error('Error fetching user profile:', error);
      return null;
    }
  }, []);

  // ── onAuthStateChanged listener ──────────────────────────
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      setUser(firebaseUser);

      if (firebaseUser) {
        setProfileLoading(true);
        const profile = await fetchProfile(firebaseUser);
        if (profile) {
          setUserProfile(profile);
          setIsAdmin(profile.role === 'admin');
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
  }, [auth, fetchProfile]);

  // ── Login ────────────────────────────────────────────────
  const login = async (email: string, password: string, rememberMe = true): Promise<FirebaseUser> => {
    setLoading(true);
    try {
      // Set persistence based on "remember me"
      await setPersistence(auth, rememberMe ? browserLocalPersistence : browserSessionPersistence);
      const credential = await signInWithEmailAndPassword(auth, email, password);

      // Update lastLogin in Firestore
      try {
        await updateDoc(doc(db, 'users', credential.user.uid), {
          lastLogin: serverTimestamp(),
        });
      } catch {
        // Non-critical — don't fail login if this fails
      }

      return credential.user;
    } finally {
      setLoading(false);
    }
  };

  // ── Login With Google ─────────────────────────────────
  const loginWithGoogle = async (): Promise<FirebaseUser> => {
    const provider = new GoogleAuthProvider();
    provider.setCustomParameters({ prompt: 'select_account' });
    const credential = await signInWithPopup(auth, provider);
    const firebaseUser = credential.user;

    // Create or merge Firestore document
    const userDocRef = doc(db, 'users', firebaseUser.uid);
    const snap = await getDoc(userDocRef);
    if (!snap.exists()) {
      await setDoc(userDocRef, {
        name: firebaseUser.displayName || 'Usuário Google',
        email: firebaseUser.email || '',
        telefone: '',
        cpf: '',
        foto: firebaseUser.photoURL || '',
        role: 'client',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        lastLogin: serverTimestamp(),
      });
    } else {
      await updateDoc(userDocRef, { lastLogin: serverTimestamp() });
    }

    return firebaseUser;
  };

  // ── Register ─────────────────────────────────────────────
  const register = async (data: RegisterData): Promise<FirebaseUser> => {
    setLoading(true);
    try {
      const credential = await createUserWithEmailAndPassword(auth, data.email, data.password);
      const firebaseUser = credential.user;

      // Update Firebase Auth display name
      await firebaseUpdateProfile(firebaseUser, { displayName: data.name });

      // Create Firestore document
      await setDoc(doc(db, 'users', firebaseUser.uid), {
        name: data.name,
        email: data.email,
        telefone: data.telefone || '',
        cpf: data.cpf || '',
        foto: '',
        role: data.email.toLowerCase().startsWith('admin@') ? 'admin' : 'client',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        lastLogin: serverTimestamp(),
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
  const updateUserProfile = async (data: Partial<Pick<UserProfile, 'name' | 'telefone' | 'cpf'>>): Promise<void> => {
    if (!user) throw new Error('Usuário não autenticado');

    const updates: Record<string, unknown> = { updatedAt: serverTimestamp() };
    if (data.name !== undefined) updates.name = data.name;
    if (data.telefone !== undefined) updates.telefone = data.telefone;
    if (data.cpf !== undefined) updates.cpf = data.cpf;

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
    const profile = await fetchProfile(user);
    if (profile) {
      setUserProfile(profile);
      setIsAdmin(profile.role === 'admin');
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
export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within an AuthProvider');
  return context;
};
