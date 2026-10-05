import HistoryExplorer from './HistoryExplorer'
import ReadingWorkspace from './ReadingWorkspace'

function App() {
  const search = new URLSearchParams(window.location.search)
  return search.get('view') === 'history' || search.has('path')
    ? <HistoryExplorer />
    : <ReadingWorkspace />
}

export default App
