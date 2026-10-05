import { useEffect, useState, type FormEvent } from 'react'
import type { Book, Chapter, ExplorationMode, ReadingExcerpt, ReadingNote, ReadingSnapshot } from './readingTypes'
import './reading.css'

const modes: { id: ExplorationMode; number: string; title: string; short: string; prompts: string[] }[] = [
  { id: 'understand', number: '01', title: '读懂文字', short: '澄清字面与细节', prompts: ['这段话具体发生了什么？', '哪个词或画面最需要你停下来理解？'] },
  { id: 'question', number: '02', title: '提出问题', short: '留意叙述的空白', prompts: ['作者没有直接说明什么？', '你想带着哪个问题继续往下读？'] },
  { id: 'connect', number: '03', title: '建立联系', short: '把片段放回全书', prompts: ['它和前面的哪个细节互相呼应？', '你能找到一种不同的理解方式吗？'] },
  { id: 'reflect', number: '04', title: '留下想法', short: '记录自己的判断', prompts: ['读到这里，你的看法发生了什么变化？', '哪些判断仍值得保留疑问？'] },
]

type EntityKind = 'book' | 'chapter' | 'excerpt'
type Editor = { kind: EntityKind; id?: string }

async function api<T>(url: string, method = 'GET', body?: object): Promise<T> {
  const response = await fetch(url, {
    method,
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  })
  if (!response.ok) {
    const detail = await response.json().catch(() => null) as { error?: string } | null
    throw new Error(detail?.error ?? `请求失败 (${response.status})`)
  }
  return response.status === 204 ? undefined as T : response.json() as Promise<T>
}

