import { useEffect, useState } from 'react'
import { AppHeader, Card, SectionHeader, ListRow, SegmentedControl, Button, RecentReceiptsSection, TextField } from './ds'
import { useAuth } from '../contexts/AuthContext'
import { useLanguage } from '../contexts/LanguageContext'
import { SupabaseService } from '../services/supabaseService'
import { UserProfile, Receipt, FamilyInvitation } from '../lib/supabase'
import { clearAppCache } from '../utils/cacheHelper'

interface AccountPageProps {
  receipts: Receipt[]
  onOpenReceipt: (receipt: Receipt) => void
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

const AccountPage = ({ receipts, onOpenReceipt }: AccountPageProps) => {
  const { user, profile, signOut } = useAuth()
  const { language, setLanguage } = useLanguage()
  const lang: 'ru' | 'pt' = language
  const [members, setMembers] = useState<UserProfile[]>([])
  const [clearing, setClearing] = useState(false)
  const [invitations, setInvitations] = useState<FamilyInvitation[]>([])
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteError, setInviteError] = useState<string | null>(null)
  const [inviting, setInviting] = useState(false)

  useEffect(() => {
    if (!profile?.family_id) return
    SupabaseService.getFamilyMembers(profile.family_id)
      .then((rows) => setMembers(rows || []))
      .catch((err) => console.error('Error loading family members:', err))
    SupabaseService.getFamilyInvitations(profile.family_id)
      .then((rows) => setInvitations(rows))
      .catch((err) => console.error('Error loading invitations:', err))
  }, [profile])

  const t = lang === 'pt'
    ? {
        title: 'Conta',
        lang: 'Idioma',
        langHint: 'PT mostra o texto original do talão; RU mostra a tradução.',
        family: 'Família',
        familyId: 'Nº',
        members: 'Membros',
        you: 'tu',
        data: 'Os dados são partilhados por toda a família.',
        invite: 'Convidar para a família',
        inviteHint: 'Quando esta pessoa entrar com Google usando este email, junta-se à tua família automaticamente.',
        invitePlaceholder: 'email@exemplo.com',
        inviteBtn: 'Convidar',
        inviteDoing: 'A enviar…',
        invitePending: 'Convites pendentes',
        cancelInvite: 'Cancelar',
        inviteErrEmail: 'Email inválido.',
        inviteErrDup: 'Este email já foi convidado.',
        inviteErrGeneric: 'Não foi possível enviar o convite.',
        clearCache: 'Limpar cache',
        clearCacheHint: 'Recalcula os dados locais e recarrega.',
        clearCacheDoing: 'A limpar…',
        logout: 'Sair',
      }
    : {
        title: 'Аккаунт',
        lang: 'Язык',
        langHint: 'PT — оригинал из чека, RU — перевод.',
        family: 'Семья',
        familyId: '№',
        members: 'Участники',
        you: 'это ты',
        data: 'Данные общие для всех участников семьи.',
        invite: 'Пригласить в семью',
        inviteHint: 'Когда человек залогинится через Google с этим email, он автоматически попадёт в твою семью.',
        invitePlaceholder: 'email@example.com',
        inviteBtn: 'Пригласить',
        inviteDoing: 'Отправляю…',
        invitePending: 'Ожидают принятия',
        cancelInvite: 'Отменить',
        inviteErrEmail: 'Некорректный email.',
        inviteErrDup: 'Этот email уже приглашён.',
        inviteErrGeneric: 'Не удалось отправить приглашение.',
        clearCache: 'Сбросить кэш',
        clearCacheHint: 'Пересчитает данные и перезагрузит приложение.',
        clearCacheDoing: 'Сбрасываю…',
        logout: 'Выйти',
      }

  const handleInvite = async () => {
    if (!profile?.family_id) return
    const email = inviteEmail.trim().toLowerCase()
    if (!EMAIL_RE.test(email)) {
      setInviteError(t.inviteErrEmail)
      return
    }
    if (invitations.some((inv) => inv.email.toLowerCase() === email)) {
      setInviteError(t.inviteErrDup)
      return
    }
    try {
      setInviting(true)
      setInviteError(null)
      const created = await SupabaseService.inviteUser(email, profile.family_id)
      setInvitations((prev) => [created, ...prev])
      setInviteEmail('')
    } catch (err: any) {
      console.error('invite failed:', err)
      const msg: string = err?.message || ''
      if (msg.toLowerCase().includes('duplicate') || msg.toLowerCase().includes('unique')) {
        setInviteError(t.inviteErrDup)
      } else {
        setInviteError(t.inviteErrGeneric)
      }
    } finally {
      setInviting(false)
    }
  }

  const handleCancelInvite = async (id: number) => {
    try {
      await SupabaseService.cancelInvitation(id)
      setInvitations((prev) => prev.filter((inv) => inv.id !== id))
    } catch (err) {
      console.error('cancel invite failed:', err)
    }
  }

