import { AppProviders } from './app/providers/AppProviders'
import { WorkspaceScreen } from './components/canvas/WorkspaceScreen'

function App() {
  return (
    <AppProviders>
      <WorkspaceScreen />
    </AppProviders>
  )
}

export default App
