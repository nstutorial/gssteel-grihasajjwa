// Mobile detection and utilities
export const isMobile = (): boolean => {
  if (typeof window === 'undefined') return false;
  
  return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
    navigator.userAgent
  ) || window.innerWidth < 768;
};

// Check if localStorage is available and working
export const isLocalStorageAvailable = (): boolean => {
  try {
    if (typeof window === 'undefined') return false;
    
    const test = '__localStorage_test__';
    localStorage.setItem(test, test);
    localStorage.removeItem(test);
    return true;
  } catch (e) {
    return false;
  }
};

// Get a safe storage implementation
export const getSafeStorage = () => {
  const isAvailable = isLocalStorageAvailable();
  
  if (!isAvailable) {
    // Fallback to memory storage
    const memoryStorage: { [key: string]: string } = {};
    
    return {
      getItem: (key: string) => memoryStorage[key] || null,
      setItem: (key: string, value: string) => {
        memoryStorage[key] = value;
      },
      removeItem: (key: string) => {
        delete memoryStorage[key];
      },
    };
  }
  
  return {
    getItem: (key: string) => localStorage.getItem(key),
    setItem: (key: string, value: string) => localStorage.setItem(key, value),
    removeItem: (key: string) => localStorage.removeItem(key),
  };
};

// Mobile-specific session recovery
export const recoverSession = async (supabase: any) => {
  try {
    // Try to get session from storage
    const { data: { session }, error } = await supabase.auth.getSession();
    
    if (error) {
      console.warn('Session recovery failed:', error);
      return null;
    }
    
    return session;
  } catch (error) {
    console.warn('Session recovery error:', error);
    return null;
  }
};
