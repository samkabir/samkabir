import Image from 'next/image';

const Loading = () => {
    return (
        <div>
            <div className='flex justify-center items-center h-[300px] md:h-[600px]'>
                <div className="item">
                    <Image
                        src="/images/Logo.png"
                        alt="Loading logo"
                        width={342}
                        height={262}
                        style={{ width: '75px', height: 'auto' }}
                    />
                </div>
                <div className="circle" style={{animationDelay: '0s'}} ></div>
                <div className="circle" style={{animationDelay: '1s'}}></div>
                <div className="circle" style={{animationDelay: '2s'}}></div>
                <div className="circle" style={{animationDelay: '3s'}}></div>
            </div>
        </div>
    );
};

export default Loading;
