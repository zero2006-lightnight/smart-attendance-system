import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import GlassCard from '../components/GlassCard';
import CameraFeed from '../components/CameraFeed';
import LivenessChecker from '../components/LivenessChecker';
import { auth } from '../services/api';

interface User {
  id: number;
  email: string;
  name: string;
  role: string;
}

interface AttendanceStats {
  present: number;
  total: number;
}

const Dashboard: React.FC = () => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [showLiveness, setShowLiveness] = useState(false);
  const [livenessVerified, setLivenessVerified] = useState(false);
  const [securityAlerts, setSecurityAlerts] = useState<string[]>([]);
  const [attendanceStats, setAttendanceStats] = useState<AttendanceStats>({ present: 0, total: 0 });
  const navigate = useNavigate();

  useEffect(() => {
    const loadUser = async () => {
      const token = localStorage.getItem('token');
      if (!token) {
        navigate('/login');
        return;
      }
      try {
        const userData = await auth.getMe();
        setUser(userData);
      } catch (err) {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        navigate('/login');
      } finally {
        setLoading(false);
      }
    };
    loadUser();
  }, [navigate]);

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    navigate('/login');
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-neon-green">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex">
      {/* Sidebar */}
      <div className="w-64 bg-white/5 border-r border-white/10 p-6">
        <div className="mb-8">
          <h2 className="text-2xl font-bold text-neon-green">Smart<br/>Attendance</h2>
        </div>
        
        <nav className="space-y-2">
          <button
            onClick={() => navigate('/dashboard')}
            className="w-full text-left px-4 py-3 rounded-xl bg-white/10 text-white hover:bg-white/20 transition-colors"
          >
            Dashboard
          </button>
          
          {user?.role === 'admin' && (
            <button
              onClick={() => navigate('/admin/users')}
              className="w-full text-left px-4 py-3 rounded-xl text-text-secondary hover:bg-white/10 hover:text-white transition-colors"
            >
              User Management
            </button>
          )}
          
          <button
            onClick={() => navigate('/enroll-face')}
            className="w-full text-left px-4 py-3 rounded-xl text-text-secondary hover:bg-white/10 hover:text-white transition-colors"
          >
            Face Enrollment
          </button>
        </nav>
        
        <div className="absolute bottom-6 left-6 w-48">
          <div className="text-text-secondary text-sm mb-2">
            Signed in as<br/>
            <span className="text-white">{user?.name}</span>
          </div>
          <button
            onClick={handleLogout}
            className="text-red-400 hover:text-red-300 text-sm"
          >
            Logout
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 p-8">
        <div className="max-w-7xl mx-auto">
          <div className="flex justify-between items-center mb-8">
            <div>
              <h1 className="text-3xl font-bold text-neon-green">Dashboard</h1>
              <p className="text-text-secondary">Welcome, {user?.name}</p>
            </div>
            <span className={`px-3 py-1 rounded-full text-sm ${
              user?.role === 'admin' 
                ? 'bg-purple-500/20 text-purple-400' 
                : 'bg-blue-500/20 text-blue-400'
            }`}>
              {user?.role}
            </span>
          </div>

          {/* Bento Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {/* Live Camera Feed - Large */}
            <GlassCard className="col-span-1 lg:col-span-2 row-span-2 min-h-[400px]">
              <h2 className="text-xl font-semibold mb-4">Live Camera Feed</h2>
              {!livenessVerified ? (
                <div className="bg-black/50 rounded-xl aspect-video flex flex-col items-center justify-center">
                  {!showLiveness ? (
                    <>
                      <svg className="w-16 h-16 text-text-secondary opacity-50 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                      </svg>
                      <p className="text-text-secondary mb-4">Start camera to mark attendance</p>
                      <button
                        onClick={() => setShowLiveness(true)}
                        className="px-6 py-2 bg-neon-green/20 text-neon-green rounded-lg hover:bg-neon-green/30 transition-colors"
                      >
                        Start Attendance
                      </button>
                    </>
                  ) : (
                    <div className="w-full max-w-md">
                      <button
                        onClick={() => setShowLiveness(false)}
                        className="mb-4 text-sm text-text-secondary hover:text-white"
                      >
                        ← Back
                      </button>
                      <LivenessChecker
                        onVerified={() => setLivenessVerified(true)}
                        onComplete={(success) => {
                          if (!success) {
                            setSecurityAlerts(prev => [...prev, `Liveness check failed at ${new Date().toLocaleTimeString()}`]);
                          }
                        }}
                      />
                    </div>
                  )}
                </div>
              ) : (
                <div className="relative">
                  <CameraFeed
                    onAttendanceMarked={(matchedUser) => {
                      setAttendanceStats(prev => ({ ...prev, present: prev.present + 1 }));
                      setSecurityAlerts(prev => [...prev, `Attendance marked for ${matchedUser.name}`]);
                    }}
                  />
                  <div className="mt-4 flex gap-4">
                    <button
                      onClick={() => {
                        setLivenessVerified(false);
                        setShowLiveness(false);
                      }}
                      className="text-sm text-text-secondary hover:text-white"
                    >
                      Reset
                    </button>
                  </div>
                </div>
              )}
            </GlassCard>

            {/* Attendance Stats - Small */}
            <GlassCard>
              <h2 className="text-lg font-semibold mb-4">Today's Attendance</h2>
              <div className="text-4xl font-bold text-neon-green mb-2">{attendanceStats.present}</div>
              <p className="text-text-secondary text-sm">Present today</p>
            </GlassCard>

            {/* System Health - Small */}
            <GlassCard>
              <h2 className="text-lg font-semibold mb-4">System Health</h2>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 bg-neon-green rounded-full animate-pulse"></div>
                <span className="text-text-secondary">All systems operational</span>
              </div>
            </GlassCard>

            {/* Recent Logs - Medium */}
            <GlassCard className="col-span-1 lg:col-span-2">
              <h2 className="text-lg font-semibold mb-4">Recent Activity</h2>
              <div className="space-y-3">
                <div className="flex items-center justify-between py-2 border-b border-white/10">
                  <span className="text-text-secondary">No recent activity</span>
                  <span className="text-sm text-text-secondary">--</span>
                </div>
              </div>
            </GlassCard>

            {/* Fraud Alerts - Small */}
            <GlassCard className="md:col-span-2 lg:col-span-2">
              <h2 className="text-lg font-semibold mb-4">Security Alerts</h2>
              {securityAlerts.length === 0 ? (
                <div className="flex items-center gap-2 text-text-secondary">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                  </svg>
                  <span>No security alerts</span>
                </div>
              ) : (
                <div className="space-y-2">
                  {securityAlerts.slice(-3).map((alert, idx) => (
                    <div key={idx} className="flex items-center gap-2 text-sm">
                      <span className="w-2 h-2 bg-yellow-500 rounded-full"></span>
                      <span className="text-text-secondary">{alert}</span>
                    </div>
                  ))}
                </div>
              )}
            </GlassCard>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;