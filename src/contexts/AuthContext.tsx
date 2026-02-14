import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { Platform } from 'react-native';
import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut as firebaseSignOut,
  updateProfile,
  GoogleAuthProvider,
  signInWithCredential,
  signInWithPopup,
  User as FirebaseUser,
} from 'firebase/auth';
import * as WebBrowser from 'expo-web-browser';
import { auth } from '../services/firebase';
import { createUserProfile, getUserProfile } from '../services/firestore';
import { User } from '../types';

WebBrowser.maybeCompleteAuthSession();

// ============================================================
// Google OAuth Configuration
// ============================================================
const GOOGLE_WEB_CLIENT_ID = '215760117220-ao69jilb4mkp6ehu1dtdqb10tuvgiqs7.apps.googleusercontent.com';
// Our own HTTPS redirect page hosted on Vercel - extracts tokens and redirects to app scheme
const GOOGLE_REDIRECT_URI = 'https://spotfly-nine.vercel.app/auth/callback.html';
// The app deep link that the redirect page will navigate to
const APP_RETURN_URI = 'spotfly://auth';

interface AuthContextType {
  user: User | null;
  firebaseUser: FirebaseUser | null;
  isLoading: boolean;
  signIn: (email: string, password: string) => Promise<{ success: boolean; error?: string }>;
  signUp: (email: string, password: string, displayName: string) => Promise<{ success: boolean; error?: string }>;
  signInWithGoogle: () => Promise<{ success: boolean; error?: string }>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({} as AuthContextType);

export function useAuth() {
  return useContext(AuthContext);
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [firebaseUser, setFirebaseUser] = useState<FirebaseUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Listen to Firebase auth state
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (fbUser) => {
      if (fbUser) {
        setFirebaseUser(fbUser);
        let profile = await getUserProfile(fbUser.uid);
        if (!profile) {
          profile = {
            id: fbUser.uid,
            email: fbUser.email || '',
            displayName: fbUser.displayName || fbUser.email?.split('@')[0] || 'Usuário',
            photoUrl: fbUser.photoURL || `https://i.pravatar.cc/150?u=${fbUser.uid}`,
            createdAt: Date.now(),
          };
          await createUserProfile(profile);
        }
        setUser(profile);
      } else {
        setFirebaseUser(null);
        setUser(null);
      }
      setIsLoading(false);
    });
    return unsubscribe;
  }, []);

  async function signIn(
    email: string,
    password: string
  ): Promise<{ success: boolean; error?: string }> {
    try {
      await signInWithEmailAndPassword(auth, email, password);
      return { success: true };
    } catch (e: any) {
      const code = e.code;
      let error = 'Erro ao fazer login. Tente novamente.';
      if (code === 'auth/user-not-found') error = 'Usuário não encontrado.';
      else if (code === 'auth/wrong-password') error = 'Senha incorreta.';
      else if (code === 'auth/invalid-email') error = 'E-mail inválido.';
      else if (code === 'auth/too-many-requests') error = 'Muitas tentativas. Tente mais tarde.';
      else if (code === 'auth/invalid-credential') error = 'E-mail ou senha incorretos.';
      return { success: false, error };
    }
  }

  async function signUp(
    email: string,
    password: string,
    displayName: string
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const { user: fbUser } = await createUserWithEmailAndPassword(auth, email, password);
      await updateProfile(fbUser, { displayName });
      const profile: User = {
        id: fbUser.uid,
        email: fbUser.email || email,
        displayName,
        photoUrl: `https://i.pravatar.cc/150?u=${fbUser.uid}`,
        createdAt: Date.now(),
      };
      await createUserProfile(profile);
      return { success: true };
    } catch (e: any) {
      const code = e.code;
      let error = 'Erro ao criar conta. Tente novamente.';
      if (code === 'auth/email-already-in-use') error = 'Este e-mail já está cadastrado.';
      else if (code === 'auth/weak-password') error = 'Senha fraca. Use pelo menos 6 caracteres.';
      else if (code === 'auth/invalid-email') error = 'E-mail inválido.';
      return { success: false, error };
    }
  }

  async function signInWithGoogleAuth(): Promise<{ success: boolean; error?: string }> {
    try {
      // Web: use Firebase signInWithPopup (native browser popup)
      if (Platform.OS === 'web') {
        const provider = new GoogleAuthProvider();
        provider.addScope('email');
        provider.addScope('profile');
        await signInWithPopup(auth, provider);
        return { success: true };
      }

      // Mobile: use custom OAuth flow with Vercel callback page
      const state = Math.random().toString(36).substring(2, 15);
      const nonce = Math.random().toString(36).substring(2, 15);

      const params = new URLSearchParams({
        client_id: GOOGLE_WEB_CLIENT_ID,
        redirect_uri: GOOGLE_REDIRECT_URI,
        response_type: 'id_token',
        scope: 'openid email profile',
        state,
        nonce,
      });

      const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;

      const result = await WebBrowser.openAuthSessionAsync(authUrl, APP_RETURN_URI);

      if (result.type === 'success' && result.url) {
        const urlObj = new URL(result.url);
        const idToken = urlObj.searchParams.get('id_token');

        if (idToken) {
          const credential = GoogleAuthProvider.credential(idToken);
          await signInWithCredential(auth, credential);
          return { success: true };
        }
        return { success: false, error: 'Token não recebido do Google.' };
      }

      if (result.type === 'dismiss' || result.type === 'cancel') {
        return { success: false, error: 'Login com Google cancelado.' };
      }

      return { success: false, error: 'Erro ao conectar com Google.' };
    } catch (e: any) {
      console.error('Google auth error:', e);
      return { success: false, error: 'Erro ao conectar com Google. Tente novamente.' };
    }
  }

  async function signOut(): Promise<void> {
    try {
      await firebaseSignOut(auth);
    } catch (e) {
      console.error('Sign out error:', e);
    }
  }

  return (
    <AuthContext.Provider
      value={{
        user,
        firebaseUser,
        isLoading,
        signIn,
        signUp,
        signInWithGoogle: signInWithGoogleAuth,
        signOut,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}
