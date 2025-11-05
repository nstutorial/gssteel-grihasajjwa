import React, { createContext, useContext, useEffect, useState } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  signUp: (email: string, password: string, fullName: string) => Promise<{ error: any }>;
  signIn: (email: string, password: string) => Promise<{ error: any }>;
  signOut: () => Promise<void>;
  getUserRole: () => Promise<string | null>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    let mounted = true;

    // Set up auth state listener
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        console.log('Auth state change:', event, session?.user?.email || 'no user');
        if (mounted) {
          setSession(session);
          setUser(session?.user ?? null);
          setLoading(false);
        }
      }
    );

    // Check for existing session with timeout for mobile
    const initializeAuth = async () => {
      try {
        const { data: { session }, error } = await supabase.auth.getSession();
        
        if (mounted) {
          if (error) {
            console.error('Error getting session:', error);
            setLoading(false);
            return;
          }
          
          setSession(session);
          setUser(session?.user ?? null);
          setLoading(false);
        }
      } catch (error) {
        console.error('Error initializing auth:', error);
        if (mounted) {
          setLoading(false);
        }
      }
    };

    // Add timeout for mobile devices
    const timeoutId = setTimeout(() => {
      if (mounted) {
        setLoading(false);
      }
    }, 5000); // 5 second timeout

    initializeAuth();

    return () => {
      mounted = false;
      clearTimeout(timeoutId);
      subscription.unsubscribe();
    };
  }, []);

  const signUp = async (email: string, password: string, fullName: string) => {
    try {
      console.log('Attempting signup with:', { email, fullName });
      
      const redirectUrl = `${window.location.origin}/`;
      
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: redirectUrl,
          data: {
            full_name: fullName,
            user_role: 'employee', // Default role for new users
          },
        },
      });

      console.log('Signup response:', { data, error });

      if (error) {
        console.error('Signup error:', error);
        
        // Check for specific error types
        if (error.message.includes('already registered') || 
            error.message.includes('User already registered') ||
            error.message.includes('already been registered')) {
          toast({
            variant: "destructive",
            title: "Already Registered",
            description: "This email address is already registered. Please try signing in instead.",
          });
        } else if (error.message.includes('Invalid email')) {
          toast({
            variant: "destructive",
            title: "Invalid Email",
            description: "Please enter a valid email address.",
          });
        } else if (error.message.includes('Password should be at least')) {
          toast({
            variant: "destructive",
            title: "Password Too Short",
            description: "Password must be at least 6 characters long.",
          });
        } else {
          toast({
            variant: "destructive",
            title: "Sign Up Error",
            description: error.message,
          });
        }
      } else if (data.user && data.user.identities && data.user.identities.length === 0) {
        // This means the user already exists (Supabase returns user but with empty identities array)
        console.log('User already exists');
        toast({
          variant: "destructive",
          title: "Already Registered",
          description: "This email address is already registered. Please try signing in instead.",
        });
        return { error: { message: 'User already exists' } };
      } else {
        console.log('Signup successful, user:', data.user);
        toast({
          title: "Account Created",
          description: "Please check your email for the confirmation link.",
        });
      }

      return { error };
    } catch (error: any) {
      console.error('Signup catch error:', error);
      toast({
        variant: "destructive",
        title: "Sign Up Error",
        description: error.message || "An unexpected error occurred",
      });
      return { error };
    }
  };

  const signIn = async (email: string, password: string) => {
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        toast({
          variant: "destructive",
          title: "Sign In Error",
          description: error.message,
        });
      } else {
        // On mobile, wait a bit for the session to be properly set
        if (window.innerWidth < 768) {
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      }

      return { error };
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Sign In Error",
        description: error.message,
      });
      return { error };
    }
  };

  const signOut = async () => {
    try {
      console.log('Starting sign out process...');
      
      // Check if we have a valid session before attempting sign out
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      
      if (sessionError) {
        console.warn('Session check error:', sessionError);
      }
      
      if (session) {
        console.log('Valid session found, signing out from Supabase...');
        const { error } = await supabase.auth.signOut();
        
        if (error) {
          console.error('Supabase sign out error:', error);
          // Don't show error toast for "Auth session missing" as it's expected in some cases
          if (!error.message.includes('Auth session missing')) {
            toast({
              variant: "destructive",
              title: "Sign Out Error",
              description: error.message,
            });
          }
        } else {
          console.log('Supabase sign out successful');
        }
      } else {
        console.log('No valid session found, proceeding with local cleanup...');
      }
      
      // Always clear local state regardless of Supabase sign out result
      setUser(null);
      setSession(null);
      setLoading(false);
      
      // Clear browser storage
      try {
        if (typeof window !== 'undefined') {
          // Clear all Supabase-related storage
          const keysToRemove = [];
          for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (key && (key.includes('supabase') || key.includes('sb-'))) {
              keysToRemove.push(key);
            }
          }
          keysToRemove.forEach(key => localStorage.removeItem(key));
          
          // Clear remember me credentials
          localStorage.removeItem('griha-sajjwa-remember-email');
          localStorage.removeItem('griha-sajjwa-remember-password');
          localStorage.removeItem('griha-sajjwa-remember-me');
          
          // Clear session storage
          sessionStorage.clear();
        }
      } catch (storageError) {
        console.warn('Error clearing storage:', storageError);
      }
      
      console.log('Sign out completed successfully');
      
    } catch (error: any) {
      console.error('Sign out catch error:', error);
      
      // Even if there's an error, clear local state
      setUser(null);
      setSession(null);
      setLoading(false);
      
      // Only show error toast for unexpected errors
      if (!error.message?.includes('Auth session missing')) {
        toast({
          variant: "destructive",
          title: "Sign Out Error",
          description: error.message || "An unexpected error occurred",
        });
      }
    }
  };

  const getUserRole = async () => {
    if (!user) return null;
    
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('user_id', user.id)
        .single();
      
      if (error) {
        console.error('Error fetching user role:', error);
        return 'employee'; // Default fallback
      }
      
      // Check if user_role column exists, otherwise default to employee
      return (data as any)?.user_role || 'employee';
    } catch (error) {
      console.error('Error in getUserRole:', error);
      return 'employee'; // Default fallback
    }
  };

  const value = {
    user,
    session,
    loading,
    signUp,
    signIn,
    signOut,
    getUserRole,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
