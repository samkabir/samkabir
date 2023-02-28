import React from 'react';

const Loading = () => {
    return (
        <div>
            <div className='flex justify-center items-center h-[300px] md:h-[600px]'>
                <div className="item">
                    <img src="/images/Logo.png" width={75} />
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