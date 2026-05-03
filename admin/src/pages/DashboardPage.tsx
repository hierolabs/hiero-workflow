import { useAuth } from '../contexts/AuthContext';

export default function DashboardPage() {
  const { user, logout } = useAuth();

  return (
    <div style={styles.container}>
      <header style={styles.header}>
        <h1 style={styles.title}>HIERO Admin</h1>
        <div style={styles.userInfo}>
          <span>{user?.name} ({user?.login_id})</span>
          <button onClick={logout} style={styles.logoutButton}>로그아웃</button>
        </div>
      </header>
      <main style={styles.main}>
        <h2>대시보드</h2>
        <p>관리자 페이지에 오신 것을 환영합니다.</p>
      </main>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    minHeight: '100vh',
    backgroundColor: '#f5f5f5',
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '16px 24px',
    backgroundColor: '#333',
    color: '#fff',
  },
  title: {
    fontSize: '18px',
    fontWeight: '700',
  },
  userInfo: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    fontSize: '14px',
  },
  logoutButton: {
    padding: '6px 14px',
    backgroundColor: 'transparent',
    color: '#fff',
    border: '1px solid #fff',
    borderRadius: '4px',
    cursor: 'pointer',
    fontSize: '13px',
  },
  main: {
    padding: '24px',
  },
};