function ReadingWorkspace() {
  const params = new URLSearchParams(window.location.search)
  const [snapshot, setSnapshot] = useState<ReadingSnapshot | null>(null)
  const [bookId, setBookId] = useState(params.get('book') ?? '')
  const [chapterId, setChapterId] = useState(params.get('chapter') ?? '')
  const [excerptId, setExcerptId] = useState(params.get('excerpt') ?? '')
  const [noteId, setNoteId] = useState(params.get('note') ?? '')
  const [mode, setMode] = useState<ExplorationMode>('understand')
  const [noteText, setNoteText] = useState('')
  const [editor, setEditor] = useState<Editor | null>(null)
  const [fieldA, setFieldA] = useState('')
  const [fieldB, setFieldB] = useState('')
  const [fieldC, setFieldC] = useState('')
  const [notice, setNotice] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  async function reload() { setSnapshot(await api<ReadingSnapshot>('/api/reading/')) }
  useEffect(() => { void reload().catch(cause => setError(cause instanceof Error ? cause.message : '无法加载阅读数据')) }, [])

  const books = snapshot?.books ?? []
  const book = books.find(item => item.id === bookId) ?? books[0]
  const chapters = snapshot?.chapters.filter(item => item.bookId === book?.id) ?? []
  const chapter = chapters.find(item => item.id === chapterId) ?? chapters[0]
  const excerpts = snapshot?.excerpts.filter(item => item.chapterId === chapter?.id) ?? []
  const excerpt = excerpts.find(item => item.id === excerptId) ?? excerpts[0]
  const selectedMode = modes.find(item => item.id === mode)!

  function location(nextBook?: string, nextChapter?: string, nextExcerpt?: string, nextNote?: string) {
    const query = new URLSearchParams()
    if (nextBook) query.set('book', nextBook)
    if (nextChapter) query.set('chapter', nextChapter)
    if (nextExcerpt) query.set('excerpt', nextExcerpt)
    if (nextNote) query.set('note', nextNote)
    window.history.replaceState({}, '', query.size ? `?${query}` : window.location.pathname)
  }
  function chooseBook(item: Book) { setBookId(item.id); setChapterId(''); setExcerptId(''); setNoteId(''); setNoteText(''); location(item.id); setNotice('') }
  function chooseChapter(item: Chapter) { setChapterId(item.id); setExcerptId(''); setNoteId(''); setNoteText(''); location(book?.id, item.id); setNotice('') }
  function chooseExcerpt(item: ReadingExcerpt) { setExcerptId(item.id); setNoteId(''); setNoteText(''); location(book?.id, chapter?.id, item.id); setNotice('') }
  function openNote(note: ReadingNote) {
    const parentExcerpt = snapshot?.excerpts.find(item => item.id === note.excerptId)
    const parentChapter = snapshot?.chapters.find(item => item.id === parentExcerpt?.chapterId)
    if (!parentExcerpt || !parentChapter) return
    setBookId(parentChapter.bookId); setChapterId(parentChapter.id); setExcerptId(parentExcerpt.id)
    setNoteId(note.id); setMode(note.mode); setNoteText(note.text); setNotice('已重新打开笔记，可继续编辑。')
    location(parentChapter.bookId, parentChapter.id, parentExcerpt.id, note.id)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  useEffect(() => {
    if (!snapshot || !noteId) return
    const saved = snapshot.notes.find(item => item.id === noteId)
    if (saved) { setMode(saved.mode); setNoteText(saved.text) }
  }, [snapshot, noteId])

  function openEditor(kind: EntityKind, id?: string) {
    setEditor({ kind, id }); setNotice('')
    if (kind === 'book') {
      const value = books.find(item => item.id === id)
      setFieldA(value?.title ?? ''); setFieldB(value?.author ?? ''); setFieldC(value?.description ?? '')
    } else if (kind === 'chapter') {
      const value = snapshot?.chapters.find(item => item.id === id)
      setFieldA(value?.title ?? ''); setFieldB(value?.summary ?? ''); setFieldC('')
    } else {
      const value = snapshot?.excerpts.find(item => item.id === id)
      setFieldA(value?.label ?? ''); setFieldB(value?.text ?? ''); setFieldC('')
    }
  }

  async function saveEntity(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!editor || busy) return
    setBusy(true); setError('')
    try {
      const { kind, id } = editor
      const endpoint = `/api/reading/${kind === 'book' ? 'books' : kind === 'chapter' ? 'chapters' : 'excerpts'}`
      const payload = kind === 'book' ? { title: fieldA, author: fieldB, description: fieldC }
        : kind === 'chapter' ? { ...(id ? {} : { bookId: book!.id }), title: fieldA, summary: fieldB }
          : { ...(id ? {} : { chapterId: chapter!.id }), label: fieldA, text: fieldB }
      const created = await api<{ id: string } | undefined>(id ? `${endpoint}/${id}` : endpoint, id ? 'PUT' : 'POST', payload)
      await reload()
      if (!id && created) {
        if (kind === 'book') { setBookId(created.id); setChapterId(''); setExcerptId(''); location(created.id) }
        if (kind === 'chapter') { setChapterId(created.id); setExcerptId(''); location(book?.id, created.id) }
        if (kind === 'excerpt') { setExcerptId(created.id); location(book?.id, chapter?.id, created.id) }
      }
      setEditor(null); setNotice(id ? '修改已保存。' : '内容已加入书架。')
    } catch (cause) { setError(cause instanceof Error ? cause.message : '保存失败') }
    finally { setBusy(false) }
  }

  async function removeEntity(kind: EntityKind, id: string, title: string) {
    const warning = kind === 'book' ? '删除书籍会同时删除章节、片段和笔记。' : kind === 'chapter' ? '删除章节会同时删除片段和笔记。' : '删除片段会同时删除关联笔记。'
    if (!window.confirm(`确定删除「${title}」？${warning}`)) return
    setBusy(true); setError('')
    try {
      const plural = kind === 'book' ? 'books' : kind === 'chapter' ? 'chapters' : 'excerpts'
      await api(`/api/reading/${plural}/${id}`, 'DELETE')
      await reload()
      if (kind === 'book') { setBookId(''); setChapterId(''); setExcerptId('') }
      if (kind === 'chapter') { setChapterId(''); setExcerptId('') }
      if (kind === 'excerpt') setExcerptId('')
      setNoteId(''); setNoteText(''); location(kind === 'book' ? undefined : book?.id)
      setNotice('已删除。')
    } catch (cause) { setError(cause instanceof Error ? cause.message : '删除失败') }
    finally { setBusy(false) }
  }

  async function saveNote(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!excerpt || !noteText.trim() || busy) return
    setBusy(true); setError('')
    try {
      const saved = await api<ReadingNote | undefined>(noteId ? `/api/reading/notes/${noteId}` : '/api/reading/notes', noteId ? 'PUT' : 'POST', noteId ? { mode, text: noteText } : { excerptId: excerpt.id, mode, text: noteText })
      if (saved) { setNoteId(saved.id); location(book?.id, chapter?.id, excerpt.id, saved.id) }
      await reload(); setNotice('笔记已保存，并与当前片段关联。')
    } catch (cause) { setError(cause instanceof Error ? cause.message : '笔记保存失败') }
    finally { setBusy(false) }
  }
  async function removeNote() {
    if (!noteId || !window.confirm('确定删除这条笔记？')) return
    setBusy(true)
    try { await api(`/api/reading/notes/${noteId}`, 'DELETE'); await reload(); setNoteId(''); setNoteText(''); location(book?.id, chapter?.id, excerpt?.id); setNotice('笔记已删除。') }
    catch (cause) { setError(cause instanceof Error ? cause.message : '删除失败') }
    finally { setBusy(false) }
  }

  if (error && !snapshot) return <div className="app-state">{error} <button onClick={() => window.location.reload()}>重试</button></div>
  if (!snapshot) return <div className="app-state">正在打开书架…</div>

  return <div className="reading-site">
    <header className="reading-header"><a className="reading-logo" href="/"><span>读</span><strong>深读之间<small>READING COMPANION</small></strong></a><nav><a className="active" href="/">阅读工作台</a><a href="?view=history">历史演示 ↗</a></nav></header>
    <main className="reading-main">
      <div className="reading-intro"><div><span className="reading-kicker">A PLACE TO THINK WITH TEXT</span><h1>把读过的文字，<em>读得更深。</em></h1><p>选择书籍与片段，沿着四种问题慢慢探索。这里保存你的想法，不替你生成答案。</p></div><span className="reading-intro-mark" aria-hidden="true">“</span></div>
      {error && <p className="reading-error" role="alert">{error}</p>}
      {notice && <p className="reading-notice" role="status">{notice}</p>}
      <div className="reading-grid">
        <aside className="reading-rail"><div className="rail-top"><span className="reading-kicker">LIBRARY / 书架</span><button onClick={() => openEditor('book')}>＋ 新建书籍</button></div><h2>正在阅读</h2><div className="book-list">{books.map(item => <button key={item.id} className={`book-item${item.id === book?.id ? ' selected' : ''}`} onClick={() => chooseBook(item)}><span className="book-spine" aria-hidden="true">▌</span><span><strong>{item.title}</strong><small>{item.author || '未注明作者'}</small></span><span>↗</span></button>)}</div>{book ? <div className="rail-details"><p>{book.description}</p><div className="text-actions"><button onClick={() => openEditor('book', book.id)}>编辑书籍</button><button onClick={() => void removeEntity('book', book.id, book.title)}>删除</button></div></div> : <p className="rail-empty">新建一本书，从片段开始阅读。</p>}<a className="legacy-entry" href="?view=history"><span>历史探索演示</span><strong>为什么古代城市经常建在河边？ ↗</strong></a></aside>
        <div className="reading-content">{book ? <>
          <section className="reading-card chapter-card"><div className="reading-section-head"><div><span className="reading-kicker">01 / CHAPTERS</span><h2>章节目录</h2></div><button className="quiet-button" onClick={() => openEditor('chapter')}>＋ 添加章节</button></div><div className="chapter-list">{chapters.length ? chapters.map(item => <button key={item.id} className={`chapter-item${item.id === chapter?.id ? ' selected' : ''}`} onClick={() => chooseChapter(item)}><span>{String(item.position).padStart(2, '0')}</span><span><strong>{item.title}</strong><small>{item.summary}</small></span><span>→</span></button>) : <p className="reading-empty">还没有章节。先添加一章。</p>}</div>{chapter && <div className="entity-actions"><button onClick={() => openEditor('chapter', chapter.id)}>编辑当前章节</button><button onClick={() => void removeEntity('chapter', chapter.id, chapter.title)}>删除章节</button></div>}</section>
          {chapter && <section className="reading-card excerpt-card"><div className="reading-section-head"><div><span className="reading-kicker">02 / EXCERPTS</span><h2>阅读片段</h2></div><button className="quiet-button" onClick={() => openEditor('excerpt')}>＋ 添加片段</button></div><div className="excerpt-tabs">{excerpts.map(item => <button className={item.id === excerpt?.id ? 'selected' : ''} key={item.id} onClick={() => chooseExcerpt(item)}>{item.label}</button>)}</div>{excerpt ? <><div className="excerpt-paper"><div className="excerpt-caption"><span>片段 {String(excerpt.position).padStart(2, '0')} · {chapter.title}</span><span>原创示例 / 用户内容</span></div><blockquote>{excerpt.text}</blockquote></div><div className="entity-actions"><button onClick={() => openEditor('excerpt', excerpt.id)}>编辑片段</button><button onClick={() => void removeEntity('excerpt', excerpt.id, excerpt.label)}>删除片段</button></div></> : <p className="reading-empty">这一章还没有片段。添加一段文字开始探索。</p>}</section>}
          {excerpt && <section className="reading-card explore-card"><div className="reading-section-head"><div><span className="reading-kicker">03 / EXPLORE</span><h2>从哪里开始深读？</h2></div><span className="small-muted">选择一种探索入口</span></div><div className="mode-grid">{modes.map(item => <button key={item.id} className={`mode-card${mode === item.id ? ' selected' : ''}`} onClick={() => setMode(item.id)}><span>{item.number}</span><strong>{item.title}</strong><small>{item.short}</small></button>)}</div><div className="prompt-box"><span className="reading-kicker">GUIDING QUESTIONS / 引导问题</span><h3>{selectedMode.title}</h3><ul>{selectedMode.prompts.map(prompt => <li key={prompt}>{prompt}</li>)}</ul><p>这些问题只供启发。请根据你读到的文字记录自己的观察。</p></div><form className="note-form" onSubmit={saveNote}><label htmlFor="reading-note">我的阅读记录 {noteId && <span>· 正在编辑已保存的笔记</span>}</label><textarea id="reading-note" value={noteText} onChange={event => setNoteText(event.target.value)} maxLength={5000} placeholder="写下你注意到的细节、疑问或新的理解…" required /><div className="note-form-bottom"><span>{noteText.length} / 5000 字</span><div>{noteId && <button type="button" className="quiet-button" onClick={() => { setNoteId(''); setNoteText(''); location(book.id, chapter?.id, excerpt.id) }}>新建一条</button>}<button type="submit" className="primary-button" disabled={busy || !noteText.trim()}>{busy ? '保存中…' : noteId ? '更新笔记 →' : '保存笔记 →'}</button></div></div>{noteId && <button type="button" className="delete-note" onClick={() => void removeNote()}>删除这条笔记</button>}</form></section>}
        </> : <div className="reading-card reading-empty">书架还是空的。新建一本书开始。</div>}</div>
        <aside className="notes-rail"><div className="notes-rail-head"><span className="reading-kicker">SAVED NOTES / 阅读笔记</span><strong>{snapshot.notes.length.toString().padStart(2, '0')}</strong></div><h2>稍后继续读</h2>{snapshot.notes.length ? <div className="saved-notes">{snapshot.notes.map(note => { const noteExcerpt = snapshot.excerpts.find(item => item.id === note.excerptId); const noteChapter = snapshot.chapters.find(item => item.id === noteExcerpt?.chapterId); return <button key={note.id} className={note.id === noteId ? 'selected' : ''} onClick={() => openNote(note)}><span>{modes.find(item => item.id === note.mode)?.title} · {noteExcerpt?.label}</span><strong>{note.text}</strong><small>{noteChapter?.title} · {new Date(note.updatedAt).toLocaleDateString('zh-CN')}</small></button> })}</div> : <p className="reading-empty">保存一条笔记后，它会出现在这里。点击可重新打开并编辑。</p>}<div className="notes-tip"><span>✧</span><p>阅读的意义，常常从一个尚未回答的问题开始。</p></div></aside>
      </div>
    </main><footer className="reading-footer"><span>深读之间 · 第一阶段</span><span>示例片段为本站原创 · 不接入 AI · 不生成回答</span></footer>
    {editor && <div className="editor-backdrop" role="presentation" onMouseDown={event => { if (event.target === event.currentTarget) setEditor(null) }}><section className="editor-dialog" role="dialog" aria-modal="true" aria-labelledby="editor-title"><div className="editor-head"><span className="reading-kicker">LIBRARY EDITOR</span><button onClick={() => setEditor(null)} aria-label="关闭">×</button></div><h2 id="editor-title">{editor.id ? '编辑' : '添加'}{editor.kind === 'book' ? '书籍' : editor.kind === 'chapter' ? '章节' : '片段'}</h2><form onSubmit={saveEntity}><label>{editor.kind === 'excerpt' ? '片段标题' : '标题'}<input value={fieldA} maxLength={120} onChange={event => setFieldA(event.target.value)} required autoFocus /></label>{editor.kind === 'book' && <label>作者或署名<input value={fieldB} maxLength={120} onChange={event => setFieldB(event.target.value)} /></label>}<label>{editor.kind === 'book' ? '简介' : editor.kind === 'chapter' ? '章节简介' : '片段文字'}<textarea value={editor.kind === 'book' ? fieldC : fieldB} maxLength={editor.kind === 'excerpt' ? 5000 : 1000} required={editor.kind === 'excerpt'} onChange={event => editor.kind === 'book' ? setFieldC(event.target.value) : setFieldB(event.target.value)} /></label><div className="editor-actions"><button type="button" onClick={() => setEditor(null)}>取消</button><button type="submit" className="primary-button" disabled={busy}>{busy ? '保存中…' : '保存'}</button></div></form></section></div>}
  </div>
}

export default ReadingWorkspace
