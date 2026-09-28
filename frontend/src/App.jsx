import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, ProtectedRoute, PublicRoute } from './auth/AuthContext';
import { ChatLayout } from './components/layout/ChatLayout';
import { Chat } from './pages/Chat';
import { Login } from './pages/Auth/Login';
import { Settings } from './pages/Settings';
import { Billing } from './pages/Billing';

import './styles/globals.css';

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<PublicRoute><Login initialMode="signin" /></PublicRoute>} />
          <Route path="/register" element={<PublicRoute><Login initialMode="signup" /></PublicRoute>} />

          <Route element={<ProtectedRoute><ChatLayout /></ProtectedRoute>}>
            <Route path="/" element={<Chat />} />
            <Route path="/c/:chatId" element={<Chat />} />
            <Route path="/settings" element={<Settings />} />
            <Route path="/billing" element={<Billing />} />
          </Route>
          <Route path="*" element={<Navigate to="/login" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;
