<template>
  <div class="privacy-page container py-5">
    <h1 class="mb-4">Privacy Notice</h1>
    <p class="text-muted mb-4">
      <strong>Effective Date:</strong> February 2026
    </p>
    
    <section class="mb-4">
      <h2>Who We Are</h2>
      <p>
        We (the operators of this decentralized metaverse/XR dApp platform, referred to as "we," "us," or "our") 
        act as the data controller for the personal data we collect through our platform. 
        Contact: <a href="mailto:info@dlux.io">info@dlux.io</a>. 
        No EU representative is designated at this time (processing is not large-scale high-risk; we will appoint one if required under Art. 27).
      </p>
    </section>

    <section class="mb-4">
      <h2>What Personal Data We Collect</h2>
      <p>We collect and process the following categories of personal data:</p>
      <ul>
        <li>
          <strong>Account & Authentication Data:</strong> When you log in (via ZK proofs or similar), 
          we issue a JWT containing an account number (pseudonymized identifier). This enables wallet prompts, 
          presence servers, Twitch-style streaming access, or subscription-based perks (e.g., skipping lines).
        </li>
        <li>
          <strong>Technical & Usage Data:</strong> IP address (used to derive approximate GeoIP location for ad relevance), 
          device/browser info, timestamps, interaction logs.
        </li>
        <li>
          <strong>User-Generated Content:</strong> Any text, dApps, models, skills, videos, or other uploads you post 
          in your sandboxed environment (creator-keyed subdomain). Text reviews/comments on the main site are sanitized for safety.
        </li>
        <li>
          <strong>Location Data:</strong> Approximate location derived from GeoIP (not precise GPS). 
          We do not collect precise geolocation unless you explicitly enable it.
        </li>
        <li>
          <strong>Advertising-Related Data:</strong> Labels/tags attached to your content for ad matching; 
          engagement metrics (views, interactions) to allocate revenue shares.
        </li>
      </ul>
      <p>We minimize collection: no unnecessary profiling, no selling of personal data.</p>
    </section>

    <section class="mb-4">
      <h2>How We Use Your Data (Purposes & Lawful Basis)</h2>
      <ul>
        <li>
          <strong>Provide & improve the platform</strong> (e.g., authentication, sandbox hosting, content loading in XR/Quest): 
          Contractual necessity (Art. 6(1)(b) GDPR) or legitimate interests (Art. 6(1)(f)) — our interest in secure, 
          functional service outweighs minimal intrusion.
        </li>
        <li>
          <strong>Serve relevant ads</strong> (content-attached via labels; GeoIP for broad regional relevance, 
          not hyper-personalized targeting): Legitimate interests (Art. 6(1)(f)) — ads fund the platform and creator shares 
          without tracking cookies or cross-site profiling. You can object anytime (see rights below).
        </li>
        <li>
          <strong>Process revenue shares, PM verifications, governance</strong> (e.g., top-earner voting): 
          Legitimate interests or contractual where tied to your participation.
        </li>
        <li>
          <strong>Moderation & safety</strong> (e.g., PM outcomes, text sanitization): Legitimate interests to maintain trust.
        </li>
        <li>
          <strong>Legal compliance</strong> (e.g., respond to requests): Legal obligation (Art. 6(1)(c)).
        </li>
      </ul>
    </section>

    <section class="mb-4">
      <h2>Sharing Your Data</h2>
      <ul>
        <li>With mirrors/nodes (decentralized content serving) — only necessary metadata.</li>
        <li>No third-party ad networks for tracking; ads are platform-internal, ZK-verified.</li>
        <li>If required by law, or to protect rights/safety.</li>
        <li>We do not sell personal data.</li>
      </ul>
    </section>

    <section class="mb-4">
      <h2>International Transfers</h2>
      <p>
        Data may be processed on Sui blockchain nodes or mirrors outside the EEA. 
        We rely on standard contractual clauses (SCCs) or adequacy decisions where applicable. 
        Contact us for details.
      </p>
    </section>

    <section class="mb-4">
      <h2>Retention</h2>
      <ul>
        <li><strong>Account/JWT data:</strong> As long as active (or until deletion request).</li>
        <li><strong>Content/uploads:</strong> Until removed by you or for policy violations.</li>
        <li><strong>Logs/GeoIP:</strong> Up to 90 days (or shorter where possible) for security/ad relevance.</li>
      </ul>
      <p>We delete or anonymize when no longer needed.</p>
    </section>

    <section class="mb-4">
      <h2>Your GDPR Rights</h2>
      <p>
        If GDPR applies (you're in the EU/EEA or we target EU users), you have:
      </p>
      <ul>
        <li>Right to access, rectify, erase ("right to be forgotten"), restrict processing.</li>
        <li>Right to object (especially to legitimate-interest processing like GeoIP ads).</li>
        <li>Right to data portability.</li>
        <li>Right to withdraw consent (if we ever rely on it).</li>
        <li>Right to lodge a complaint with your supervisory authority (e.g., your national DPA).</li>
      </ul>
      <p>
        To exercise: Email <a href="mailto:info@dlux.io">info@dlux.io</a>. 
        We respond within one month (extendable if complex).
      </p>
    </section>

    <section class="mb-4">
      <h2>Security</h2>
      <p>
        We use cryptographic signatures, public/audited sources (Walrus), sandboxes, and sanitization to protect data. 
        No system is 100% secure — report issues to us.
      </p>
    </section>

    <section class="mb-4">
      <h2>Children</h2>
      <p>
        Our platform is not directed at children under 16. We do not knowingly collect data from them.
      </p>
    </section>

    <section class="mb-4">
      <h2>Changes</h2>
      <p>
        We may update this notice. Check back; significant changes will be notified (e.g., via login prompt).
      </p>
    </section>

    <section class="mb-4">
      <h2>Questions?</h2>
      <p>
        Reach us at <a href="mailto:info@dlux.io">info@dlux.io</a>.
      </p>
    </section>

    <router-link to="/" class="btn btn-outline-primary">← Back</router-link>
  </div>
</template>

<script setup lang="ts">
</script>

<style scoped>
.privacy-page {
  max-width: 640px;
}
.privacy-page h2 {
  font-size: 1.15rem;
  margin-bottom: 0.5rem;
}
.privacy-page p {
  color: var(--bs-body-color);
}
</style>
