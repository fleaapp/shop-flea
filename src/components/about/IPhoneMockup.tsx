interface IPhoneMockupProps {
  videoSrc: string;
}

const IPhoneMockup = ({ videoSrc }: IPhoneMockupProps) => {
  return (
    <div className="relative mx-auto" style={{ width: '220px' }}>
      {/* Outer iPhone shell */}
      <div
        className="relative bg-[#1a1a1a] shadow-[0_20px_60px_rgba(0,0,0,0.3)]"
        style={{ borderRadius: '40px', padding: '9px' }}
      >
        {/* Side button — power */}
        <div className="absolute -right-[2px] top-[95px] w-[3px] h-[32px] bg-[#2a2a2a] rounded-r-sm" />
        {/* Side buttons — volume */}
        <div className="absolute -left-[2px] top-[78px] w-[3px] h-[22px] bg-[#2a2a2a] rounded-l-sm" />
        <div className="absolute -left-[2px] top-[108px] w-[3px] h-[22px] bg-[#2a2a2a] rounded-l-sm" />
        {/* Silent switch */}
        <div className="absolute -left-[2px] top-[55px] w-[3px] h-[13px] bg-[#2a2a2a] rounded-l-sm" />

        {/* Dynamic Island */}
        <div className="absolute top-[14px] left-1/2 -translate-x-1/2 w-[78px] h-[24px] bg-[#0a0a0a] rounded-full z-30" />

        {/* Screen area */}
        <div
          className="relative overflow-hidden bg-black"
          style={{ borderRadius: '31px', aspectRatio: '9 / 19.5' }}
        >
          <video
            src={videoSrc}
            autoPlay
            loop
            muted
            playsInline
            className="absolute inset-0 w-full h-full object-cover"
          />
        </div>

        {/* Home indicator */}
        <div className="absolute bottom-[8px] left-1/2 -translate-x-1/2 w-[94px] h-[4px] bg-white/20 rounded-full z-30" />
      </div>
    </div>
  );
};

export default IPhoneMockup;
