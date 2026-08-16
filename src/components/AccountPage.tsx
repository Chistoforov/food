import { useEffect, useState } from 'react'
import { AppHeader, Card, SectionHeader, ListRow, SegmentedControl, Button } from './ds'
import { useAuth } from '../contexts/AuthContext'
import { useLanguage } from '../contexts/LanguageContext'
import { SupabaseService } from '../services/supabaseService'
import { UserProfile } from '../lib/supabase'

const AccountPage = () => {
  const { user, profile, signOut } = useAuth()
  const { language, setLanguage } = useLanguage()
  const lang: 'ru' | 'pt' = language
  const [members, setMembers] = useState<UserProfile[]>([])

  useEffect(() => {
    if (!profile?.family_id) return
    SupabaseService.getFamilyMembers(profile.family_id)
      .then((rows) => setMembers(rows || []))
      .catch((err) => console.error('Error loading family members:', err))
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
        logout: 'Выйти',
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

        <div style={{ paddingTop: 'var(--space-8)' }}>
          <Button variant="danger" block onClick={() => signOut()}>
            {t.logout}
          </Button>
        </div>
      </div>
    </>
  )
}

export default AccountPage
