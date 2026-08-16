import { Button } from './ds'
import { useAuth } from '../contexts/AuthContext'
import { useLanguage } from '../contexts/LanguageContext'

const LoginPage = () => {
  const { signInWithGoogle, loading } = useAuth()
  const { language } = useLanguage()
  const lang: 'ru' | 'pt' = language

  const t = lang === 'pt'
    ? { title: 'Запасы', sub: 'A tua despensa, atualizada sozinha.', google: 'Entrar com Google', note: 'Só entra. Os recibos vêm sozinhos.' }
    : { title: 'Запасы', sub: 'Твоя кладовка, обновляется сама.', google: 'Войти через Google', note: 'Просто войди. Чеки подтянутся сами.' }

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        padding: '0 var(--space-9) var(--space-12)',
        background: 'var(--surface-page)',
      }}
    >
      <div style={{ maxWidth: 360, margin: '0 auto', width: '100%' }}>
        <div style={{ font: 'var(--fw-semibold) var(--fs-32)/1.1 var(--font-sans)', letterSpacing: 'var(--ls-tight)', color: 'var(--text-primary)' }}>
          {t.title}
        </div>
        <div style={{ font: 'var(--type-body)', color: 'var(--text-secondary)', marginTop: 'var(--space-4)', maxWidth: 260 }}>
          {t.sub}
        </div>
        <div style={{ marginTop: 'var(--space-11)' }}>
          <Button variant="primary" size="lg" block disabled={loading} onClick={() => signInWithGoogle()}>
            {t.google}
          </Button>
        </div>
        <div style={{ font: 'var(--type-meta)', color: 'var(--text-tertiary)', marginTop: 'var(--space-5)', textAlign: 'center' }}>
          {t.note}
        </div>
      </div>
    </div>
  )
}

export default LoginPage
