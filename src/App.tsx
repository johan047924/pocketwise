import { useEffect, useMemo, useState } from 'react'
import { Activity, ArrowDownLeft, ArrowUpRight, Bot, CalendarDays, Check, ChevronDown, CircleHelp, CreditCard, LayoutDashboard, Plus, Send, Settings2, Sparkles, Target, Wallet, X, TrendingUp } from 'lucide-react'
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis } from 'recharts'
import type { AppData, Transaction } from './types'
import { budgetSpent, money, monthlyRecurring, safeToSpend, thisMonth, total } from './lib/finance'
import { isCloudConfigured, supabase } from './lib/supabase'
import AuthScreen from './AuthScreen'

const today = new Date().toISOString().slice(0, 10)
const initial: AppData = {
  startingBalance: 1800,
  transactions: [
    { id: 't1', kind: 'income', amount: 1200, description: 'Paycheque', category: 'Employment', date: today },
    { id: 't2', kind: 'expense', amount: 14.5, description: "McDonald's", category: 'Eating out', date: today },
    { id: 't3', kind: 'expense', amount: 68.2, description: 'Groceries', category: 'Groceries', date: today },
    { id: 't4', kind: 'expense', amount: 32, description: 'Gas', category: 'Transportation', date: today },
    { id: 't5', kind: 'expense', amount: 22, description: 'Coffee & lunch', category: 'Eating out', date: today },
  ],
  recurring: [
    { id: 'r1', name: 'Phone plan', amount: 55, category: 'Bills', frequency: 'monthly', nextDate: today },
    { id: 'r2', name: 'Gym membership', amount: 35, category: 'Fitness', frequency: 'monthly', nextDate: today },
    { id: 'r3', name: 'Car insurance', amount: 185, category: 'Car', frequency: 'monthly', nextDate: today },
  ],
  goals: [
    { id: 'g1', name: 'Emergency fund', target: 3000, saved: 850, dueDate: '2027-06-01' },
    { id: 'g2', name: 'Vacation', target: 1200, saved: 320, dueDate: '2027-05-01' },
  ],
  budgets: [
    { category: 'Eating out', limit: 180 }, { category: 'Groceries', limit: 300 },
    { category: 'Personal spending', limit: 100 }, { category: 'Transportation', limit: 220 },
    { category: 'Dating', limit: 120 }, { category: 'Fitness', limit: 70 },
  ],
  incomeCycles: [{ id: 'i1', date: today, amount: 1200, source: 'Employment' }],
}

type Tab = 'Overview' | 'Activity' | 'Budgets' | 'Goals' | 'AI Coach'
const nav: { label: Tab; icon: typeof LayoutDashboard }[] = [
  { label: 'Overview', icon: LayoutDashboard }, { label: 'Activity', icon: Activity },
  { label: 'Budgets', icon: Wallet }, { label: 'Goals', icon: Target }, { label: 'AI Coach', icon: Bot },
]

