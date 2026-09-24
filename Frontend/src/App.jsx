import React from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { ChatLayout } from './components/layout/ChatLayout';
import { Chat } from './pages/Chat';
import { Login } from './pages/Auth/Login';

import './styles/globals.css';

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Login />} />
        
        <Route element={<ChatLayout />}>
          <Route path="/" element={<Chat />} />
          <Route path="/c/:chatId" element={<Chat />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

export default App;
