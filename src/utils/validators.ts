// ──────────────────────────────────────────────────────────────
// Email
// ──────────────────────────────────────────────────────────────
export const validateEmail = (email: string): boolean => {
  const re = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
  return re.test(email.trim());
};

// ──────────────────────────────────────────────────────────────
// CPF — algoritmo oficial de dígitos verificadores
// ──────────────────────────────────────────────────────────────
export const validateCPF = (cpf: string): boolean => {
  const raw = cpf.replace(/\D/g, '');
  if (raw.length !== 11) return false;
  if (/^(\d)\1{10}$/.test(raw)) return false; // repeated digits

  let sum = 0;
  for (let i = 0; i < 9; i++) sum += parseInt(raw[i]) * (10 - i);
  let remainder = (sum * 10) % 11;
  if (remainder === 10 || remainder === 11) remainder = 0;
  if (remainder !== parseInt(raw[9])) return false;

  sum = 0;
  for (let i = 0; i < 10; i++) sum += parseInt(raw[i]) * (11 - i);
  remainder = (sum * 10) % 11;
  if (remainder === 10 || remainder === 11) remainder = 0;
  return remainder === parseInt(raw[10]);
};

// ──────────────────────────────────────────────────────────────
// Phone — Brazilian format (10 or 11 digits)
// ──────────────────────────────────────────────────────────────
export const validatePhone = (phone: string): boolean => {
  const raw = phone.replace(/\D/g, '');
  return raw.length === 10 || raw.length === 11;
};

// ──────────────────────────────────────────────────────────────
// Password Strength
// ──────────────────────────────────────────────────────────────
export type PasswordStrengthLevel = 'empty' | 'weak' | 'fair' | 'good' | 'strong';

export interface PasswordStrength {
  score: number; // 0–4
  level: PasswordStrengthLevel;
  label: string;
  color: string;
  width: string;
  tips: string[];
}

export const getPasswordStrength = (password: string): PasswordStrength => {
  if (!password) {
    return { score: 0, level: 'empty', label: '', color: 'transparent', width: '0%', tips: [] };
  }

  let score = 0;
  const tips: string[] = [];

  if (password.length >= 8) score++; else tips.push('Use ao menos 8 caracteres');
  if (password.length >= 12) score++;
  if (/[A-Z]/.test(password)) score++; else tips.push('Adicione letras maiúsculas');
  if (/[0-9]/.test(password)) score++; else tips.push('Inclua números');
  if (/[^A-Za-z0-9]/.test(password)) score++; else tips.push('Use símbolos (!, @, #...)');
  if (/[a-z]/.test(password)) score++;

  // Normalize to 0-4
  const normalized = Math.min(4, Math.floor(score * 4 / 6));

  const levels: Array<{ level: PasswordStrengthLevel; label: string; color: string; width: string }> = [
    { level: 'weak',   label: 'Muito fraca', color: '#ef4444', width: '25%'  },
    { level: 'fair',   label: 'Fraca',       color: '#f59e0b', width: '50%'  },
    { level: 'good',   label: 'Boa',         color: '#3b82f6', width: '75%'  },
    { level: 'strong', label: 'Forte',       color: '#10b981', width: '100%' },
  ];

  const entry = levels[Math.max(0, normalized - 1)] || levels[0];

  return {
    score: normalized,
    level: entry.level,
    label: entry.label,
    color: entry.color,
    width: entry.width,
    tips,
  };
};

export const validatePassword = (password: string): { valid: boolean; message: string } => {
  if (!password) return { valid: false, message: 'Senha obrigatória' };
  if (password.length < 8) return { valid: false, message: 'Mínimo de 8 caracteres' };
  if (!/[A-Za-z]/.test(password)) return { valid: false, message: 'Inclua letras na senha' };
  if (!/[0-9]/.test(password)) return { valid: false, message: 'Inclua números na senha' };
  return { valid: true, message: '' };
};

// ──────────────────────────────────────────────────────────────
// Name
// ──────────────────────────────────────────────────────────────
export const validateName = (name: string): boolean => {
  return name.trim().split(' ').length >= 2 && name.trim().length >= 4;
};
