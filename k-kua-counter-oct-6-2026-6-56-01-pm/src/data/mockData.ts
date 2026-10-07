import { Eatery, MealRedemption, StudentProfile, DonationRecord } from '../types';

export const APP_IMAGES = {
  hero: '/src/assets/images/hero_community_meals_1791348230239.jpg',
  foodPlate: '/src/assets/images/eatery_plate_lunch_1791348245654.jpg',
  volunteers: '/src/assets/images/community_kokua_team_1791348256733.jpg',
  studentPortrait: '/src/assets/images/student_profile_portrait_1791348269204.jpg',
};

export const INITIAL_STUDENT: StudentProfile = {
  id: 'stu_882194',
  name: 'Leilani Kealoha',
  uhId: 'UH-2024-8842',
  email: 'leilani.k@hawaii.edu',
  campus: 'University of Hawaiʻi at Mānoa',
  major: 'Natural Resources & Environmental Management',
  creditsRemaining: 4,
  creditsWeeklyMax: 5,
  activePassCode: 'KK-8429-UH',
  passExpiresAt: 'Today at 9:00 PM HST',
  photoUrl: APP_IMAGES.studentPortrait,
  enrolledSemester: 'Fall 2026',
};

export const MOCK_EATERIES: Eatery[] = [
  {
    id: 'eatery-1',
    name: 'Mānoa Valley Plate & Bowl',
    neighborhood: 'Mānoa Village',
    distanceFromCampus: '0.4 miles (8 min walk)',
    cuisine: 'Modern Hawaiian Comfort',
    address: '2752 Woodlawn Dr, Honolulu, HI 96822',
    operatingHours: 'Mon–Sat: 10:30 AM – 7:30 PM',
    phone: '(808) 988-3411',
    acceptsDigitalPass: true,
    imageUrl: APP_IMAGES.foodPlate,
    featuredQuote: '“Every student deserves a warm, nourishing meal cooked with real care and local kalo.”',
    eligibleMeals: [
      {
        name: 'Slow-Cooked Kalua Pork Plate',
        description: 'Locally raised heritage pork, braised local cabbage, hapa rice, and lomi tomato.',
        dietary: ['Gluten-Free Option', 'Locally Sourced'],
        isStudentFavorite: true,
      },
      {
        name: 'Tofu & Watercress Luau Stew',
        description: 'Tender taro leaves simmered in coconut milk, ginger, garlic, and organic island tofu.',
        dietary: ['Vegan', 'Gluten-Free'],
        isStudentFavorite: false,
      },
      {
        name: 'Fresh Shoyu Ahi Bowl',
        description: 'Line-caught ahi tuna marinated in gluten-free tamari, green onion, and sweet ogo seaweed.',
        dietary: ['Pescatarian', 'Dairy-Free'],
        isStudentFavorite: true,
      },
    ],
  },
  {
    id: 'eatery-2',
    name: 'Kaimukī Green Pantry & Deli',
    neighborhood: 'Kaimukī',
    distanceFromCampus: '1.2 miles (Biki bike 6 min)',
    cuisine: 'Organic Island Deli',
    address: '3458 Waialae Ave, Honolulu, HI 96816',
    operatingHours: 'Daily: 9:00 AM – 6:00 PM',
    phone: '(808) 735-8290',
    acceptsDigitalPass: true,
    imageUrl: APP_IMAGES.foodPlate,
    featuredQuote: '“Partnering with Kōkua Counter keeps our kitchen humming while supporting our neighborhood students.”',
    eligibleMeals: [
      {
        name: 'Island Harvest Grain Bowl',
        description: 'Roasted ʻuala (sweet potato), sautéed kale, chickpeas, avocado, and macadamia ginger vinaigrette.',
        dietary: ['Vegan', 'Gluten-Free', 'Nut Allergen'],
        isStudentFavorite: true,
      },
      {
        name: 'Grilled Herb Chicken Baguette',
        description: 'Free-range chicken breast with sun-dried tomato spread, crisp romaine, and pickled onions on house sourdough.',
        dietary: ['Dairy-Free Option'],
        isStudentFavorite: false,
      },
    ],
  },
  {
    id: 'eatery-3',
    name: 'Moʻiliʻili Bento & Musubi',
    neighborhood: 'Moʻiliʻili',
    distanceFromCampus: '0.6 miles (10 min walk)',
    cuisine: 'Japanese-Hawaiian Homestyle',
    address: '2410 S Beretania St, Honolulu, HI 96826',
    operatingHours: 'Mon–Fri: 7:00 AM – 4:00 PM',
    phone: '(808) 949-1122',
    acceptsDigitalPass: true,
    imageUrl: APP_IMAGES.foodPlate,
    featuredQuote: '“Quick, respectful pickup with zero stigma. Students just tap and enjoy their bento.”',
    eligibleMeals: [
      {
        name: 'Classic Mochiko Chicken Bento',
        description: 'Crispy sweet-rice batter chicken, steamed calrose rice, tamagoyaki, and Japanese pickles.',
        dietary: ['Halal Chicken Available'],
        isStudentFavorite: true,
      },
      {
        name: 'Vegetarian Furikake Bento',
        description: 'Teriyaki baked tofu, stir-fried kabocha squash, seasoned edamame, and multigrain rice.',
        dietary: ['Vegetarian'],
        isStudentFavorite: false,
      },
    ],
  },
  {
    id: 'eatery-4',
    name: 'Diamond Head Community Kitchen',
    neighborhood: 'Kapahulu / Diamond Head',
    distanceFromCampus: '1.7 miles (UH Shuttle line)',
    cuisine: 'Nourishing Diner & Soups',
    address: '3158 Monsarrat Ave, Honolulu, HI 96815',
    operatingHours: 'Tue–Sun: 11:00 AM – 8:00 PM',
    phone: '(808) 732-5501',
    acceptsDigitalPass: true,
    imageUrl: APP_IMAGES.foodPlate,
    eligibleMeals: [
      {
        name: 'Grass-Fed Beef Chili & Cornbread',
        description: 'Slow-simmered Big Island beef chili with sweet Maui onions and warm honey cornbread.',
        dietary: ['High Protein'],
        isStudentFavorite: true,
      },
      {
        name: 'Yellow Ginger Lentil Soup & Bread',
        description: 'Spiced island turmeric and ginger yellow split lentils with hearty crusty bread.',
        dietary: ['Vegan'],
        isStudentFavorite: false,
      },
    ],
  },
];

