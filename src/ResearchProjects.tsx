import { useState } from 'react'
import './research.css'

interface ProjectItem {
  id: string
  cat: string
  isNew: boolean
  title: string
  diff: 'low' | 'mid' | 'high'
  diffLabel: string
  days: string
  pain: string
  solution: string
  wow: string
  tags: string[]
  impact: number
  feasibility: number
  interview: number
}

const ITEMS: ProjectItem[] = [
  // ── 수집·저장
  {id:'biz_profile', cat:'collect', isNew:true,
   title:'사업보고서 기반 기업 사업 프로파일 DB',
   diff:'mid', diffLabel:'난이도 중간', days:'1~2일',
   pain:'기업이 실제로 어떤 사업을 영위하는지는 뉴스나 종목명만으로 파악하기 어려움. 공식 출처 기반 분류가 없음.',
   solution:'사업보고서 "사업의 내용"을 AI로 파싱 → 영위 사업 태그(예: OLED 패널, 전기차 배터리, 클라우드 SaaS)를 자동 추출해 DB에 저장. 이후 사업 기반 필터링의 기반 데이터가 됨.',
   wow:'증권사 섹터 분류보다 훨씬 세밀한 사업 단위 분류 가능. 이 DB가 쌓이면 "사업 기반 종목 검색" 기능이 돌아감.',
   tags:['사업보고서 파싱','Exaone 2.4b','SQLite','BeautifulSoup'],
   impact:88, feasibility:80, interview:88},

  {id:'note_parser', cat:'collect', isNew:true,
   title:'연결재무제표 주석 파싱 · 구조화 저장',
   diff:'high', diffLabel:'난이도 높음', days:'3일+',
   pain:'주석에 숨겨진 핵심 정보(우발부채, 특수관계자 거래, 차입금 만기 등)를 수작업으로 읽어야 함. 파싱이 어렵고 비정형적.',
   solution:'사업보고서 주석 섹션을 HTML 파싱 → AI로 항목별(우발부채/소송/특수관계자/차입금만기/재고평가/대손충당금) 구조화해 DB 저장.',
   wow:'본문 재무제표에 안 잡히는 숨겨진 리스크를 자동으로 포착. 애널리스트도 수작업으로 하는 일을 자동화.',
   tags:['BeautifulSoup','Exaone 2.4b','SQLite','정규표현식'],
   impact:95, feasibility:55, interview:95},

  {id:'report_db', cat:'collect', isNew:false,
   title:'리서치 리포트 수집 · DB 저장',
   diff:'mid', diffLabel:'난이도 중간', days:'1~2일',
   pain:'증권사 리포트가 각 앱에 흩어져 있고 쌓이지 않아 과거 비교가 불가능.',
   solution:'리포트 PDF 수집 → 목표주가·투자의견·핵심 근거 파싱 후 SQLite DB 저장. 이후 모든 분석의 기반 데이터.',
   wow:'데이터가 쌓일수록 컨센서스·추이·이견 분석 등 새 인사이트가 생기는 구조.',
   tags:['PDF 파싱','SQLite','pandas','DART API'],
   impact:90, feasibility:72, interview:88},

  {id:'news_db', cat:'collect', isNew:false,
   title:'종목별 뉴스 자동 수집 · 저장',
   diff:'low', diffLabel:'난이도 낮음', days:'1일',
   pain:'보유 종목 기사를 매일 수동으로 찾아야 함. 과거 기사 맥락을 되돌아보기 어려움.',
   solution:'보유 종목 키워드로 뉴스를 매일 자동 수집해 DB에 저장. AI가 중요도·요약을 붙여서 함께 저장.',
   wow:'쌓인 뉴스로 "이 종목이 어떤 이슈를 겪어왔는지" 타임라인 조회 가능.',
   tags:['네이버 뉴스 API','Exaone 2.4b','SQLite','APScheduler'],
   impact:85, feasibility:90, interview:80},

  {id:'price_db', cat:'collect', isNew:false,
   title:'재무·주가 데이터 정기 업데이트',
   diff:'low', diffLabel:'난이도 낮음', days:'반나절',
   pain:'분석할 때마다 API를 새로 호출해야 해서 느리고 번거로움.',
   solution:'관심 종목의 주가·재무지표를 주기적으로 DB에 적재. 이후 분석은 DB 조회만으로 즉시 실행.',
   wow:'모든 기능의 속도와 안정성을 높이는 인프라. 단독보단 다른 기능과 결합 시 빛남.',
   tags:['FinanceDataReader','DART API','SQLite','APScheduler'],
   impact:78, feasibility:97, interview:65},

  // ── 검색·발굴
  {id:'biz_filter', cat:'search', isNew:true,
   title:'사업 기반 종목 검색 · 필터링',
   diff:'low', diffLabel:'난이도 낮음', days:'1일',
   pain:'"HBM 생산 기업", "베트남 매출 비중 높은 기업"을 찾으려면 수작업 서치밖에 없음. 섹터 분류는 너무 넓음.',
   solution:'사업 프로파일 DB에서 키워드 검색 → 해당 사업을 영위하는 기업 리스트 즉시 출력. 복수 사업 태그로 AND/OR 필터 가능.',
   wow:'공식 사업보고서 기반이라 신뢰도 높음. "이 테마에 실제로 엮인 기업"을 정확히 찾는 유일한 방법.',
   tags:['SQLite','Streamlit','사업 프로파일 DB'],
   impact:92, feasibility:90, interview:93},

  {id:'upside', cat:'search', isNew:false,
   title:'목표주가 대비 상승 여력 순위',
   diff:'low', diffLabel:'난이도 낮음', days:'1일',
   pain:'어떤 종목이 현재 가장 저평가돼 있는지 한눈에 보기 어려움. 리포트마다 흩어져 있어 비교 불가.',
   solution:'DB에 쌓인 리포트에서 증권사별 목표주가 집계 → 컨센서스 목표주가 계산 → 현재가 대비 괴리율 순위 정렬.',
   wow:'"여러 증권사 의견을 종합한 상승여력 랭킹"은 지금 어느 무료 서비스도 제공하지 않음.',
   tags:['SQLite','pandas','FinanceDataReader','Streamlit'],
   impact:93, feasibility:88, interview:95},

  {id:'portfolio_news', cat:'search', isNew:false,
   title:'보유 종목 관련 기사 자동 모음',
   diff:'low', diffLabel:'난이도 낮음', days:'1일',
   pain:'보유 종목이 10개면 10개 앱·사이트를 각각 들어가야 기사를 확인할 수 있음.',
   solution:'보유 종목 등록 → DB에서 해당 종목 최신 뉴스를 한 페이지로 모아 출력. AI 중요도 필터로 노이즈 제거.',
   wow:'"내 포트폴리오 전용 뉴스 피드"라는 개념. 직관적이고 즉시 쓸 수 있음.',
   tags:['SQLite','Streamlit','Exaone 2.4b'],
   impact:88, feasibility:93, interview:85},

  {id:'coverage_tracker', cat:'search', isNew:false,
   title:'애널리스트 커버리지 급증 종목 탐지',
   diff:'mid', diffLabel:'난이도 중간', days:'1~2일',
   pain:'기관 관심이 막 생기기 시작한 종목을 선제적으로 발굴하기 어려움.',
   solution:'DB에서 최근 1개월 신규 리포트 수가 급증한 종목을 자동 탐지. 커버리지 증가 = 기관 관심 신호.',
   wow:'데이터가 쌓인 DB에서만 가능한 분석. "시간이 지날수록 더 강력해지는 기능"이라는 스토리.',
   tags:['SQLite','pandas','Plotly'],
   impact:85, feasibility:80, interview:90},

  // ── 모니터링·알림
  {id:'portfolio_alert', cat:'alert', isNew:false,
   title:'보유 종목 일일 브리핑 자동 발송',
   diff:'mid', diffLabel:'난이도 중간', days:'2일',
   pain:'보유 종목 수십 개의 공시·뉴스를 매일 수동 확인은 현실적으로 불가능.',
   solution:'매일 아침 보유 종목 DB 스캔 → 어제 공시·주요 뉴스·주가 변동을 한 장으로 요약해 슬랙 발송.',
   wow:'정보 과잉이 아니라 정보 압축. 운용사 실무에서 가장 즉각적으로 쓸 수 있는 툴.',
   tags:['SQLite','Exaone 2.4b','APScheduler','Slack API'],
   impact:92, feasibility:80, interview:90},

  {id:'tp_alert', cat:'alert', isNew:false,
   title:'목표주가 하향 조정 즉시 알림',
   diff:'low', diffLabel:'난이도 낮음', days:'1일',
   pain:'보유 종목의 목표주가가 낮아졌는데 뒤늦게 알게 되는 경우 발생.',
   solution:'새 리포트가 DB에 들어올 때 이전 목표주가와 비교 → 하향 조정이면 즉시 알림 발송.',
   wow:'"리포트 업데이트 → 즉각 반응"하는 파이프라인. 실무에서 바로 쓸 수 있는 기능.',
   tags:['SQLite','APScheduler','Slack API'],
   impact:88, feasibility:90, interview:83},

  {id:'note_alert', cat:'alert', isNew:true,
   title:'주석 이상 징후 자동 감지 알림',
   diff:'mid', diffLabel:'난이도 중간', days:'2일',
   pain:'우발부채 급증, 대손충당금 증가 같은 리스크 신호를 주석을 직접 읽기 전엔 모름.',
   solution:'신규 주석 파싱 결과를 전기와 비교 → 이상 징후(우발부채 증가율 X% 초과, 소송 신규 발생 등) 감지 시 즉시 알림.',
   wow:'주가 하락 전에 재무 이상 신호를 선제적으로 잡는 기능. 기관에서도 수작업으로 하는 일.',
   tags:['SQLite','pandas','Slack API','Exaone 2.4b'],
   impact:93, feasibility:65, interview:92},

  // ── 분석·인사이트
  {id:'biz_outlook', cat:'analysis', isNew:true,
   title:'사업 전망 자동 요약 (경영진단 활용)',
   diff:'low', diffLabel:'난이도 낮음', days:'1일',
   pain:'이사의 경영진단 및 기타 참고사항은 경영진이 직접 쓴 가장 솔직한 전망이지만 읽기 번거로움.',
   solution:'수집해둔 경영진단 섹션을 AI로 요약 → 긍정 전망 / 우려 사항 / 핵심 전략을 구조화해 출력. 여러 기업 비교 가능.',
   wow:'경영진이 직접 쓴 텍스트이므로 신뢰도 최상. IR 미팅 전 예습 자료로도 바로 활용 가능. 사업보고서 수집 완료 상태라 즉시 구현 가능.',
   tags:['Exaone 2.4b','SQLite','Streamlit','사업보고서 수집 완료'],
   impact:87, feasibility:95, interview:88},

  {id:'consensus_trend', cat:'analysis', isNew:false,
   title:'컨센서스 목표주가 추이 분석',
   diff:'low', diffLabel:'난이도 낮음', days:'1일',
   pain:'목표주가가 시간이 지나면서 올라가는지 내려가는지 트렌드를 보기 어려움.',
   solution:'DB에 쌓인 리포트로 월별 컨센서스 목표주가 변화를 차트화. 꺾이는 시점이 매도 시그널.',
   wow:'리포트 DB가 있어야만 가능한 분석. "데이터 축적의 가치"를 가장 잘 보여주는 기능.',
   tags:['SQLite','pandas','Plotly'],
   impact:87, feasibility:88, interview:88},

  {id:'opinion_conflict', cat:'analysis', isNew:false,
   title:'증권사 간 투자의견 상충 감지',
   diff:'mid', diffLabel:'난이도 중간', days:'1~2일',
   pain:'A 증권사는 매수, B 증권사는 매도일 때 왜 의견이 갈리는지 파악하기 어려움.',
   solution:'같은 종목에 상반된 의견이 있을 때 AI가 양쪽 논리를 나란히 비교해서 쟁점을 정리.',
   wow:'"왜 의견이 다른가"를 분석하는 고차원 기능. 단순 정보 제공을 넘어섬.',
   tags:['SQLite','Exaone 2.4b','Streamlit'],
   impact:88, feasibility:75, interview:92},

  {id:'note_insight', cat:'analysis', isNew:true,
   title:'주석 기반 숨겨진 리스크 리포트',
   diff:'high', diffLabel:'난이도 높음', days:'3일+',
   pain:'우발부채·특수관계자 거래·차입금 만기 같은 정보가 주석에 있지만 투자 판단에 연결하기 어려움.',
   solution:'파싱된 주석 데이터를 AI가 투자 관점으로 해석 → "이 기업의 숨겨진 리스크 3가지" 자동 리포트 생성. 주가·실적 데이터와 교차 분석.',
   wow:'애널리스트 리포트에서도 잘 다루지 않는 영역. "남들이 안 보는 곳을 본다"는 강력한 차별점.',
   tags:['SQLite','Exaone 2.4b','pandas','Plotly'],
   impact:97, feasibility:52, interview:97},

  {id:'thesis_check', cat:'analysis', isNew:false,
   title:'투자 thesis AI 유효성 점검',
   diff:'mid', diffLabel:'난이도 중간', days:'2일',
   pain:'매수 당시 논리가 아직 유효한지 주기적으로 검토하기 어려움.',
   solution:'매수 시 thesis 기록 → AI가 최신 공시·뉴스·리포트를 DB에서 조회해 "유효 / 약화 / 훼손" 판정.',
   wow:'투자 프로세스를 체계화하는 툴. "감이 아닌 근거로 보유 여부를 판단"하는 스토리.',
   tags:['SQLite','Exaone 2.4b','DART API','Streamlit'],
   impact:90, feasibility:72, interview:93},
];

