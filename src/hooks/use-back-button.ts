import { useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { App } from '@capacitor/app';

export const useBackButton = () => {
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    const handleBackButton = () => {
      // Define routes that should exit the app
      const exitRoutes = ['/auth'];
      
      // If we're on an exit route, let the app minimize
      if (exitRoutes.includes(location.pathname)) {
        return false; // Let the default behavior happen (minimize app)
      }
      
      // For all other routes, navigate back
      if (window.history.length > 1) {
        navigate(-1);
      } else {
        // If no history, go to dashboard
        navigate('/');
      }
      
      return true; // Prevent default behavior
    };

    // Add the back button listener
    App.addListener('backButton', handleBackButton);

    // Cleanup listener on unmount
    return () => {
      App.removeAllListeners();
    };
  }, [navigate, location.pathname]);
};
