// @ts-nocheck
import { ScrollViewStyleReset } from "expo-router/html";
import type { PropsWithChildren } from "react";

export default function Root({ children }: PropsWithChildren) {
  return (
    <html lang="en" style={{ height: "100%" }}>
      <head>
        <meta charSet="utf-8" />
        <meta httpEquiv="X-UA-Compatible" content="IE=edge" />
        {/* Viewport — keeps the layout stable on mobile (initial-scale 1, no
            forced device fit). We intentionally leave user scaling enabled
            (no maximum-scale) so iOS / Android accessibility zoom still
            works, but the 16px input font-size below stops iOS auto-zoom
            from triggering when an input is focused. */}
        <meta
          name="viewport"
          content="width=device-width, initial-scale=1, viewport-fit=cover"
        />

        {/* SEO */}
        <title>RevoloAI — Your AI Career Assistant</title>
        <meta
          name="description"
          content="Find better jobs, practice interviews, and get hired faster with three friendly AI avatars."
        />

        {/* PWA */}
        <link rel="manifest" href="/manifest.json" />
        <meta name="theme-color" content="#5B5FE9" />
        <meta name="background-color" content="#FAFAFB" />

        {/* Favicon — explicit links so all browsers pick up the RevoloAI mark */}
        <link rel="icon" type="image/png" sizes="192x192" href="/icons/icon-192.png?v=2" />
        <link rel="icon" type="image/png" sizes="512x512" href="/icons/icon-512.png?v=2" />
        <link rel="icon" type="image/x-icon" href="/favicon.ico?v=2" />
        <link rel="shortcut icon" href="/favicon.ico?v=2" />

        {/* Apple Web App */}
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-title" content="RevoloAI" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
        <link rel="apple-touch-icon" href="/icons/apple-touch-icon.png" />

        {/* Microsoft */}
        <meta name="msapplication-TileColor" content="#5B5FE9" />
        <meta name="msapplication-TileImage" content="/icons/icon-192.png" />

        {/* Open Graph / social */}
        <meta property="og:title" content="RevoloAI — Your AI Career Assistant" />
        <meta
          property="og:description"
          content="Find better jobs, practice interviews, and get hired faster."
        />
        <meta property="og:type" content="website" />
        <meta property="og:image" content="/icons/icon-512.png" />

        {/*
          Disable body scrolling on web to make ScrollView components work correctly.
          If you want to enable scrolling, remove `ScrollViewStyleReset` and
          set `overflow: auto` on the body style below.
        */}
        <ScrollViewStyleReset />
        <style
          dangerouslySetInnerHTML={{
            __html: `
              /* ── Global resets to stabilise the viewport ────────────────── */
              html, body {
                margin: 0;
                padding: 0;
                /* Lock text size so iOS does not auto-rescale text on rotate */
                -webkit-text-size-adjust: 100%;
                text-size-adjust: 100%;
                /* Prevent rubber-band scroll chain affecting page below */
                overscroll-behavior: none;
                /* Prevent horizontal overflow / "phantom" sideways scroll */
                overflow-x: hidden;
                /* Stable mobile viewport — falls back gracefully */
                min-height: 100vh;
                min-height: 100dvh;
              }
              body {
                /* Inputs at <16px trigger iOS auto-zoom which destabilises the
                   viewport. Force 16px on every native form element so the
                   keyboard never zooms in. App-level inputs override this with
                   their own (≥16) sizes via React Native styles. */
                font-size: 16px;
              }
              input, textarea, select {
                font-size: 16px !important;
                /* Avoid rounded iOS native shadows that shift layout */
                -webkit-appearance: none;
              }

              /* Existing behaviour: pin the Expo root to fill the viewport. */
              body > div:first-child {
                position: fixed !important;
                top: 0; left: 0; right: 0; bottom: 0;
              }
              [role="tablist"] [role="tab"] * { overflow: visible !important; }
              [role="heading"], [role="heading"] * { overflow: visible !important; }

              /* ── Desktop: turn the page into a real centred SaaS layout ──
                 At ≥1024px we center the Expo root in a max-width column and
                 give the surrounding canvas a soft branded backdrop so the
                 mobile-spaced UI no longer "stretches" awkwardly across a wide
                 monitor.  Mobile (<1024px) is left untouched. */
              @media (min-width: 1024px) {
                body {
                  background: linear-gradient(135deg, #F5F6FF 0%, #FAFAFB 50%, #FDF6F4 100%);
                }
                body > div:first-child {
                  left: 50% !important;
                  right: auto !important;
                  transform: translateX(-50%);
                  width: 100%;
                  max-width: 1200px;
                  /* Inner side gutters that scale gently with viewport */
                  box-shadow:
                    0 0 0 1px rgba(15, 18, 56, 0.04),
                    0 24px 60px -28px rgba(91, 95, 233, 0.18);
                }
                /* Slight breathing space above + below the centred app */
                html { background: transparent; }
              }

              /* ── Extra-wide screens: stop the app from getting "too tall"
                 by capping height. The Expo app uses position:fixed inside its
                 own React Native root, so we just ensure the column stays
                 well-proportioned on ultrawide displays. */
              @media (min-width: 1440px) {
                body > div:first-child { max-width: 1240px; }
              }
            `,
          }}
        />

        {/* Register service worker for PWA / offline */}
        <script
          dangerouslySetInnerHTML={{
            __html: `
              if ('serviceWorker' in navigator) {
                window.addEventListener('load', function() {
                  navigator.serviceWorker.register('/service-worker.js')
                    .catch(function(err) { console.warn('SW registration failed:', err); });
                });
              }
            `,
          }}
        />
      </head>
      <body
        style={{
          margin: 0,
          height: "100%",
          overflow: "hidden",
          display: "flex",
          flexDirection: "column",
        }}
      >
        {children}
      </body>
    </html>
  );
}
