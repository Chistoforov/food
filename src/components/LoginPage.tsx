import { useAuth } from '../contexts/AuthContext'
import { ShoppingCart, LogIn, Sparkles } from 'lucide-react'

const LoginPage = () => {
  const { signInWithGoogle, loading } = useAuth()

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white rounded-[32px] p-8 shadow-2xl animate-scaleIn relative overflow-hidden">
         {/* Decorative elements */}
         <div className="absolute top-0 right-0 w-64 h-64 bg-purple-500/10 rounded-full blur-3xl -mr-16 -mt-16 pointer-events-none"></div>
         <div className="absolute bottom-0 left-0 w-48 h-48 bg-blue-500/10 rounded-full blur-3xl -ml-10 -mb-10 pointer-events-none"></div>

        <div className="text-center mb-10 relative z-10">
          <div className="inline-flex p-4 rounded-3xl bg-slate-900 text-white mb-6 shadow-xl transform rotate-3 hover:rotate-0 transition-transform duration-300">
            <ShoppingCart size={48} strokeWidth={1.5} />
          </div>
          <h1 className="text-3xl font-bold text-slate-900 mb-2 tracking-tight">Grocery Tracker</h1>
          <p className="text-slate-500 font-medium">Умный список покупок для всей семьи</p>
        </div>

        <div className="space-y-4 relative z-10">
           <div className="bg-slate-50 rounded-2xl p-6 mb-8 border border-slate-100">
              <h3 className="font-bold text-slate-900 mb-3 flex items-center gap-2">
                 <Sparkles size={18} className="text-amber-500" />
                 Возможности
              </h3>
              <ul className="space-y-3 text-sm text-slate-600 font-medium">
                 <li className="flex items-center gap-2">
                    <div className="w-1.5 h-1.5 rounded-full bg-indigo-500"></div>
                    Совместный доступ для семьи
                 </li>
                 <li className="flex items-center gap-2">
                    <div className="w-1.5 h-1.5 rounded-full bg-indigo-500"></div>
                    Сканирование чеков с AI
                 </li>
                 <li className="flex items-center gap-2">
                    <div className="w-1.5 h-1.5 rounded-full bg-indigo-500"></div>
                    Умная аналитика и прогнозы
                 </li>
              </ul>
           </div>

          <button
            onClick={() => signInWithGoogle()}
            disabled={loading}
            className="w-full flex items-center justify-center gap-3 bg-slate-900 text-white p-4 rounded-2xl font-bold text-lg hover:bg-slate-800 transition-all active:scale-95 shadow-lg shadow-slate-900/20"
          >
            {loading ? (
                <span>Загрузка...</span>
            ) : (
                <>
                    <LogIn size={24} />
                    <span>Войти через Google</span>
                </>
            )}
          </button>
          
          <p className="text-center text-xs text-slate-400 mt-6">
            Используя приложение, вы принимаете условия использования
          </p>
        </div>
      </div>
    </div>
  )
}

export default LoginPage


