import { useEffect, useMemo, useState } from 'react'
import type { ExplorationData, KnowledgeRelation, MapNode, ReviewStatus, SavedPath } from './types'

const statusText: Record<ReviewStatus, string> = { reviewed: '已核对', partial: '部分待审核', pending: '待审核' }

async function getJson<T>(url: string): Promise<T> {
  const response = await fetch(url)
  if (!response.ok) throw new Error(`请求失败 (${response.status})`)
  return response.json() as Promise<T>
}

function Status({ value }: { value: ReviewStatus }) {
  return <span className={`status status-${value}`}>{statusText[value]}</span>
}

function KnowledgeMap({ data, currentId }: { data: ExplorationData; currentId: string }) {
  const nodes = new Map(data.mapNodes.map(node => [node.id, node]))
  const currentNodes = data.mapNodes.filter(node => node.questionId === currentId).map(node => node.id)
  return <section className="panel map-panel" aria-labelledby="map-title">
    <div className="section-heading"><div><span className="kicker">CONNECTIONS / 知识关系</span><h2 id="map-title">当前区域的知识地图</h2></div><span className="section-note">两河流域南部 · 示意</span></div>
    <p className="section-intro">实线文字描述的是知识关系；右侧的探索推荐是另一套路径。灰色关系仍待资料核对。</p>
    <div className="map-layout">
      <div className="map-diagram" role="img" aria-label="河流连接水源与灌溉、洪水风险及可能的水路；灌溉连接农田，农田和水路可能影响城市发展。">
        <div className="map-column"><MapTile node={nodes.get('river')!} active={currentNodes.includes('river')} /></div>
        <div className="map-fork" aria-hidden="true"><span>↗</span><span>→</span><span>↘</span></div>
        <div className="map-column"><MapTile node={nodes.get('water')!} active={currentNodes.includes('water')} /><MapTile node={nodes.get('routes')!} active={currentNodes.includes('routes')} /><MapTile node={nodes.get('floods')!} active={currentNodes.includes('floods')} /></div>
        <div className="map-fork" aria-hidden="true"><span>→</span><span>→</span><span>　</span></div>
        <div className="map-column"><MapTile node={nodes.get('fields')!} active={currentNodes.includes('fields')} /><MapTile node={nodes.get('city')!} active={currentNodes.includes('city')} /></div>
      </div>
      <div className="relation-list"><h3>关系依据</h3>{data.knowledgeRelations.map((relation: KnowledgeRelation) => <div className="relation" key={`${relation.fromNodeId}-${relation.toNodeId}`}>
        <div><strong>{nodes.get(relation.fromNodeId)?.label}</strong><span className="relation-arrow">→</span><strong>{nodes.get(relation.toNodeId)?.label}</strong></div>
        <small>{relation.label} · {statusText[relation.reviewStatus]}</small>
      </div>)}</div>
    </div>
  </section>
}

function MapTile({ node, active }: { node: MapNode; active: boolean }) {
  return <div className={`map-tile map-${node.kind}${active ? ' active' : ''}`}><span className="map-dot" />{node.label}</div>
}

