import React, { createContext, useContext, useEffect, useState } from 'react';
import { User, onAuthStateChanged, signOut as firebaseSignOut } from 'firebase/auth';
import { doc, onSnapshot, setDoc, serverTimestamp } from 'firebase/firestore';
import { auth, db } from '../firebase';
import { COLLECTIONS } from '../lib/shared-types';

// Starting balance for all participants (INR virtual currency)
const STARTING_BALANCE = 100000;

interface UserData {
  role: 'admin' | 'participant';
  name: string;
  currentCash: number;
  portfolioValue: number;
  startingBalance?: number;
  email?: string;
}

interface AuthContextType {
  user: User | null;
  userData: UserData | null;
  loading: boolean;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  userData: null,
  loading: true,
  signOut: async () => {},
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [userData, setUserData] = useState<UserData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribeAuth = onAuthStateChanged(auth, (firebaseUser) => {
      setUser(firebaseUser);
      if (!firebaseUser) {
        setUserData(null);
        setLoading(false);
      }
    });
    return () => unsubscribeAuth();
  }, []);

  useEffect(() => {
    let unsubscribeDoc = () => {};
    if (user) {
      setLoading(true);
      unsubscribeDoc = onSnapshot(
        doc(db, COLLECTIONS.USERS, user.uid),
        async (docSnap) => {
          if (docSnap.exists()) {
            const data = docSnap.data() as UserData;
            if (data.startingBalance === undefined) {
              data.startingBalance = STARTING_BALANCE;
            }
            setUserData(data);
            setLoading(false);
          } else {
            try {
              const newProfile: UserData = {
                email: user.email || '',
                name: user.displayName || user.email?.split('@')[0] || 'Trader',
                role: 'participant' as const,
                startingBalance: STARTING_BALANCE,
                currentCash: STARTING_BALANCE,
                portfolioValue: STARTING_BALANCE,
              };
              await setDoc(doc(db, COLLECTIONS.USERS, user.uid), {
                ...newProfile,
                createdAt: serverTimestamp(),
              });
              setUserData(newProfile);
            } catch (err) {
              console.error('Error auto-initializing user document:', err);
              setUserData({
                email: user.email || '',
                name: user.displayName || 'Trader',
                role: 'participant',
                startingBalance: STARTING_BALANCE,
                currentCash: STARTING_BALANCE,
                portfolioValue: STARTING_BALANCE,
              });
            } finally {
              setLoading(false);
            }
          }
        },
        (error) => {
          console.error('User doc snapshot error:', error);
          setLoading(false);
        }
      );
    } else {
      setUserData(null);
      setLoading(false);
    }
    return () => unsubscribeDoc();
  }, [user]);

  const signOut = async () => {
    await firebaseSignOut(auth);
  };

  return (
    <AuthContext.Provider value={{ user, userData, loading, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
