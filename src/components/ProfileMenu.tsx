import { Check, ChevronDown, Pencil, Plus, Trash2, UserRound, X } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import clsx from 'clsx'
import { useStore } from '../store/useStore'
import type { Profile } from '../types'

const inputCls =
  'h-8 min-w-0 flex-1 rounded-md border border-line bg-surface px-2 text-sm text-ink focus:border-accent focus:outline-none'
const iconBtn =
  'grid h-7 w-7 shrink-0 place-items-center rounded-md text-ink-3 hover:bg-surface-2 hover:text-ink'

/** Header dropdown to switch between, create, rename and delete profiles. */
export function ProfileMenu() {
  const profiles = useStore((s) => s.profiles)
  const profileId = useStore((s) => s.profileId)
  const createProfile = useStore((s) => s.createProfile)
  const [open, setOpen] = useState(false)
  const [newName, setNewName] = useState('')
  const root = useRef<HTMLDivElement>(null)
  const active = profiles.find((p) => p.id === profileId)

  useEffect(() => {
    if (!open) return
    const onDown = (e: PointerEvent) => {
      if (!root.current?.contains(e.target as Node)) setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false)
    window.addEventListener('pointerdown', onDown)
    window.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('pointerdown', onDown)
      window.removeEventListener('keydown', onKey)
    }
  }, [open])

  const onCreate = (e: React.FormEvent) => {
    e.preventDefault()
    void createProfile(newName)
    setNewName('')
    setOpen(false)
  }

  return (
    <div ref={root} className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="true"
        aria-expanded={open}
        aria-label={`Profile: ${active?.name ?? ''}`}
        className="inline-flex h-9 max-w-[11rem] items-center gap-1.5 rounded-lg border border-line bg-surface px-2.5 text-sm text-ink hover:border-accent"
      >
        <UserRound className="h-4 w-4 shrink-0 text-accent" aria-hidden />
        <span className="truncate">{active?.name}</span>
        <ChevronDown className="h-3.5 w-3.5 shrink-0 text-ink-3" aria-hidden />
      </button>
      {open && (
        <div className="absolute right-0 z-40 mt-1.5 w-72 max-w-[calc(100vw-2rem)] rounded-xl border border-line bg-surface p-2 shadow-xl">
          <p className="px-2 pt-1 pb-2 text-xs text-ink-3">
            Each profile keeps its own imported data.
          </p>
          <ul className="space-y-0.5">
            {profiles.map((p) => (
              <ProfileRow
                key={p.id}
                profile={p}
                active={p.id === profileId}
                canDelete={profiles.length > 1}
                onPicked={() => setOpen(false)}
              />
            ))}
          </ul>
          <form
            onSubmit={onCreate}
            className="mt-2 flex items-center gap-1.5 border-t border-line pt-2"
          >
            <label className="sr-only" htmlFor="new-profile">
              New profile name
            </label>
            <input
              id="new-profile"
              className={inputCls}
              placeholder="New profile name"
              value={newName}
              maxLength={40}
              onChange={(e) => setNewName(e.target.value)}
            />
            <button
              type="submit"
              className="inline-flex h-8 items-center gap-1 rounded-md bg-accent px-2.5 text-sm font-medium text-white hover:opacity-90"
            >
              <Plus className="h-4 w-4" aria-hidden /> Add
            </button>
          </form>
        </div>
      )}
    </div>
  )
}

function ProfileRow({
  profile,
  active,
  canDelete,
  onPicked,
}: {
  profile: Profile
  active: boolean
  canDelete: boolean
  onPicked: () => void
}) {
  const switchProfile = useStore((s) => s.switchProfile)
  const renameProfile = useStore((s) => s.renameProfile)
  const deleteProfile = useStore((s) => s.deleteProfile)
  const [mode, setMode] = useState<'view' | 'rename' | 'confirm'>('view')
  const [name, setName] = useState(profile.name)

  if (mode === 'rename') {
    return (
      <li>
        <form
          className="flex items-center gap-1 px-1 py-0.5"
          onSubmit={(e) => {
            e.preventDefault()
            renameProfile(profile.id, name)
            setMode('view')
          }}
        >
          <input
            autoFocus
            aria-label="Profile name"
            className={inputCls}
            value={name}
            maxLength={40}
            onChange={(e) => setName(e.target.value)}
          />
          <button type="submit" aria-label="Save name" className={iconBtn}>
            <Check className="h-4 w-4" />
          </button>
          <button
            type="button"
            aria-label="Cancel rename"
            className={iconBtn}
            onClick={() => {
              setName(profile.name)
              setMode('view')
            }}
          >
            <X className="h-4 w-4" />
          </button>
        </form>
      </li>
    )
  }

  if (mode === 'confirm') {
    return (
      <li className="flex items-center gap-2 rounded-lg bg-bad/10 px-2 py-1.5 text-sm">
        <span className="min-w-0 flex-1 truncate">
          Delete <span className="font-medium">{profile.name}</span> and its data?
        </span>
        <button
          onClick={() => void deleteProfile(profile.id)}
          className="rounded-md bg-bad px-2 py-1 text-xs font-medium text-white"
        >
          Delete
        </button>
        <button onClick={() => setMode('view')} className="text-xs text-ink-2 hover:text-ink">
          Cancel
        </button>
      </li>
    )
  }

  return (
    <li className="group flex items-center gap-0.5">
      <button
        onClick={() => {
          void switchProfile(profile.id)
          onPicked()
        }}
        aria-current={active ? 'true' : undefined}
        className={clsx(
          'flex min-w-0 flex-1 items-center gap-2 rounded-lg px-2 py-1.5 text-left text-sm',
          active
            ? 'bg-surface-2 font-medium text-ink'
            : 'text-ink-2 hover:bg-surface-2 hover:text-ink',
        )}
      >
        <Check
          className={clsx('h-4 w-4 shrink-0 text-accent', !active && 'invisible')}
          aria-hidden
        />
        <span className="truncate">{profile.name}</span>
      </button>
      <button
        onClick={() => setMode('rename')}
        aria-label={`Rename ${profile.name}`}
        className={iconBtn}
      >
        <Pencil className="h-3.5 w-3.5" />
      </button>
      {canDelete && (
        <button
          onClick={() => setMode('confirm')}
          aria-label={`Delete ${profile.name}`}
          className={clsx(iconBtn, 'hover:text-bad')}
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      )}
    </li>
  )
}
