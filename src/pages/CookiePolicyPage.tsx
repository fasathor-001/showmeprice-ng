import React from "react";
import { smpNavigate } from "../lib/smpNavigate";

export default function CookiePolicyPage() {
  return (
    <div className="min-h-screen bg-slate-50">
      <div className="max-w-3xl mx-auto px-4 py-12">
        <button
          type="button"
          onClick={() => smpNavigate("/")}
          className="text-sm text-slate-500 hover:text-slate-800 mb-6 inline-flex items-center gap-1"
        >
          ← Back to Home
        </button>

        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-8 space-y-8">
          <div>
            <h1 className="text-3xl font-black text-slate-900">Cookie Policy</h1>
            <p className="text-sm text-slate-500 mt-1">Last updated: May 2026</p>
          </div>

          <p className="text-sm text-slate-600 leading-relaxed">
            This Cookie Policy explains how ShowMePrice.ng (&quot;we&quot;, &quot;us&quot;, &quot;our&quot;) uses
            cookies and similar tracking technologies when you visit our website at{" "}
            <span className="font-semibold">showmeprice.ng</span>. It should be read alongside our{" "}
            <button
              type="button"
              onClick={() => smpNavigate("/privacy")}
              className="text-emerald-700 font-semibold hover:underline"
            >
              Privacy Policy
            </button>
            .
          </p>

          {/* Section 1 */}
          <section>
            <h2 className="text-lg font-black text-slate-900 mb-2">1. What Are Cookies?</h2>
            <p className="text-sm text-slate-600 leading-relaxed">
              Cookies are small text files placed on your device (computer, tablet, or mobile) when you visit a
              website. They are widely used to make websites work efficiently and to provide information to website
              owners. Cookies do not contain personally identifiable information on their own.
            </p>
          </section>

          {/* Section 2 */}
          <section>
            <h2 className="text-lg font-black text-slate-900 mb-3">2. Cookies We Use</h2>
            <div className="space-y-4">
              <div className="rounded-xl border border-slate-100 bg-slate-50 p-4">
                <div className="font-black text-sm text-slate-800 mb-1">Strictly Necessary Cookies</div>
                <p className="text-xs text-slate-600 leading-relaxed">
                  These are essential for the website to function. They enable core features such as authentication
                  (keeping you signed in), security, and your saved preferences. You cannot opt out of these.
                </p>
                <div className="mt-2 text-xs text-slate-500">
                  <span className="font-bold">Examples:</span> Supabase authentication session token, CSRF tokens.
                </div>
              </div>

              <div className="rounded-xl border border-slate-100 bg-slate-50 p-4">
                <div className="font-black text-sm text-slate-800 mb-1">Functional Cookies</div>
                <p className="text-xs text-slate-600 leading-relaxed">
                  These remember your choices and preferences to provide a more personalised experience — such as
                  your notification settings, preferred view mode, and saved items.
                </p>
              </div>

              <div className="rounded-xl border border-slate-100 bg-slate-50 p-4">
                <div className="font-black text-sm text-slate-800 mb-1">Analytics Cookies</div>
                <p className="text-xs text-slate-600 leading-relaxed">
                  We may use analytics tools to understand how users interact with our platform — such as which
                  pages are visited most and how long users spend on them. This data is aggregated and
                  anonymous. No personally identifiable information is shared with analytics providers.
                </p>
              </div>

              <div className="rounded-xl border border-slate-100 bg-slate-50 p-4">
                <div className="font-black text-sm text-slate-800 mb-1">Local Storage</div>
                <p className="text-xs text-slate-600 leading-relaxed">
                  We use browser local storage (similar to cookies) to store non-sensitive preferences such as
                  your last selected view mode, feature flag overrides, and user type cache to reduce load
                  times. This data stays on your device and is never transmitted to third parties.
                </p>
              </div>
            </div>
          </section>

          {/* Section 3 */}
          <section>
            <h2 className="text-lg font-black text-slate-900 mb-2">3. Third-Party Cookies</h2>
            <p className="text-sm text-slate-600 leading-relaxed">
              We integrate with third-party services that may set their own cookies:
            </p>
            <ul className="mt-3 space-y-2 text-sm text-slate-600 list-disc list-inside">
              <li>
                <span className="font-bold">Supabase</span> — authentication and session management
              </li>
              <li>
                <span className="font-bold">Paystack</span> — payment processing (during checkout only)
              </li>
            </ul>
            <p className="text-sm text-slate-600 leading-relaxed mt-3">
              These third parties have their own privacy and cookie policies. We encourage you to review them.
            </p>
          </section>

          {/* Section 4 */}
          <section>
            <h2 className="text-lg font-black text-slate-900 mb-2">4. How Long Do Cookies Last?</h2>
            <div className="overflow-x-auto">
              <table className="w-full text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-100 text-slate-700">
                    <th className="text-left p-3 rounded-tl-lg font-black">Cookie Type</th>
                    <th className="text-left p-3 font-black">Duration</th>
                    <th className="text-left p-3 rounded-tr-lg font-black">Purpose</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  <tr>
                    <td className="p-3 text-slate-700">Session cookies</td>
                    <td className="p-3 text-slate-600">Until browser closes</td>
                    <td className="p-3 text-slate-600">Authentication state</td>
                  </tr>
                  <tr>
                    <td className="p-3 text-slate-700">Persistent cookies</td>
                    <td className="p-3 text-slate-600">Up to 1 year</td>
                    <td className="p-3 text-slate-600">Preferences, saved settings</td>
                  </tr>
                  <tr>
                    <td className="p-3 text-slate-700">Local storage</td>
                    <td className="p-3 text-slate-600">Until cleared</td>
                    <td className="p-3 text-slate-600">UI preferences, cache</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </section>

          {/* Section 5 */}
          <section>
            <h2 className="text-lg font-black text-slate-900 mb-2">5. Managing Cookies</h2>
            <p className="text-sm text-slate-600 leading-relaxed">
              You can control and manage cookies through your browser settings. Most browsers allow you to:
            </p>
            <ul className="mt-3 space-y-1.5 text-sm text-slate-600 list-disc list-inside">
              <li>View cookies stored on your device</li>
              <li>Delete cookies individually or all at once</li>
              <li>Block cookies from specific websites</li>
              <li>Block all third-party cookies</li>
              <li>Clear cookies when you close the browser</li>
            </ul>
            <p className="text-sm text-slate-600 leading-relaxed mt-3">
              Please note that disabling strictly necessary cookies may prevent some features of ShowMePrice.ng
              from working correctly, including the ability to sign in and use escrow services.
            </p>
          </section>

          {/* Section 6 */}
          <section>
            <h2 className="text-lg font-black text-slate-900 mb-2">6. Your Consent</h2>
            <p className="text-sm text-slate-600 leading-relaxed">
              By continuing to use ShowMePrice.ng, you consent to our use of cookies as described in this
              policy. If you do not consent, please adjust your browser settings or discontinue use of the
              platform.
            </p>
            <p className="text-sm text-slate-600 leading-relaxed mt-3">
              We comply with the Nigeria Data Protection Act 2023 (NDPA) and applicable international
              standards regarding user data and tracking.
            </p>
          </section>

          {/* Section 7 */}
          <section>
            <h2 className="text-lg font-black text-slate-900 mb-2">7. Changes to This Policy</h2>
            <p className="text-sm text-slate-600 leading-relaxed">
              We may update this Cookie Policy from time to time. Changes will be posted on this page with an
              updated effective date. For material changes, we will notify registered users via email or an
              in-app notification.
            </p>
          </section>

          {/* Section 8 */}
          <section>
            <h2 className="text-lg font-black text-slate-900 mb-2">8. Contact Us</h2>
            <p className="text-sm text-slate-600 leading-relaxed">
              If you have any questions about our use of cookies, please contact us:
            </p>
            <div className="mt-3 rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm space-y-1">
              <div>
                <span className="font-bold text-slate-700">Email: </span>
                <a href="mailto:support@showmeprice.ng" className="text-emerald-700 hover:underline">
                  support@showmeprice.ng
                </a>
              </div>
              <div>
                <span className="font-bold text-slate-700">Address: </span>
                <span className="text-slate-600">ShowMePrice.ng, Lagos, Nigeria</span>
              </div>
            </div>
          </section>

          <div className="border-t border-slate-100 pt-4 flex flex-wrap gap-4 text-xs text-slate-400">
            <button
              type="button"
              onClick={() => smpNavigate("/privacy")}
              className="hover:text-slate-700 hover:underline"
            >
              Privacy Policy
            </button>
            <button
              type="button"
              onClick={() => smpNavigate("/terms")}
              className="hover:text-slate-700 hover:underline"
            >
              Terms of Service
            </button>
            <button
              type="button"
              onClick={() => smpNavigate("/")}
              className="hover:text-slate-700 hover:underline"
            >
              Back to Home
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
