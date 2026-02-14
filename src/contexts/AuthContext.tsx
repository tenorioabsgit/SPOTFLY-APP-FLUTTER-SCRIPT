import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut as firebaseSignOut,
  updateProfile,
  GoogleAuthProvider,
  signInWithCredential,
  User as FirebaseUser,
} from 'firebase/auth';
import * as Google from 'expo-auth-session/providers/google';
import * as WebBrowser from 'expo-web-browser';
import { auth } from '../services/firebase';
import { createUserProfile, getUserProfile } from '../services/firestore';
import { User } from '../types';

WebBrowser.maybeCompleteAuthSession();

// ============================================================
// Google OAuth Client IDs
// ============================================================
const GOOGLE_WEB_CLIENT_ID = '215760117220-ao69jilb4mkp6ehu1dtdqb10tuvgiqs7.apps.googleusercontent.com';
// Expo auth proxy provides HTTPS redirect URI required by Google OAuth Web client
const EXPO_REDIRECT_URI = 'https://auth.expo.io/@tenorioabs/spotfly';

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

  const [_request, response, promptAsync] = Google.useIdTokenAuthRequest({
    clientId: GOOGLE_WEB_CLIENT_ID,
    redirectUri: EXPO_REDIRECT_URI,
  });

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

  // Handle Google sign-in response
  useEffect(() => {
    if (response?.type === 'success') {
      const { id_token } = response.params;
      const credential = GoogleAuthProvider.credential(id_token);
      signInWithCredential(auth, credential).catch((e) => {
        console.error('Google credential error:', e);
      });
    }
  }, [response]);

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
      const result = await promptAsync();
      if (result?.type === 'error') {
        return { success: false, error: result.error?.message || 'Erro ao conectar com Google.' };
      }
      if (result?.type === 'dismiss' || result?.type === 'cancel') {
        return { success: false, error: 'Login com Google cancelado.' };
      }
      return { success: true };
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
