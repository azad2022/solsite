import React, { StrictMode, useState, useEffect, ReactNode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import './index.css';

interface ErrorBoundaryProps {
  children: ReactNode;
}

function ErrorBoundary({ children }: ErrorBoundaryProps) {
  const [hasError, setHasError] = useState(false);

  useEffect(() => {
    const handleError = (event: ErrorEvent) => {
      console.error('Captured runtime error:', event.error);
      setHasError(true);
    };
    window.addEventListener('error', handleError);
    return () => window.removeEventListener('error', handleError);
  }, []);

  if (hasError) {
    return (
      <div style={{
        minHeight: '100vh',
        backgroundColor: '#08080f',
        color: '#ffffff',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '20px',
        fontFamily: 'Vazirmatn, sans-serif',
        textAlign: 'center',
        direction: 'rtl'
      }}>
        <div style={{
          maxWidth: '500px',
          backgroundColor: '#11111f',
          border: '1px solid rgba(255,255,255,0.1)',
          borderRadius: '24px',
          padding: '32px',
          boxShadow: '0 20px 40px rgba(0,0,0,0.5)'
        }}>
          <h2 style={{ fontSize: '20px', fontWeight: 'bold', marginBottom: '12px', color: '#14F195' }}>
            سولمینت - بارگذاری مجدد
          </h2>
          <p style={{ fontSize: '14px', color: '#94a3b8', marginBottom: '24px', lineHeight: '1.6' }}>
            مشکلی در بارگذاری اولیه رخ داده است. لطفاً حافظه کش مرورگر را بروزرسانی کنید.
          </p>
          <button
            onClick={() => window.location.reload()}
            style={{
              backgroundColor: '#9945FF',
              color: '#ffffff',
              border: 'none',
              padding: '12px 24px',
              borderRadius: '12px',
              fontWeight: 'bold',
              cursor: 'pointer',
              fontSize: '14px'
            }}
          >
            تلاش مجدد (Reload)
          </button>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>,
);
