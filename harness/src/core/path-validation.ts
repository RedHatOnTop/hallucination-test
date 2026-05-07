const VALID_NAME_PATTERN = /^[a-z0-9]+(-[a-z0-9]+)*$/;

export function isValidPathComponent(name: string): boolean {
  return VALID_NAME_PATTERN.test(name);
}

export function validatePathComponent(name: string, label: string): { valid: boolean; error?: string } {
  if (!name || name.length === 0) {
    return { valid: false, error: `${label} cannot be empty` };
  }
  if (!VALID_NAME_PATTERN.test(name)) {
    return {
      valid: false,
      error: `${label} must contain only lowercase alphanumeric characters and hyphens (no leading, trailing, or consecutive hyphens). Got: "${name}"`,
    };
  }
  return { valid: true };
}

export function buildResultPath(provider: string, modelName: string): { path: string; valid: boolean; errors: string[] } {
  const errors: string[] = [];

  const providerResult = validatePathComponent(provider, 'Provider');
  if (!providerResult.valid) errors.push(providerResult.error!);

  const modelResult = validatePathComponent(modelName, 'Model');
  if (!modelResult.valid) errors.push(modelResult.error!);

  if (errors.length > 0) {
    return { path: '', valid: false, errors };
  }

  return {
    path: `results/${provider}/${modelName}`,
    valid: true,
    errors: [],
  };
}
