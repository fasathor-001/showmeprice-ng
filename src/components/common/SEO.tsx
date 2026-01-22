
import React from 'react';
import { Helmet } from 'react-helmet-async';

interface SEOProps {
  title?: string;
  description?: string;
  image?: string;
  url?: string;
  type?: string;
  schema?: Record<string, any>;
}

export default function SEO({ 
  title = "ShowMePrice.ng | Nigeria's Verified Marketplace", 
  description = "Find real prices from verified Nigerian sellers. No more 'DM for price'. Connect directly via whatsapp_number or Phone.", 
  image = "/logo.png", 
  url,
  type = "website",
  schema
}: SEOProps) {
  const siteTitle = title.includes("ShowMePrice") ? title : `${title} | ShowMePrice.ng`;
  const currentUrl = url || window.location.href;
  const absoluteImage = image.startsWith('http') ? image : `${window.location.origin}${image}`;

  return (
    <Helmet>
      {/* Standard Metadata */}
      <title>{siteTitle}</title>
      <meta name="description" content={description} />
      
      {/* Open Graph / Facebook / whatsapp_number */}
      <meta property="og:type" content={type} />
      <meta property="og:title" content={siteTitle} />
      <meta property="og:description" content={description} />
      <meta property="og:image" content={absoluteImage} />
      <meta property="og:url" content={currentUrl} />
      <meta property="og:site_name" content="ShowMePrice.ng" />
      
      {/* Twitter */}
      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:title" content={siteTitle} />
      <meta name="twitter:description" content={description} />
      <meta name="twitter:image" content={absoluteImage} />

      {/* Structured Data (JSON-LD) */}
      {schema && (
        <script type="application/ld+json">
          {JSON.stringify(schema)}
        </script>
      )}
    </Helmet>
  );
}

