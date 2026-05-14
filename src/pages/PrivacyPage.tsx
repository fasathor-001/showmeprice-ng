import React from "react";
import { smpNavigate } from "../lib/smpNavigate";

export default function PrivacyPage() {
  return (
    <div className="max-w-3xl mx-auto px-4 py-10 space-y-6 text-slate-800">
      <button
        type="button"
        onClick={() => smpNavigate("/")}
        className="text-sm text-slate-500 hover:text-slate-900"
      >
        ← Back to Home
      </button>

      <h1 className="text-3xl font-black text-slate-900">Privacy Policy</h1>
      <p className="text-sm text-slate-500">Last updated: May 2026</p>

      <section className="space-y-3">
        <h2 className="text-xl font-black">1. Introduction</h2>
        <p>
          ShowMePrice.ng ("we", "us") is committed to protecting your personal data in accordance
          with the Nigeria Data Protection Regulation (NDPR) 2019 and the Nigeria Data Protection
          Act (NDPA) 2023. This Policy explains how we collect, use, and protect your data.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-xl font-black">2. Data We Collect</h2>
        <ul className="list-disc pl-5 space-y-1">
          <li>Account information: name, email address, phone number</li>
          <li>Profile data: city, state, business details</li>
          <li>Seller verification data: government ID, CAC number, selfie (for KYC)</li>
          <li>Bank account details: account number, bank code, account name (for payouts)</li>
          <li>Transaction data: purchase history, escrow records, payment references</li>
          <li>Usage data: pages visited, device type, IP address</li>
        </ul>
      </section>

      <section className="space-y-3">
        <h2 className="text-xl font-black">3. How We Use Your Data</h2>
        <ul className="list-disc pl-5 space-y-1">
          <li>To operate the marketplace and process transactions</li>
          <li>To verify seller identities and comply with KYC requirements</li>
          <li>To process escrow payments and disburse funds via Paystack</li>
          <li>To send transactional notifications (payment, shipping, dispute updates)</li>
          <li>To comply with legal and regulatory obligations</li>
          <li>To prevent fraud and enforce our Terms of Service</li>
        </ul>
      </section>

      <section className="space-y-3">
        <h2 className="text-xl font-black">4. Legal Basis for Processing</h2>
        <p>
          We process your data on the basis of: (a) performance of a contract — to fulfil your
          orders and provide services; (b) legal obligation — to comply with Nigerian financial and
          data laws; (c) legitimate interests — to prevent fraud and improve our services.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-xl font-black">5. Data Sharing</h2>
        <p>We share your data only with:</p>
        <ul className="list-disc pl-5 space-y-1">
          <li>
            <strong>Paystack</strong> — our payment processor, for payment and payout processing
          </li>
          <li>
            <strong>Supabase</strong> — our database and authentication provider
          </li>
          <li>
            <strong>Resend</strong> — our transactional email provider
          </li>
          <li>
            Law enforcement or regulators where required by Nigerian law
          </li>
        </ul>
        <p>We do not sell your personal data.</p>
      </section>

      <section className="space-y-3">
        <h2 className="text-xl font-black">6. Data Retention</h2>
        <p>
          We retain your account data for as long as your account is active. Transaction records are
          retained for 7 years as required by Nigerian financial regulations. You may request
          deletion of non-transactional data at any time.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-xl font-black">7. Your Rights</h2>
        <p>Under the NDPA 2023, you have the right to:</p>
        <ul className="list-disc pl-5 space-y-1">
          <li>Access your personal data</li>
          <li>Correct inaccurate data</li>
          <li>Request deletion of your data (subject to legal retention obligations)</li>
          <li>Object to processing in certain circumstances</li>
          <li>Data portability</li>
        </ul>
        <p>
          To exercise your rights, email{" "}
          <a href="mailto:privacy@showmeprice.ng" className="underline text-slate-900">
            privacy@showmeprice.ng
          </a>
          .
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-xl font-black">8. Security</h2>
        <p>
          We implement industry-standard security measures including encryption at rest and in
          transit, access controls, and regular security reviews. No system is 100% secure; please
          use a strong password and keep your login credentials private.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-xl font-black">9. Cookies</h2>
        <p>
          We use essential cookies for authentication and session management. We do not use
          third-party advertising cookies.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-xl font-black">10. Contact</h2>
        <p>
          Our Data Protection Officer can be reached at{" "}
          <a href="mailto:privacy@showmeprice.ng" className="underline text-slate-900">
            privacy@showmeprice.ng
          </a>
          .
        </p>
      </section>
    </div>
  );
}
