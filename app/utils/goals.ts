import { addMonths, differenceInCalendarMonths } from 'date-fns'
import type { GoalColor, GoalIcon } from '~~/shared/schemas'

/**
 * What each goal icon is meant for — surfaced in the goal form's icon picker so
 * the choice reads as "what am I saving for", not just decoration. The copy
 * lives in i18n under `goalIcons.<key>` (icon id minus the `i-lucide-` prefix,
 * keyed to `goalIcons` in shared/schemas.ts) — render with `t(...)`.
 */
export function goalIconKeys(icon: GoalIcon): { labelKey: string, descriptionKey: string } {
  const key = icon.replace(/^i-lucide-/, '')
  return { labelKey: `goalIcons.${key}.label`, descriptionKey: `goalIcons.${key}.description` }
}

// Client-side shape of a goal returned by /api/v1/goals (see server/utils/goals.ts enrichGoal).
export interface GoalLinkedAccount {
  id: string
  name: string
  type: string
  currency: string
  balance: number
}

export interface GoalView {
  id: string
  name: string
  targetAmount: string | number
  currency: string
  startDate: string
  targetDate: string | null
  icon: string | null
  color: string | null
  saved: number
  linkedAccounts: GoalLinkedAccount[]
  recentMonthlyNet: number
}

// Accent classes per goal color. Written as literal strings so Tailwind emits them
// (mirrors the `@source inline` safelist rationale in app/assets/css/main.css).
export interface GoalAccent {
  /** SVG ring stroke / icon glyph (uses currentColor) */
  ring: string
  /** Readable accent text, tuned for light + dark */
  text: string
  /** Soft tinted surface (icon chip, highlights) */
  soft: string
  /** Solid fill (progress bar) */
  solid: string
}

export const goalColorClasses: Record<GoalColor, GoalAccent> = {
  emerald: { ring: 'text-emerald-500', text: 'text-emerald-600 dark:text-emerald-400', soft: 'bg-emerald-500/10', solid: 'bg-emerald-500' },
  sky: { ring: 'text-sky-500', text: 'text-sky-600 dark:text-sky-400', soft: 'bg-sky-500/10', solid: 'bg-sky-500' },
  violet: { ring: 'text-violet-500', text: 'text-violet-600 dark:text-violet-400', soft: 'bg-violet-500/10', solid: 'bg-violet-500' },
  amber: { ring: 'text-amber-500', text: 'text-amber-600 dark:text-amber-400', soft: 'bg-amber-500/10', solid: 'bg-amber-500' },
  rose: { ring: 'text-rose-500', text: 'text-rose-600 dark:text-rose-400', soft: 'bg-rose-500/10', solid: 'bg-rose-500' },
  teal: { ring: 'text-teal-500', text: 'text-teal-600 dark:text-teal-400', soft: 'bg-teal-500/10', solid: 'bg-teal-500' },
  pink: { ring: 'text-pink-500', text: 'text-pink-600 dark:text-pink-400', soft: 'bg-pink-500/10', solid: 'bg-pink-500' },
  indigo: { ring: 'text-indigo-500', text: 'text-indigo-600 dark:text-indigo-400', soft: 'bg-indigo-500/10', solid: 'bg-indigo-500' },
}

export function goalAccent(color?: string | null): GoalAccent {
  return goalColorClasses[(color ?? 'sky') as GoalColor] ?? goalColorClasses.sky
}

/** Encouraging, honest copy tied to how far along the goal is — i18n keys under
 * `goals.milestones.<step>`; render with `t(titleKey)` / `t(toneKey)`. */
export function goalMilestone(pct: number): { titleKey: string, toneKey: string } {
  const step
    = pct >= 100 ? 'achieved'
      : pct >= 75 ? 'almost'
        : pct >= 50 ? 'halfway'
          : pct >= 25 ? 'momentum'
            : pct > 0 ? 'start'
              : 'begin'
  return { titleKey: `goals.milestones.${step}.title`, toneKey: `goals.milestones.${step}.tone` }
}

export type GoalPaceStatus = 'achieved' | 'on-track' | 'behind' | 'past-due' | 'no-date'

export interface GoalPace {
  remaining: number
  monthsLeft: number | null
  requiredPerMonth: number | null
  /** Projected finish date at the user's recent saving pace (null if not saving) */
  projectedDate: Date | null
  status: GoalPaceStatus
}

interface PaceInput {
  saved: number
  targetAmount: string | number
  targetDate?: string | Date | null
  recentMonthlyNet: number
}

/**
 * Grounds a goal in the user's real finances: how much is still needed each month
 * to hit the target date, versus the pace they've actually been saving at.
 */
export function goalPace(goal: PaceInput): GoalPace {
  const target = Number(goal.targetAmount)
  const remaining = Math.max(target - goal.saved, 0)
  const pace = goal.recentMonthlyNet

  // Projected finish from current pace (only meaningful when actually saving).
  const projectedDate = pace > 0 && remaining > 0
    ? addMonths(new Date(), Math.ceil(remaining / pace))
    : null

  if (goal.saved >= target) {
    return { remaining: 0, monthsLeft: null, requiredPerMonth: null, projectedDate: null, status: 'achieved' }
  }
  if (!goal.targetDate) {
    return { remaining, monthsLeft: null, requiredPerMonth: null, projectedDate, status: 'no-date' }
  }

  const monthsLeft = differenceInCalendarMonths(parseDate(goal.targetDate), new Date())
  if (monthsLeft <= 0) {
    return { remaining, monthsLeft, requiredPerMonth: remaining, projectedDate, status: 'past-due' }
  }

  const requiredPerMonth = remaining / monthsLeft
  return {
    remaining,
    monthsLeft,
    requiredPerMonth,
    projectedDate,
    status: pace >= requiredPerMonth ? 'on-track' : 'behind',
  }
}

type BadgeColor = 'success' | 'warning' | 'error' | 'neutral'

/** Small status pill for a goal's pace (null when there's nothing to flag).
 * Labels live in i18n under `goals.pace.<status>`; render with `t(labelKey)`. */
export function goalPaceBadge(status: GoalPaceStatus): { labelKey: string, color: BadgeColor } | null {
  switch (status) {
    case 'achieved': return { labelKey: 'goals.pace.achieved', color: 'success' }
    case 'on-track': return { labelKey: 'goals.pace.on-track', color: 'success' }
    case 'behind': return { labelKey: 'goals.pace.behind', color: 'warning' }
    case 'past-due': return { labelKey: 'goals.pace.past-due', color: 'error' }
    default: return null
  }
}
