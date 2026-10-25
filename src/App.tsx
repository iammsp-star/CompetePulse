import { BrowserRouter, Route, Routes } from 'react-router-dom';
import { Layout } from './components/Layout';
import { ToastProvider } from './components/Toast';
import { AskPage } from './views/Ask';
import { CompetitorDetailPage } from './views/CompetitorDetail';
import { CompetitorsPage } from './views/Competitors';
import { DigestPage } from './views/Digest';
import { FeedPage } from './views/Feed';
import { MatrixPage } from './views/Matrix';
import { NotFoundPage } from './views/NotFound';
import { OverviewPage } from './views/Overview';
import { SettingsPage } from './views/Settings';

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
