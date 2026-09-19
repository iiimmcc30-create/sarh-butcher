/**
 * Minimal pages-router error page.
 * This overrides Next.js's built-in _error.js which uses <Html> from next/document
 * and fails during App Router static generation with output: 'standalone'.
 */
function ErrorPage({ statusCode }: { statusCode?: number }) {
  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#020617', color: '#e2e8f0', fontFamily: 'system-ui, sans-serif' }}>
      <div style={{ textAlign: 'center' }}>
        <p style={{ fontSize: '4rem', fontWeight: 700, color: '#34d399', margin: 0 }}>{statusCode ?? 'Error'}</p>
        <p style={{ marginTop: '1rem', color: '#94a3b8' }}>{statusCode === 404 ? 'الصفحة غير موجودة' : 'حدث خطأ في الخادم'}</p>
        <a href="/" style={{ display: 'inline-block', marginTop: '1.5rem', padding: '0.5rem 1.25rem', background: '#059669', color: '#fff', borderRadius: '0.5rem', textDecoration: 'none' }}>
          العودة للرئيسية
        </a>
      </div>
    </div>
  );
}

ErrorPage.getInitialProps = ({ res, err }: { res?: { statusCode: number }; err?: { statusCode: number } }) => {
  const statusCode = res?.statusCode ?? err?.statusCode ?? 404;
  return { statusCode };
};

export default ErrorPage;
