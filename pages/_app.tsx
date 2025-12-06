import type { AppProps } from "next/app";
import { AuthProvider } from "../contexts/AuthContext";
import Head from "next/head";
import Script from "next/script";
import "../styles/globals.css";

function MyApp({ Component, pageProps }: AppProps) {
  return (
    <>
      <Head>
        <meta charSet="utf-8" />
        <meta httpEquiv="X-UA-Compatible" content="IE=edge" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>Walt - Decentralized Storage</title>
        <link rel="shortcut icon" type="image/png" href="/walt-icon.png" />
        <link rel="icon" type="image/png" href="/walt-icon.png" />
        {/* Add other global head elements here */}
      </Head>
      
      {/* Load Cashfree SDK v3 globally */}
      <Script
        src="https://sdk.cashfree.com/js/v3/cashfree.js"
        strategy="lazyOnload"
        onLoad={() => {
          console.log('[Cashfree] SDK v3 loaded globally');
        }}
        onError={(e) => {
          console.error('[Cashfree] Failed to load SDK v3 globally:', e);
        }}
      />
      
      <AuthProvider>
        <Component {...pageProps} />
      </AuthProvider>
    </>
  );
}

export default MyApp;
