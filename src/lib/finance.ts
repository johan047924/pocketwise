import type { AppData, Transaction } from '../types'

export const money = (n: number) => new Intl.NumberFormat('en-CA', {
  style: 'currency', currency: 'CAD', maximumFractionDigits: 2
}).format(n)

export const monthKey = (date = new Date()) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
export const thisMonth = (t: Transaction[]) => t.filter(x => x.date.slice(0, 7) === monthKey())
export const total = (t: Transaction[], kind: 'income' | 'expense') =>
  t.filter(x => x.kind === kind).reduce((s, x) => s + x.amount, 0)

export function budgetSpent(data: AppData, category: string) {
  return thisMonth(data.transactions).filter(t => t.kind === 'expense' && t.category === category)
    .reduce((s, t) => s + t.amount, 0)
}

export function monthlyRecurring(data: AppData) {
  return data.recurring.reduce((sum, r) => {
    const multiplier: Record<string, number> = {
      weekly: 52 / 12, biweekly: 26 / 12, monthly: 1, quarterly: 1 / 3, yearly: 1 / 12
    }
    return sum + r.amount * (multiplier[r.frequency] ?? 1)
  }, 0)
}

export function safeToSpend(data: AppData) {
  const balance = data.startingBalance + total(data.transactions, 'income') - total(data.transactions, 'expense')
  const futureBills = data.recurring.reduce((sum, r) => {
    const d = new Date(`${r.nextDate}T12:00:00`)
    const now = new Date(); const end = new Date(now); end.setDate(end.getDate() + 14)
    if (d >= new Date(now.getFullYear(), now.getMonth(), now.getDate()) && d <= end) return sum + r.amount
    return sum
  }, 0)
  const goalReserve = data.goals.reduce((sum, g) => {
    const remaining = Math.max(0, g.target - g.saved)
    const days = Math.max(1, Math.ceil((new Date(`${g.dueDate}T12:00:00`).getTime() - Date.now()) / 86400000))
    return sum + Math.min(remaining, remaining * Math.min(14 / days, 1))
  }, 0)
  return { balance, futureBills, goalReserve, safe: Math.max(0, balance - futureBills - goalReserve) }
}

export function annualIncomeEstimate(cycles: { amount: number }[]) {
  if (!cycles.length) return 0
  const average = cycles.reduce((s, c) => s + c.amount, 0) / cycles.length
  return average * 26
}