import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { api } from '../api/client';

interface AiosUser {
  id: string;
  email: string;
  name: string;
  role: string;
  isActive: boolean;
  isEmailVerified: boolean;
  mfaEnabled: boolean;
}

export function UserManagementPage() {
  const [users, setUsers] = useState<AiosUser[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({ email: '', name: '', password: '', role: 'READ_ONLY_VIEWER' });
  const [creating, setCreating] = useState(false);

  function loadUsers() {
    api.get<AiosUser[]>('/auth/users').then(setUsers).catch((err) => setError((err as Error).message));
  }

  useEffect(loadUsers, []);

  async function handleCreate(e: FormEvent) {
    e.preventDefault();
    setCreating(true);
    setError(null);
    try {
      await api.post('/auth/register', form);
      setForm({ email: '', name: '', password: '', role: 'READ_ONLY_VIEWER' });
      loadUsers();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setCreating(false);
    }
  }

  async function toggleActive(user: AiosUser) {
    await api.patch(`/auth/users/${user.id}/active`, { isActive: !user.isActive });
    loadUsers();
  }

  return (
    <div>
      <h1>User Management</h1>
      {error && <p style={{ color: 'crimson' }}>{error}</p>}

      <table style={{ borderCollapse: 'collapse', width: '100%', marginTop: 16 }}>
        <thead>
          <tr>
            <th style={headerStyle}>Name</th>
            <th style={headerStyle}>Email</th>
            <th style={headerStyle}>Role</th>
            <th style={headerStyle}>Active</th>
            <th style={headerStyle}>MFA</th>
            <th style={headerStyle}></th>
          </tr>
        </thead>
        <tbody>
          {users.map((u) => (
            <tr key={u.id}>
              <td style={cellStyle}>{u.name}</td>
              <td style={cellStyle}>{u.email}</td>
              <td style={cellStyle}>{u.role}</td>
              <td style={cellStyle}>{u.isActive ? 'Yes' : 'No'}</td>
              <td style={cellStyle}>{u.mfaEnabled ? 'Enabled' : 'Disabled'}</td>
              <td style={cellStyle}>
                <button onClick={() => toggleActive(u)}>{u.isActive ? 'Deactivate' : 'Activate'}</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <h2 style={{ marginTop: 32 }}>Create user</h2>
      <form onSubmit={handleCreate} style={{ maxWidth: 320 }}>
        <input placeholder="Name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required style={inputStyle} />
        <input placeholder="Email" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required style={inputStyle} />
        <input placeholder="Password" type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} required style={inputStyle} />
        <select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })} style={inputStyle}>
          {['READ_ONLY_VIEWER', 'TECHNICIAN', 'SERVICE_ADVISOR', 'GARAGE_MANAGER', 'BRANCH_MANAGER', 'GENERAL_MANAGER'].map((r) => (
            <option key={r} value={r}>{r}</option>
          ))}
        </select>
        <button type="submit" disabled={creating} style={{ marginTop: 8 }}>{creating ? 'Creating…' : 'Create user'}</button>
      </form>
    </div>
  );
}

const headerStyle: React.CSSProperties = { textAlign: 'left', borderBottom: '2px solid #ddd', padding: '8px 12px' };
const cellStyle: React.CSSProperties = { borderBottom: '1px solid #eee', padding: '8px 12px' };
const inputStyle: React.CSSProperties = { display: 'block', width: '100%', padding: 8, marginTop: 8, boxSizing: 'border-box' };
