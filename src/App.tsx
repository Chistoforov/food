import GroceryTrackerApp from './GroceryTrackerApp'
import ErrorBoundary from './components/ErrorBoundary'

function App() {
  return (
    <ErrorBoundary>
      <GroceryTrackerApp />
    </ErrorBoundary>
  )
}

export default App

