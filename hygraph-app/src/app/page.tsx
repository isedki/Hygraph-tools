'use client';

import { useEffect, useState, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { init, AppInstallationStatus } from '@hygraph/app-sdk';

interface AppProps {
  context?: {
    project?: { id?: string; name?: string };
    environment?: { id?: string; name?: string };
  };
  updateInstallation?: (status: { status: string }) => void;
}

function SetupContent() {
  const searchParams = useSearchParams();
  const [status, setStatus] = useState<'initializing' | 'ready' | 'error' | 'standalone'>('initializing');
  const [errorMsg, setErrorMsg] = useState<string>('');
  
  // Get extensionUid from URL if present
  const extensionUid = searchParams.get('extensionUid');
  const isInHygraph = extensionUid || searchParams.get('code');

  useEffect(() => {
    if (!isInHygraph) {
      // Standalone mode - not in Hygraph iframe
      setStatus('standalone');
      return;
    }

    // Initialize the SDK
    init({
      debug: true,
      onProps: (props: AppProps) => {
        console.log('Hygraph props received:', props);
      },
    })
      .then((result) => {
        console.log('SDK init result:', result);
        
        if (result.status === 'ok') {
          const props = result.props as AppProps;
          
          // Mark installation as complete
          if (props.updateInstallation) {
            props.updateInstallation({ status: AppInstallationStatus.COMPLETED });
          }
          
          setStatus('ready');
        } else {
          setStatus('ready'); // Validation mode - still show ready
        }
      })
      .catch((err) => {
        console.error('SDK init error:', err);
        setErrorMsg(err.message || 'Failed to connect');
        setStatus('error');
      });
  }, [isInHygraph]);

  // Standalone view
  if (status === 'standalone') {
    return (
      <div style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 100%)',
        fontFamily: 'system-ui, -apple-system, sans-serif',
        color: '#fff'
      }}>
        <div style={{ textAlign: 'center', maxWidth: '500px', padding: '40px' }}>
          <div style={{
            width: '80px',
            height: '80px',
            borderRadius: '20px',
            background: 'linear-gradient(135deg, #7c3aed 0%, #4f46e5 100%)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto 24px'
          }}>
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2">
              <circle cx="11" cy="11" r="8" />
              <path d="M21 21l-4.35-4.35" />
            </svg>
          </div>
          <h1 style={{ fontSize: '28px', fontWeight: '700', margin: '0 0 12px' }}>
            Schema Explorer
          </h1>
          <p style={{ color: '#9ca3af', margin: '0 0 32px', lineHeight: '1.6' }}>
            This is a Hygraph Custom App. Install it in your Hygraph project to analyze your schema.
          </p>
          <a 
            href="https://hygraph-component-finder.vercel.app/component-finder"
            style={{
              display: 'inline-block',
              padding: '14px 28px',
              background: 'linear-gradient(135deg, #7c3aed 0%, #4f46e5 100%)',
              color: '#fff',
              borderRadius: '12px',
              textDecoration: 'none',
              fontWeight: '600',
              fontSize: '16px'
            }}
          >
            Use Web Version Instead →
          </a>
        </div>
      </div>
    );
  }

  // In Hygraph - show setup status
  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: '#fff',
      fontFamily: 'system-ui, -apple-system, sans-serif'
    }}>
      <div style={{ textAlign: 'center', maxWidth: '400px', padding: '40px' }}>
        {status === 'initializing' && (
          <>
            <div style={{
              width: '48px',
              height: '48px',
              border: '3px solid #e5e7eb',
              borderTopColor: '#6366f1',
              borderRadius: '50%',
              animation: 'spin 1s linear infinite',
              margin: '0 auto 24px'
            }} />
            <p style={{ color: '#6b7280', fontSize: '16px' }}>Connecting to Hygraph...</p>
          </>
        )}
        
        {status === 'ready' && (
          <>
            <div style={{
              width: '60px',
              height: '60px',
              background: '#dcfce7',
              borderRadius: '50%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 24px'
            }}>
              <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="#16a34a" strokeWidth="2.5">
                <path d="M20 6L9 17l-5-5" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </div>
            <h1 style={{ fontSize: '24px', fontWeight: '600', color: '#111827', margin: '0 0 12px' }}>
              Ready to Install
            </h1>
            <p style={{ color: '#6b7280', margin: '0 0 24px', lineHeight: '1.5' }}>
              Schema Explorer is configured. Click <strong>Save</strong> below to complete installation.
            </p>
            <div style={{ 
              background: '#f0fdf4', 
              border: '1px solid #86efac', 
              borderRadius: '8px', 
              padding: '12px',
              marginTop: '16px',
              textAlign: 'left'
            }}>
              <p style={{ fontSize: '14px', color: '#166534', margin: '0 0 8px', fontWeight: '500' }}>
                ✓ App features:
              </p>
              <ul style={{ fontSize: '13px', color: '#166534', margin: 0, paddingLeft: '20px' }}>
                <li>Schema analysis (components, enums, models)</li>
                <li>Entry reference finder</li>
                <li>Usage statistics</li>
              </ul>
            </div>
          </>
        )}
        
        {status === 'error' && (
          <>
            <div style={{
              width: '60px',
              height: '60px',
              background: '#fef2f2',
              borderRadius: '50%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 24px'
            }}>
              <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="#dc2626" strokeWidth="2">
                <circle cx="12" cy="12" r="10"/>
                <path d="M15 9l-6 6M9 9l6 6" strokeLinecap="round"/>
              </svg>
            </div>
            <h1 style={{ fontSize: '24px', fontWeight: '600', color: '#111827', margin: '0 0 12px' }}>
              Connection Error
            </h1>
            <p style={{ color: '#6b7280', margin: '0', lineHeight: '1.5' }}>
              {errorMsg || 'Failed to connect to Hygraph'}
            </p>
          </>
        )}
      </div>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

export default function SetupPage() {
  return (
    <Suspense fallback={
      <div style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: '#fff'
      }}>
        <div style={{
          width: '40px',
          height: '40px',
          border: '3px solid #e5e7eb',
          borderTopColor: '#6366f1',
          borderRadius: '50%',
          animation: 'spin 1s linear infinite'
        }} />
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    }>
      <SetupContent />
    </Suspense>
  );
}
