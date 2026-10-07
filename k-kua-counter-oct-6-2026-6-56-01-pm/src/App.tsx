/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { AppProvider, useApp } from './context/AppContext';
import { Header } from './components/Header';
import { Footer } from './components/Footer';
import { ToastContainer } from './components/ToastContainer';
import { LandingPage } from './pages/LandingPage';
import { DonationPage } from './pages/DonationPage';
import { StudentSignInPage } from './pages/StudentSignInPage';
import { StudentDashboard } from './pages/StudentDashboard';
import { EateryStaffScreen } from './pages/EateryStaffScreen';
import { LegalPrivacyPage } from './pages/LegalPrivacyPage';
import { LegalTermsPage } from './pages/LegalTermsPage';

const AppContent: React.FC = () => {
  const { currentPage } = useApp();

  return (
    <div className="min-h-screen flex flex-col bg-[#FAF8F5] text-[#1E2922] font-sans antialiased selection:bg-[#E27D60]/20 selection:text-[#18392B]">
      <Header />
      <main className="flex-grow">
        {currentPage === 'landing' && <LandingPage />}
        {currentPage === 'donate' && <DonationPage />}
        {currentPage === 'signin' && <StudentSignInPage />}
        {currentPage === 'dashboard' && <StudentDashboard />}
        {currentPage === 'eatery' && <EateryStaffScreen />}
        {currentPage === 'privacy' && <LegalPrivacyPage />}
        {currentPage === 'terms' && <LegalTermsPage />}
      </main>
      <Footer />
      <ToastContainer />
    </div>
  );
};

export default function App() {
  return (
    <AppProvider>
      <AppContent />
    </AppProvider>
  );
}
