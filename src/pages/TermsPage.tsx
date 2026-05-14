import React from "react";
import { smpNavigate } from "../lib/smpNavigate";

export default function TermsPage() {
  return (
    <div className="max-w-3xl mx-auto px-4 py-10 space-y-6 text-slate-800">
      <button
        type="button"
        onClick={() => smpNavigate("/")}
        className="text-sm text-slate-500 hover:text-slate-900"
      >
        ← Back to Home
      </button>

      <h1 className="text-3xl font-black text-slate-900">Terms of Service</h1>
      <p className="text-sm text-slate-500">Last updated: May 2026</p>

      <section className="space-y-3">
        <h2 className="text-xl font-black">1. Acceptance of Terms</h2>
        <p>
          By accessing or using ShowMePrice.ng ("Platform", "we", "us"), you agree to be bound by
          these Terms of Service. If you do not agree, please do not use the Platform.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-xl font-black">2. The Platform</h2>
        <p>
          ShowMePrice.ng is a Nigerian online marketplace that connects buyers and sellers. We
          provide an escrow payment service to facilitate secure transactions between parties.
          ShowMePrice.ng is not a party to any transaction between buyers and sellers and does not
          hold title to any listed items.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-xl font-black">3. Escrow Service</h2>
        <p>
          Our escrow service holds buyer payments securely until the buyer confirms receipt of goods.
          Funds are released to the seller only after delivery confirmation. Disputes may be raised
          within the platform and will be reviewed by our team. We charge a service fee for escrow
          transactions as disclosed at checkout.
        </p>
        <p>
          Escrow requires a Premium or Institution membership. By initiating an escrow transaction
          you agree to abide by the escrow terms, including dispute resolution procedures.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-xl font-black">4. Seller Obligations</h2>
        <p>
          Sellers must accurately describe their products, fulfil orders promptly, and provide valid
          tracking information when applicable. Sellers must complete identity verification before
          receiving escrow payouts. Fraudulent listings or misrepresentation will result in immediate
          account suspension.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-xl font-black">5. Buyer Obligations</h2>
        <p>
          Buyers must confirm or dispute delivery within 14 days of the seller marking an order as
          shipped. Failure to act within this period may result in automatic fund release to the
          seller.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-xl font-black">6. Prohibited Activities</h2>
        <p>You may not use the Platform to:</p>
        <ul className="list-disc pl-5 space-y-1">
          <li>List counterfeit, illegal, or prohibited goods</li>
          <li>Engage in fraud, money laundering, or deceptive practices</li>
          <li>Harass, threaten, or abuse other users</li>
          <li>Circumvent our payment or escrow system</li>
          <li>Violate any applicable Nigerian law or regulation</li>
        </ul>
      </section>

      <section className="space-y-3">
        <h2 className="text-xl font-black">7. Fees</h2>
        <p>
          ShowMePrice.ng charges an escrow service fee disclosed at the time of transaction. Fees are
          non-refundable unless required by law. Membership fees are billed according to the plan
          selected.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-xl font-black">8. Limitation of Liability</h2>
        <p>
          ShowMePrice.ng is not liable for the quality, safety, or legality of items listed; the
          accuracy of listings; or the ability of sellers to sell or buyers to pay. To the maximum
          extent permitted by law, our total liability to you shall not exceed the fees paid in the
          three months preceding the claim.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-xl font-black">9. Governing Law</h2>
        <p>
          These Terms are governed by the laws of the Federal Republic of Nigeria. Any dispute
          arising shall be submitted to the exclusive jurisdiction of Nigerian courts.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-xl font-black">10. Changes to Terms</h2>
        <p>
          We may update these Terms at any time. Continued use of the Platform after changes
          constitutes acceptance of the new Terms.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-xl font-black">11. Contact</h2>
        <p>
          For questions about these Terms, contact us at{" "}
          <a href="mailto:support@showmeprice.ng" className="underline text-slate-900">
            support@showmeprice.ng
          </a>
          .
        </p>
      </section>
    </div>
  );
}
