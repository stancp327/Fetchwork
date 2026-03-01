import React from 'react';
import { Helmet } from 'react-helmet-async';

const SITE_NAME = 'Fetchwork';
const DEFAULT_DESC = 'Find local freelancers and jobs near you. Fetchwork connects skilled professionals with clients for both remote and local projects.';
const SITE_URL = 'https://fetchwork.net';

const SEO = ({
  title,
  description = DEFAULT_DESC,
  keywords,
  path = '',
  type = 'website',
  image,
  noIndex = false,
  jsonLd,
  structuredData // backward compat
}) => {
  const fullTitle = title ? `${title} | ${SITE_NAME}` : `${SITE_NAME} — Find Local Freelancers & Jobs`;
  const url = `${SITE_URL}${path}`;
  const ogImage = image || `${SITE_URL}/og-default.png`;
  const sd = jsonLd || structuredData;

  return (
    <Helmet>
      <title>{fullTitle}</title>
      <meta name="description" content={description} />
      {keywords && <meta name="keywords" content={keywords} />}
      <link rel="canonical" href={url} />

      {/* Open Graph */}
      <meta property="og:type" content={type} />
      <meta property="og:title" content={fullTitle} />
      <meta property="og:description" content={description} />
      <meta property="og:url" content={url} />
      <meta property="og:image" content={ogImage} />
      <meta property="og:site_name" content={SITE_NAME} />

      {/* Twitter */}
      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:title" content={fullTitle} />
      <meta name="twitter:description" content={description} />
      <meta name="twitter:image" content={ogImage} />

      {noIndex && <meta name="robots" content="noindex,nofollow" />}

      {sd && <script type="application/ld+json">{JSON.stringify(sd)}</script>}
    </Helmet>
  );
};

export default SEO;
