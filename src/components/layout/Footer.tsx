// src/components/layout/Footer.tsx
import React from "react";
import { Facebook, Instagram, Twitter, Linkedin, Youtube, Music2 } from "lucide-react";

function nav(to: string) {
  try {
    if (window.location.pathname !== to) window.history.pushState({}, "", to);
    window.dispatchEvent(new Event("smp:navigate"));
  } catch {
    window.location.href = to;
  }
}

export default function Footer() {
  const year = new Date().getFullYear();
  const footerBrand = "/footer-brand.png";

  const SOCIALS = [
    { name: "Facebook", href: "https://www.facebook.com/showmeprice_ng", Icon: Facebook },
    { name: "Instagram", href: "https://www.instagram.com/showmeprice_ng/", Icon: Instagram },
    { name: "X (Twitter)", href: "https://x.com/showmeprice_ng", Icon: Twitter },
    { name: "LinkedIn", href: "https://www.linkedin.com/company/showmeprice-ng/", Icon: Linkedin },
    { name: "YouTube", href: "https://www.youtube.com/@showmeprice_ng", Icon: Youtube },
    { name: "TikTok", href: "https://www.tiktok.com/@showmeprice_ng", Icon: Music2 },
  ] as const;

  return (
    <footer className="bg-slate-900 text-white mt-14 border-t border-slate-700">
      <div className="container mx-auto px-4 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {/* Brand */}
          <div className="lg:col-span-5">
            <div className="pl-3 sm:pl-4">
              <div className="flex items-center mb-3">
                <img
                  src={footerBrand}
                  alt="ShowMePrice.ng"
                  className="h-[56px] sm:h-[64px] md:h-[72px] w-auto object-contain"
                />
              </div>

              <div className="text-slate-200 text-sm font-extrabold mb-2">
                Nigeria Marketplace for Transparent Pricing
              </div>

              <p className="text-slate-300 text-xs leading-relaxed max-w-md">
                Nigeria's marketplace for transparent pricing and verified listings—built to help buyers compare
                confidently and connect with trusted sellers.
              </p>

              <div className="mt-4">
                <div className="text-[11px] font-extrabold tracking-wider text-brand uppercase leading-tight">
                  Verified prices <span className="text-brand/60">•</span> Trusted sellers{" "}
                  <span className="text-brand/60">•</span> Safer shopping
                </div>

                <div className="flex flex-wrap gap-2 mt-3">
                  {SOCIALS.map(({ name, href, Icon }) => (
                    <a
                      key={name}
                      href={href}
                      target="_blank"
                      rel="noreferrer noopener"
                      className="bg-slate-800/80 p-2 rounded-lg hover:bg-slate-700 transition"
                      aria-label={name}
                      title={name}
                    >
                      <Icon className="w-4 h-4 text-slate-200" />
                    </a>
                  ))}
                </div>

                <div className="mt-3 text-xs text-slate-400">
                  Follow: <span className="text-slate-200 font-semibold">@showmeprice_ng</span>
                </div>
              </div>
            </div>
          </div>

          {/* Links */}
          <div className="lg:col-span-7">
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-8">

              {/* Quick Links */}
              <div className="text-left">
                <h4 className="font-black text-sm mb-3 uppercase tracking-wider">Quick Links</h4>
                <ul className="space-y-2 text-slate-300 text-xs">
                  <li>
                    <a href="/" className="hover:text-white hover:underline">Home</a>
                  </li>
                  <li>
                    <button
                      type="button"
                      onClick={() => nav("/help")}
                      className="hover:text-white hover:underline text-left"
                    >
                      How It Works
                    </button>
                  </li>
                  <li>
                    <button
                      type="button"
                      onClick={() => nav("/seller/setup")}
                      className="hover:text-white hover:underline text-left"
                    >
                      Sell on ShowMePrice
                    </button>
                  </li>
                  <li>
                    <button
                      type="button"
                      onClick={() => nav("/marketplace")}
                      className="hover:text-white hover:underline text-left"
                    >
                      Browse Listings
                    </button>
                  </li>
                </ul>
              </div>

              {/* For Buyers */}
              <div className="text-left">
                <h4 className="font-black text-sm mb-3 uppercase tracking-wider">For Buyers</h4>
                <ul className="space-y-2 text-slate-300 text-xs">
                  <li>
                    <a href="/" className="hover:text-white hover:underline">Search Products</a>
                  </li>
                  <li>
                    <button
                      type="button"
                      onClick={() => nav("/marketplace")}
                      className="hover:text-white hover:underline text-left"
                    >
                      Browse Categories
                    </button>
                  </li>
                  <li>
                    <button
                      type="button"
                      onClick={() => nav("/deals")}
                      className="hover:text-white hover:underline text-left"
                    >
                      Deals
                    </button>
                  </li>
                  <li>
                    <button
                      type="button"
                      onClick={() => nav("/delivery")}
                      className="hover:text-white hover:underline text-left"
                    >
                      Delivery Info
                    </button>
                  </li>
                  <li>
                    <button
                      type="button"
                      onClick={() => nav("/escrow")}
                      className="hover:text-white hover:underline text-left"
                    >
                      Escrow Protection
                    </button>
                  </li>
                </ul>
              </div>

              {/* For Sellers */}
              <div className="text-left">
                <h4 className="font-black text-sm mb-3 uppercase tracking-wider">For Sellers</h4>
                <ul className="space-y-2 text-slate-300 text-xs">
                  <li>
                    <button
                      type="button"
                      onClick={() => nav("/seller/setup")}
                      className="hover:text-white hover:underline text-left"
                    >
                      Seller Registration
                    </button>
                  </li>
                  <li>
                    <button
                      type="button"
                      onClick={() => nav("/account/verification")}
                      className="hover:text-white hover:underline text-left"
                    >
                      Verification Guide
                    </button>
                  </li>
                  <li>
                    <a href="/#pricing" className="hover:text-white hover:underline">
                      Pricing &amp; Fees
                    </a>
                  </li>
                  <li>
                    <button
                      type="button"
                      onClick={() => nav("/help")}
                      className="hover:text-white hover:underline text-left"
                    >
                      Seller Protection
                    </button>
                  </li>
                </ul>
              </div>

              {/* Help & Legal */}
              <div className="text-left">
                <h4 className="font-black text-sm mb-3 uppercase tracking-wider">Help &amp; Legal</h4>
                <ul className="space-y-2 text-slate-300 text-xs">
                  <li>
                    <button
                      type="button"
                      onClick={() => nav("/help")}
                      className="hover:text-white hover:underline text-left"
                    >
                      Help Center / FAQ
                    </button>
                  </li>
                  <li>
                    <a
                      href="mailto:support@showmeprice.ng"
                      className="hover:text-white hover:underline"
                    >
                      Contact Us
                    </a>
                  </li>
                  <li>
                    <button
                      type="button"
                      onClick={() => nav("/terms")}
                      className="hover:text-white hover:underline text-left"
                    >
                      Terms of Service
                    </button>
                  </li>
                  <li>
                    <button
                      type="button"
                      onClick={() => nav("/privacy")}
                      className="hover:text-white hover:underline text-left"
                    >
                      Privacy Policy
                    </button>
                  </li>
                  <li>
                    <button
                      type="button"
                      onClick={() => nav("/cookies")}
                      className="hover:text-white hover:underline text-left"
                    >
                      Cookie Policy
                    </button>
                  </li>
                </ul>
              </div>

            </div>
          </div>
        </div>

        <div className="border-t border-slate-800 mt-6 pt-4 text-center text-slate-400 text-xs">
          <p>&copy; {year} ShowMePrice.ng. All rights reserved.</p>
          <p className="mt-2">
            Need help?{" "}
            <a href="mailto:support@showmeprice.ng" className="text-brand font-bold underline">
              support@showmeprice.ng
            </a>{" "}
            |{" "}
            <a href="tel:+2348000000000" className="text-brand font-bold underline">
              +234 800 000 0000
            </a>
          </p>
        </div>
      </div>
    </footer>
  );
}
