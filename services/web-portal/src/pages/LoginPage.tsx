import { useState } from 'react';
import type { FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';

export function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [mfaToken, setMfaToken] = useState('');
  const [mfaRequired, setMfaRequired] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const result = await login(email, password, mfaToken || undefined);
      if (result.mfaRequired) {
        setMfaRequired(true);
      } else {
        navigate('/');
      }
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ maxWidth: 360, margin: '80px auto', fontFamily: 'system-ui, sans-serif' }}>
      <h1 style={{ fontSize: 20 }}>AIOS Management Portal</h1>
      <form onSubmit={handleSubmit}>
        <label style={{ display: 'block', marginTop: 16 }}>
          Email
          <input value={email} onChange={(e) => setEmail(e.target.value)} type="email" required style={inputStyle} />
        </label>
        <label style={{ display: 'block', marginTop: 12 }}>
          Password
          <input value={password} onChange={(e) => setPassword(e.target.value)} type="password" required style={inputStyle} />
        </label>
        {mfaRequired && (
          <label style={{ display: 'block', marginTop: 12 }}>
            MFA code
            <input value={mfaToken} onChange={(e) => setMfaToken(e.target.value)} type="text" maxLength={6} style={inputStyle} />
          </label>
        )}
        {error && <p style={{ color: 'crimson', marginTop: 12 }}>{error}</p>}
        <button type="submit" disabled={loading} style={{ marginTop: 16, width: '100%', padding: 10 }}>
          {loading ? 'Signing in…' : 'Sign in'}
        </button>
      </form>
    </div>
  );
}

const inputStyle: React.CSSProperties = { display: 'block', width: '100%', padding: 8, marginTop: 4, boxSizing: 'border-box' };
