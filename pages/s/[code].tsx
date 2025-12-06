import { useRouter } from 'next/router';
import { useEffect, useState } from 'react';
import Head from 'next/head';

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_API_URL || 'https://api-walt.aayushman.dev';

export default function ShortLinkRedirect() {
  const router = useRouter();
  const { code } = router.query;
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!code || typeof code !== 'string') {
      return;
    }

    // Redirect to backend endpoint which will handle the redirect
    const redirectUrl = `${BACKEND_URL}/api/s/${code}`;
    
    // Use window.location for proper redirect (preserves query params, etc.)
    window.location.href = redirectUrl;
    
    // Fallback: if redirect doesn't happen, show error after timeout
    const timeout = setTimeout(() => {
      setLoading(false);
      setError('Redirect failed. Please try again.');
    }, 5000);

    return () => clearTimeout(timeout);
  }, [code]);

  if (error) {
    return (
      <>
        <Head>
          <title>Short Link Error - Walt</title>
        </Head>
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: '100vh',
          fontFamily: 'system-ui, sans-serif',
        }}>
          <h1>Link Not Found</h1>
          <p>{error}</p>
          <a href="/" style={{ marginTop: '1rem', color: '#0066cc' }}>Go to Home</a>
        </div>
      </>
    );
  }

  return (
    <>
      <Head>
        <title>Redirecting... - Walt</title>
      </Head>
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '100vh',
        fontFamily: 'system-ui, sans-serif',
      }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{
            width: '40px',
            height: '40px',
            border: '4px solid #f3f3f3',
            borderTop: '4px solid #0066cc',
            borderRadius: '50%',
            animation: 'spin 1s linear infinite',
            margin: '0 auto 1rem',
          }} />
          <p>Redirecting...</p>
        </div>
        <style jsx>{`
          @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
          }
        `}</style>
      </div>
    </>
  );
}

