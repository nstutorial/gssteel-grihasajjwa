import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "./contexts/AuthContext";
import { ControlProvider } from "./contexts/ControlContext";
import { useBackButton } from "./hooks/use-back-button";
import Dashboard from "./pages/Dashboard";
import Settings from "./pages/Settings";
import Profile from "./pages/Profile";
import Auth from "./pages/Auth";
import CollectionPage from "./pages/CollectionPage";
import PasswordManagement from "./pages/PasswordManagement";
import Reminders from "./pages/Reminders";
import BillReminders from "./pages/BillReminders";
import BillCustomers from "./pages/BillCustomers";
import BillCustomerDetails from "./pages/BillCustomerDetails";
import Partners from "./pages/Partners";
import PartnerDetails from "./pages/PartnerDetails";
import FirmAccounts from "./pages/FirmAccounts";
import FirmAccountDetails from "./pages/FirmAccountDetails";
import TransactionTypes from "./pages/TransactionTypes";
import CollectionReport from "./pages/reports/CollectionReport";
import DisbursedReport from "./pages/reports/DisbursedReport";
import SalesReport from "./pages/reports/SalesReport";
import ActiveLoansReport from "./pages/reports/ActiveLoansReport";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

// Protected Route Component
const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const { user, loading } = useAuth();
  
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }
  
  if (!user) {
    return <Navigate to="/auth" replace />;
  }
  
  return <>{children}</>;
};

// Public Route Component (redirects to dashboard if already authenticated)
const PublicRoute = ({ children }: { children: React.ReactNode }) => {
  const { user, loading } = useAuth();
  
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }
  
  if (user) {
    return <Navigate to="/" replace />;
  }
  
  return <>{children}</>;
};

const AppRoutes = () => {
  // Initialize back button handling
  useBackButton();

  return (
    <Routes>
      <Route path="/" element={
        <ProtectedRoute>
          <Dashboard />
        </ProtectedRoute>
      } />
      <Route path="/settings" element={
        <ProtectedRoute>
          <Settings />
        </ProtectedRoute>
      } />
      <Route path="/profile" element={
        <ProtectedRoute>
          <Profile />
        </ProtectedRoute>
      } />
      <Route path="/auth" element={
        <PublicRoute>
          <Auth />
        </PublicRoute>
      } />
      <Route path="/collection" element={
        <ProtectedRoute>
          <CollectionPage />
        </ProtectedRoute>
      } />
      <Route path="/password-management" element={
        <ProtectedRoute>
          <PasswordManagement />
        </ProtectedRoute>
      } />
      <Route path="/reminders" element={
        <ProtectedRoute>
          <Reminders />
        </ProtectedRoute>
      } />
      <Route path="/bill-reminders" element={
        <ProtectedRoute>
          <BillReminders />
        </ProtectedRoute>
      } />
      <Route path="/bill-customers" element={
        <ProtectedRoute>
          <BillCustomers />
        </ProtectedRoute>
      } />
      <Route path="/bill-customers/:id" element={
        <ProtectedRoute>
          <BillCustomerDetails />
        </ProtectedRoute>
      } />
      <Route path="/partners" element={
        <ProtectedRoute>
          <Partners />
        </ProtectedRoute>
      } />
      <Route path="/partners/:id" element={
        <ProtectedRoute>
          <PartnerDetails />
        </ProtectedRoute>
      } />
      <Route path="/firm-accounts" element={
        <ProtectedRoute>
          <FirmAccounts />
        </ProtectedRoute>
      } />
      <Route path="/firm-accounts/:id" element={
        <ProtectedRoute>
          <FirmAccountDetails />
        </ProtectedRoute>
      } />
      <Route path="/transaction-types" element={
        <ProtectedRoute>
          <TransactionTypes />
        </ProtectedRoute>
      } />
      <Route path="/reports/collection" element={
        <ProtectedRoute>
          <CollectionReport />
        </ProtectedRoute>
      } />
      <Route path="/reports/disbursed" element={
        <ProtectedRoute>
          <DisbursedReport />
        </ProtectedRoute>
      } />
      <Route path="/reports/sales" element={
        <ProtectedRoute>
          <SalesReport />
        </ProtectedRoute>
      } />
      <Route path="/reports/active-loans" element={
        <ProtectedRoute>
          <ActiveLoansReport />
        </ProtectedRoute>
      } />
      {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
};

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <ControlProvider>
        <TooltipProvider>
          <Toaster />
          <Sonner />
          <BrowserRouter>
            <AppRoutes />
          </BrowserRouter>
        </TooltipProvider>
      </ControlProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;