export default function App() {
  const [data, setData] = useState<AppData>(() => {
    try { const saved = localStorage.getItem('pocketwise-data'); return saved ? JSON.parse(saved) as AppData : initial }
    catch { return initial }
  })
  const [tab, setTab] = useState<Tab>('Overview')
  const [showAdd, setShowAdd] = useState(false)
  const [showIncome, setShowIncome] = useState(false)
  const [amount, setAmount] = useState('')
  const [description, setDescription] = useState('')
  const [category, setCategory] = useState('Eating out')
  const [date, setDate] = useState(today)
  const [query, setQuery] = useState('')
  const [chat, setChat] = useState<{ role: 'assistant' | 'user'; text: string }[]>([
    { role: 'assistant', text: "Hi! I'm your money coach. Ask me about your spending, what you can safely spend, or how to reach a goal. I'll use the financial details you've entered to help you think through your options." }
  ])
  const [question, setQuestion] = useState('')
  const [notice, setNotice] = useState('')
  const [saving, setSaving] = useState(false)

  const monthTransactions = useMemo(() => thisMonth(data.transactions), [data.transactions])
  const income = total(monthTransactions, 'income')
  const spent = total(monthTransactions, 'expense')
  const budgetTotal = data.budgets.reduce((s, b) => s + b.limit, 0)
  const safe = safeToSpend(data)
  const recurringMonthly = monthlyRecurring(data)

  function persist(next: AppData) {
    setData(next)
    localStorage.setItem('pocketwise-data', JSON.stringify(next))
    setNotice(isCloudConfigured ? 'Saved locally. Cloud sync setup is ready to connect.' : 'Saved on this device')
    window.setTimeout(() => setNotice(''), 2400)
  }
  function addTransaction(kind: 'expense' | 'income') {
    const n = Number(amount)
    if (!Number.isFinite(n) || n <= 0) { setNotice('Enter an amount greater than $0'); return }
    const tx: Transaction = { id: crypto.randomUUID(), kind, amount: Math.round(n * 100) / 100,
      description: description.trim() || (kind === 'expense' ? category : 'Income'), category, date }
    const next = { ...data, transactions: [tx, ...data.transactions] }
    if (kind === 'income') next.incomeCycles = [{ id: crypto.randomUUID(), date, amount: tx.amount, source: tx.description }, ...data.incomeCycles]
    persist(next); setShowAdd(false); setShowIncome(false); setAmount(''); setDescription('')
  }
  function deleteTransaction(id: string) {
    persist({ ...data, transactions: data.transactions.filter(t => t.id !== id) })
  }
  function exportData() {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'pocketwise-backup.json'; a.click(); URL.revokeObjectURL(a.href)
  }
  async function askCoach() {
    const q = question.trim()
    if (!q || saving) return
    setChat(prev => [...prev, { role: 'user', text: q }]); setQuestion(''); setSaving(true)
    try {
      if (!import.meta.env.VITE_AI_FUNCTION_URL) throw new Error('AI endpoint is not configured yet')
      const response = await fetch(import.meta.env.VITE_AI_FUNCTION_URL as string, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question: q, financialSummary: {
          currency: 'CAD', monthIncome: income, monthSpending: spent, budgets: data.budgets,
          transactions: monthTransactions.slice(0, 100), recurring: data.recurring, goals: data.goals,
          safeToSpend: safe.safe, estimatedBalance: safe.balance
        } })
      })
      if (!response.ok) throw new Error('AI service returned an error. Check your server setup.')
      const result = await response.json() as { answer?: string }
      setChat(prev => [...prev, { role: 'assistant', text: result.answer || 'I could not produce an answer this time.' }])
    } catch {
      const lower = q.toLowerCase()
      let answer = 'The AI connection is not configured yet. Your budgeting tools still work. Once the secure server function is deployed, I can analyze your actual entered data and explain trade-offs.'
      if (lower.includes('safe') || lower.includes('spend') || lower.includes('afford')) answer = `Your current rough safe-to-spend estimate is ${money(safe.safe)} after reserving ${money(safe.futureBills)} for recurring bills due in the next 14 days and ${money(safe.goalReserve)} for near-term goal contributions. This is only as accurate as the balances and future income you've entered.`
      else if (lower.includes('where') || lower.includes('spent') || lower.includes('spending')) {
        const top = [...new Set(monthTransactions.filter(t => t.kind === 'expense').map(t => t.category))].map(c => ({ c, n: budgetSpent(data, c) })).sort((a, b) => b.n - a.n)[0]
        answer = `You've recorded ${money(spent)} in spending this month. Your largest recorded category is ${top ? `${top.c} (${money(top.n)})` : 'not available yet'}. Add transactions consistently for a more reliable picture.`
      }
      setChat(prev => [...prev, { role: 'assistant', text: answer }])
    } finally { setSaving(false) }
  }

  const chartData = useMemo(() => {
    const days = Array.from({ length: 7 }, (_, i) => {
      const d = new Date(); d.setDate(d.getDate() - (6 - i))
      const key = d.toISOString().slice(0, 10)
      return { day: d.toLocaleDateString('en-CA', { weekday: 'short' }), amount: data.transactions.filter(t => t.kind === 'expense' && t.date === key).reduce((s, t) => s + t.amount, 0) }
    })
    return days
  }, [data.transactions])

  return <div className="app-shell">
    <aside className="sidebar">
      <div className="brand"><div className="brand-mark"><Wallet size={19}/></div><span>Pocketwise</span></div>
      <div className="workspace-label">YOUR MONEY</div>
      <nav>{nav.map(({ label, icon: Icon }) => <button key={label} className={`nav-item ${tab === label ? 'active' : ''}`} onClick={() => setTab(label)}><Icon size={18}/><span>{label}</span>{label === 'AI Coach' && <Sparkles className="nav-sparkle" size={14}/>}</button>)}</nav>
      <div className="sidebar-bottom">
        <div className="calm-card"><div className="calm-icon"><Sparkles size={16}/></div><strong>Small steps add up.</strong><p>Your money should support the life you want to live.</p></div>
        <button className="nav-item" onClick={exportData}><Settings2 size={18}/><span>Export backup</span></button>
        <div className="profile"><div className="avatar">P</div><div><strong>Personal workspace</strong><small>CAD · Canada</small></div><ChevronDown size={15}/></div>
      </div>
    </aside>

    <main className="main-content">
      <header className="topbar"><div className="mobile-brand"><div className="brand-mark"><Wallet size={18}/></div>Pocketwise</div><div className="breadcrumb">Your money <span>/</span> {tab}</div><div className="top-actions"><span className={`sync-pill ${isCloudConfigured ? 'ready' : ''}`}><span className="sync-dot"/>{isCloudConfigured ? 'Cloud configured' : 'Device storage'}</span><button className="icon-button" title="Export backup" onClick={exportData}><Settings2 size={18}/></button><button className="primary-button top-add" onClick={() => { setShowIncome(false); setShowAdd(true) }}><Plus size={17}/> Add transaction</button></div></header>

      <div className="page-wrap">
        {tab === 'Overview' && <section>
          <div className="page-heading"><div><div className="eyebrow">{new Date().toLocaleDateString('en-CA', { month: 'long', year: 'numeric' }).toUpperCase()}</div><h1>Your financial picture</h1><p className="subheading">A clearer view of where you are — and where you're going.</p></div><button className="secondary-button" onClick={() => setTab('AI Coach')}><Sparkles size={16}/> Ask your coach</button></div>
          <div className="hero-grid">
            <div className="safe-card"><div className="card-top"><span>SAFE TO SPEND</span><span className="soft-icon"><Wallet size={17}/></span></div><div className="safe-amount">{money(safe.safe)}</div><p className="safe-caption">Estimated after near-term bills and goal reserves</p><div className="safe-divider"/><div className="safe-meta"><span><i className="green-dot"/> Available balance</span><strong>{money(safe.balance)}</strong></div><div className="safe-meta"><span><i className="cream-dot"/> Upcoming bills · 14 days</span><strong>{money(safe.futureBills)}</strong></div><div className="safe-meta"><span><i className="cream-dot"/> Goal reserve estimate</span><strong>{money(safe.goalReserve)}</strong></div></div>
            <div className="stat-stack"><div className="stat-card"><div className="stat-icon income-icon"><ArrowDownLeft size={18}/></div><div><span>Income this month</span><strong>{money(income)}</strong><small>Recorded income</small></div><div className="stat-trend positive"><TrendingUp size={14}/></div></div><div className="stat-card"><div className="stat-icon spend-icon"><ArrowUpRight size={18}/></div><div><span>Spent this month</span><strong>{money(spent)}</strong><small>{budgetTotal ? `${Math.round(spent / budgetTotal * 100)}% of total category limits` : 'Set category budgets'}</small></div></div><div className="stat-card"><div className="stat-icon bill-icon"><CalendarDays size={18}/></div><div><span>Recurring monthly</span><strong>{money(recurringMonthly)}</strong><small>{data.recurring.length} scheduled payments</small></div></div></div>
          </div>
          <div className="content-grid">
            <div className="panel spending-panel"><div className="panel-heading"><div><h2>Spending rhythm</h2><p>Your recorded spending over the last 7 days</p></div><span className="mini-pill">Last 7 days</span></div><div className="chart"><ResponsiveContainer width="100%" height="100%"><AreaChart data={chartData} margin={{ top: 12, right: 5, left: -20, bottom: 0 }}><defs><linearGradient id="fillSpend" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#80a992" stopOpacity={0.26}/><stop offset="95%" stopColor="#80a992" stopOpacity={0.015}/></linearGradient></defs><CartesianGrid stroke="#edf0eb" vertical={false}/><XAxis dataKey="day" axisLine={false} tickLine={false} tick={{ fill: '#90988f', fontSize: 12 }}/><Tooltip formatter={(v) => money(Number(v))} contentStyle={{ borderRadius: 12, border: '1px solid #e7ebe5', fontSize: 12 }}/><Area type="monotone" dataKey="amount" stroke="#5f9278" strokeWidth={2.5} fill="url(#fillSpend)" /></AreaChart></ResponsiveContainer></div></div>
            <div className="panel goals-panel"><div className="panel-heading"><div><h2>Your goals</h2><p>Progress, at your pace</p></div><button className="text-button" onClick={() => setTab('Goals')}>View all <span>↗</span></button></div>{data.goals.slice(0, 3).map(g => <div className="goal-row" key={g.id}><div className="goal-row-top"><div className="goal-symbol"><Target size={16}/></div><div className="goal-label"><strong>{g.name}</strong><small>{money(g.saved)} of {money(g.target)}</small></div><strong className="goal-percent">{Math.min(100, Math.round(g.saved / Math.max(1, g.target) * 100))}%</strong></div><div className="progress-track"><div style={{ width: `${Math.min(100, g.saved / Math.max(1, g.target) * 100)}%` }}/></div></div>)}{!data.goals.length && <p className="empty-note">Create a goal to give your money a direction.</p>}</div>
          </div>
          <div className="panel transactions-panel"><div className="panel-heading"><div><h2>Recent activity</h2><p>Your latest recorded transactions</p></div><button className="text-button" onClick={() => setTab('Activity')}>All activity <span>↗</span></button></div><TransactionList transactions={data.transactions.slice(0, 5)} onDelete={deleteTransaction}/></div>
          <div className="coach-banner"><div className="coach-banner-icon"><Sparkles size={19}/></div><div><strong>A little clarity goes a long way.</strong><p>Ask a question about your spending, your next paycheque, or a goal you're working toward.</p></div><button className="secondary-button" onClick={() => setTab('AI Coach')}>Talk to your coach <ArrowUpRight size={15}/></button></div>
        </section>}

        {tab === 'Activity' && <section><div className="page-heading"><div><div className="eyebrow">YOUR TRANSACTIONS</div><h1>Activity</h1><p className="subheading">Every dollar, with a little more clarity.</p></div><button className="primary-button" onClick={() => setShowAdd(true)}><Plus size={16}/> Add transaction</button></div><div className="panel"><div className="search-box"><CircleHelp size={16}/><input value={query} onChange={e => setQuery(e.target.value)} placeholder="Search transactions or categories"/></div><TransactionList transactions={data.transactions.filter(t => `${t.description} ${t.category}`.toLowerCase().includes(query.toLowerCase()))} onDelete={deleteTransaction}/></div></section>}

        {tab === 'Budgets' && <section><div className="page-heading"><div><div className="eyebrow">SPEND WITH INTENTION</div><h1>Your budgets</h1><p className="subheading">Monthly limits shaped around what matters to you.</p></div><button className="secondary-button" onClick={() => { const name = prompt('Category name?'); if (!name?.trim()) return; const limit = Number(prompt('Monthly budget in CAD?')); if (limit > 0) persist({ ...data, budgets: [...data.budgets, { category: name.trim(), limit }] }) }}><Plus size={16}/> Add category</button></div><div className="budget-grid">{data.budgets.map(b => { const used = budgetSpent(data, b.category); const pct = used / Math.max(1, b.limit) * 100; return <div className="panel budget-card" key={b.category}><div className="budget-card-top"><span className="category-dot"/><span>{b.category}</span><button className="quiet-icon" onClick={() => { const v = prompt(`Monthly limit for ${b.category}`, String(b.limit)); if (v && Number(v) > 0) persist({ ...data, budgets: data.budgets.map(x => x.category === b.category ? { ...x, limit: Number(v) } : x) }) }}>···</button></div><strong className="budget-amount">{money(Math.max(0, b.limit - used))}<small> left</small></strong><p>{money(used)} of {money(b.limit)} used</p><div className="progress-track"><div className={pct > 100 ? 'over' : ''} style={{ width: `${Math.min(100, pct)}%` }}/></div><small className="budget-foot">{pct > 100 ? `${money(used - b.limit)} over budget` : `${Math.round(pct)}% of monthly limit`}</small></div>})}</div><div className="panel"><div className="panel-heading"><div><h2>Recurring expenses</h2><p>Upcoming obligations, made visible</p></div><button className="text-button" onClick={() => { const name = prompt('Bill or subscription name?'); if (!name?.trim()) return; const amount = Number(prompt('Amount in CAD?')); if (!(amount > 0)) return; const nextDate = prompt('Next payment date (YYYY-MM-DD)', today) || today; const frequency = prompt('Frequency: weekly, biweekly, monthly, quarterly, yearly', 'monthly') || 'monthly'; persist({ ...data, recurring: [...data.recurring, { id: crypto.randomUUID(), name: name.trim(), amount, category: 'Bills', frequency, nextDate }] }) }}><Plus size={15}/> Add recurring</button></div>{data.recurring.map(r => <div className="recurring-row" key={r.id}><div className="recurring-icon"><CreditCard size={17}/></div><div className="recurring-name"><strong>{r.name}</strong><small>{r.category} · {r.frequency} · Next {r.nextDate}</small></div><strong>{money(r.amount)}</strong></div>)}</div></section>}

        {tab === 'Goals' && <section><div className="page-heading"><div><div className="eyebrow">YOUR FUTURE, ON PURPOSE</div><h1>Savings goals</h1><p className="subheading">Turn what matters to you into a plan you can follow.</p></div><button className="primary-button" onClick={() => { const name = prompt('Goal name?'); if (!name?.trim()) return; const target = Number(prompt('Target amount in CAD?')); if (!(target > 0)) return; const saved = Number(prompt('Already saved? (CAD)', '0')) || 0; const dueDate = prompt('Target date (YYYY-MM-DD)', '2027-06-01') || '2027-06-01'; persist({ ...data, goals: [...data.goals, { id: crypto.randomUUID(), name: name.trim(), target, saved, dueDate }] }) }}><Plus size={16}/> New goal</button></div><div className="goal-grid">{data.goals.map(g => { const pct = Math.min(100, g.saved / Math.max(1, g.target) * 100); const days = Math.max(1, Math.ceil((new Date(g.dueDate).getTime() - Date.now()) / 86400000)); const monthly = Math.max(0, g.target - g.saved) / (days / 30.4375); return <div className="panel goal-card" key={g.id}><div className="goal-card-icon"><Target size={20}/></div><div className="goal-card-title"><h2>{g.name}</h2><button className="quiet-icon" onClick={() => { const v = Number(prompt('Add amount saved (CAD):', '50')); if (v > 0) persist({ ...data, goals: data.goals.map(x => x.id === g.id ? { ...x, saved: x.saved + v } : x) }) }}>+ Add savings</button></div><div className="goal-big">{money(g.saved)}<span> / {money(g.target)}</span></div><div className="progress-track"><div style={{ width: `${pct}%` }}/></div><div className="goal-stats"><div><small>Progress</small><strong>{Math.round(pct)}%</strong></div><div><small>Monthly pace needed</small><strong>{money(monthly)}</strong></div><div><small>Target date</small><strong>{g.dueDate}</strong></div></div><button className="subtle-action" onClick={() => { const v = Number(prompt('Update target amount (CAD):', String(g.target))); if (v > 0) persist({ ...data, goals: data.goals.map(x => x.id === g.id ? { ...x, target: v } : x) }) }}>Adjust goal <ArrowUpRight size={14}/></button></div>})}</div>{!data.goals.length && <div className="panel empty-panel">Your first goal can be small. Give it a name, a target, and a date.</div>}</section>}

        {tab === 'AI Coach' && <section><div className="page-heading"><div><div className="eyebrow">THOUGHTFUL MONEY GUIDANCE</div><h1>Your financial coach</h1><p className="subheading">Clear answers, grounded in your numbers — never judgment.</p></div><span className="ai-label"><Sparkles size={14}/> AI assistant</span></div><div className="coach-layout"><div className="panel chat-panel"><div className="chat-top"><div className="coach-avatar"><Bot size={20}/></div><div><strong>Pocketwise Coach</strong><small><span className="online-dot"/>{import.meta.env.VITE_AI_FUNCTION_URL ? 'AI service configured' : 'Local insights · AI setup pending'}</small></div></div><div className="chat-messages">{chat.map((m, i) => <div className={`message ${m.role}`} key={i}><div className="message-avatar">{m.role === 'assistant' ? <Sparkles size={15}/> : 'Y'}</div><div className="message-body">{m.text}</div></div>)}{saving && <div className="message assistant"><div className="message-avatar"><Sparkles size={15}/></div><div className="message-body">Thinking through your numbers…</div></div>}</div><form className="chat-compose" onSubmit={e => { e.preventDefault(); void askCoach() }}><input value={question} onChange={e => setQuestion(e.target.value)} placeholder="Ask anything about your money…" /><button className="send-button" type="submit" disabled={!question.trim() || saving}><Send size={17}/></button></form><p className="privacy-note">Your coach uses the data you provide. AI responses are estimates, not guarantees.</p></div><div className="suggested-questions"><h3>Good questions to start with</h3>{['Can I afford a $200 purchase?','Where did my money go this month?','How can I reach my emergency fund goal faster?','How much should I set aside from my next paycheque?'].map(q => <button key={q} onClick={() => setQuestion(q)}>{q}<ArrowUpRight size={14}/></button>)}<div className="coach-note"><Sparkles size={16}/><p>Good advice respects your priorities. We'll look for trade-offs, not just tell you to spend less.</p></div></div></div></section>}
      </div>
      <footer className="footer"><span>Pocketwise</span><span>Built for clarity, not guilt.</span><button onClick={exportData}>Download your data</button></footer>
    </main>

    {showAdd && <div className="modal-backdrop" onMouseDown={e => { if (e.target === e.currentTarget) { setShowAdd(false); setShowIncome(false) } }}><form className="quick-modal" onSubmit={e => { e.preventDefault(); addTransaction(showIncome ? 'income' : 'expense') }}><div className="modal-header"><div><span className="eyebrow">QUICK ENTRY</span><h2>{showIncome ? 'Add income' : 'Add expense'}</h2></div><button type="button" className="quiet-icon" onClick={() => { setShowAdd(false); setShowIncome(false) }}><X size={19}/></button></div><div className="entry-switch"><button type="button" className={!showIncome ? 'selected' : ''} onClick={() => setShowIncome(false)}><ArrowUpRight size={15}/> Expense</button><button type="button" className={showIncome ? 'selected' : ''} onClick={() => setShowIncome(true)}><ArrowDownLeft size={15}/> Income</button></div><label className="field-label">Amount <span>CAD</span></label><div className="amount-input"><span>$</span><input autoFocus inputMode="decimal" type="number" min="0.01" step="0.01" value={amount} onChange={e => setAmount(e.target.value)} placeholder="0.00" required/></div><label className="field-label">Description</label><input className="field-input" value={description} onChange={e => setDescription(e.target.value)} placeholder={showIncome ? 'e.g. Paycheque' : 'e.g. McDonald’s'}/><label className="field-label">Category</label><select className="field-input" value={category} onChange={e => setCategory(e.target.value)}>{(showIncome ? ['Employment', 'Freelance', 'Side income', 'Bonus', 'Other'] : ['Eating out', 'Groceries', 'Personal spending', 'Dating', 'Entertainment', 'Travel', 'Clothing', 'Car', 'Gifts', 'Technology', 'Fitness', 'Education', 'Bills', 'Transportation', 'Other']).map(c => <option key={c}>{c}</option>)}</select><label className="field-label">Date</label><input className="field-input" type="date" value={date} onChange={e => setDate(e.target.value)} required/><button className="primary-button save-button" type="submit"><Check size={17}/> Save {showIncome ? 'income' : 'expense'}</button><p className="modal-hint">Quick tip: description and category make your spending insights more useful.</p></form></div>}
    {notice && <div className="toast"><Check size={15}/>{notice}</div>}
    <div className="mobile-nav">{nav.map(({ label, icon: Icon }) => <button key={label} className={tab === label ? 'active' : ''} onClick={() => setTab(label)}><Icon size={19}/><span>{label === 'Overview' ? 'Home' : label === 'AI Coach' ? 'Coach' : label}</span></button>)}</div>
  </div>
}

function TransactionList({ transactions, onDelete }: { transactions: Transaction[]; onDelete: (id: string) => void }) {
  if (!transactions.length) return <div className="empty-panel">No transactions yet. Add your first one to start seeing your money clearly.</div>
  return <div className="transaction-list">{transactions.map(t => <div className="transaction-row" key={t.id}><div className={`transaction-icon ${t.kind}`} >{t.kind === 'income' ? <ArrowDownLeft size={17}/> : <ArrowUpRight size={17}/>}</div><div className="transaction-name"><strong>{t.description}</strong><small>{t.category} · {new Date(`${t.date}T12:00:00`).toLocaleDateString('en-CA', { month: 'short', day: 'numeric' })}</small></div><strong className={`transaction-amount ${t.kind}`}>{t.kind === 'income' ? '+' : '−'}{money(t.amount)}</strong><button className="delete-transaction" title="Delete transaction" onClick={() => onDelete(t.id)}><X size={15}/></button></div>)}</div>
}
