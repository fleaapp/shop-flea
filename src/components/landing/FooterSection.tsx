import { motion, AnimatePresence } from "framer-motion";
import { Mail, Loader2, Check } from "lucide-react";
import { Link } from "react-router-dom";
import { useState, FormEvent } from "react";
import { supabase } from "@/integrations/supabase/client";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

const FooterSection = () => {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [website, setWebsite] = useState(""); // honeypot
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    const trimmedName = name.trim();
    const trimmedEmail = email.trim();
    const trimmedMessage = message.trim();

    if (!trimmedName) return setErrorMsg("Please enter your name.");
    if (!EMAIL_RE.test(trimmedEmail)) return setErrorMsg("Please enter a valid email address.");
    if (!trimmedMessage) return setErrorMsg("Please enter a message.");

    setStatus("loading");
    try {
      const { data, error } = await supabase.functions.invoke("contact-form-submit", {
        body: {
          name: trimmedName,
          email: trimmedEmail,
          message: trimmedMessage,
          website, // honeypot
        },
      });
      if (error) throw error;
      if (data && (data as any).error) throw new Error((data as any).error);

      setStatus("success");
      setName("");
      setEmail("");
      setMessage("");
      setTimeout(() => setStatus("idle"), 4000);
    } catch (err) {
      setStatus("error");
      setErrorMsg(err instanceof Error ? err.message : "Something went wrong. Please try again.");
    }
  };

  return (
    <footer className="bg-navy px-6 pt-16 pb-8 md:pt-20 md:pb-10">
      <div className="container mx-auto max-w-xl text-center">
        <motion.h2
          className="text-2xl md:text-4xl font-black text-mint uppercase tracking-wider mb-2"
          initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.5 }}
        >
          FIND IT ON
        </motion.h2>
        <motion.p className="text-mint/70 text-base md:text-lg mb-8" initial={{ opacity: 0 }} whileInView={{ opacity: 1 }} viewport={{ once: true }} transition={{ delay: 0.1, duration: 0.5 }}>
          Start Swiping
        </motion.p>

        <motion.div className="flex flex-col justify-center items-center gap-3 mb-10" initial={{ opacity: 0, y: 10 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: 0.2, duration: 0.4 }}>
          <div className="flex flex-col items-center gap-1.5">
            <button
              type="button"
              disabled
              aria-label="Download Flea — coming May"
              className="flex items-center justify-center gap-2 bg-mint/30 rounded-xl w-[170px] py-3.5 cursor-not-allowed pointer-events-none"
            >
              <p className="text-mint/60 text-xs font-bold uppercase tracking-wide">📲 Download Flea</p>
            </button>
            <p className="text-mint/50 text-[10px] font-semibold uppercase tracking-wide">Coming May</p>
          </div>

          <div className="flex flex-row justify-center items-start gap-3">
            <div className="flex flex-col items-center gap-1.5">
              <button
                type="button"
                disabled
                aria-label="Apple App Store — coming May"
                className="flex items-center justify-center gap-1.5 bg-mint/30 rounded-xl w-[135px] py-3 cursor-not-allowed"
              >
                <svg viewBox="0 0 24 24" className="w-5 h-5 text-mint/60 shrink-0" fill="currentColor"><path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.8-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z" /></svg>
                <p className="text-mint/60 text-[11px] font-bold uppercase tracking-wide whitespace-nowrap">App Store</p>
              </button>
              <p className="text-mint/50 text-[10px] font-semibold uppercase tracking-wide">Coming May</p>
            </div>
            <div className="flex flex-col items-center gap-1.5">
              <button
                type="button"
                disabled
                aria-label="Google Play — coming May"
                className="flex items-center justify-center gap-1.5 bg-mint/30 rounded-xl w-[135px] py-3 cursor-not-allowed"
              >
                <svg viewBox="0 0 24 24" className="w-5 h-5 text-mint/60 shrink-0" fill="currentColor"><path d="M3.609 1.814L13.792 12 3.61 22.186a.996.996 0 01-.61-.92V2.734a1 1 0 01.609-.92zm10.89 10.893l2.302 2.302-10.937 6.333 8.635-8.635zm3.199-3.199l2.302 2.302a1 1 0 010 1.38l-2.302 2.302L15.396 13l2.302-2.492zM5.864 2.658L16.8 9.99l-2.302 2.302L5.864 3.658z" /></svg>
                <p className="text-mint/60 text-[11px] font-bold uppercase tracking-wide whitespace-nowrap">Google Play</p>
              </button>
              <p className="text-mint/50 text-[10px] font-semibold uppercase tracking-wide">Coming May</p>
            </div>
          </div>
        </motion.div>

        {/* Contact Us */}
        <motion.div
          className="mb-10 flex flex-col items-center"
          initial={{ opacity: 0 }} whileInView={{ opacity: 1 }} viewport={{ once: true }} transition={{ delay: 0.3, duration: 0.4 }}
        >
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            aria-expanded={open}
            aria-controls="footer-contact-form"
            className="inline-flex items-center justify-center gap-2 bg-mint text-navy rounded-xl w-[170px] py-3.5 hover:opacity-90 transition-opacity"
          >
            <Mail className="w-4 h-4" />
            <span className="text-xs font-bold uppercase tracking-wide">Contact Us</span>
          </button>

          <AnimatePresence initial={false}>
            {open && (
              <motion.div
                id="footer-contact-form"
                key="contact-form"
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.3, ease: "easeOut" }}
                className="w-full max-w-md overflow-hidden"
              >
                <form
                  onSubmit={handleSubmit}
                  className="mt-5 flex flex-col gap-3 rounded-2xl bg-mint/10 border border-mint/20 p-5 text-left"
                  noValidate
                >
                  {/* Honeypot (hidden from real users) */}
                  <input
                    type="text"
                    name="website"
                    value={website}
                    onChange={(e) => setWebsite(e.target.value)}
                    autoComplete="off"
                    tabIndex={-1}
                    aria-hidden="true"
                    className="hidden"
                  />

                  <label className="flex flex-col gap-1.5">
                    <span className="text-mint/70 text-[11px] font-semibold uppercase tracking-wide">Name</span>
                    <input
                      type="text"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      maxLength={100}
                      required
                      disabled={status === "loading"}
                      className="rounded-lg bg-navy/40 border border-mint/20 px-3 py-2.5 text-mint text-sm placeholder-mint/30 focus:outline-none focus:border-mint focus:ring-2 focus:ring-mint/20 transition-colors"
                      placeholder="Your name"
                    />
                  </label>

                  <label className="flex flex-col gap-1.5">
                    <span className="text-mint/70 text-[11px] font-semibold uppercase tracking-wide">Email</span>
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      maxLength={255}
                      required
                      disabled={status === "loading"}
                      className="rounded-lg bg-navy/40 border border-mint/20 px-3 py-2.5 text-mint text-sm placeholder-mint/30 focus:outline-none focus:border-mint focus:ring-2 focus:ring-mint/20 transition-colors"
                      placeholder="you@example.com"
                    />
                  </label>

                  <label className="flex flex-col gap-1.5">
                    <span className="text-mint/70 text-[11px] font-semibold uppercase tracking-wide">Message</span>
                    <textarea
                      value={message}
                      onChange={(e) => setMessage(e.target.value)}
                      maxLength={5000}
                      required
                      disabled={status === "loading"}
                      rows={4}
                      className="rounded-lg bg-navy/40 border border-mint/20 px-3 py-2.5 text-mint text-sm placeholder-mint/30 focus:outline-none focus:border-mint focus:ring-2 focus:ring-mint/20 transition-colors resize-none"
                      placeholder="How can we help?"
                    />
                  </label>

                  {errorMsg && (
                    <p className="text-[12px] text-red-400 text-center">{errorMsg}</p>
                  )}

                  <button
                    type="submit"
                    disabled={status === "loading" || status === "success"}
                    className="mt-1 inline-flex items-center justify-center gap-2 bg-mint text-navy rounded-xl py-3 hover:opacity-90 transition-opacity disabled:opacity-60 disabled:cursor-not-allowed"
                  >
                    {status === "loading" && <Loader2 className="w-4 h-4 animate-spin" />}
                    {status === "success" && <Check className="w-4 h-4" />}
                    <span className="text-xs font-bold uppercase tracking-wide">
                      {status === "loading"
                        ? "Sending..."
                        : status === "success"
                        ? "Message sent."
                        : "Send Message"}
                    </span>
                  </button>

                  {status === "success" && (
                    <p className="text-[12px] text-mint/70 text-center">
                      Thanks — we'll get back to you soon.
                    </p>
                  )}
                </form>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>

        <div className="flex flex-col items-center gap-2">
          <div className="flex gap-4 text-mint/50 text-xs">
            <Link to="/terms" className="hover:text-mint transition-colors">Terms &amp; Conditions</Link>
            <span>·</span>
            <Link to="/privacy" className="hover:text-mint transition-colors">Privacy Policy</Link>
          </div>
          <p className="text-mint/30 text-xs">© {new Date().getFullYear()} Flea. All rights reserved.</p>
        </div>
      </div>
    </footer>
  );
};

export default FooterSection;
