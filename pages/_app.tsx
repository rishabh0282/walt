import type { AppProps } from "next/app";
import { ThirdwebProvider } from "@thirdweb-dev/react";
import { AuthProvider } from "../contexts/AuthContext";
import Head from "next/head";
import Script from "next/script";
import "../styles/globals.css";

// Use Ethereum Mainnet as the active chain
const activeChain = "ethereum";

// Get client ID from environment variable
const clientId = process.env.NEXT_PUBLIC_THIRDWEB_CLIENT_ID || "test-api";

// Determine Cashfree environment
const cashfreeEnv = (process.env.NEXT_PUBLIC_CASHFREE_ENVIRONMENT || '').toUpperCase() === 'PRODUCTION'
  ? 'PRODUCTION'
  : 'SANDBOX';

const cashfreeScriptUrl = cashfreeEnv === 'PRODUCTION'
  ? 'https://sdk.cashfree.com/js/ui/2.0.0/cashfree.prod.js'
  : 'https://sdk.cashfree.com/js/ui/2.0.0/cashfree.sandbox.js';

function MyApp({ Component, pageProps }: AppProps) {
  return (
    <>
      <Head>
        <meta charSet="utf-8" />
        <meta httpEquiv="X-UA-Compatible" content="IE=edge" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>Vault Labs - Decentralized Storage</title>
        <link rel="shortcut icon" type="image/png" href="/vault-labs-icon.png" />
        <link rel="icon" type="image/png" href="/vault-labs-icon.png" />
        {/* Add other global head elements here */}
      </Head>
      
      {/* Load Cashfree SDK globally */}
      <Script
        src={cashfreeScriptUrl}
        strategy="lazyOnload"
        onLoad={() => {
          console.log('[Cashfree] SDK loaded globally');
        }}
        onError={(e) => {
          console.error('[Cashfree] Failed to load SDK globally:', e);
        }}
      />
      
      <AuthProvider>
        <ThirdwebProvider
          activeChain={activeChain}
          clientId={clientId}
        >
          <Component {...pageProps} />
        </ThirdwebProvider>
      </AuthProvider>
    </>
  );
}

export default MyApp;
