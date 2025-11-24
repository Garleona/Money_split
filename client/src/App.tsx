import React, { useEffect, useState } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import RegistrationPage from './pages/RegistrationPage';
import WelcomePage from './pages/WelcomePage';
import JoinGroupPage from './pages/JoinGroupPage';

interface User {
  id: number;
  email: string;
  nickname?: string;
}

function App() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Check if user is logged in
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 2000); // 2s timeout

    fetch('/api/me', {
      credentials: 'include', // Send cookies
      signal: controller.signal
    })
      .then((res) => {
        if (res.ok) return res.json();
        throw new Error('Not logged in');
      })
      .then((data) => {
        setUser(data.user);
      })
      .catch((err) => {
        // If it's a timeout or connection error, just assume not logged in
        console.log("Session check failed or timed out", err);
        setUser(null);
      })
      .finally(() => {
        clearTimeout(timeoutId);
        setLoading(false);
      });

      return () => {
        controller.abort();
        clearTimeout(timeoutId);
      };
  }, []);

  const handleLogin = (userData: User) => {
    setUser(userData);
  };

  const handleLogout = () => {
    fetch('/api/logout', { method: 'POST', credentials: 'include' })
      .then(() => setUser(null));
  };

  if (loading) return <div>Loading...</div>;

  return (
    <Router>
      <Routes>
        <Route 
          path="/" 
          element={!user ? <RegistrationPage onLogin={handleLogin} /> : <Navigate to="/welcome" />} 
        />
        <Route 
          path="/welcome" 
          element={user ? <WelcomePage user={user} onLogout={handleLogout} /> : <Navigate to="/" />} 
        />
        <Route 
            path="/join" 
            element={<JoinGroupPage user={user} onLogin={handleLogin} />} 
        />
      </Routes>
    </Router>
  );
}

export default App;
