import GroceryTrackerApp from './GroceryTrackerApp'
import ErrorBoundary from './components/ErrorBoundary'
import { AuthProvider } from './contexts/AuthContext'

function App() {
  return (
    <ErrorBoundary>
      <AuthProvider>
        <GroceryTrackerApp />
      </AuthProvider>
    </ErrorBoundary>
  )
}

export default App
