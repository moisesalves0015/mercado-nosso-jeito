import React, { createContext, useContext, useState, useEffect } from 'react';
import { 
  getAuth, 
  onAuthStateChanged, 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword, 
  signOut,
} from 'firebase/auth';
import type { User as FirebaseUser } from 'firebase/auth';
import { app } from '../firebase';

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
    const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
      setUser(firebaseUser);
      if (firebaseUser) {
        // Safe check for Admin privileges
        const emailLower = firebaseUser.email?.toLowerCase() || '';
        const isUserAdmin = emailLower === 'admin@mercado.com' || emailLower.startsWith('admin@');
        setIsAdmin(isUserAdmin);

        // Fetch name
        const storedName = localStorage.getItem(`user_name_${firebaseUser.uid}`) || firebaseUser.displayName || 'Cliente';
        setUserName(storedName);
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
      // Store local name
      localStorage.setItem(`user_name_${credential.user.uid}`, name);
      setUserName(name);
      return credential.user;
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
