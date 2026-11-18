import { Navigate, Outlet, Route, Routes } from 'react-router-dom';
import { useAuth } from './auth.jsx';
import Layout from './components/Layout.jsx';
import AuthPage from './pages/AuthPage.jsx';
import Dashboard from './pages/Dashboard.jsx';
import Courses from './pages/Courses.jsx';
import Course from './pages/Course.jsx';
import Lesson from './pages/Lesson.jsx';
import Playground from './pages/Playground.jsx';
import Profile from './pages/Profile.jsx';
import Practice from './pages/Practice.jsx';
import Challenge from './pages/Challenge.jsx';
import Assessments from './pages/Assessments.jsx';
import AssessmentDetail from './pages/AssessmentDetail.jsx';
import AssessmentAttempt from './pages/AssessmentAttempt.jsx';
import Projects from './pages/Projects.jsx';
import Project from './pages/Project.jsx';
import Verify from './pages/Verify.jsx';
import Portfolio from './pages/Portfolio.jsx';
import Achievements from './pages/Achievements.jsx';
import Leaderboard from './pages/Leaderboard.jsx';
import Community from './pages/Community.jsx';
import Thread from './pages/Thread.jsx';
import Admin from './pages/Admin.jsx';
import ForgotPassword from './pages/ForgotPassword.jsx';
import ResetPassword from './pages/ResetPassword.jsx';
import VerifyEmail from './pages/VerifyEmail.jsx';
import Explore from './pages/Explore.jsx';
import SharedProgram from './pages/SharedProgram.jsx';

function Protected() {
  const { user, loading } = useAuth();
  if (loading) return <div className="center muted">Loading…</div>;
  if (!user) return <Navigate to="/login" replace />;
  return (
    <Layout>
      <Outlet />
    </Layout>
  );
}

export default function App() {
  const { user, loading } = useAuth();
  return (
    <Routes>
      <Route path="/login" element={!loading && user ? <Navigate to="/" replace /> : <AuthPage mode="login" />} />
      <Route path="/register" element={!loading && user ? <Navigate to="/" replace /> : <AuthPage mode="register" />} />
      <Route path="/forgot-password" element={<ForgotPassword />} />
      <Route path="/reset-password" element={<ResetPassword />} />
      <Route path="/verify-email" element={<VerifyEmail />} />
      <Route path="/verify/:code" element={<Verify />} />
      <Route path="/portfolio/u/:id" element={<Portfolio />} />
      <Route path="/s/:token" element={<SharedProgram />} />
      <Route element={<Protected />}>
        <Route path="/" element={<Dashboard />} />
        <Route path="/learn" element={<Courses />} />
        <Route path="/learn/:course" element={<Course />} />
        <Route path="/learn/:course/:lesson" element={<Lesson />} />
        <Route path="/practice" element={<Practice />} />
        <Route path="/practice/:slug" element={<Challenge />} />
        <Route path="/assessments" element={<Assessments />} />
        <Route path="/assessments/attempt/:id" element={<AssessmentAttempt />} />
        <Route path="/assessments/:slug" element={<AssessmentDetail />} />
        <Route path="/projects" element={<Projects />} />
        <Route path="/projects/:slug" element={<Project />} />
        <Route path="/portfolio" element={<Portfolio />} />
        <Route path="/achievements" element={<Achievements />} />
        <Route path="/leaderboard" element={<Leaderboard />} />
        <Route path="/community" element={<Community />} />
        <Route path="/community/:id" element={<Thread />} />
        <Route path="/admin" element={<Admin />} />
        <Route path="/playground" element={<Playground />} />
        <Route path="/explore" element={<Explore />} />
        <Route path="/profile" element={<Profile />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
