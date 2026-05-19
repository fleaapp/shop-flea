import { useEffect, useMemo, useState } from "react";
import { z } from "zod";
import { Check, ChevronsUpDown, Loader2, X } from "lucide-react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import fleaLogo from "@/assets/flea-landing/flea-logo-v2.webp";
import { cn } from "@/lib/utils";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";

import { COUNTRIES, type Country } from "@/data/countries";

const schema = z.object({
  first_name: z.string().trim().min(1, "First name is required").max(60),
  last_name: z.string().trim().min(1, "Last name is required").max(60),
  email: z.string().trim().email("Enter a valid email").max(255),
  country_code: z.string().min(2, "Select your country").max(2),
});

const STORAGE_KEY = "flea_waitlist_popup_shown";
const DELAY_MS = 10000;

const inputCls =
  "w-full h-11 rounded-xl bg-background border border-[hsl(var(--flea-navy))]/25 px-3 text-foreground text-sm placeholder:text-muted-foreground outline-none transition-all focus:border-[hsl(var(--flea-navy))] focus:ring-2 focus:ring-[hsl(var(--flea-navy))]/30";

const WaitlistPopup = () => {
  const [open, setOpen] = useState(false);
  const countries = COUNTRIES;
  const [first, setFirst] = useState("");
  const [last, setLast] = useState("");
  const [email, setEmail] = useState("");
  const [country, setCountry] = useState<string>("");
  const [openCountry, setOpenCountry] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (sessionStorage.getItem(STORAGE_KEY)) return;
    const t = setTimeout(() => {
      setOpen(true);
      sessionStorage.setItem(STORAGE_KEY, "1");
    }, DELAY_MS);
    return () => clearTimeout(t);
  }, []);


  const selectedCountryName = useMemo(
    () => countries.find((c) => c.code === country)?.name ?? "",
    [countries, country],
  );

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const parsed = schema.safeParse({
      first_name: first,
      last_name: last,
      email,
      country_code: country,
    });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Please check your details");
      return;
    }
    setSubmitting(true);
    try {
      const { error: insertError } = await supabase.from("waitlist").insert({
        first_name: parsed.data.first_name,
        last_name: parsed.data.last_name,
        email: parsed.data.email.toLowerCase(),
        country_code: parsed.data.country_code,
      });
      if (insertError) {
        console.error("[waitlist-popup] insert failed", insertError);
        if (insertError.code === "23505") {
          setError("This email is already on the waitlist.");
        } else {
          setError(insertError.message || "Something went wrong. Please try again.");
        }
        setSubmitting(false);
        return;
      }
      setSuccess(true);
    } catch (err) {
      console.error("[waitlist-popup] submit threw", err);
      setError("Something went wrong. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent
        className="w-[90vw] max-w-sm rounded-3xl border-[3px] border-[hsl(var(--flea-navy))] bg-card p-5 text-foreground"
        hideCloseButton
      >
        <button
          type="button"
          onClick={() => setOpen(false)}
          aria-label="Close"
          className="absolute right-3 top-3 rounded-full p-1 text-muted-foreground hover:text-foreground"
        >
          <X className="h-4 w-4" />
        </button>

        <div className="flex flex-col items-center text-center pt-4 pb-2">
          <img src={fleaLogo} alt="Flea" className="h-14 w-auto object-contain" width={155} height={56} decoding="async" />
          <h2 className="mt-8 text-lg font-extrabold uppercase tracking-tight text-[hsl(var(--flea-navy))] whitespace-nowrap">
            GET 2 MONTHS FREE LISTINGS
          </h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Sign up to be notified when we launch.
          </p>
        </div>

        {success ? (
          <div className="mt-4 rounded-2xl border border-[hsl(var(--flea-navy))]/25 bg-background p-5 text-center">
            <div className="text-2xl">🎉</div>
            <h3 className="mt-1 text-base font-bold text-[hsl(var(--flea-navy))]">You're on the list!</h3>
            <p className="mt-1 text-xs text-muted-foreground">
              We'll email you the moment Flea launches.
            </p>
          </div>
        ) : (
          <form onSubmit={onSubmit} className="mt-4 grid grid-cols-2 gap-2 text-left">
            <input
              className={inputCls}
              placeholder="First name"
              value={first}
              onChange={(e) => setFirst(e.target.value)}
              autoComplete="given-name"
              required
            />
            <input
              className={inputCls}
              placeholder="Last name"
              value={last}
              onChange={(e) => setLast(e.target.value)}
              autoComplete="family-name"
              required
            />
            <input
              className={cn(inputCls, "col-span-2")}
              type="email"
              placeholder="Email address"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
              required
            />

            <div className="col-span-2">
              <Popover open={openCountry} onOpenChange={setOpenCountry}>
                <PopoverTrigger asChild>
                  <button
                    type="button"
                    className={cn(inputCls, "flex items-center justify-between text-left")}
                  >
                    <span className={cn(!selectedCountryName && "text-muted-foreground")}>
                      {selectedCountryName || "Select country"}
                    </span>
                    <ChevronsUpDown className="h-4 w-4 opacity-70" />
                  </button>
                </PopoverTrigger>
                <PopoverContent
                  className="p-0 w-[--radix-popover-trigger-width] border-[hsl(var(--flea-navy))]/25 z-[80] shadow-xl"
                  align="start"
                  style={{ backgroundColor: "hsl(var(--card))" }}
                >
                  <Command className="bg-transparent">
                    <CommandInput
                      placeholder="Search country..."
                      className="text-[hsl(var(--flea-navy))] placeholder:text-[hsl(var(--flea-navy))]/50"
                    />
                    <CommandList className="max-h-56">
                      <CommandEmpty className="py-3 text-sm text-[hsl(var(--flea-navy))]/60">No country found.</CommandEmpty>
                      <CommandGroup>
                        {countries.map((c) => (
                          <CommandItem
                            key={c.code}
                            value={c.name}
                            onSelect={() => {
                              setCountry(c.code);
                              setOpenCountry(false);
                            }}
                            className="text-[hsl(var(--flea-navy))] data-[selected=true]:bg-[hsl(var(--flea-navy))]/10 data-[selected=true]:text-[hsl(var(--flea-navy))]"
                          >
                            <Check
                              className={cn(
                                "mr-2 h-4 w-4",
                                country === c.code ? "opacity-100" : "opacity-0",
                              )}
                            />
                            {c.name}
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
            </div>

            {error && (
              <p className="col-span-2 text-xs text-destructive">{error}</p>
            )}

            <button
              type="submit"
              disabled={submitting}
              className="col-span-2 mt-1 h-11 rounded-full bg-[hsl(var(--flea-navy))] text-[hsl(var(--flea-mint))] font-bold uppercase tracking-wide transition-all hover:brightness-110 active:scale-[0.99] disabled:opacity-70 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {submitting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" /> Signing up...
                </>
              ) : (
                "Notify me"
              )}
            </button>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default WaitlistPopup;
