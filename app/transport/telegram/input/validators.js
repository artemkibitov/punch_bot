export function requiredText(text) {
  if (!text || !text.trim()) {
    return 'Введите непустой текст';
  }
}

export function maxLength(max) {
  return (text) => {
    if (text.length > max) {
      return `Максимум ${max} символов`;
    }
  };
}

export function runValidators(text, validators = []) {
  for (const v of validators) {
    const error = v(text);
    if (error) return error;
  }
}
