import { useAuth } from './auth/AuthContext';
import AuthScreen from './auth/AuthScreen';
import DashboardApp from './DashboardApp';
import styles from './App.module.css';

export default function App() {
  const { user, loading, signOut } = useAuth();

  if (loading) {
    return (
      <div className={styles.card} style={{ background: '#fbf7f2' }}>
        <div className={styles.loading}>Carregando...</div>
      </div>
    );
  }

  if (!user) {
    return <AuthScreen />;
  }

  return <DashboardApp userId={user.id} userEmail={user.email} onSignOut={signOut} />;
}
