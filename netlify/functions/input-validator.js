/**
 * INPUT VALIDATION & SANITIZATION
 * 
 * Server-side validation for all user inputs
 */

const ALLOWED_FILE_TYPES = [
  'application/pdf',
  'image/jpeg',
  'image/jpg',
  'image/png'
];

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

const VALID_CLAIM_TYPES = [
  'property_homeowners',
  'property_renters',
  'auto_collision',
  'auto_comprehensive',
  'health_medical',
  'health_prescription'
];

const VALID_PARTY_TYPES = ['first_party', 'third_party'];
const VALID_CLAIM_CONTEXTS = ['personal', 'commercial'];
const VALID_CLAIM_AMOUNTS = ['under_5k', '5k_to_25k', '25k_to_50k', 'over_50k'];

function validateFileUpload(file) {
  const errors = [];

  if (!file) {
    errors.push('File is required');
    return { valid: false, errors };
  }

  if (!ALLOWED_FILE_TYPES.includes(file.type)) {
    errors.push('Invalid file type. Only PDF, JPG, and PNG are allowed.');
  }

  if (file.size > MAX_FILE_SIZE) {
    errors.push('File size exceeds 10MB limit.');
  }

  return {
    valid: errors.length === 0,
    errors
  };
}

function validateClassification(classification) {
  const errors = [];

  if (!classification) {
    errors.push('Classification is required');
    return { valid: false, errors };
  }

  if (!VALID_CLAIM_TYPES.includes(classification.claimType)) {
    errors.push('Invalid claim type');
  }

  if (!VALID_PARTY_TYPES.includes(classification.partyType)) {
    errors.push('Invalid party type');
  }

  if (!VALID_CLAIM_CONTEXTS.includes(classification.claimContext)) {
    errors.push('Invalid claim context');
  }

  if (!VALID_CLAIM_AMOUNTS.includes(classification.claimAmount)) {
    errors.push('Invalid claim amount');
  }

  return {
    valid: errors.length === 0,
    errors
  };
}

function sanitizeText(text) {
  if (!text || typeof text !== 'string') {
    return '';
  }

  return text
    .replace(/<script[^>]*>.*?<\/script>/gi, '')
    .replace(/<[^>]+>/g, '')
    .replace(/javascript:/gi, '')
    .trim();
}

function validateEmail(email) {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

function validateUserId(userId) {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  return uuidRegex.test(userId);
}

module.exports = {
  validateFileUpload,
  validateClassification,
  sanitizeText,
  validateEmail,
  validateUserId,
  ALLOWED_FILE_TYPES,
  MAX_FILE_SIZE
};