  const handleClearCache = async () => {
    try {
      setClearing(true)
      await clearAppCache(profile?.family_id, true)
      window.location.reload()
    } catch (err) {
      console.error('clear cache failed:', err)
      alert(lang === 'pt' ? 'Não foi possível limpar.' : 'Не удалось сбросить кэш.')
      setClearing(false)
    }
  }

  return (
    <>
      <AppHeader title={t.title} />
      <div style={{ padding: '0 var(--gutter-mobile) var(--space-12)', maxWidth: 'var(--content-max)', margin: '0 auto' }}>
        <SectionHeader>{t.lang}</SectionHeader>
        <Card>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 'var(--space-6)' }}>
            <span style={{ font: 'var(--type-body-sm)', color: 'var(--text-secondary)', maxWidth: 220 }}>{t.langHint}</span>
            <SegmentedControl
              value={lang}
              onChange={(v) => setLanguage(v as 'ru' | 'pt')}
              options={[
                { value: 'ru', label: 'RU' },
                { value: 'pt', label: 'PT' },
              ]}
            />
          </div>
        </Card>

        <SectionHeader>{t.family}</SectionHeader>
        <Card padded={false}>
          <ListRow
            first
            chevron={false}
            right={<span className="tnum" style={{ font: 'var(--type-meta)', color: 'var(--text-tertiary)' }}>#{profile?.family_id ?? '—'}</span>}
          >
            <span style={{ font: 'var(--type-row-title)' }}>{t.familyId}</span>
          </ListRow>
          <ListRow
            chevron={false}
            right={<span className="tnum" style={{ font: 'var(--type-meta)', color: 'var(--text-tertiary)' }}>{members.length || 1}</span>}
          >
            <span style={{ font: 'var(--type-row-title)' }}>{t.members}</span>
          </ListRow>
        </Card>

        {members.length > 0 && (
          <Card padded={false} style={{ marginTop: 'var(--space-4)' }}>
            {members.map((m, i) => (
              <ListRow
                key={m.id}
                first={i === 0}
                chevron={false}
                right={
                  m.id === user?.id ? (
                    <span style={{ font: 'var(--type-meta)', color: 'var(--text-tertiary)' }}>{t.you}</span>
                  ) : null
                }
              >
                <span style={{ font: 'var(--type-body-sm)', color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'block' }}>
                  {m.email}
                </span>
              </ListRow>
            ))}
          </Card>
        )}

        <div style={{ font: 'var(--type-meta)', color: 'var(--text-tertiary)', padding: 'var(--space-5) var(--space-1)' }}>{t.data}</div>

        <SectionHeader>{t.invite}</SectionHeader>
        <Card>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
            <TextField
              value={inviteEmail}
              onChange={(e) => {
                setInviteEmail(e.target.value)
                if (inviteError) setInviteError(null)
              }}
              placeholder={t.invitePlaceholder}
              invalid={!!inviteError}
              hint={inviteError || t.inviteHint}
            />
            <Button variant="primary" block onClick={handleInvite} disabled={inviting || !inviteEmail.trim()}>
              {inviting ? t.inviteDoing : t.inviteBtn}
            </Button>
          </div>
        </Card>

        {invitations.length > 0 && (
          <>
            <SectionHeader count={invitations.length}>{t.invitePending}</SectionHeader>
            <Card padded={false}>
              {invitations.map((inv, i) => (
                <ListRow
                  key={inv.id}
                  first={i === 0}
                  chevron={false}
                  right={
                    <button
                      type="button"
                      onClick={() => handleCancelInvite(inv.id)}
                      style={{
                        font: 'var(--type-meta)',
                        color: 'var(--text-danger)',
                        background: 'transparent',
                        border: 'none',
                        padding: 'var(--space-2) var(--space-3)',
                        cursor: 'pointer',
                      }}
                    >
                      {t.cancelInvite}
                    </button>
                  }
                >
                  <span style={{ font: 'var(--type-body-sm)', color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'block' }}>
                    {inv.email}
                  </span>
                </ListRow>
              ))}
            </Card>
          </>
        )}

        <div style={{ paddingTop: 'var(--space-8)', display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
          <Button block onClick={handleClearCache} disabled={clearing}>
            {clearing ? t.clearCacheDoing : t.clearCache}
          </Button>
          <div style={{ font: 'var(--type-meta)', color: 'var(--text-tertiary)', padding: '0 var(--space-1)' }}>{t.clearCacheHint}</div>
        </div>

        <div style={{ paddingTop: 'var(--space-8)' }}>
          <Button variant="danger" block onClick={() => signOut()} disabled={clearing}>
            {t.logout}
          </Button>
        </div>

        <div style={{ paddingTop: 'var(--space-10)' }}>
          <RecentReceiptsSection receipts={receipts} lang={lang} onOpenReceipt={onOpenReceipt} />
        </div>
      </div>
    </>
  )
}

export default AccountPage
