export type PageView =
  | 'landing'
  | 'donate'
  | 'signin'
  | 'dashboard'
  | 'eatery'
  | 'privacy'
  | 'terms';

export interface StudentProfile {
  id: string;
  name: string;
  uhId: string;
  email: string;
  campus: string;
  major: string;
  creditsRemaining: number;
  creditsWeeklyMax: number;
  activePassCode: string;
  passExpiresAt: string;
  photoUrl: string;
  enrolledSemester: string;
}

export interface Eatery {
  id: string;
  name: string;
  neighborhood: string;
  distanceFromCampus: string;
  cuisine: string;
  address: string;
  operatingHours: string;
  eligibleMeals: {
    name: string;
    description: string;
    dietary: string[];
    isStudentFavorite?: boolean;
  }[];
  imageUrl: string;
  phone: string;
  acceptsDigitalPass: boolean;
  featuredQuote?: string;
}

export interface MealRedemption {
  id: string;
  timestamp: string;
  eateryName: string;
  eateryNeighborhood: string;
  mealName: string;
  creditsUsed: number;
  passCode: string;
  status: 'completed' | 'processing' | 'refunded';
  studentUhIdMasked: string;
}

export interface DonationRecord {
  id: string;
  amount: number;
  mealsFunded: number;
  donorName: string;
  timestamp: string;
  isMonthly: boolean;
  dedicatedTo?: string;
}

export interface FAQItem {
  id: string;
  category: 'students' | 'donors' | 'eateries';
  categoryLabel: string;
  question: string;
  answer: string;
  highlight?: string;
  relatedAction?: {
    label: string;
    target: PageView;
  };
}
