import { useEffect, useState } from 'react'
import { createClient } from '@supabase/supabase-js'
import './styles.css'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

const supabase = createClient(supabaseUrl, supabaseAnonKey)

interface Transaction {
  id: number
  rcept_dt: string
  corp_name: string
  stock_code: string
  repror_name: string
  sp_stock_lmp_cnt: number
  sp_stock_lmp_rate: number
}

function App() {
  const [data, setData] = useState<Transaction[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function fetchData() {
      try {
        const { data: result, error } = await supabase
          .from('transaction_history')
          .select('*')
          .order('rcept_dt', { ascending: false })
          .limit(50)

        if (error) throw error
        setData(result || [])
      } catch (err: any) {
        setError(err.message)
      } finally {
        setLoading(false)
      }
    }

    fetchData()
  }, [])

  return (
    <div className="container">
      <header>
        <h1>Finance Dashboard</h1>
        <p style={{ color: '#94a3b8' }}>Real-time Transaction Insights (Latest 50)</p>
      </header>

      {loading ? (
        <div className="loading">Fetching transaction data...</div>
      ) : error ? (
        <div className="error">Error: {error}</div>
      ) : (
        <div className="card" style={{ padding: 0 }}>
          <table className="history-table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Company</th>
                <th>Reporter</th>
                <th>Quantity</th>
                <th>Stake (%)</th>
              </tr>
            </thead>
            <tbody>
              {data.map((item) => (
                <tr key={item.id}>
                  <td>{item.rcept_dt}</td>
                  <td>
                    <div style={{ fontWeight: 600 }}>{item.corp_name}</div>
                    <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>{item.stock_code}</div>
                  </td>
                  <td>{item.repror_name}</td>
                  <td>{item.sp_stock_lmp_cnt?.toLocaleString()}</td>
                  <td>{item.sp_stock_lmp_rate?.toFixed(2)}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

export default App
