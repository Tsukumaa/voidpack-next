export default function MaintenancePage() {
  return (
    <div style={{
      minHeight: '100vh',
      background: '#06010e',
      backgroundImage: 'radial-gradient(ellipse 80% 50% at 50% 0%, rgba(123,43,255,0.18), transparent)',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '24px',
      fontFamily: 'system-ui, sans-serif',
      color: '#f6f1ff',
    }}>
      <img
        src="/assets/branding/void-logo-polished.png"
        alt="VOID Pack"
        style={{ width: 180, marginBottom: 32, opacity: 0.9 }}
      />
      <h1 style={{
        fontSize: 28,
        fontWeight: 900,
        marginBottom: 12,
        letterSpacing: '.04em',
        textAlign: 'center',
      }}>
        Maintenance en cours
      </h1>
      <p style={{
        color: 'rgba(246,241,255,0.5)',
        fontSize: 15,
        textAlign: 'center',
        maxWidth: 340,
        lineHeight: 1.6,
      }}>
        Le site est temporairement en pause.<br />
        Reviens dans quelques instants !
      </p>
      <div style={{
        marginTop: 40,
        width: 48,
        height: 48,
        borderRadius: '50%',
        border: '3px solid rgba(123,43,255,0.2)',
        borderTopColor: '#7b2bff',
        animation: 'spin 1s linear infinite',
      }} />
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  )
}
