import handImage from '@/assets/about/hand-holding-iphone.png';

interface IPhoneMockupProps {
  videoSrc: string;
}

const IPhoneMockup = ({ videoSrc }: IPhoneMockupProps) => {
  return (
    <div className="relative mx-auto" style={{ width: '220px' }}>
      {/* Hand holding iPhone */}
      <img
        src={handImage}
        alt=""
        className="relative z-10 w-full pointer-events-none select-none"
        draggable={false}
      />
      {/* Video overlaid on the phone screen */}
      <video
        src={videoSrc}
        autoPlay
        loop
        muted
        playsInline
        className="absolute z-0 object-cover"
        style={{
          top: '13.5%',
          left: '19%',
          width: '62%',
          height: '46%',
          borderRadius: '12px',
        }}
      />
    </div>
  );
};

export default IPhoneMockup;
