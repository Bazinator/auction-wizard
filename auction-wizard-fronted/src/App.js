import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { isAuthenticated } from './utils/auth';

// Page imports
import Login from './pages/login';
import SignUp from './pages/SignUp';
import ItemSniper from './pages/ItemSniper';
import ImportingItems from './pages/ImportingItems';
import Leaderboard from './pages/Leaderboard';
import LandingPage from './pages/LandingPage';
import NavBar from './components/NavBar';

// Protected Route component with NavBar
const ProtectedRoute = ({ children }) => {
  if (!isAuthenticated()) {
    return <Navigate to="/login" replace />;
  }
  return (
    <>
      <NavBar />
      <div style={{ paddingTop: '80px' }}>
        {children}
      </div>
    </>
  );
};

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/login" element={<Login />} />
        <Route path="/signup" element={<SignUp />} />
        <Route
          path="/sniper"
          element={
            <ProtectedRoute>
              <ItemSniper />
            </ProtectedRoute>
          }
        />
        <Route
          path="/items"
          element={
            <ProtectedRoute>
              <ImportingItems />
            </ProtectedRoute>
          }
        />
        <Route
          path="/leaderboard"
          element={
            <ProtectedRoute>
              <Leaderboard />
            </ProtectedRoute>
          }
        />
      </Routes>
    </Router>
  );
}

export default App;
