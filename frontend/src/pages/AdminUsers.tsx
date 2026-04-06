import React, { useState, useEffect } from 'react';
import GlassCard from '../components/GlassCard';
import { adminUsers } from '../services/api';

interface User {
  id: number;
  email: string;
  name: string;
  role: string;
}

const AdminUsers: React.FC = () => {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);
  const [newUser, setNewUser] = useState({ email: '', name: '', password: '', role: 'user' });
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const loadUsers = async () => {
    try {
      const data = await adminUsers.listUsers();
      setUsers(data.users);
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to load users');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadUsers();
  }, []);

  const handleAddUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    try {
      await adminUsers.createUser(newUser.email, newUser.name, newUser.password, newUser.role);
      setSuccess('User created successfully');
      setShowAddForm(false);
      setNewUser({ email: '', name: '', password: '', role: 'user' });
      loadUsers();
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to create user');
    }
  };

  const handleDeleteUser = async (userId: number) => {
    if (!confirm('Are you sure you want to delete this user?')) return;
    setError('');
    setSuccess('');
    try {
      await adminUsers.deleteUser(userId);
      setSuccess('User deleted successfully');
      loadUsers();
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to delete user');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-neon-green">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen p-8">
      <div className="max-w-7xl mx-auto">
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-3xl font-bold text-neon-green">User Management</h1>
            <p className="text-text-secondary">Manage registered users</p>
          </div>
          <button
            onClick={() => setShowAddForm(!showAddForm)}
            className="glass px-4 py-2 rounded-xl hover:bg-white/10 transition-colors text-neon-green"
          >
            {showAddForm ? 'Cancel' : '+ Add User'}
          </button>
        </div>

        {error && (
          <div className="bg-red-500/20 border border-red-500 text-red-400 px-4 py-2 rounded-xl mb-4">
            {error}
          </div>
        )}

        {success && (
          <div className="bg-green-500/20 border border-green-500 text-green-400 px-4 py-2 rounded-xl mb-4">
            {success}
          </div>
        )}

        {showAddForm && (
          <GlassCard className="mb-6">
            <h2 className="text-xl font-semibold mb-4">Add New User</h2>
            <form onSubmit={handleAddUser} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-text-secondary text-sm mb-2">Name</label>
                  <input
                    type="text"
                    value={newUser.name}
                    onChange={(e) => setNewUser({ ...newUser, name: e.target.value })}
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2 text-white focus:outline-none focus:border-neon-green"
                    required
                  />
                </div>
                <div>
                  <label className="block text-text-secondary text-sm mb-2">Email</label>
                  <input
                    type="email"
                    value={newUser.email}
                    onChange={(e) => setNewUser({ ...newUser, email: e.target.value })}
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2 text-white focus:outline-none focus:border-neon-green"
                    required
                  />
                </div>
                <div>
                  <label className="block text-text-secondary text-sm mb-2">Password</label>
                  <input
                    type="password"
                    value={newUser.password}
                    onChange={(e) => setNewUser({ ...newUser, password: e.target.value })}
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2 text-white focus:outline-none focus:border-neon-green"
                    placeholder="Default: changeme123"
                  />
                </div>
                <div>
                  <label className="block text-text-secondary text-sm mb-2">Role</label>
                  <select
                    value={newUser.role}
                    onChange={(e) => setNewUser({ ...newUser, role: e.target.value })}
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2 text-white focus:outline-none focus:border-neon-green"
                  >
                    <option value="user">User</option>
                    <option value="admin">Admin</option>
                  </select>
                </div>
              </div>
              <button
                type="submit"
                className="bg-neon-green text-black font-semibold px-6 py-2 rounded-xl hover:bg-neon-green/80 transition-colors"
              >
                Create User
              </button>
            </form>
          </GlassCard>
        )}

        <GlassCard>
          <h2 className="text-xl font-semibold mb-4">Registered Users ({users.length})</h2>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-white/10">
                  <th className="text-left text-text-secondary py-3 px-4">ID</th>
                  <th className="text-left text-text-secondary py-3 px-4">Name</th>
                  <th className="text-left text-text-secondary py-3 px-4">Email</th>
                  <th className="text-left text-text-secondary py-3 px-4">Role</th>
                  <th className="text-right text-text-secondary py-3 px-4">Actions</th>
                </tr>
              </thead>
              <tbody>
                {users.map((user) => (
                  <tr key={user.id} className="border-b border-white/5 hover:bg-white/5">
                    <td className="py-3 px-4 text-text-secondary">{user.id}</td>
                    <td className="py-3 px-4 text-white">{user.name}</td>
                    <td className="py-3 px-4 text-text-secondary">{user.email}</td>
                    <td className="py-3 px-4">
                      <span
                        className={`px-2 py-1 rounded-full text-xs ${
                          user.role === 'admin'
                            ? 'bg-purple-500/20 text-purple-400'
                            : 'bg-blue-500/20 text-blue-400'
                        }`}
                      >
                        {user.role}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right">
                      <button
                        onClick={() => handleDeleteUser(user.id)}
                        className="text-red-400 hover:text-red-300 text-sm"
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {users.length === 0 && (
              <p className="text-center text-text-secondary py-8">No users found</p>
            )}
          </div>
        </GlassCard>
      </div>
    </div>
  );
};

export default AdminUsers;