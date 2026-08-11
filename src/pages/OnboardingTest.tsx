import OnboardingCarousel from "@/components/OnboardingCarousel";

export default function OnboardingTest() {
  return (
    <div className="fixed inset-0 bg-primary">
      <OnboardingCarousel open onComplete={() => {}} />
    </div>
  );
}
