import React from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { MobileShell } from './mobile/MobileShell';
import { ResidentStandaloneAppPage } from './mobile/pages/ResidentStandaloneAppPage';

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/resident-app/*" element={<ResidentStandaloneAppPage />} />
        <Route path="/resident-app" element={<ResidentStandaloneAppPage />} />
        <Route path="/m/*" element={<MobileShell />} />
        <Route path="/m" element={<MobileShell />} />
        <Route path="/" element={<Navigate to="/m" replace />} />
        <Route path="*" element={<Navigate to="/m" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
