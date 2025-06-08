import { Router, Route } from 'electron-router-dom'
import { JSX } from 'react/jsx-runtime'
import PDVInterface from './pages/PDVInterface'

const AppRoutes = (): JSX.Element => {
  return (
    <Router
      main={
        <>
          <Route path="/" element={ <PDVInterface />} >
            
          </Route>
        </>
      }
    />
  )
}

export default AppRoutes