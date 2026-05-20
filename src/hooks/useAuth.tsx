import React, { createContext, useContext, useState, useEffect } from 'react';
import { 
  getAuth, 
  onAuthStateChanged, 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword, 
  signOut,
} from 'firebase/auth';
import type { User as FirebaseUser } from 'firebase/auth';
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { app, db } from '../firebase';

interface AuthContextType {
  user: FirebaseUser | null;
  loading: boolean;
  isAdmin: boolean;
  login: (email: string, senhas: string) => Promise<FirebaseUser>;
  register: (email: string, senhas: string, name: string) => Promise<FirebaseUser>;
  logout: () => Promise<void>;
  userName: string;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [userName, setUserName] = useState('');

  const auth = getAuth(app);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      setUser(firebaseUser);
      if (firebaseUser) {
        // Fetch user data from Firestore
        try {
          const userDocRef = doc(db, 'users', firebaseUser.uid);
          const userDocSnap = await getDoc(userDocRef);
          
          if (userDocSnap.exists()) {
            const userData = userDocSnap.data();
            setIsAdmin(userData.role === 'admin');
            
            // Sync name if missing locally
            if (userData.name) {
              setUserName(userData.name);
              localStorage.setItem(`user_name_${firebaseUser.uid}`, userData.name);
            }
          } else {
            // Auto-heal: Create document for existing users who registered before Firestore was added or when rules blocked it
            const emailLower = firebaseUser.email?.toLowerCase() || '';
            const initialRole = (emailLower === 'admin@mercado.com' || emailLower.startsWith('admin@')) ? 'admin' : 'client';
            
            await setDoc(userDocRef, {
              name: firebaseUser.displayName || 'Usuário',
              email: firebaseUser.email,
              role: initialRole,
              createdAt: serverTimestamp()
            });
            setIsAdmin(initialRole === 'admin');
          }
        } catch (error: any) {
          console.error("Error fetching user role:", error);
          alert("Erro no Firebase: " + error.message);
          setIsAdmin(false);
        }

        // Fetch name locally if Firestore didn't provide one
        const storedName = localStorage.getItem(`user_name_${firebaseUser.uid}`) || firebaseUser.displayName || 'Cliente';
        if (!userName) setUserName(storedName);

      } else {
        setIsAdmin(false);
        setUserName('');
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, [auth]);

  const login = async (email: string, senhas: string) => {
    setLoading(true);
    try {
      const credential = await signInWithEmailAndPassword(auth, email, senhas);
      return credential.user;
    } finally {
      setLoading(false);
    }
  };

  const register = async (email: string, senhas: string, name: string) => {
    setLoading(true);
    try {
      const credential = await createUserWithEmailAndPassword(auth, email, senhas);
      const user = credential.user;
      
      // Store local name
      localStorage.setItem(`user_name_${user.uid}`, name);
      setUserName(name);

      // Create User Document in Firestore
      await setDoc(doc(db, 'users', user.uid), {
        name: name,
        email: email,
        role: email.toLowerCase().startsWith('admin@') ? 'admin' : 'client',
        createdAt: serverTimestamp()
      });

      return user;
    } finally {
      setLoading(false);
    }
  };

  const logout = async () => {
    setLoading(true);
    try {
      await signOut(auth);
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthContext.Provider value={{ user, loading, isAdmin, login, register, logout, userName }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
