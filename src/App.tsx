import GroceryTrackerApp from './GroceryTrackerApp'
import ErrorBoundary from './components/ErrorBoundary'
import { AuthProvider } from './contexts/AuthContext'
import { LanguageProvider } from './contexts/LanguageContext'

function App() {
  return (
    <ErrorBoundary>
      <AuthProvider>
        <LanguageProvider>
          <GroceryTrackerApp />
        </LanguageProvider>
      </AuthProvider>
    </ErrorBoundary>
  )
}

export default App
