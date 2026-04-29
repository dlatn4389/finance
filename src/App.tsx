import { useEffect, useState, useRef, useCallback } from 'react'
import { createClient } from '@supabase/supabase-js'
import { BrowserRouter, Routes, Route, Link, useParams } from 'react-router-dom'
import './styles.css'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseKey = import.meta.env.VITE_SUPABASE_KEY
const supabase = createClient(supabaseUrl, supabaseKey)

interface Transaction {
  id: number
  rcept_dt: string
  corp_name: string
  stock_code: string
  repror: string
  sp_stock_lmp_cnt: number
  sp_stock_lmp_rate: number
  sp_stock_lmp_irds_cnt: number
}

interface StockSuggestion {
  ISU_ABBRV: string
  ISU_SRT_CD: string
}

type SortOrder = 'asc' | 'desc'
const PAGE_SIZE = 50

/* --- Context-like Props Provider --- */
function App() {
  const [theme, setTheme] = useState<'dark' | 'light'>('light')
  const [searchTerm, setSearchTerm] = useState('')
  const [suggestions, setSuggestions] = useState<StockSuggestion[]>([])
  const [showSuggestions, setShowSuggestions] = useState(false)
  
  // Reporter Filter State
  const [selectedReprors, setSelectedReprors] = useState<string[]>(['국민연금공단'])
  const [reprorSearch, setReprorSearch] = useState('')
  const [reprorSuggestions, setReprorSuggestions] = useState<string[]>([])
  const [showReprorSearch, setShowReprorSearch] = useState(false)

  useEffect(() => {
    document.body.setAttribute('data-theme', theme)
  }, [theme])

  // Fetch unique reporters for the add feature
  useEffect(() => {
    if (reprorSearch.length < 1) {
      setReprorSuggestions([])
      return
    }
    async function fetchReprors() {
      // Use rpc or a specialized query if possible. 
      // For simplicity here, we'll fetch unique values from transaction_history
      // In a real app, a dedicated 'reporters' table is better.
      const { data } = await supabase
        .from('transaction_history')
        .select('repror')
        .ilike('repror', `%${reprorSearch}%`)
        .limit(20)
      
      const unique = Array.from(new Set(data?.map(d => d.repror) || []))
      setReprorSuggestions(unique.filter(name => !selectedReprors.includes(name)))
    }
    const timer = setTimeout(fetchReprors, 200)
    return () => clearTimeout(timer)
  }, [reprorSearch, selectedReprors])

  // Stock Suggestions
  useEffect(() => {
    if (searchTerm.length < 2) {
      setSuggestions([])
      setShowSuggestions(false)
      return
    }
    async function fetchSuggestions() {
      const { data: stocks } = await supabase
        .from('listed_stocks')
        .select('ISU_ABBRV, ISU_SRT_CD')
        .ilike('ISU_ABBRV', `%${searchTerm}%`)
        .limit(10)
      setSuggestions(stocks || [])
      setShowSuggestions(true)
    }
    const timer = setTimeout(fetchSuggestions, 200)
    return () => clearTimeout(timer)
  }, [searchTerm])

  const addRepror = (name: string) => {
    setSelectedReprors(prev => [...prev, name])
    setReprorSearch('')
    setShowReprorSearch(false)
  }

  const removeRepror = (name: string) => {
    if (selectedReprors.length > 1) {
      setSelectedReprors(prev => prev.filter(r => r !== name))
    }
  }

  return (
    <BrowserRouter>
      <div className="container">
        <div className="top-controls">
          <div className="left-group">
            <div className="chip-container">
              {selectedReprors.map(name => (
                <div key={name} className="chip">
                  {name}
                  <span className="chip-remove" onClick={() => removeRepror(name)}>×</span>
                </div>
              ))}
              <div style={{ position: 'relative' }}>
                <button 
                  className="add-repror-btn" 
                  onClick={() => setShowReprorSearch(!showReprorSearch)}
                >
                  +
                </button>
                {showReprorSearch && (
                  <div className="suggestions-list" style={{ width: '250px', left: '0' }}>
                    <input 
                      autoFocus
                      className="search-input" 
                      style={{ borderRadius: 0, border: 'none', borderBottom: '1px solid var(--border)' }}
                      placeholder="Add reporter..." 
                      value={reprorSearch}
                      onChange={(e) => setReprorSearch(e.target.value)}
                    />
                    {reprorSuggestions.map(name => (
                      <div key={name} className="suggestion-item" onClick={() => addRepror(name)}>
                        {name}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="right-group">
            <div className="search-container">
              <input 
                type="text" 
                placeholder="Quick search stocks..." 
                className="search-input"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                onFocus={() => searchTerm.length >= 2 && setShowSuggestions(true)}
              />
              {showSuggestions && suggestions.length > 0 && (
                <div className="suggestions-list">
                  {suggestions.map((stock: any) => (
                    <Link 
                      key={stock.ISU_SRT_CD} 
                      to={`/stock/${stock.ISU_SRT_CD}`}
                      className="suggestion-item"
                      onClick={() => {
                        setSearchTerm('')
                        setShowSuggestions(false)
                      }}
                    >
                      <span>{stock.ISU_ABBRV}</span>
                      <span style={{ opacity: 0.5 }}>{stock.ISU_SRT_CD}</span>
                    </Link>
                  ))}
                </div>
              )}
            </div>
            <button className="theme-toggle" onClick={() => setTheme(t => t === 'dark' ? 'light' : 'dark')}>
              {theme === 'dark' ? '☀️' : '🌙'}
            </button>
          </div>
        </div>

        <main>
          <Routes>
            <Route path="/" element={<Dashboard selectedReprors={selectedReprors} />} />
            <Route path="/stock/:stockCode" element={<StockDetail selectedReprors={selectedReprors} />} />
          </Routes>
        </main>
      </div>
    </BrowserRouter>
  )
}

/* --- Dashboard Page --- */
function Dashboard({ selectedReprors }: { selectedReprors: string[] }) {
  const [data, setData] = useState<Transaction[]>([])
  const [loading, setLoading] = useState(false)
  const [hasMore, setHasMore] = useState(true)
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc')
  const [page, setPage] = useState(0)
  
  const observer = useRef<IntersectionObserver | null>(null)
  const lastElementRef = useCallback((node: HTMLDivElement) => {
    if (loading) return
    if (observer.current) observer.current.disconnect()
    observer.current = new IntersectionObserver(entries => {
      if (entries[0].isIntersecting && hasMore) {
        setPage(prevPage => prevPage + 1)
      }
    })
    if (node) observer.current.observe(node)
  }, [loading, hasMore])

  useEffect(() => {
    setData([])
    setPage(0)
    setHasMore(true)
  }, [sortOrder, selectedReprors])

  useEffect(() => {
    async function fetchData() {
      setLoading(true)
      const from = page * PAGE_SIZE
      const to = from + PAGE_SIZE - 1

      const { data: result, error } = await supabase
        .from('transaction_history')
        .select('*')
        .in('repror', selectedReprors)
        .order('rcept_dt', { ascending: sortOrder === 'asc' })
        .range(from, to)

      if (!error) {
        setData(prev => [...prev, ...(result || [])])
        if (result.length < PAGE_SIZE) setHasMore(false)
      }
      setLoading(false)
    }
    fetchData()
  }, [page, sortOrder, selectedReprors])

  return (
    <>
      <TransactionTable data={data} sortOrder={sortOrder} onToggleSort={() => setSortOrder(s => s === 'desc' ? 'asc' : 'desc')} />
      {hasMore && <div ref={lastElementRef} className="loading-container">Synchronizing insights...</div>}
    </>
  )
}

/* --- Stock Detail Page --- */
function StockDetail({ selectedReprors }: { selectedReprors: string[] }) {
  const { stockCode } = useParams()
  const [data, setData] = useState<Transaction[]>([])
  const [loading, setLoading] = useState(true)
  const [corpName, setCorpName] = useState('')
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc')

  useEffect(() => {
    async function fetchData() {
      setLoading(true)
      const { data: result } = await supabase
        .from('transaction_history')
        .select('*')
        .in('repror', selectedReprors)
        .eq('stock_code', stockCode)
        .order('rcept_dt', { ascending: sortOrder === 'asc' })
      
      setData(result || [])
      if (result && result.length > 0) setCorpName(result[0].corp_name)
      setLoading(false)
    }
    fetchData()
  }, [stockCode, sortOrder, selectedReprors])

  return (
    <div>
      <div style={{ marginBottom: '2rem', display: 'flex', alignItems: 'center', gap: '1.5rem' }}>
        <Link to="/" className="theme-toggle" style={{ textDecoration: 'none', width: '2.75rem', height: '2.75rem', padding: 0, justifyContent: 'center' }}>
          ←
        </Link>
        <h2 style={{ margin: 0, fontWeight: 700 }}>
          {corpName || stockCode} <span style={{ color: 'var(--text-dim)', fontSize: '1rem', fontWeight: 400 }}>{stockCode}</span>
        </h2>
      </div>
      <TransactionTable data={data} sortOrder={sortOrder} onToggleSort={() => setSortOrder(s => s === 'desc' ? 'asc' : 'desc')} />
    </div>
  )
}

/* --- Reusable Table --- */
function TransactionTable({ data, sortOrder, onToggleSort }: { data: Transaction[], sortOrder: SortOrder, onToggleSort: () => void }) {
  return (
    <div className="table-card">
      <table className="history-table">
        <thead>
          <tr>
            <th onClick={onToggleSort} style={{ cursor: 'pointer', userSelect: 'none' }}>날짜 {sortOrder === 'desc' ? '↓' : '↑'}</th>
            <th>구분</th>
            <th>종목</th>
            <th>보고자</th>
            <th>변동 수량</th>
            <th>보유 주식수</th>
            <th>지분율</th>
          </tr>
        </thead>
        <tbody>
          {data.map((item, index) => {
            const isBuy = item.sp_stock_lmp_irds_cnt > 0
            return (
              <tr key={`${item.id}-${index}`}>
                <td>{item.rcept_dt}</td>
                <td><span className={`tag ${isBuy ? 'tag-buy' : 'tag-sell'}`}>{isBuy ? 'BUY' : 'SELL'}</span></td>
                <td>
                  <Link to={`/stock/${item.stock_code}`} className="corp-name" style={{ textDecoration: 'none', color: 'var(--primary)' }}>{item.corp_name}</Link>
                  <span className="stock-code">{item.stock_code}</span>
                </td>
                <td style={{ color: 'var(--text-dim)' }}>{item.repror}</td>
                <td className={isBuy ? 'change-pos' : 'change-neg'}>{isBuy ? '+' : ''}{item.sp_stock_lmp_irds_cnt?.toLocaleString()}</td>
                <td>{item.sp_stock_lmp_cnt?.toLocaleString()}</td>
                <td style={{ fontWeight: 600 }}>{item.sp_stock_lmp_rate?.toFixed(2)}%</td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

export default App
