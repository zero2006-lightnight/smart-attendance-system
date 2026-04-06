import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { auth } from '../services/api';

export default function Login() {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [error, setError] = useState('');
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    try {
      if (isLogin) {
        const data = await auth.login(email, password);
        localStorage.setItem('token', data.access_token);
        localStorage.setItem('user', JSON.stringify(data.user));
        navigate('/dashboard');
      } else {
        await auth.register(email, password, name);
        setIsLogin(true);
        setError('Registration successful! Please login.');
      }
    } catch (err: any) {
      setError(err.response?.data?.detail || 'An error occurred');
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="glass-card p-8 w-full max-w-md">
        <h1 className="text-3xl font-bold text-center neon-green mb-8">
          Smart Attendance
        </h1>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          {!isLogin && (
            <input
              type="text"
              placeholder="Name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full p-3 rounded bg-white/5 border border-glass-border text-white"
              required={!isLogin}
            />
          )}
          <input
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full p-3 rounded bg-white/5 border border-glass-border text-white"
            required
          />
          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full p-3 rounded bg-white/5 border border-glass-border text-white"
            required
          />
          
          {error && <p className="text-red-400 text-sm">{error}</p>}
          
          <button
            type="submit"
            className="w-full p-3 rounded bg-green-600 hover:bg-green-700 text-white font-semibold"
          >
            {isLogin ? 'Login' : 'Register'}
          </button>
        </form>
        
        <p className="text-center mt-4 text-gray-400">
          {isLogin ? "Don't have an account? " : "Already have an account? "}
          <button
            onClick={() => setIsLogin(!isLogin)}
            className="text-green-400 hover:underline"
          >
            {isLogin ? 'Register' : 'Login'}
          </button>
        </p>
      </div>
    </div>
  );
}
