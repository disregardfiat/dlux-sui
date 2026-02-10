<template>
  <div class="terms-page container py-5">
    <h1 class="mb-4">Disclaimer & Terms of Use</h1>
    <p class="text-muted mb-4">
      <strong>Read this before posting, staking, betting, or loading anything. By using the platform, you agree to these terms.</strong>
    </p>
    
    <section class="mb-4">
      <p>
        This is a decentralized, community-driven system built on prediction markets (PMs), cryptographic verification, 
        and user-posted content. We provide the tools and backbone — we do not guarantee safety, accuracy, profitability, 
        or protection of your funds or data.
      </p>
    </section>

    <section class="mb-4">
      <h2>Key Risks You Accept</h2>
      
      <h3>Prediction Markets Are High-Risk Gambling</h3>
      <p>
        PMs involve real economic stakes. You can lose your entire stake (slashed or redirected) if your prediction is wrong. 
        Markets can be manipulated, illiquid, or resolved incorrectly due to low participation, bad faith actors, or unforeseen events. 
        Do not risk capital you cannot afford to lose. No refunds, no insurance, no recourse from us.
      </p>

      <h3>User-Posted Content Can Be Anything</h3>
      <p>
        Creators post dApps, models, skills, videos, text, or XR experiences in their sandboxes. Content may be inaccurate, 
        misleading, harmful, offensive, illegal in your jurisdiction, or outright malicious (viruses, scams, deceptive claims). 
        We rely on PM verification and community moderation — these are not foolproof. A PM may pass false or dangerous content, 
        or fail legitimate stuff.
      </p>

      <h3>No Endorsement or Liability</h3>
      <p>
        We do not review, vet, or endorse any dApp, skill, model, ad, claim, or prediction. We are not responsible for losses from:
      </p>
      <ul>
        <li>Loading/running unverified or failed-PM content</li>
        <li>Bad wallet prompts, presence server issues, or subscription perks</li>
        <li>Revenue share disputes, governance decisions, or mirror failures</li>
        <li>GeoIP-based ad relevance mismatches</li>
        <li>Any financial, emotional, physical, or legal harm from platform use</li>
      </ul>
    </section>

    <section class="mb-4">
      <h2>Financial & Capital Separation Warning</h2>
      <p>
        Staking in PMs, posting fees, ad revenue expectations, or any economic activity here can separate you from your capital permanently. 
        Past performance (viral earnings, amplified pools, affirmative resolutions) does not predict future results. 
        Markets can dry up, content can flop, PMs can be contested or ignored.
      </p>
    </section>

    <section class="mb-4">
      <h2>Technical & Decentralized Nature</h2>
      <p>
        Walrus blobs, mirrors, signatures, ZK proofs, JWTs, sandboxes — all can have bugs, exploits, downtime, or chain-level failures 
        (Sui network risks). We make no uptime or security guarantees beyond best-effort cryptographic practices.
      </p>
    </section>

    <section class="mb-4">
      <h2>Your Responsibility</h2>
      <ul>
        <li>Do your own research (DYOR). Verify claims independently.</li>
        <li>Only load/run content you trust.</li>
        <li>Understand local laws (e.g., gambling regs, content legality, tax on earnings).</li>
        <li>Use at your own risk — no warranties, express or implied. We disclaim all liability to the maximum extent permitted by law.</li>
      </ul>
    </section>

    <section class="mb-4">
      <h2>If Something Goes Wrong</h2>
      <p>
        Report issues via <a href="mailto:info@dlux.io">info@dlux.io</a>. 
        We may investigate or adjust governance, but we owe no duty of care, compensation, or intervention.
      </p>
    </section>

    <section class="mb-4 alert alert-warning">
      <p class="mb-0">
        <strong>By continuing to use the platform, you acknowledge these risks and release us from any claims arising from your participation.</strong><br>
        Build, verify, earn — but proceed with eyes wide open. No heroes here, just decentralized tools and real consequences. 🚀
      </p>
    </section>

    <router-link to="/" class="btn btn-outline-primary">← Back</router-link>
  </div>
</template>

<script setup lang="ts">
</script>

<style scoped>
.terms-page {
  max-width: 800px;
}
.terms-page h2 {
  font-size: 1.5rem;
  margin-top: 2rem;
  margin-bottom: 1rem;
}
.terms-page h3 {
  font-size: 1.25rem;
  margin-top: 1.5rem;
  margin-bottom: 0.75rem;
}
.terms-page p {
  color: var(--bs-body-color);
  line-height: 1.6;
}
.terms-page ul {
  margin-top: 0.5rem;
  margin-bottom: 1rem;
}
.terms-page li {
  margin-bottom: 0.5rem;
  line-height: 1.6;
}
</style>
