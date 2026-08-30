import React, { ReactNode } from 'react'

interface Gradient_header_props{
    title : string;
    subtitle? : string;
    children? : ReactNode;

}

function Gradient_header({title, subtitle, children} : Gradient_header_props )  {
  return (
    <div className='relative overflow-hidden rounded-2xl bg-linear-to-r from-blue-500 to-purple-500 p-8 text-white mb-8'>
        <div className='relative z-10'>
            <h1 className='text-4xl font-bold'>{title}</h1>
            {subtitle && <p className='mt-2 text-lg text-blue-100 mb-5'>{subtitle}</p> }
            {children}
        </div>
    </div>
  )
}

export default Gradient_header