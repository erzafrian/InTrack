/** Present the supplied artwork through a viewport; keep its pixels and colors intact. */
export default function Brand({ variant = 'default' }) {
  if (variant === 'login') {
    return (
      <svg className="brand-login" viewBox="150 218 955 825" role="img" aria-label="InTrack">
        <image href="/brand/intrack-logo.png" width="1254" height="1254" />
      </svg>
    );
  }

  return (
    <span className="brand">
      <svg className="brand-mark" viewBox="335 218 555 600" role="img" aria-label={variant === 'mark' ? 'InTrack' : undefined} aria-hidden={variant !== 'mark'}>
        <image href="/brand/intrack-logo.png" width="1254" height="1254" />
      </svg>
      {variant !== 'mark' && <span className="brand-name">InTrack</span>}
    </span>
  );
}