export const INITIAL_REDEMPTIONS: MealRedemption[] = [
  {
    id: 'red-9041',
    timestamp: 'Yesterday at 1:15 PM HST',
    eateryName: 'Mānoa Valley Plate & Bowl',
    eateryNeighborhood: 'Mānoa Village',
    mealName: 'Slow-Cooked Kalua Pork Plate',
    creditsUsed: 1,
    passCode: 'KK-8429-UH',
    status: 'completed',
    studentUhIdMasked: 'UH-••••-8842',
  },
  {
    id: 'red-8912',
    timestamp: 'Oct 4, 2026 at 6:40 PM HST',
    eateryName: 'Moʻiliʻili Bento & Musubi',
    eateryNeighborhood: 'Moʻiliʻili',
    mealName: 'Classic Mochiko Chicken Bento',
    creditsUsed: 1,
    passCode: 'KK-8429-UH',
    status: 'completed',
    studentUhIdMasked: 'UH-••••-8842',
  },
  {
    id: 'red-8733',
    timestamp: 'Oct 2, 2026 at 12:20 PM HST',
    eateryName: 'Kaimukī Green Pantry & Deli',
    eateryNeighborhood: 'Kaimukī',
    mealName: 'Island Harvest Grain Bowl',
    creditsUsed: 1,
    passCode: 'KK-8429-UH',
    status: 'completed',
    studentUhIdMasked: 'UH-••••-8842',
  },
];

export const INITIAL_DONATIONS: DonationRecord[] = [
  {
    id: 'don-101',
    amount: 60,
    mealsFunded: 5,
    donorName: 'Dr. Keanu & Nalani Silva',
    timestamp: '2 hours ago',
    isMonthly: true,
    dedicatedTo: 'UH First-Generation Scholars',
  },
  {
    id: 'don-102',
    amount: 120,
    mealsFunded: 10,
    donorName: 'Kailua Community Circle',
    timestamp: '5 hours ago',
    isMonthly: false,
    dedicatedTo: 'Mānoa Food Security Fund',
  },
  {
    id: 'don-103',
    amount: 30,
    mealsFunded: 2,
    donorName: 'Anonymous Alum ‘18',
    timestamp: '1 day ago',
    isMonthly: true,
  },
  {
    id: 'don-104',
    amount: 300,
    mealsFunded: 25,
    donorName: 'Pacific Heritage Trust',
    timestamp: '2 days ago',
    isMonthly: false,
    dedicatedTo: 'All UH Island Campuses',
  },
];

