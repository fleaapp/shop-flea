import { useEffect, useMemo, useState } from "react";
import { z } from "zod";
import { Check, ChevronsUpDown, Loader2 } from "lucide-react";
import { supabase } from "@/lib/supabase";
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

type Country = { code: string; name: string };

const schema = z.object({
  first_name: z.string().trim().min(1, "First name is required").max(60),
  last_name: z.string().trim().min(1, "Last name is required").max(60),
  email: z.string().trim().email("Enter a valid email").max(255),
  country_code: z.string().min(2, "Select your country").max(2),
});

const inputCls =
  "w-full h-12 rounded-xl bg-[hsl(var(--flea-navy))] border border-[hsl(var(--flea-mint))]/30 px-4 text-[hsl(var(--flea-mint))] placeholder:text-[hsl(var(--flea-mint))]/50 outline-none transition-all focus:border-[hsl(var(--flea-mint))] focus:ring-2 focus:ring-[hsl(var(--flea-mint))]/40 hover:border-[hsl(var(--flea-mint))]/60";

const WaitlistSignupSection = () => {
  const [countries, setCountries] = useState<Country[]>([]);
  const [first, setFirst] = useState("");
  const [last, setLast] = useState("");
  const [email, setEmail] = useState("");
  const [country, setCountry] = useState<string>("");
  const [openCountry, setOpenCountry] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    supabase
      .from("countries")
      .select("code,name")
      .order("name", { ascending: true })
      .then(({ data }) => {
        if (data) setCountries(data as Country[]);
      });
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
        if (insertError.code === "23505") {
          setError("This email is already on the waitlist.");
        } else {
          setError("Something went wrong. Please try again.");
        }
        setSubmitting(false);
        return;
      }
      setSuccess(true);
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <section className="w-full bg-[hsl(var(--flea-navy))] text-[hsl(var(--flea-mint))] py-14 md:py-20 px-5">
      <div className="mx-auto max-w-xl text-center">
        <h2 className="text-3xl md:text-5xl font-extrabold tracking-tight uppercase leading-tight whitespace-pre-line">
          {"GET 2 MONTHS\nFREE LISTINGS"}
        </h2>
        <p className="mt-3 md:mt-4 text-[hsl(var(--flea-mint))]/80 text-base md:text-lg">
          <span className="block md:inline text-center">Sign up to be notified for</span>{" "}
          <span className="block md:inline text-center">when we launch.</span>
        </p>

        {success ? (
          <div className="mt-8 rounded-2xl border border-[hsl(var(--flea-mint))]/40 bg-[hsl(var(--flea-mint))]/10 p-6 animate-in fade-in zoom-in-95 duration-300">
            <div className="text-2xl">🎉</div>
            <h3 className="mt-2 text-xl font-bold">You're on the list!</h3>
            <p className="mt-1 text-sm text-[hsl(var(--flea-mint))]/80">
              We'll email you the moment Flea launches.
            </p>
          </div>
        ) : (
          <form onSubmit={onSubmit} className="mt-8 grid grid-cols-1 sm:grid-cols-2 gap-3 text-left">
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
              className={cn(inputCls, "sm:col-span-2")}
              type="email"
              placeholder="Email address"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
              required
            />

            <div className="sm:col-span-2">
              <Popover open={openCountry} onOpenChange={setOpenCountry}>
                <PopoverTrigger asChild>
                  <button
                    type="button"
                    className={cn(inputCls, "flex items-center justify-between text-left")}
                  >
                    <span className={cn(!selectedCountryName && "text-[hsl(var(--flea-mint))]/50")}>
                      {selectedCountryName || "Select country"}
                    </span>
                    <ChevronsUpDown className="h-4 w-4 opacity-70" />
                  </button>
                </PopoverTrigger>
                <PopoverContent
                  className="p-0 w-[--radix-popover-trigger-width] !bg-[hsl(var(--flea-navy))] border-[hsl(var(--flea-mint))]/30 text-[hsl(var(--flea-mint))] z-[60] shadow-xl"
                  align="start"
                  style={{ backgroundColor: "hsl(var(--flea-navy))" }}
                >
                  <Command className="bg-transparent text-[hsl(var(--flea-mint))]">
                    <CommandInput
                      placeholder="Search country..."
                      className="text-[hsl(var(--flea-mint))] placeholder:text-[hsl(var(--flea-mint))]/50"
                    />
                    <CommandList className="max-h-64">
                      <CommandEmpty>No country found.</CommandEmpty>
                      <CommandGroup>
                        {countries.map((c) => (
                          <CommandItem
                            key={c.code}
                            value={c.name}
                            onSelect={() => {
                              setCountry(c.code);
                              setOpenCountry(false);
                            }}
                            className="aria-selected:bg-[hsl(var(--flea-mint))]/15 aria-selected:text-[hsl(var(--flea-mint))]"
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
              <p className="sm:col-span-2 text-sm text-red-300">{error}</p>
            )}

            <button
              type="submit"
              disabled={submitting}
              className="sm:col-span-2 mt-1 h-12 rounded-xl bg-[hsl(var(--flea-mint))] text-[hsl(var(--flea-navy))] font-bold uppercase tracking-wide transition-all hover:brightness-95 active:scale-[0.99] disabled:opacity-70 disabled:cursor-not-allowed flex items-center justify-center gap-2"
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
      </div>
    </section>
  );
};

export default WaitlistSignupSection;
