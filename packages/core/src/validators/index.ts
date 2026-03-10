// Ported from RAPID_CORE CORE_Validation_API.gs

export function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
}

export function isValidPhone(phone: string): boolean {
  const digits = phone.replace(/\D/g, '')
  return digits.length === 10
}

export function isValidNPI(npi: string): boolean {
  if (!/^\d{10}$/.test(npi)) return false
  // Luhn check
  const digits = npi.split('').map(Number)
  let sum = 24 // Prefix for NPI
  for (let i = digits.length - 2; i >= 0; i--) {
    let d = digits[i]
    if ((digits.length - 1 - i) % 2 === 0) {
      d *= 2
      if (d > 9) d -= 9
    }
    sum += d
  }
  return (sum + digits[digits.length - 1]) % 10 === 0
}

export function isValidZip(zip: string): boolean {
  return /^\d{5}(-\d{4})?$/.test(zip)
}

export function isValidSSNLast4(ssn: string): boolean {
  return /^\d{4}$/.test(ssn)
}
