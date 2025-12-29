import { useState, useEffect } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { SupabaseService } from '../services/supabaseService'
import { UserProfile, FamilyInvitation } from '../lib/supabase'
import { LogOut, Plus, Mail, X, Check, Loader2, Users, Globe, RefreshCw } from 'lucide-react'
import { clearAppCache } from '../utils/cacheHelper'

const LANGUAGES = [
  { code: 'Russian', label: 'Русский (Russian)' },
  { code: 'English', label: 'English' },
  { code: 'German', label: 'Deutsch (German)' },
  { code: 'French', label: 'Français (French)' },
  { code: 'Spanish', label: 'Español (Spanish)' },
  { code: 'Portuguese', label: 'Português (Portuguese)' },
  { code: 'Italian', label: 'Italiano (Italian)' },
  { code: 'Ukrainian', label: 'Українська (Ukrainian)' },
  { code: 'Kazakh', label: 'Қазақ (Kazakh)' },
  { code: 'Belarusian', label: 'Беларуская (Belarusian)' },
];

const AccountPage = () => {
  const { user, profile, signOut, refreshProfile } = useAuth()
  const [members, setMembers] = useState<UserProfile[]>([])
  const [invitations, setInvitations] = useState<FamilyInvitation[]>([])
  const [loading, setLoading] = useState(true)
  const [showInviteModal, setShowInviteModal] = useState(false)
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviting, setInviting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [updatingLanguage, setUpdatingLanguage] = useState(false)
  
  // Cache clearing state
  const [isClearingCache, setIsClearingCache] = useState(false);

  useEffect(() => {
    if (profile?.family_id) {
      loadFamilyData()
    }
  }, [profile])

  const loadFamilyData = async () => {
    try {
      setLoading(true)
      const [membersData, invitationsData] = await Promise.all([
        SupabaseService.getFamilyMembers(profile!.family_id),
        SupabaseService.getFamilyInvitations(profile!.family_id)
      ])
      setMembers(membersData || [])
      setInvitations(invitationsData || [])
    } catch (err) {
      console.error('Error loading family data:', err)
    } finally {
      setLoading(false)
    }
  }

  const handleLanguageChange = async (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newLang = e.target.value;
    if (!user) return;
    
    try {
      setUpdatingLanguage(true);
      await SupabaseService.updateUserProfile(user.id, { receipt_language: newLang });
      await refreshProfile();
      setSuccess('Язык чеков обновлен');
      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      console.error('Error updating language:', err);
      setError('Не удалось обновить язык чеков');
    } finally {
      setUpdatingLanguage(false);
    }
  };

  const handleClearCache = async () => {
    try {
      setIsClearingCache(true);
      console.log('🧹 Начинаем очистку кэша...');

      // Используем общую функцию очистки
      // true - сохраняем авторизацию
      await clearAppCache(profile?.family_id, true);

      setSuccess('Кэш очищен! Приложение перезагрузится...');
      
      // Перезагружаем страницу через 2 секунды
      setTimeout(() => {
        console.log('🔄 Перезагружаем страницу...');
        window.location.reload();
      }, 1500);
      
    } catch (error) {
      console.error('❌ Ошибка очистки кэша:', error);
      setError('Ошибка: ' + (error instanceof Error ? error.message : 'Неизвестная ошибка'));
    } finally {
      setIsClearingCache(false);
    }
  };

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!inviteEmail) return

    try {
      setInviting(true)
      setError(null)
      await SupabaseService.inviteUser(inviteEmail, profile!.family_id)
      setSuccess('Приглашение отправлено!')
      setInviteEmail('')
      setShowInviteModal(false)
      loadFamilyData()
      setTimeout(() => setSuccess(null), 3000)
    } catch (err: any) {
      console.error('Invite error:', err)
      setError(err.message || 'Ошибка отправки приглашения')
    } finally {
      setInviting(false)
    }
  }

  const handleCancelInvite = async (id: number) => {
      try {
          await SupabaseService.cancelInvitation(id)
          loadFamilyData()
      } catch (err) {
          console.error(err)
      }
  }

  return (
    <div className="space-y-6 animate-fadeIn">
      <div className="flex items-center justify-between">
          <h2 className="text-xl font-bold text-slate-900">Аккаунт</h2>
          <button 
            onClick={() => signOut()}
            className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition-colors"
            title="Выйти"
          >
              <LogOut size={20} />
          </button>
      </div>

      {/* Profile Card */}
      <div className="bg-white rounded-[24px] p-4 sm:p-6 shadow-sm border border-slate-100 flex items-center gap-4">
        <div className="w-16 h-16 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white text-2xl font-bold shadow-lg shadow-indigo-200">
          {user?.email?.charAt(0).toUpperCase()}
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-xs font-semibold text-indigo-600 uppercase tracking-wider mb-0.5">Ваш профиль</div>
          <div className="font-bold text-slate-900 text-lg truncate">{user?.email}</div>
          <div className="text-sm text-slate-500">Семья #{profile?.family_id}</div>
        </div>
      </div>
      
      {/* Settings Section */}
      <div className="space-y-4">
        <h3 className="font-bold text-slate-900 px-1">Настройки</h3>
        
        {/* Receipt Language Settings */}
        <div className="bg-white rounded-[24px] p-4 sm:p-6 shadow-sm border border-slate-100">
          <h3 className="font-bold text-slate-900 mb-4 flex items-center gap-2">
            <Globe size={20} className="text-slate-400" />
            Язык чеков
          </h3>
          <p className="text-sm text-slate-500 mb-4">
            Выберите язык, на котором обычно печатаются ваши чеки. Это поможет нам лучше распознавать товары.
          </p>
          <div className="relative">
            <select
              value={profile?.receipt_language || ''}
              onChange={handleLanguageChange}
              disabled={updatingLanguage}
              className="w-full appearance-none bg-slate-50 border border-slate-200 text-slate-900 text-sm rounded-xl focus:ring-indigo-500 focus:border-indigo-500 block p-3 pr-8 disabled:opacity-50 transition-colors cursor-pointer"
            >
              <option value="" disabled>Выберите язык</option>
              {LANGUAGES.map(lang => (
                <option key={lang.code} value={lang.code}>{lang.label}</option>
              ))}
            </select>
            <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-3 text-slate-500">
              <svg className="fill-current h-4 w-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20"><path d="M9.293 12.95l.707.707L15.657 8l-1.414-1.414L10 10.828 5.757 6.586 4.343 8z"/></svg>
            </div>
            {updatingLanguage && (
              <div className="absolute inset-y-0 right-10 flex items-center">
                <Loader2 className="animate-spin text-indigo-600 w-4 h-4" />
              </div>
            )}
          </div>
        </div>
        
        {/* Clear Cache Button */}
        <button
          onClick={handleClearCache}
          disabled={isClearingCache}
          className="w-full bg-white rounded-[24px] p-4 shadow-sm border border-slate-100 flex items-center justify-between group hover:bg-slate-50 transition-colors"
        >
          <div className="flex items-center gap-4">
            <div className="p-3 bg-slate-100 text-slate-500 rounded-2xl group-hover:bg-slate-200 transition-colors">
              <RefreshCw size={24} className={isClearingCache ? 'animate-spin' : ''} />
            </div>
            <div className="text-left">
              <div className="font-bold text-slate-900">Сбросить кэш</div>
              <div className="text-sm text-slate-500">Исправить ошибки и обновить данные</div>
            </div>
          </div>
        </button>
      </div>

      {/* Family Members */}
      <div>
        <div className="flex items-center justify-between mb-4 px-1">
            <h3 className="font-bold text-slate-900 flex items-center gap-2">
                <Users size={20} className="text-slate-400" />
                Члены семьи
            </h3>
            <button
              onClick={() => setShowInviteModal(true)}
              className="bg-indigo-600 text-white px-3 py-1.5 rounded-xl text-sm font-bold flex items-center gap-1.5 hover:bg-indigo-700 transition-colors shadow-md shadow-indigo-200 active:scale-95"
            >
                <Plus size={16} />
                Добавить
            </button>
        </div>

        {loading ? (
           <div className="flex justify-center py-8">
               <Loader2 className="animate-spin text-slate-400" />
           </div>
        ) : (
            <div className="space-y-3">
                {members.map(member => (
                    <div key={member.id} className="bg-white p-4 rounded-2xl border border-slate-100 flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center text-slate-500 font-bold">
                            {member.email?.charAt(0).toUpperCase()}
                        </div>
                        <div className="flex-1 truncate">
                            <div className="font-semibold text-slate-900 truncate">{member.email}</div>
                            {member.id === user?.id && <div className="text-xs text-indigo-600 font-medium">Это вы</div>}
                        </div>
                    </div>
                ))}

                {/* Pending Invitations */}
                {invitations.map(invite => (
                    <div key={invite.id} className="bg-slate-50 p-4 rounded-2xl border border-slate-100 border-dashed flex items-center gap-3 opacity-80">
                         <div className="w-10 h-10 rounded-full bg-white border border-slate-200 flex items-center justify-center text-slate-400">
                            <Mail size={18} />
                        </div>
                        <div className="flex-1 truncate">
                            <div className="font-medium text-slate-900 truncate">{invite.email}</div>
                            <div className="text-xs text-slate-500">Приглашение отправлено</div>
                        </div>
                        <button 
                            onClick={() => handleCancelInvite(invite.id)}
                            className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-xl transition-colors"
                        >
                            <X size={18} />
                        </button>
                    </div>
                ))}

                {members.length === 1 && invitations.length === 0 && (
                    <div className="text-center py-8 bg-slate-50 rounded-2xl border border-dashed border-slate-200">
                        <p className="text-slate-500 text-sm mb-2">Вы пока одни в семье</p>
                        <button 
                          onClick={() => setShowInviteModal(true)}
                          className="text-indigo-600 font-bold text-sm hover:underline"
                        >
                            Пригласить близких
                        </button>
                    </div>
                )}
            </div>
        )}
      </div>

      {/* Success/Error Messages */}
      {success && (
          <div className="bg-emerald-50 text-emerald-700 px-4 py-3 rounded-2xl flex items-center gap-2 text-sm font-medium animate-fadeIn">
              <Check size={18} /> {success}
          </div>
      )}
      {error && (
          <div className="bg-red-50 text-red-700 px-4 py-3 rounded-2xl flex items-center gap-2 text-sm font-medium animate-fadeIn">
              <X size={18} /> {error}
          </div>
      )}

      {/* Invite Modal */}
      {showInviteModal && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fadeIn">
              <div className="bg-white rounded-[32px] p-4 sm:p-6 w-full max-w-sm shadow-2xl animate-scaleIn">
                  <h3 className="text-xl font-bold text-slate-900 mb-4">Пригласить в семью</h3>
                  <form onSubmit={handleInvite}>
                      <div className="mb-4">
                          <label className="block text-sm font-medium text-slate-500 mb-1.5 ml-1">Email пользователя</label>
                          <input 
                            type="email" 
                            required
                            value={inviteEmail}
                            onChange={e => setInviteEmail(e.target.value)}
                            placeholder="example@gmail.com"
                            className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                          />
                      </div>
                      <div className="flex gap-3">
                          <button 
                            type="button"
                            onClick={() => setShowInviteModal(false)}
                            className="flex-1 py-3 text-slate-600 font-bold bg-slate-100 rounded-xl hover:bg-slate-200 transition-colors"
                          >
                              Отмена
                          </button>
                          <button 
                            type="submit"
                            disabled={inviting}
                            className="flex-1 py-3 bg-indigo-600 text-white font-bold rounded-xl hover:bg-indigo-700 transition-colors shadow-lg shadow-indigo-200 disabled:opacity-70 disabled:cursor-not-allowed"
                          >
                              {inviting ? <Loader2 className="animate-spin mx-auto" /> : 'Отправить'}
                          </button>
                      </div>
                  </form>
              </div>
          </div>
      )}
    </div>
  )
}

export default AccountPage