function App() {
  const [data, setData] = useState<ExplorationData | null>(null)
  const [savedPaths, setSavedPaths] = useState<SavedPath[]>([])
  const [path, setPath] = useState<string[]>([])
  const [title, setTitle] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [saveMessage, setSaveMessage] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    let active = true
    async function load() {
      try {
        const [catalog, stored] = await Promise.all([getJson<ExplorationData>('/api/exploration'), getJson<SavedPath[]>('/api/paths')])
        let initialPath = [catalog.featuredQuestionIds[0]]
        const pathId = new URLSearchParams(window.location.search).get('path')
        if (pathId) {
          try { initialPath = (await getJson<SavedPath>(`/api/paths/${encodeURIComponent(pathId)}`)).questionIds }
          catch { /* Invalid or deleted link: show the featured entry. */ }
        }
        if (active) { setData(catalog); setSavedPaths(stored); setPath(initialPath) }
      } catch (cause) { if (active) setError(cause instanceof Error ? cause.message : '无法加载示例') }
      finally { if (active) setLoading(false) }
    }
    void load()
    return () => { active = false }
  }, [])

  const questions = useMemo(() => new Map(data?.questions.map(q => [q.id, q]) ?? []), [data])
  const current = questions.get(path.at(-1) ?? '')
  const recommendations = data?.recommendations.filter(r => r.fromQuestionId === current?.id) ?? []
  const sources = data?.sources.filter(source => current?.sourceIds.includes(source.id)) ?? []

  function start(id: string) { setPath([id]); setSaveMessage(''); window.history.replaceState({}, '', '?view=history') }
  function go(id: string) { setPath(previous => [...previous, id]); setSaveMessage(''); window.history.replaceState({}, '', '?view=history') }
  function back() { setPath(previous => previous.length > 1 ? previous.slice(0, -1) : previous); setSaveMessage(''); window.history.replaceState({}, '', '?view=history') }
  function restore(saved: SavedPath) { setPath(saved.questionIds); setSaveMessage(`已打开「${saved.title}」`); window.history.replaceState({}, '', `?view=history&path=${saved.id}`); window.scrollTo({ top: 0, behavior: 'smooth' }) }

  async function save(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!title.trim() || saving) return
    setSaving(true); setSaveMessage('')
    try {
      const response = await fetch('/api/paths', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ title: title.trim(), questionIds: path }) })
      if (!response.ok) throw new Error((await response.json()).error ?? '保存失败')
      const saved = await response.json() as SavedPath
      setSavedPaths(previous => [saved, ...previous].slice(0, 30))
      setTitle(''); setSaveMessage('探索路径已保存，可从下方重新打开。')
      window.history.replaceState({}, '', `?view=history&path=${saved.id}`)
    } catch (cause) { setSaveMessage(cause instanceof Error ? cause.message : '保存失败') }
    finally { setSaving(false) }
  }

  if (loading) return <div className="app-state">正在展开历史地图…</div>
  if (error || !data || !current) return <div className="app-state">{error || '示例数据不可用'} <button onClick={() => window.location.reload()}>重新加载</button></div>

  return <div className="site-shell">
    <header className="site-header"><a className="brand" href="?view=history" onClick={event => { event.preventDefault(); start(data.featuredQuestionIds[0]) }}><span className="brand-mark">史</span><span>历史之间<small>HISTORY, CONNECTED</small></span></a><div className="header-right"><span className="header-theme">主题 01 / {data.theme}</span><a href="/" className="header-link">返回阅读首页 ↗</a><a href="#journey" className="header-link">我的探索路径 <span>↗</span></a></div></header>
    <main>
      <section className="hero"><div className="hero-copy"><div className="hero-overline"><span className="overline-rule" /> EXPLORE THE PAST, ONE QUESTION AT A TIME</div><h1>从一个问题，<br /><em>走进一段历史。</em></h1><p>{data.intro}</p><div className="hero-meta"><span>01 / 精选主题</span><span>●</span><span>河流 · 城市 · 文明</span></div></div><div className="hero-art" aria-hidden="true"><span className="hero-sun"/><span className="hero-river river-one"/><span className="hero-river river-two"/><span className="hero-river river-three"/><span className="hero-art-caption">THE RIVER<br/>AND THE CITY</span></div></section>
      <section className="featured" aria-labelledby="featured-title"><div className="featured-label"><span className="kicker">START HERE / 精选问题</span><h2 id="featured-title">从这里出发</h2><p>选择一个问题，沿着线索向前。</p></div>{data.featuredQuestionIds.map(id => { const q = questions.get(id)!; return <button key={id} className="featured-card" onClick={() => start(id)}><span className="featured-number">01</span><span><small>精选探索入口</small><strong>{q.title}</strong><span>从水源、交换与风险三个方向开始理解。</span></span><span className="featured-arrow">↗</span></button> })}</section>
      <div className="content-grid"><div className="main-column">
        <section className="question-panel panel" aria-labelledby="question-title"><div className="question-top"><span className="kicker">CURRENT QUESTION / 当前问题</span><Status value={current.reviewStatus} /></div><p className="eyebrow">{current.eyebrow}</p><h2 id="question-title">{current.title}</h2><p className="lead">{current.summary}</p><div className="point-grid">{current.points.map((point, index) => <div className="point" key={point}><span>0{index + 1}</span><p>{point}</p></div>)}</div><div className="context-row"><div><small>年代</small><span>{current.context.period ?? '待确定'}</span></div><div><small>地点</small><span>{current.context.place ?? '待确定'}</span></div></div>{current.context.interpretationNote && <p className="interpretation"><strong>解释提示</strong>{current.context.interpretationNote}</p>}</section>
        <section className="next-section" aria-labelledby="next-title"><div className="section-heading"><div><span className="kicker">WHERE TO NEXT / 探索推荐</span><h2 id="next-title">下一步，想追问什么？</h2></div><span className="section-note">为你的问题精选 3 条路线</span></div><div className="recommendation-list">{recommendations.map((recommendation, index) => { const next = questions.get(recommendation.toQuestionId)!; return <button className="recommendation" key={next.id} onClick={() => { go(next.id); window.scrollTo({ top: 0, behavior: 'smooth' }) }}><span className="recommendation-index">0{index + 1}</span><span className="recommendation-copy"><small>{next.eyebrow}</small><strong>{next.title}</strong><span><b>推荐理由</b> {recommendation.reason}</span></span><span className="round-arrow">↗</span></button> })}</div></section>
        <KnowledgeMap data={data} currentId={current.id} />
        <section className="panel sources-panel" aria-labelledby="sources-title"><div className="section-heading"><div><span className="kicker">READ FURTHER / 延伸阅读</span><h2 id="sources-title">来源与进一步阅读</h2></div></div>{sources.length ? <div className="source-list">{sources.map(source => <a key={source.id} href={source.url} target="_blank" rel="noreferrer" className="source"><span className="source-icon">↗</span><span><strong>{source.title}</strong><small>{source.publisher} · {source.note}</small></span><Status value={source.reviewStatus} /></a>)}</div> : <p className="empty-sources">此问题的专门来源尚待审核。当前内容仅用于说明探索结构，请从已核对的起点资料继续阅读。</p>}<p className="source-caveat">“已核对”表示来源页面与所标注内容已对应；问题中的跨地区推论仍可能标为“待审核”。</p></section>
      </div><aside className="sidebar" id="journey"><div className="sidebar-sticky"><section className="journey-card"><div className="sidebar-heading"><span className="kicker">YOUR JOURNEY / 探索路径</span><span className="journey-count">{path.length.toString().padStart(2, '0')} 步</span></div><h2>你走过的问题</h2><ol className="path-list">{path.map((id, index) => <li key={`${id}-${index}`} className={index === path.length - 1 ? 'current' : ''}><span className="path-marker">{index + 1}</span><span>{questions.get(id)?.title}</span></li>)}</ol><button className="back-button" onClick={back} disabled={path.length < 2}>← 返回上一个问题</button><form onSubmit={save} className="save-form"><label htmlFor="path-title">为这段探索命名</label><input id="path-title" value={title} maxLength={80} onChange={event => setTitle(event.target.value)} placeholder="例如：沿河寻找城市" required /><button type="submit" disabled={saving}>{saving ? '保存中…' : '保存探索路径 ↗'}</button></form>{saveMessage && <p className="save-message" role="status">{saveMessage}</p>}</section><section className="saved-card"><div className="saved-heading"><span className="kicker">SAVED / 已保存</span><span>{savedPaths.length.toString().padStart(2, '0')}</span></div>{savedPaths.length ? <ul>{savedPaths.map(saved => <li key={saved.id}><button onClick={() => restore(saved)}><strong>{saved.title}</strong><small>{saved.questionIds.length} 个问题 · {new Date(saved.createdAt).toLocaleDateString('zh-CN')}</small></button></li>)}</ul> : <p>你的探索还没有保存。走过几步后，给它一个名字吧。</p>}</section></div></aside></div>
    </main><footer className="site-footer"><span className="brand-mini">史 · 历史之间</span><span>第一阶段示例 · 内容审校状态见各问题与关系</span></footer>
  </div>
}

export default App
