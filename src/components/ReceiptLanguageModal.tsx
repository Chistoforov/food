import React, { useState } from 'react';
import { SupabaseService } from '../services/supabaseService';
import { useAuth } from '../contexts/AuthContext';
import { Globe, Check, Loader2 } from 'lucide-react';

interface ReceiptLanguageModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const LANGUAGES = [
  { code: 'Russian', label: 'Русский', flag: '🇷🇺' },
  { code: 'English', label: 'English', flag: '🇺🇸' },
  { code: 'German', label: 'Deutsch', flag: '🇩🇪' },
  { code: 'French', label: 'Français', flag: '🇫🇷' },
  { code: 'Spanish', label: 'Español', flag: '🇪🇸' },
  { code: 'Portuguese', label: 'Português', flag: '🇵🇹' },
  { code: 'Italian', label: 'Italiano', flag: '🇮🇹' },
  { code: 'Ukrainian', label: 'Українська', flag: '🇺🇦' },
  { code: 'Kazakh', label: 'Қазақ', flag: '🇰🇿' },
  { code: 'Belarusian', label: 'Беларуская', flag: '🇧🇾' },
];

const ReceiptLanguageModal: React.FC<ReceiptLanguageModalProps> = ({ isOpen, onClose }) => {
  const { user, refreshProfile } = useAuth();
  const [selectedLanguage, setSelectedLanguage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen || !user) return null;

  const handleSubmit = async () => {
    if (!selectedLanguage) return;

    try {
      setIsSubmitting(true);
      await SupabaseService.updateUserProfile(user.id, {
        receipt_language: selectedLanguage
      });
      await refreshProfile(); // Refresh profile to get updated data
      onClose();
    } catch (error) {
      console.error('Failed to update receipt language:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fadeIn">
      <div className="bg-white rounded-[24px] shadow-2xl w-full max-w-md overflow-hidden animate-scaleIn">
        <div className="p-8">
          <div className="w-16 h-16 bg-indigo-100 rounded-full flex items-center justify-center mx-auto mb-6">
            <Globe className="text-indigo-600 w-8 h-8" />
          </div>

          <h2 className="text-2xl font-bold text-center text-slate-900 mb-2">
            Добро пожаловать!
          </h2>
          <p className="text-center text-slate-500 mb-8">
            На каком языке будут ваши <span className="font-bold text-indigo-600 bg-indigo-50 px-1 rounded">чеки</span>?
            <br />
            <span className="text-sm mt-1 block">Это поможет нам лучше распознавать товары.</span>
          </p>

          <div className="space-y-3 mb-8 max-h-[300px] overflow-y-auto pr-2 custom-scrollbar">
            {LANGUAGES.map((lang) => (
              <button
                key={lang.code}
                onClick={() => setSelectedLanguage(lang.code)}
                className={`w-full flex items-center justify-between p-4 rounded-xl border-2 transition-all ${
                  selectedLanguage === lang.code
                    ? 'border-indigo-600 bg-indigo-50 text-indigo-900'
                    : 'border-slate-100 hover:border-indigo-200 hover:bg-slate-50 text-slate-700'
                }`}
              >
                <div className="flex items-center gap-3">
                  <span className="text-2xl">{lang.flag}</span>
                  <span className="font-medium">{lang.label}</span>
                </div>
                {selectedLanguage === lang.code && (
                  <Check className="text-indigo-600 w-5 h-5" />
                )}
              </button>
            ))}
          </div>

          <button
            onClick={handleSubmit}
            disabled={!selectedLanguage || isSubmitting}
            className={`w-full py-4 rounded-xl font-bold text-lg transition-all flex items-center justify-center gap-2 ${
              !selectedLanguage || isSubmitting
                ? 'bg-slate-100 text-slate-400 cursor-not-allowed'
                : 'bg-indigo-600 hover:bg-indigo-700 text-white shadow-lg shadow-indigo-200 hover:shadow-indigo-300 transform hover:-translate-y-0.5'
            }`}
          >
            {isSubmitting ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                Сохранение...
              </>
            ) : (
              'Продолжить'
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ReceiptLanguageModal;

