import { ImageResponse } from 'next/server';

export const contentType = 'image/png';
export const size = {
  width: 32,
  height: 32
};

export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          display: 'flex',
          width: '100%',
          height: '100%',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: 18,
          background: '#111111',
          color: '#ffffff',
          borderRadius: '50%'
        }}
      >
        L
      </div>
    ),
    size
  );
}
