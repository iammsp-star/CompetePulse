import { BrowserRouter, Route, Routes } from 'react-router-dom';
import { Layout } from './components/Layout';
import { ToastProvider } from './components/Toast';
import { AskPage } from './pages/Ask';
import { CompetitorDetailPage } from './pages/CompetitorDetail';
import { CompetitorsPage } from './pages/Competitors';
import { DigestPage } from './pages/Digest';
import { FeedPage } from './pages/Feed';
import { MatrixPage } from './pages/Matrix';
import { NotFoundPage } from './pages/NotFound';
import { OverviewPage } from './pages/Overview';
import { SettingsPage } from './pages/Settings';

export default function App() {
  return (
    <ToastProvider>
      <BrowserRouter>
        <Routes>
          <Route element={<Layout />}>
            <Route path="/" element={<OverviewPage />} />
            <Route path="/feed" element={<FeedPage />} />
            <Route path="/competitors" element={<CompetitorsPage />} />
            <Route path="/competitors/:id" element={<CompetitorDetailPage />} />
            <Route path="/matrix" element={<MatrixPage />} />
            <Route path="/ask" element={<AskPage />} />
            <Route path="/digest" element={<DigestPage />} />
            <Route path="/settings" element={<SettingsPage />} />
            <Route path="*" element={<NotFoundPage />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </ToastProvider>
  );
}
