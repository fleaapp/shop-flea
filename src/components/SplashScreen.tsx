import { useState, useEffect, useRef } from 'react';

interface SplashScreenProps {
  onComplete: () => void;
}

const SplashScreen = ({ onComplete }: SplashScreenProps) => {
  const [fadeOut, setFadeOut] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const handleEnded = () => {
      setFadeOut(true);
      setTimeout(onComplete, 600);
    };

    video.addEventListener('ended', handleEnded);

    // Fallback timeout in case video doesn't fire ended
    const fallback = setTimeout(() => {
      setFadeOut(true);
      setTimeout(onComplete, 600);
    }, 8000);

    return () => {
      video.removeEventListener('ended', handleEnded);
      clearTimeout(fallback);
    };
  }, [onComplete]);

  return (
    <div
      className={`fixed inset-0 z-[9999] bg-background flex items-center justify-center transition-opacity duration-500 ${
        fadeOut ? 'opacity-0 pointer-events-none' : 'opacity-100'
      }`}
    >
      <video
        ref={videoRef}
        autoPlay
        muted
        playsInline
        className="w-full h-full object-cover"
        src="/splash-screen.mov"
      />
    </div>
  );
};

export default SplashScreen;
