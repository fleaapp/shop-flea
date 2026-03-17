interface IPhoneMockupProps {
  videoSrc: string;
}

const IPhoneMockup = ({ videoSrc }: IPhoneMockupProps) => {
  return (
    <div className="relative mx-auto" style={{ width: '260px' }}>
      {/* iPhone frame */}
      <div className="relative rounded-[40px] border-[6px] border-[#1a1a1a] bg-[#1a1a1a] shadow-2xl overflow-hidden">
        {/* Notch / Dynamic Island */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[90px] h-[28px] bg-[#1a1a1a] rounded-b-2xl z-20" />
        
        {/* Screen */}
        <div className="relative rounded-[34px] overflow-hidden bg-black">
          <video
            src={videoSrc}
            autoPlay
            loop
            muted
            playsInline
            className="w-full h-auto block"
          />
        </div>
        
        {/* Bottom bar indicator */}
        <div className="absolute bottom-2 left-1/2 -translate-x-1/2 w-[100px] h-[4px] bg-white/30 rounded-full z-20" />
      </div>
    </div>
  );
};

export default IPhoneMockup;
