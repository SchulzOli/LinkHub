import { AppProviders } from './app/providers/AppProviders'
import { WorkspaceRoute } from './app/routes/WorkspaceRoute'

function App() {
  return (
    <AppProviders>
      <WorkspaceRoute />
    </AppProviders>
  )
}

export default App
