import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import {
  Lock,
  Mail,
  ShieldCheck,
  Eye,
  EyeOff,
  AlertCircle,
  CheckCircle2,
  KeyRound,
  ArrowRight,
  Info,
} from 'lucide-react';

export const StudentSignInPage: React.FC = () => {
  const { loginAsStudent, setCurrentPage } = useApp();

  const [activeTab, setActiveTab] = useState<'password' | 'magic'>('password');
  const [emailOrUsername, setEmailOrUsername] = useState('leilani.k@hawaii.edu');
  const [password, setPassword] = useState('••••••••••••');
  const [showPassword, setShowPassword] = useState(false);
  const [magicEmail, setMagicEmail] = useState('');
  const [magicSent, setMagicSent] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{
    type: 'error' | 'success' | null;
    text: string;
  }>({ type: null, text: '' });
  const [loading, setLoading] = useState(false);

  const handlePasswordSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setStatusMessage({ type: null, text: '' });
    setLoading(true);

    setTimeout(() => {
      setLoading(false);
      // Validate email format
      if (!emailOrUsername.includes('@hawaii.edu') && !emailOrUsername.includes('uh')) {
        setStatusMessage({
          type: 'error',
          text: 'Please enter a valid @hawaii.edu institutional email address or UH Username.',
        });
        return;
      }

      if (password.length < 4) {
        setStatusMessage({
          type: 'error',
          text: 'Password must be at least 4 characters.',
        });
        return;
      }

      // Successful login
      loginAsStudent();
    }, 600);
  };

  const handleMagicLinkSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!magicEmail.endsWith('@hawaii.edu')) {
      setStatusMessage({
        type: 'error',
        text: 'Access is reserved for verified University of Hawaiʻi accounts ending in @hawaii.edu.',
      });
      return;
    }

    setLoading(true);
    setTimeout(() => {
      setLoading(false);
      setMagicSent(true);
      setStatusMessage({
        type: 'success',
        text: `Secure 6-digit verification pass sent to ${magicEmail}. Check your UH Gmail inbox.`,
      });
    }, 600);
  };

  return (
    <div className="min-h-screen bg-[#FAF8F5] py-12 sm:py-20 px-4 sm:px-6 lg:px-8 flex items-center justify-center">
      <div className="max-w-md w-full space-y-8">
        {/* Header Branding */}
        <div className="text-center space-y-2">
          <div className="w-12 h-12 rounded-2xl bg-[#24503B] text-white flex items-center justify-center mx-auto shadow-md">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
            </svg>
          </div>
          <h1 className="font-serif text-3xl font-bold text-[#132A1E]">
            Student Meal Pass Portal
          </h1>
          <p className="text-xs sm:text-sm text-stone-600">
            Sign in with your University of Hawaiʻi credentials to access your weekly meal credits.
          </p>
        </div>

        {/* Demo Fast Login Banner */}
        <div className="bg-[#E7EFEA] border border-[#A3E0C8]/80 rounded-2xl p-4 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-[#18392B] flex items-center gap-1.5">
              <KeyRound className="w-4 h-4 text-[#24503B]" />
              Quick Demo Access
            </span>
            <span className="text-[11px] text-[#24503B] font-medium bg-white/70 px-2 py-0.5 rounded">
              Active UH Student
            </span>
          </div>
          <p className="text-xs text-stone-700 leading-relaxed">
            Test the live student meal pass with sample student <strong className="text-[#18392B]">Leilani Kealoha</strong> (UH Mānoa, 4 credits remaining).
          </p>
          <button
            type="button"
            onClick={loginAsStudent}
            className="w-full mt-1 py-2 px-3 text-xs font-semibold text-white bg-[#24503B] hover:bg-[#1B3B2B] rounded-xl transition-all shadow-sm flex items-center justify-center gap-1.5 cursor-pointer"
          >
            <span>One-Click Sign In as Leilani</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Auth Box */}
        <div className="bg-white rounded-3xl p-6 sm:p-8 border border-stone-200/90 shadow-sm space-y-6">
          {/* Tab Selection */}
          <div className="p-1 bg-[#FAF8F5] border border-stone-200/80 rounded-xl flex items-center">
            <button
              type="button"
              onClick={() => {
                setActiveTab('password');
                setStatusMessage({ type: null, text: '' });
              }}
              className={`flex-1 py-2 text-xs font-semibold rounded-lg transition-all ${
                activeTab === 'password'
                  ? 'bg-white text-stone-900 shadow-sm'
                  : 'text-stone-600 hover:text-stone-900'
              }`}
            >
              Password Login
            </button>
            <button
              type="button"
              onClick={() => {
                setActiveTab('magic');
                setStatusMessage({ type: null, text: '' });
              }}
              className={`flex-1 py-2 text-xs font-semibold rounded-lg transition-all ${
                activeTab === 'magic'
                  ? 'bg-white text-stone-900 shadow-sm'
                  : 'text-stone-600 hover:text-stone-900'
              }`}
            >
              Magic Link / Email Code
            </button>
          </div>

          {/* Status / Error Banner */}
          {statusMessage.text && (
            <div
              className={`p-3.5 rounded-xl text-xs flex items-start gap-2 ${
                statusMessage.type === 'error'
                  ? 'bg-[#FCECE8] text-[#C8583D] border border-[#F5A38F]/50'
                  : 'bg-[#E7EFEA] text-[#24503B] border border-[#A3E0C8]/60'
              }`}
            >
              {statusMessage.type === 'error' ? (
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              ) : (
                <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
              )}
              <span className="leading-relaxed">{statusMessage.text}</span>
            </div>
          )}

          {/* Flow 1: Password Login */}
          {activeTab === 'password' && (
            <form onSubmit={handlePasswordSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-stone-800 mb-1">
                  UH Email or Username
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-stone-400">
                    <Mail className="w-4 h-4" />
                  </div>
                  <input
                    type="text"
                    required
                    placeholder="e.g. username@hawaii.edu"
                    value={emailOrUsername}
                    onChange={(e) => setEmailOrUsername(e.target.value)}
                    className="w-full pl-9 pr-4 py-2.5 text-sm rounded-xl border border-stone-200 focus:border-[#24503B] focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-xs font-semibold text-stone-800">
                    Password
                  </label>
                  <button
                    type="button"
                    onClick={() => {
                      setStatusMessage({
                        type: 'success',
                        text: 'Password reset link sent to your verified @hawaii.edu recovery email.',
                      });
                    }}
                    className="text-[11px] text-[#24503B] hover:underline"
                  >
                    Forgot password?
                  </button>
                </div>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-stone-400">
                    <Lock className="w-4 h-4" />
                  </div>
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    placeholder="Enter password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full pl-9 pr-10 py-2.5 text-sm rounded-xl border border-stone-200 focus:border-[#24503B] focus:outline-none"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute inset-y-0 right-0 pr-3 flex items-center text-stone-400 hover:text-stone-700"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div className="flex items-center justify-between pt-1">
                <label className="flex items-center gap-2 text-xs text-stone-600 cursor-pointer">
                  <input
                    type="checkbox"
                    defaultChecked
                    className="w-4 h-4 text-[#24503B] rounded border-stone-300"
                  />
                  <span>Remember this device for 30 days</span>
                </label>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-3 px-4 text-xs font-semibold text-white bg-[#24503B] hover:bg-[#1B3B2B] rounded-xl shadow-sm transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60"
              >
                <span>{loading ? 'Authenticating...' : 'Sign In with UH Account'}</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </form>
          )}

          {/* Flow 2: Magic Link / Email Code */}
          {activeTab === 'magic' && (
            <form onSubmit={handleMagicLinkSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-stone-800 mb-1">
                  Your @hawaii.edu Email Address
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-stone-400">
                    <Mail className="w-4 h-4" />
                  </div>
                  <input
                    type="email"
                    required
                    placeholder="student@hawaii.edu"
                    value={magicEmail}
                    onChange={(e) => setMagicEmail(e.target.value)}
                    className="w-full pl-9 pr-4 py-2.5 text-sm rounded-xl border border-stone-200 focus:border-[#24503B] focus:outline-none"
                  />
                </div>
                <p className="text-[11px] text-stone-500 mt-1">
                  We'll send a one-time sign-in link with zero password required.
                </p>
              </div>

              {magicSent && (
                <div className="space-y-2 pt-2 border-t border-stone-100">
                  <label className="block text-xs font-semibold text-stone-800">
                    Enter 6-Digit Code from Email
                  </label>
                  <input
                    type="text"
                    maxLength={6}
                    placeholder="e.g. 842910"
                    defaultValue="842910"
                    className="w-full text-center tracking-widest text-lg font-mono font-bold py-2 rounded-xl border border-stone-200 bg-stone-50"
                  />
                  <button
                    type="button"
                    onClick={loginAsStudent}
                    className="w-full py-2.5 text-xs font-semibold text-white bg-[#24503B] hover:bg-[#1B3B2B] rounded-xl transition-all"
                  >
                    Confirm & Enter Dashboard
                  </button>
                </div>
              )}

              {!magicSent && (
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-3 px-4 text-xs font-semibold text-white bg-[#24503B] hover:bg-[#1B3B2B] rounded-xl shadow-sm transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60"
                >
                  <span>{loading ? 'Sending link...' : 'Send One-Time Magic Link'}</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              )}
            </form>
          )}

          {/* Privacy & FERPA note */}
          <div className="pt-4 border-t border-stone-100 flex items-start gap-2.5 text-[11px] text-stone-500 leading-relaxed">
            <ShieldCheck className="w-4 h-4 text-[#24503B] shrink-0 mt-0.5" />
            <span>
              Protected by Family Educational Rights and Privacy Act (FERPA). Participation in Kōkua Counter is strictly confidential and never shared with academic advisors or financial aid offices.
            </span>
          </div>
        </div>

        {/* Need Help link */}
        <div className="text-center text-xs text-stone-500">
          Not yet enrolled in the meal credit initiative?{' '}
          <button
            onClick={() => setCurrentPage('landing')}
            className="text-[#24503B] font-semibold underline underline-offset-4"
          >
            Learn about eligibility & apply
          </button>
        </div>
      </div>
    </div>
  );
};