const SECTIONS = [
  { key:'collect',  label:'데이터 수집·저장',  color:'var(--research-c-collect)'  },
  { key:'search',   label:'검색·발굴',          color:'var(--research-c-search)'   },
  { key:'alert',    label:'모니터링·알림',       color:'var(--research-c-alert)'    },
  { key:'analysis', label:'분석·인사이트',       color:'var(--research-c-analysis)' },
];

export default function ResearchProjects() {
  const [currentFilter, setCurrentFilter] = useState('all')
  const [openId, setOpenId] = useState<string | null>(null)

  const toggle = (id: string) => {
    setOpenId(prev => prev === id ? null : id)
  }

  const filteredItems = ITEMS.filter(item => {
    if (currentFilter === 'new') return item.isNew;
    if (currentFilter === 'low') return item.diff === 'low';
    if (currentFilter === 'all') return true;
    return item.cat === currentFilter;
  });

  const stats = {
    total: filteredItems.length,
    newCount: filteredItems.filter(i => i.isNew).length,
    lowCount: filteredItems.filter(i => i.diff === 'low').length
  }

  const getDiffClass = (d: string) => d === 'low' ? 'diff-low' : d === 'mid' ? 'diff-mid' : 'diff-high';
  const getBarColor = (k: string) => k === 'impact' ? '#2dd4a0' : k === 'feasibility' ? '#4f7cff' : '#f5a623';
  const getBarLabel = (k: string) => k === 'impact' ? '실무 임팩트' : k === 'feasibility' ? '구현 가능성' : '면접 임팩트';

  return (
    <div className="research-container">
      <header className="research-header">
        <div className="header-eyebrow">리서치 자동화 · 프로젝트 아이디어 목록</div>
        <h1>투자 리서치를 자동화하는<br />16가지 프로젝트</h1>
        <p>종목 발굴부터 포트폴리오 관리까지 — 사업보고서, 공시, 뉴스, 리서치 리포트를 DB에 쌓고 그 위에서 돌아가는 자동화 인프라 설계.</p>
      </header>

      <div className="legend">
        {SECTIONS.map(sec => (
          <div key={sec.key} className="legend-item">
            <div className="legend-dot" style={{ background: sec.color }}></div>
            {sec.label}
          </div>
        ))}
      </div>

      <div className="stats-bar">
        <div className="stat"><span>{stats.total}</span>전체 아이디어</div>
        <div className="stat"><span>{stats.newCount}</span>신규 추가</div>
        <div className="stat"><span>{stats.lowCount}</span>3일 내 구현 가능</div>
      </div>

      <div className="filter-wrap">
        <button className={`filter-btn ${currentFilter === 'all' ? 'active' : ''}`} onClick={() => setCurrentFilter('all')}>전체</button>
        {SECTIONS.map(sec => (
          <button 
            key={sec.key}
            className={`filter-btn ${currentFilter === sec.key ? 'active' : ''}`} 
            onClick={() => setCurrentFilter(sec.key)}
          >
            {sec.label}
          </button>
        ))}
        <button className={`filter-btn new-filter ${currentFilter === 'new' ? 'active' : ''}`} onClick={() => setCurrentFilter('new')}>🆕 신규</button>
        <button className={`filter-btn ${currentFilter === 'low' ? 'active' : ''}`} onClick={() => setCurrentFilter('low')}>⚡ 3일 내 가능</button>
      </div>

      <main className="research-main">
        {SECTIONS.map(sec => {
          const sectionItems = filteredItems.filter(item => item.cat === sec.key);
          if (sectionItems.length === 0) return null;

          return (
            <div key={sec.key} className="section-group">
              <div className="section-header">
                <div className="section-stripe" style={{ background: sec.color }}></div>
                <div className="section-title-text">{sec.label}</div>
              </div>
              
              {sectionItems.map(item => (
                <div 
                  key={item.id} 
                  className={`card ${openId === item.id ? 'open' : ''}`}
                  onClick={() => toggle(item.id)}
                >
                  {item.isNew && <div className="new-badge">NEW</div>}
                  <div className="card-top">
                    <div className="cat-indicator" style={{ background: sec.color }}></div>
                    <div className="card-title">{item.title}</div>
                    <div className="badges">
                      <span className={`badge ${getDiffClass(item.diff)}`}>{item.diffLabel}</span>
                      <span className="badge day-badge">{item.days}</span>
                    </div>
                    <svg className="chevron" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
                      <path d="M3 5.5l5 5 5-5" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </div>
                  
                  {openId === item.id && (
                    <div className="card-body">
                      <div className="detail-row">
                        <span className="detail-label">불편함</span>
                        <span className="detail-value">{item.pain}</span>
                      </div>
                      <div className="detail-row">
                        <span className="detail-label">해결</span>
                        <span className="detail-value">{item.solution}</span>
                      </div>
                      <div className="detail-row">
                        <span className="detail-label">차별점</span>
                        <span className="detail-value">{item.wow}</span>
                      </div>
                      <div className="detail-row">
                        <span className="detail-label">지표</span>
                        <div className="bars">
                          {['impact', 'feasibility', 'interview'].map(k => (
                            <div key={k} className="bar-row">
                              <span className="bar-label">{getBarLabel(k)}</span>
                              <div className="bar-bg">
                                <div className="bar-fill" style={{ width: `${item[k as keyof ProjectItem]}%`, background: getBarColor(k) }}></div>
                              </div>
                              <span className="bar-val">{item[k as keyof ProjectItem]}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                      <div className="detail-row">
                        <span className="detail-label">도구</span>
                        <div className="tag-row">
                          {item.tags.map(t => <span key={t} className="tag">{t}</span>)}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )
        })}
      </main>

      <footer className="research-footer">종목 발굴 · 포트폴리오 관리 · 리서치 자동화 인프라 — 디에스자산운용 인턴 면접 준비</footer>
    </div>
  )
}
