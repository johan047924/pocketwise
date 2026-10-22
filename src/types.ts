export type Kind = 'expense' | 'income'
export type Transaction = {
  id: string; kind: Kind; amount: number; description: string; category: string; date: string
}
export type RecurringExpense = {
  id: string; name: string; amount: number; category: string; frequency: string; nextDate: string
}
export type Goal = { id: string; name: string; target: number; saved: number; dueDate: string }
export type Budget = { category: string; limit: number }
export type IncomeCycle = {
  id: string
  date: string
  amount: number
  source: string
  transactionId?: string
}
export type AppData = {
  transactions: Transaction[]; recurring: RecurringExpense[]; goals: Goal[];
  budgets: Budget[]; incomeCycles: IncomeCycle[]; startingBalance: number
}
