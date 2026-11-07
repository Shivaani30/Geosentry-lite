import React from 'react';
import { FiCrosshair, FiMapPin, FiShield } from 'react-icons/fi';
import { Brand } from './UI';

export default function AuthLayout({ children }) {
  return <main className="auth-layout"><section className="auth-story" aria-label="About GeoSentry"><Brand /><div className="auth-story-content"><p className="eyebrow">A CLEARER VIEW. A SAFER WORLD.</p><h1>Stay connected.<br />Stay a step ahead.</h1><p>Smart location awareness. Safer decisions.</p><div className="location-art" aria-hidden="true"><div className="art-grid" /><div className="art-road road-one" /><div className="art-road road-two" /><div className="art-zone"><span className="art-pin"><FiMapPin /></span></div><span className="art-label"><FiShield /> Awareness, in every direction</span><span className="art-coordinate"><FiCrosshair /> YOUR WORLD, IN VIEW</span></div><div className="auth-benefits"><span><FiMapPin /> Location visibility</span><span><FiShield /> Geofence awareness</span></div></div><p className="auth-footnote">GeoSentry · Location monitoring workspace</p></section><section className="auth-form-side"><div className="auth-mobile-brand"><Brand /></div><div className="auth-form-card">{children}</div><p className="auth-form-footer"><FiShield aria-hidden="true" /> Built for informed decisions.</p></section></main>;
}
