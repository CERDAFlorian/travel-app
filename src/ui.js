// Fragments de style partagés par les sections de la page.

export const card = {
  background: '#fdf6e9',
  border: '1.5px solid #e0caa2',
  borderRadius: 14
};

export const serif = "'Playfair Display', Georgia, serif";

export const sectionTitle = {
  margin: 0,
  fontFamily: serif,
  fontWeight: 600,
  letterSpacing: '.05em',
  textTransform: 'uppercase',
  color: '#8f1d24'
};

export const input = {
  padding: '4px 8px',
  border: '1px solid #ddc59b',
  borderRadius: 7,
  background: '#fffdf7',
  fontSize: 'clamp(12.5px, 1.25vw, 15px)'
};

export const priceInput = {
  textAlign: 'right',
  padding: '3px 7px',
  border: '1px solid #ddc59b',
  borderRadius: 7,
  background: '#fffdf7',
  fontSize: 'clamp(12px, 1.25vw, 15px)',
  fontStyle: 'italic',
  color: '#8f1d24'
};

export const button = {
  cursor: 'pointer',
  border: '1px solid #c9a86a',
  borderRadius: 7,
  padding: '4px 13px',
  background: '#f6e3c4',
  color: '#8f1d24',
  fontSize: 'clamp(12.5px, 1.25vw, 15px)',
  whiteSpace: 'nowrap'
};

export const pill = {
  border: '1px solid #d0b177',
  borderRadius: 999,
  padding: '5px 13px',
  background: '#fdf6e9',
  fontSize: 'clamp(11px, 1.15vw, 14px)',
  letterSpacing: '.09em',
  textTransform: 'uppercase',
  color: '#7a2027'
};

export const dashedRule = {
  height: 1,
  background: 'repeating-linear-gradient(90deg, #d6b783 0 5px, transparent 5px 10px)'
};

export const eyebrow = {
  fontSize: 'clamp(10.5px, 1.1vw, 13px)',
  letterSpacing: '.12em',
  textTransform: 'uppercase',
  color: '#a08050'
};

export const hint = {
  fontSize: 'clamp(11.5px, 1.2vw, 14.5px)',
  fontStyle: 'italic',
  color: '#8a6c47'
};

export const PAGE_X = 'clamp(16px, 3vw, 44px)';