export const FAQS: import('../types').FAQItem[] = [
  {
    id: 'faq-eligibility-1',
    category: 'students',
    categoryLabel: 'Student Eligibility',
    question: 'Who is eligible for Kōkua Counter meal credits?',
    answer:
      'Any currently enrolled University of Hawaiʻi undergraduate, graduate, or community college student facing food budget hardship or living cost pressure is eligible. We do not require invasive financial means testing or minimum GPA barriers. Verification is completed in under two minutes using your official @hawaii.edu institutional email account.',
    highlight: 'Open to all UH campus students experiencing nutrition or budget hardship.',
    relatedAction: {
      label: 'Sign in with UH email to activate pass',
      target: 'signin',
    },
  },
  {
    id: 'faq-usage-1',
    category: 'students',
    categoryLabel: 'Credit Usage',
    question: 'How do meal credits work and how many do I receive?',
    answer:
      'Enrolled students typically receive 4 to 5 meal credits every week. Exactly 1 credit covers 1 complete, hot, wholesome entree plate (including proteins and fresh sides) at any participating neighborhood eatery. Up to 2 credits may be used per calendar day to ensure balanced nutrition throughout the week.',
    highlight: '1 Credit = 1 Complete Hot Plate with no out-of-pocket costs.',
    relatedAction: {
      label: 'View active student pass demo',
      target: 'dashboard',
    },
  },
  {
    id: 'faq-usage-2',
    category: 'students',
    categoryLabel: 'Credit Usage',
    question: 'How do I redeem my meal pass at the counter? Is it stigmatizing?',
    answer:
      'Redemption is 100% stigma-free and private. Simply open your Kōkua pass on your smartphone and show the dynamic QR code or 6-character verification code to the cashier. To anyone in line, it looks identical to scanning an Apple Wallet loyalty pass or coffee gift card. Cashiers treat pass holders with the exact same warm aloha as any paying guest.',
    highlight: 'Looks like a regular mobile loyalty card. Zero public charity identifiers.',
    relatedAction: {
      label: 'Learn about our FERPA privacy policy',
      target: 'privacy',
    },
  },
  {
    id: 'faq-usage-3',
    category: 'students',
    categoryLabel: 'Credit Usage',
    question: 'What happens to unused credits at the end of the week?',
    answer:
      'Weekly allocations refresh every Sunday at 11:59 PM HST. Unused credits from the prior cycle gracefully return to our central community food trust so other classmates in need can be supported. If you ever have a particularly demanding week (midterms, car repairs, reduced work hours), you can request immediate supplemental credits right from your dashboard.',
    highlight: 'Unused credits circulate to peers; supplemental refills are approved within 2 hours.',
  },
  {
    id: 'faq-usage-4',
    category: 'students',
    categoryLabel: 'Menu & Dietary',
    question: 'Are there dietary accommodations for vegan, gluten-free, or halal diets?',
    answer:
      'Yes. Our participating eateries (including Mānoa Valley Plate & Bowl, Kaimukī Green Pantry, and Moʻiliʻili Bento) curate designated Kōkua plates accommodating plant-based, gluten-free, dairy-free, and halal diets. Every menu item in your student dashboard clearly lists allergen badges and ingredient highlights.',
    highlight: 'Wholesome options available for plant-based, gluten-free, and halal needs.',
  },
  {
    id: 'faq-trust-1',
    category: 'donors',
    categoryLabel: 'Donor Trust & Impact',
    question: 'Where does my donation actually go? Is there administrative overhead?',
    answer:
      '100% of your meal donation ($12 per plate) is disbursed directly to independent local eateries via automated Monday ACH bank transfers to cover the cost of prepared student meals. We maintain a strict zero-overhead policy on meal contributions: platform engineering, server hosting, and student outreach are fully funded by independent private philanthropic grants.',
    highlight: '100% of donor dollars pay for food directly at local kitchen counters.',
    relatedAction: {
      label: 'Make a $12 tax-deductible gift',
      target: 'donate',
    },
  },
  {
    id: 'faq-trust-2',
    category: 'donors',
    categoryLabel: 'Tax & Receipts',
    question: 'Is my donation tax-deductible under IRS rules?',
    answer:
      'Yes. Kōkua Counter operates under fiscal sponsorship with a registered 501(c)(3) nonprofit public charity (EIN: 99-0418291). Every donor immediately receives an official IRS-compliant PDF receipt detailing the transaction ID, contribution amount, and student meal equivalent.',
    highlight: 'Immediate 501(c)(3) tax receipt generated upon gift completion.',
  },
  {
    id: 'faq-trust-3',
    category: 'donors',
    categoryLabel: 'Community Impact',
    question: 'Why choose restaurant meal credits over traditional food banks?',
    answer:
      'Traditional canned-food drives are vital, but college students with packed academic schedules and limited dorm kitchen setups frequently lack the stoves, cookware, or time to prepare raw ingredients. Hot, cooked plate lunches from neighborhood restaurants provide immediate, dignity-affirming calories while keeping local food dollars circulating directly inside our island economy.',
    highlight: 'Immediate hot nourishment for students while strengthening local businesses.',
  },
  {
    id: 'faq-eateries-1',
    category: 'eateries',
    categoryLabel: 'Eatery Partnerships',
    question: 'How do restaurants partner with Kōkua Counter and receive payment?',
    answer:
      'Participating eateries negotiate a fair standard rate of $12.00 per designated nutritious meal plate. Counter staff use our simple mobile/tablet screen to scan student passes in under 3 seconds. Reimbursements are processed on weekly Monday batch cycles with direct deposit and zero transaction fees.',
    highlight: 'Guaranteed weekly ACH payouts at $12/plate with zero merchant deductions.',
    relatedAction: {
      label: 'Explore the eatery staff terminal',
      target: 'eatery',
    },
  },
  {
    id: 'faq-eateries-2',
    category: 'eateries',
    categoryLabel: 'Eatery Partnerships',
    question: 'What standards must participating dining partners meet?',
    answer:
      'All partner kitchens must hold active Hawaiʻi Department of Health sanitary permits, operate within walking distance or transit access of a UH campus, and commit to serving Kōkua pass holders with the same portion sizes, quality ingredients, and welcoming hospitality given to standard retail guests.',
    highlight: 'Rigorous health standards and a covenant of equal, respectful hospitality.',
  },
];
