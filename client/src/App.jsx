import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Navbar from './components/Navbar';
import ProtectedRoute from './components/ProtectedRoute';
import Home from './pages/Home';
import AdminLogin from './pages/AdminLogin';
import AdminDashboard from './pages/AdminDashboard';
import VerifyQR from './pages/VerifyQR';
import QuizLanding from './pages/QuizLanding';
import QuizActive from './pages/QuizActive';
import QuizResult from './pages/QuizResult';
import QuizLeaderboard from './pages/QuizLeaderboard';
import QuizHostAdmin from './pages/QuizHostAdmin';
import './index.css';

function App() {
  return (
    <Router>
      <Navbar />
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/admin" element={<AdminLogin />} />
        <Route
          path="/admin/dashboard"
          element={
            <ProtectedRoute>
              <AdminDashboard />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/quiz-host"
          element={
            <ProtectedRoute>
              <QuizHostAdmin />
            </ProtectedRoute>
          }
        />
        <Route path="/verify/:token" element={<VerifyQR />} />
        
        {/* Quiz Competition Routes */}
        <Route path="/quiz" element={<QuizLanding />} />
        <Route path="/quiz/play" element={<QuizActive />} />
        <Route path="/quiz/result" element={<QuizResult />} />
        <Route path="/quiz/leaderboard" element={<QuizLeaderboard />} />
      </Routes>
    </Router>
  );
}

export default App;
