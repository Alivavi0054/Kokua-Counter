import React, { createContext, useContext, useState, useEffect } from 'react';
import { PageView, StudentProfile, Eatery, MealRedemption, DonationRecord } from '../types';
import { INITIAL_STUDENT, MOCK_EATERIES, INITIAL_REDEMPTIONS, INITIAL_DONATIONS } from '../data/mockData';

interface ToastMessage {
  id: string;
  title: string;
  message: string;
  type: 'success' | 'info' | 'error';
}

interface AppContextType {
  currentPage: PageView;
  setCurrentPage: (page: PageView) => void;
  currentUser: StudentProfile | null;
  setCurrentUser: React.Dispatch<React.SetStateAction<StudentProfile | null>>;
  eateries: Eatery[];
  redemptions: MealRedemption[];
  donations: DonationRecord[];
  totalMealsFunded: number;
  redeemMeal: (eateryId: string, mealName: string, passCodeInput?: string) => boolean;
  addDonation: (amount: number, donorName: string, isMonthly: boolean, dedicatedTo?: string) => void;
  toasts: ToastMessage[];
  addToast: (title: string, message: string, type?: 'success' | 'info' | 'error') => void;
  removeToast: (id: string) => void;
  loginAsStudent: () => void;
  logout: () => void;
  reloadStudentCredits: () => void;
  activeEateryId: string;
  setActiveEateryId: (id: string) => void;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [currentPage, setCurrentPage] = useState<PageView>('landing');
  const [currentUser, setCurrentUser] = useState<StudentProfile | null>(INITIAL_STUDENT);
  const [eateries] = useState<Eatery[]>(MOCK_EATERIES);
  const [activeEateryId, setActiveEateryId] = useState<string>('eatery-1');
  const [redemptions, setRedemptions] = useState<MealRedemption[]>(INITIAL_REDEMPTIONS);
  const [donations, setDonations] = useState<DonationRecord[]>(INITIAL_DONATIONS);
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  // Scroll to top on page change
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [currentPage]);

  const addToast = (title: string, message: string, type: 'success' | 'info' | 'error' = 'success') => {
    const id = Math.random().toString(36).substring(2, 9);
    setToasts((prev) => [...prev, { id, title, message, type }]);
    setTimeout(() => {
      removeToast(id);
    }, 4500);
  };

  const removeToast = (id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  const loginAsStudent = () => {
    setCurrentUser(INITIAL_STUDENT);
    addToast('Aloha Leilani!', 'Signed in successfully via University of Hawaiʻi SSO.');
    setCurrentPage('dashboard');
  };

  const logout = () => {
    setCurrentUser(null);
    addToast('Signed Out', 'You have been safely signed out.', 'info');
    setCurrentPage('landing');
  };

  const reloadStudentCredits = () => {
    if (currentUser) {
      setCurrentUser({
        ...currentUser,
        creditsRemaining: currentUser.creditsWeeklyMax,
      });
      addToast('Credits Refreshed', `Your weekly meal allocation has been restored to ${currentUser.creditsWeeklyMax} credits.`);
    }
  };

  const redeemMeal = (eateryId: string, mealName: string, passCodeInput?: string): boolean => {
    const eatery = eateries.find((e) => e.id === eateryId);
    if (!eatery) {
      addToast('Error', 'Eatery not found.', 'error');
      return false;
    }

    if (!currentUser || currentUser.creditsRemaining <= 0) {
      addToast('Insufficient Credits', 'No meal credits remaining for this cycle.', 'error');
      return false;
    }

    const passToUse = passCodeInput || currentUser.activePassCode;

    // Deduct credit
    setCurrentUser((prev) => {
      if (!prev) return null;
      return {
        ...prev,
        creditsRemaining: Math.max(0, prev.creditsRemaining - 1),
      };
    });

    const newRedemption: MealRedemption = {
      id: `red-${Math.floor(1000 + Math.random() * 9000)}`,
      timestamp: 'Just now',
      eateryName: eatery.name,
      eateryNeighborhood: eatery.neighborhood,
      mealName: mealName,
      creditsUsed: 1,
      passCode: passToUse,
      status: 'completed',
      studentUhIdMasked: 'UH-••••-8842',
    };

    setRedemptions((prev) => [newRedemption, ...prev]);
    addToast('Meal Approved! Mahalo!', `1 credit redeemed for "${mealName}" at ${eatery.name}.`);
    return true;
  };

  const addDonation = (amount: number, donorName: string, isMonthly: boolean, dedicatedTo?: string) => {
    const meals = Math.round(amount / 12);
    const newDonation: DonationRecord = {
      id: `don-${Math.floor(100 + Math.random() * 900)}`,
      amount,
      mealsFunded: meals,
      donorName: donorName || 'Kind Neighbor',
      timestamp: 'Just now',
      isMonthly,
      dedicatedTo,
    };

    setDonations((prev) => [newDonation, ...prev]);
    addToast(
      'Mahalo Nui Loa!',
      `Your tax-deductible contribution of $${amount} funds approximately ${meals} student meals.`
    );
  };

  const totalMealsFunded = 18450 + donations.reduce((acc, d) => acc + d.mealsFunded, 0);

  return (
    <AppContext.Provider
      value={{
        currentPage,
        setCurrentPage,
        currentUser,
        setCurrentUser,
        eateries,
        redemptions,
        donations,
        totalMealsFunded,
        redeemMeal,
        addDonation,
        toasts,
        addToast,
        removeToast,
        loginAsStudent,
        logout,
        reloadStudentCredits,
        activeEateryId,
        setActiveEateryId,
      }}
    >
      {children}
    </AppContext.Provider>
  );
};

export const useApp = () => {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useApp must be used within an AppProvider');
  }
  return context;
};
