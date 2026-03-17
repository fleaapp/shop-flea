interface IPhoneMockupProps {
  videoSrc: string;
}

const IPhoneMockup = ({ videoSrc }: IPhoneMockupProps) => {
  return (
    <div className="relative mx-auto" style={{ width: '280px' }}>
      {/* Outer iPhone shell */}
      <div
        className="relative bg-[#1a1a1a] shadow-[0_20px_60px_rgba(0,0,0,0.3)]"
        style={{ borderRadius: '50px', padding: '12px' }}
      >
        {/* Side button — power */}
        <div className="absolute -right-[2px] top-[120px] w-[3px] h-[40px] bg-[#2a2a2a] rounded-r-sm" />
        {/* Side buttons — volume */}
        <div className="absolute -left-[2px] top-[100px] w-[3px] h-[28px] bg-[#2a2a2a] rounded-l-sm" />
        <div className="absolute -left-[2px] top-[138px] w-[3px] h-[28px] bg-[#2a2a2a] rounded-l-sm" />
        {/* Silent switch */}
        <div className="absolute -left-[2px] top-[70px] w-[3px] h-[16px] bg-[#2a2a2a] rounded-l-sm" />

        {/* Dynamic Island */}
        <div className="absolute top-[18px] left-1/2 -translate-x-1/2 w-[100px] h-[30px] bg-[#0a0a0a] rounded-full z-30" />

        {/* Screen area */}
        <div
          className="relative overflow-hidden bg-black"
          style={{ borderRadius: '38px', aspectRatio: '9 / 19.5' }}
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
        <div className="absolute bottom-[10px] left-1/2 -translate-x-1/2 w-[120px] h-[5px] bg-white/20 rounded-full z-30" />
      </div>
    </div>
  );
};

export default IPhoneMockup;
