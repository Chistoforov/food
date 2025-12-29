import { createContext, useContext, useEffect, useState } from 'react'
import { User } from '@supabase/supabase-js'
import { supabase, UserProfile } from '../lib/supabase'

interface AuthContextType {
  user: User | null
  profile: UserProfile | null
  loading: boolean
  signInWithGoogle: () => Promise<void>
  signOut: () => Promise<void>
  refreshProfile: () => Promise<void>
}

const AuthContext = createContext<AuthContextType>({} as AuthContextType)

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<User | null>(null)
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // Check active session
    supabase.auth.getSession().then(({ data: { session } }) => {
      console.log('🔍 [Auth] Initial session check:', session ? 'Found session' : 'No session')
      
      // If no session but we have a code/hash in URL, don't stop loading yet
      // Let onAuthStateChange handle the session establishment
      const isAuthCallback = window.location.hash || window.location.search.includes('code=')
      
      if (session) {
        setUser(session.user)
        fetchProfile(session.user.id)
      } else if (!isAuthCallback) {
        // Only set loading false if we're not expecting a callback
        console.log('🔍 [Auth] No session and no callback params - stopping load')
        setLoading(false)
      } else {
        console.log('🔍 [Auth] Detected auth callback params - waiting for auth state change')
      }
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      console.log(`🔔 [Auth] State change: ${event}`, session ? 'User present' : 'No user')
      
      setUser(session?.user ?? null)
      if (session?.user) {
        fetchProfile(session.user.id)
      } else if (event !== 'INITIAL_SESSION') {
        // Don't clear profile on INITIAL_SESSION if we're just starting up
        // (handled by getSession above)
        setProfile(null)
        setLoading(false)
      } else {
         // INITIAL_SESSION with no session
         const isAuthCallback = window.location.hash || window.location.search.includes('code=')
         if (!isAuthCallback) {
            setLoading(false)
         }
      }
    })

    return () => subscription.unsubscribe()
  }, [])

  const fetchProfile = async (userId: string) => {
    try {
      // Small delay to ensure triggers have fired if it's a new user
      if (!profile) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }

      const { data, error } = await supabase
        .from('user_profiles')
        .select('*')
        .eq('id', userId)
        .single()
      
      if (error) {
        // Retry once if profile not found immediately (trigger delay)
        if (!profile) {
             await new Promise(resolve => setTimeout(resolve, 2000));
             const { data: retryData, error: retryError } = await supabase
                .from('user_profiles')
                .select('*')
                .eq('id', userId)
                .single()
             
             if (retryError) {
                // Last resort: Try to create profile manually via RPC
                console.log('⚠️ Profile not found after retry. Attempting to create via RPC...');
                const { data: newProfile, error: rpcError } = await supabase.rpc('create_my_profile');
                
                if (rpcError) {
                   console.error('❌ Failed to create profile via RPC:', rpcError);
                   throw retryError;
                }
                
                if (newProfile) {
                   console.log('✅ Profile created successfully via RPC');
                   setProfile(newProfile as UserProfile);
                   return;
                }
             }
             setProfile(retryData)
        } else {
            throw error
        }
      } else {
        setProfile(data)
      }
    } catch (error) {
      console.error('Error fetching profile:', error)
    } finally {
      setLoading(false)
    }
  }

  const signInWithGoogle = async () => {
    const redirectUrl = window.location.origin
    console.log('🔐 [Auth] Initiating Google Sign In, redirect to:', redirectUrl)
    
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: redirectUrl,
        queryParams: {
          access_type: 'offline',
          prompt: 'consent',
        },
      }
    })
  }

  const signOut = async () => {
    // Устанавливаем флаг, что после следующего входа нужно сбросить кэш
    localStorage.setItem('needs_cache_reset', 'true')
    
    await supabase.auth.signOut()
    setProfile(null)
    setUser(null)
  }

  const refreshProfile = async () => {
      if (user) {
          await fetchProfile(user.id)
      }
  }

  return (
    <AuthContext.Provider value={{ user, profile, loading, signInWithGoogle, signOut, refreshProfile }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => useContext(AuthContext)

