import React, { useEffect } from "react";
import { useAuth } from "../../lib/auth";
import { useTermsAcceptance } from "../../lib/useTermsAcceptance";
import { TermsAcceptanceGate } from "./TermsAcceptanceGate";

/**
 * Post-auth Terms & Conditions guard.
 *
 *  - Stays invisible for anonymous visitors (so the first app open does NOT
 *    show the gate, per product requirement).
 *  - As soon as a user is authenticated AND hasn't accepted the current
 *    TC_VERSION, the full-screen gate opens. Because it is a fullscreen
 *    Modal, it blocks navigation to every route (/profile, /checkout, /jobs,
 *    /chat, etc.) until acceptance.
 *  - After acceptance the storage flag flips and the gate self-hides.
 *  - On decline we log the user out so the app returns to the home page
 *    (anonymous state) — preventing the user from poking around protected
 *    screens without consent.
 *
 * Temporary diagnostic console.log statements per request — remove later.
 */
export function PostAuthTermsGuard() {
  const auth = useAuth();
  const tc = useTermsAcceptance();

  // Diagnostics — fire whenever any of the deciding inputs change so we can
  // confirm in the browser console that the guard is evaluating correctly.
  useEffect(() => {
    // eslint-disable-next-line no-console
    console.log("[T&C guard] eval", {
      authReady: auth.ready,
      tcReady: tc.ready,
      userId: auth.user?.user_id || null,
      isAuthed: !!auth.user,
      tcAccepted: tc.accepted,
      tcVersion: tc.version,
      willShowGate: !!(auth.ready && tc.ready && auth.user && !tc.accepted),
    });
  }, [auth.ready, tc.ready, auth.user, tc.accepted, tc.version]);

  // Wait for both providers to finish loading from AsyncStorage before
  // deciding — avoids a flash where `tc.accepted` is briefly false and the
  // gate appears for an already-accepted user.
  if (!auth.ready || !tc.ready) return null;

  // Anonymous user → never show gate (first-launch requirement).
  if (!auth.user) return null;

  // Authenticated + accepted current version → nothing to show.
  if (tc.accepted) return null;

  return (
    <TermsAcceptanceGate
      visible
      onAccept={() => {
        // eslint-disable-next-line no-console
        console.log("[T&C guard] accepted by", auth.user?.email);
        // Gate self-hides via tc.accepted flipping to true.
      }}
      onDecline={() => {
        // eslint-disable-next-line no-console
        console.log("[T&C guard] declined → logging out", auth.user?.email);
        // Decline → log out so the user returns to anonymous home and is
        // blocked from /profile, /checkout, /jobs, /chat until they re-signup
        // and accept.
        auth.logout().catch(() => {});
      }}
    />
  );
}
