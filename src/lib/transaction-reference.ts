export const extractReferenceFromNotes = (notes?: string | null): string | null => {
  if (!notes) return null;
  const match = notes.match(/REF#(\d{8})/i);
  return match?.[1] ?? null;
};

export const generateFallbackReferenceFromId = (id: string): string => {
  const normalizedId = id.replace(/-/g, '').slice(0, 8);
  const numericValue = Number.parseInt(normalizedId || '0', 16);
  return (numericValue % 100_000_000).toString().padStart(8, '0');
};

export const getTransactionReference = ({
  id,
  notes,
}: {
  id: string;
  notes?: string | null;
}): string => {
  return extractReferenceFromNotes(notes) ?? generateFallbackReferenceFromId(id);
};

export const stripReferencePrefix = (notes?: string | null): string => {
  if (!notes) return '';
  return notes.replace(/REF#\d{8}\s*-\s*/i, '').trim();
};

export const normalizeReferenceSearchTerm = (value: string): string => {
  return value.trim().toUpperCase().replace(/^REF#/, '');
};

export const formatReferenceForNotes = (reference: string, details?: string | null): string => {
  const trimmedDetails = details?.trim();
  return trimmedDetails ? `REF#${reference} - ${trimmedDetails}` : `REF#${reference}`;
};
