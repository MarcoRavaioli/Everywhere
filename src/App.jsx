import { Toaster } from "@/components/ui/toaster"
import { QueryClientProvider } from '@tanstack/react-query'
import { queryClientInstance } from '@/lib/query-client'
import { BrowserRouter as Router, Route, Routes, Navigate } from 'react-router-dom';
import PageNotFound from './lib/PageNotFound';
import { AuthProvider, useAuth } from '@/lib/AuthContext';
import { AppProvider } from '@/context/AppContext';
import ErrorBoundary from '@/components/ErrorBoundary';

// Pages
import AccountTypeSelect from '@/pages/AccountTypeSelect';
import BusinessOnboarding from '@/pages/BusinessOnBoarding';
import BusinessDashboard from '@/pages/BusinessDashboard';
import Welcome from '@/pages/Welcome';
import CreateProfile from '@/pages/CreateProfile';
import Home from '@/pages/Home';
import Scanner from '@/pages/Scanner';
import CheckIn from '@/pages/CheckIn';
import Session from '@/pages/Session';
import PersonDetail from '@/pages/PersonDetail';
import EVPage from '@/pages/EVPage';
import Locale from '@/pages/Local';
import Memories from '@/pages/Memories';
import Profile from '@/pages/Profile';

// Layout
import SessionLayout from '@/components/everywhere/SessionLayout';

const AuthenticatedApp = () => {
  const { isLoadingAuth } = useAuth();

  if (isLoadingAuth) {
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-background">
        <div className="w-8 h-8 border-4 border-primary/20 border-t-primary rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <Routes>
      <Route path="/" element={<AccountTypeSelect />} />
      <Route path="/welcome" element={<Welcome />} />
      <Route path="/business-onboarding" element={<BusinessOnboarding />} />
      <Route path="/business" element={<BusinessDashboard />} />
      <Route path="/create-profile" element={<CreateProfile />} />
      <Route path="/home" element={<Home />} />
      <Route path="/scanner" element={<Scanner />} />
      {/* Destinazione dei QR delle serate */}
      <Route path="/checkin" element={<CheckIn />} />
      {/* Il profilo si cura anche da casa: fuori da SessionLayout, che
          richiede una sessione attiva in un locale */}
      <Route path="/profile" element={<Profile />} />

      {/* Session routes with bottom nav */}
      <Route element={<SessionLayout />}>
        <Route path="/session" element={<Session />} />
        <Route path="/session/person/:personId" element={<PersonDetail />} />
        <Route path="/ev" element={<EVPage />} />
        <Route path="/locale" element={<Locale />} />
        <Route path="/memories" element={<Memories />} />
      </Route>

      <Route path="*" element={<PageNotFound />} />
    </Routes>
  );
};

function App() {
  return (
    <ErrorBoundary>
      <AuthProvider>
        <QueryClientProvider client={queryClientInstance}>
          <AppProvider>
            <Router>
              <div className="dark">
                <AuthenticatedApp />
              </div>
            </Router>
            <Toaster />
          </AppProvider>
        </QueryClientProvider>
      </AuthProvider>
    </ErrorBoundary>
  )
}

export default App
