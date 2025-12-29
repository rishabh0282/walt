import Head from 'next/head';

interface OpenGraphProps {
  title?: string;
  description?: string;
  image?: string;
  url?: string;
  type?: string;
  siteName?: string;
  locale?: string;
}

/**
 * OpenGraph component for adding social media meta tags
 * Supports OpenGraph, Twitter Cards, and standard meta tags
 */
export default function OpenGraph({
  title = 'Walt - Decentralized Storage',
  description = 'A decentralized, open-source file storage platform built on IPFS. Self-hostable, private, and affordable.',
  image = '/images/VaultLabsLogoWhtBg.png',
  url,
  type = 'website',
  siteName = 'Walt',
  locale = 'en_US',
}: OpenGraphProps) {
  // Get the base URL from environment or use default
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://walt.aayushman.dev';
  const fullUrl = url ? (url.startsWith('http') ? url : `${baseUrl}${url}`) : baseUrl;
  const fullImageUrl = image.startsWith('http') ? image : `${baseUrl}${image}`;

  return (
    <Head>
      {/* Primary Meta Tags */}
      <title>{title}</title>
      <meta name="title" content={title} />
      <meta name="description" content={description} />

      {/* Open Graph / Facebook */}
      <meta property="og:type" content={type} />
      <meta property="og:url" content={fullUrl} />
      <meta property="og:title" content={title} />
      <meta property="og:description" content={description} />
      <meta property="og:image" content={fullImageUrl} />
      <meta property="og:image:width" content="1200" />
      <meta property="og:image:height" content="630" />
      <meta property="og:site_name" content={siteName} />
      <meta property="og:locale" content={locale} />

      {/* Twitter */}
      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:url" content={fullUrl} />
      <meta name="twitter:title" content={title} />
      <meta name="twitter:description" content={description} />
      <meta name="twitter:image" content={fullImageUrl} />

      {/* Additional Meta Tags */}
      <meta name="theme-color" content="#000000" />
    </Head>
  );
}

